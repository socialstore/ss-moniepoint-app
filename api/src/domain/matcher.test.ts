import { test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { memoryDb } from "../store/db";
import { reserve } from "./reservation";
import { reconcile } from "./matcher";
import { listUnmapped } from "./suspense";
import { normalizeWebhook, type MoniepointWebhook } from "../moniepoint/types";
import type { MarkOrderPaidArgs, SentralbeeClient } from "../sentralbee/client";

let db: Database;
const T0 = 1_000_000;
const WS = "ws1";
const TERM = "P260678997653";

function fakeClient() {
  const calls: MarkOrderPaidArgs[] = [];
  const client: SentralbeeClient = {
    async markOrderPaid(a) {
      calls.push(a);
    },
  };
  return { calls, client };
}

function webhook(over: Partial<MoniepointWebhook>): MoniepointWebhook {
  return {
    transactionReference: "TXN1",
    terminalSerial: TERM,
    businessId: "42",
    amount: 14000,
    transactionStatus: "APPROVED",
    merchantReference: "",
    ...over,
  };
}

beforeEach(() => {
  db = memoryDb();
  db.query("INSERT INTO terminal (id,workspace,terminal_serial,nuban,bank_name,created_at) VALUES (?,?,?,?,?,?)").run(
    "t1",
    WS,
    TERM,
    "5012345678",
    "Moniepoint MFB",
    T0,
  );
  db.query("INSERT INTO install (workspace,business_id,created_at) VALUES (?,?,?)").run(WS, "42", T0);
});

test("APPROVED, reference-LESS transfer with a unique amount reconciles + marks paid exactly once", async () => {
  const intent = reserve({ db, now: T0 }, WS, "order-1", TERM, 1_400_000); // ₦14,000.00
  const { calls, client } = fakeClient();
  const t = normalizeWebhook(webhook({ amount: intent.amountMinor / 100, merchantReference: "" }), T0 + 1000);

  const out = await reconcile(db, t, client, WS);
  expect(out.kind).toBe("reconciled");
  expect(calls.length).toBe(1);
  expect(calls[0]!.orderId).toBe("order-1");
  expect(calls[0]!.reference).toBe("TXN1"); // idempotency key = moniepoint txn id

  // webhook redelivery is a no-op
  const out2 = await reconcile(db, t, client, WS);
  expect(out2.kind).toBe("duplicate");
  expect(calls.length).toBe(1);
});

test("PENDING does not pay; the later APPROVED (same txn) reconciles + clears suspense", async () => {
  const intent = reserve({ db, now: T0 }, WS, "order-2", TERM, 1_400_000);
  const { calls, client } = fakeClient();

  const pend = normalizeWebhook(webhook({ transactionStatus: "PENDING", amount: intent.amountMinor / 100 }), T0 + 500);
  expect((await reconcile(db, pend, client, WS)).kind).toBe("pending");
  expect(calls.length).toBe(0);
  expect(listUnmapped(db, WS).length).toBe(1); // parked in suspense

  const appr = normalizeWebhook(webhook({ transactionStatus: "APPROVED", amount: intent.amountMinor / 100 }), T0 + 1000);
  expect((await reconcile(db, appr, client, WS)).kind).toBe("reconciled");
  expect(calls.length).toBe(1);
  expect(listUnmapped(db, WS).length).toBe(0); // suspense row resolved
});

test("no amount match lands in the suspense ledger, no payment", async () => {
  reserve({ db, now: T0 }, WS, "order-3", TERM, 1_400_000);
  const { calls, client } = fakeClient();
  const t = normalizeWebhook(webhook({ amount: 99.99, transactionReference: "TXN-X" }), T0 + 1000);

  const out = await reconcile(db, t, client, WS);
  expect(out).toEqual({ kind: "unmapped", reason: "no_match" });
  expect(calls.length).toBe(0);
  expect(listUnmapped(db, WS).length).toBe(1);
});

test("two open reservations at the same amount => ambiguous => suspense, no payment", async () => {
  // force a collision by reserving the same order id twice would be idempotent; instead seed two
  // open reservations at the identical amount directly.
  reserve({ db, now: T0 }, WS, "order-a", TERM, 1_400_000); // 1_400_000
  db.query(
    "INSERT INTO reservation (id,workspace,order_id,terminal_serial,amount_minor,currency,reference,status,expires_at,matched_txn_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
  ).run("dup", WS, "order-b", TERM, 1_400_000, "NGN", "ref", "open", T0 + 9_000_000, null, T0);
  const { calls, client } = fakeClient();
  const t = normalizeWebhook(webhook({ amount: 14000, transactionReference: "TXN-AMB" }), T0 + 1000);

  const out = await reconcile(db, t, client, WS);
  expect(out).toEqual({ kind: "unmapped", reason: "ambiguous" });
  expect(calls.length).toBe(0);
});
