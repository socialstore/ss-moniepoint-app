process.env.MONIEPOINT_APP_KEY ??= "test-app-key";

import { test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { memoryDb } from "../store/db";
import { reserve } from "./reservation";
import { reconcile } from "./matcher";
import { listUnmapped } from "./suspense";
import { normalizeWebhook } from "../moniepoint/types";
import { TerminalOwnedByOtherWorkspace, upsertTerminal } from "../store/repo";
import type { MarkOrderPaidArgs, SentralbeeClient } from "../sentralbee/client";

const T0 = 1_000_000;

function fakeClient() {
  const calls: MarkOrderPaidArgs[] = [];
  const client: SentralbeeClient = {
    async markOrderPaid(a) {
      calls.push(a);
    },
  };
  return { calls, client };
}

let db: Database;
beforeEach(() => {
  db = memoryDb();
});

test("a terminal serial cannot be registered by two workspaces (no squatting / silent overwrite)", () => {
  upsertTerminal(db, { workspace: "A", terminalSerial: "T1", nuban: "50001", accountName: null, now: T0 });
  expect(() =>
    upsertTerminal(db, { workspace: "B", terminalSerial: "T1", nuban: "50002", accountName: null, now: T0 }),
  ).toThrow(TerminalOwnedByOtherWorkspace);

  const rows = db
    .query<{ workspace: string; nuban: string }, []>("SELECT workspace, nuban FROM terminal WHERE terminal_serial='T1'")
    .all();
  expect(rows.length).toBe(1);
  expect(rows[0]!.workspace).toBe("A"); // A's terminal is untouched
  expect(rows[0]!.nuban).toBe("50001");
});

test("reconcile scoped to workspace B can NEVER credit workspace A's reservation", async () => {
  upsertTerminal(db, { workspace: "A", terminalSerial: "T-A", nuban: "50001", accountName: null, now: T0 });
  const intent = reserve({ db, now: T0 }, "A", "order-A", "T-A", 1_400_000);
  const { calls, client } = fakeClient();

  // An APPROVED transfer for A's terminal at the exact amount, but reconciled under the WRONG tenant B.
  const t = normalizeWebhook(
    { transactionReference: "TXN-X", terminalSerial: "T-A", businessId: "42", amount: intent.amountMinor / 100, transactionStatus: "APPROVED" },
    T0 + 1000,
  );
  const out = await reconcile(db, t, client, "B");

  expect(out.kind).toBe("unmapped"); // A's reservation is invisible to B
  expect(calls.length).toBe(0); // nothing paid
  expect(listUnmapped(db, "B").length).toBe(1); // parked in B's suspense
  expect(listUnmapped(db, "A").length).toBe(0); // A's ledger untouched
});

test("the same provider txn id in two tenants does not collide (per-tenant idempotency)", async () => {
  upsertTerminal(db, { workspace: "A", terminalSerial: "T-A", nuban: "50001", accountName: null, now: T0 });
  upsertTerminal(db, { workspace: "B", terminalSerial: "T-B", nuban: "50002", accountName: null, now: T0 });
  const { client } = fakeClient();

  // identical txn id, different tenants — must produce two independent suspense rows, not a collision.
  const mk = (serial: string) =>
    normalizeWebhook(
      { transactionReference: "DUP", terminalSerial: serial, amount: 500, transactionStatus: "APPROVED" },
      T0 + 1,
    );
  await reconcile(db, mk("T-A"), client, "A");
  await reconcile(db, mk("T-B"), client, "B");

  expect(listUnmapped(db, "A").length).toBe(1);
  expect(listUnmapped(db, "B").length).toBe(1);
});
