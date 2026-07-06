import { test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { memoryDb } from "../store/db";
import { formatMinor, reserve } from "./reservation";

let db: Database;
const T0 = 1_000_000;
const WS = "ws1";
const TERM = "P260678997653";

beforeEach(() => {
  db = memoryDb();
  db.query(
    "INSERT INTO terminal (id,workspace,terminal_serial,nuban,account_name,bank_name,created_at) VALUES (?,?,?,?,?,?,?)",
  ).run("t1", WS, TERM, "5012345678", "ACME LTD", "Moniepoint MFB", T0);
});

test("two orders on one terminal get DISTINCT unique amounts", () => {
  const a = reserve({ db, now: T0 }, WS, "o1", TERM, 1_400_000);
  const b = reserve({ db, now: T0 }, WS, "o2", TERM, 1_400_000);
  expect(a.amountMinor).toBe(1_400_000);
  expect(b.amountMinor).toBe(1_400_001);
  expect(a.nuban).toBe("5012345678");
  expect(a.bankName).toBe("Moniepoint MFB");
});

test("re-reserving the same order is idempotent", () => {
  const a = reserve({ db, now: T0 }, WS, "o1", TERM, 1_400_000);
  const again = reserve({ db, now: T0 + 5000 }, WS, "o1", TERM, 1_400_000);
  expect(again.amountMinor).toBe(a.amountMinor);
  expect(again.reference).toBe(a.reference);
});

test("an expired reservation frees its amount slot", () => {
  const a = reserve({ db, now: T0, ttlMs: 1000 }, WS, "o1", TERM, 1_400_000);
  expect(a.amountMinor).toBe(1_400_000);
  const b = reserve({ db, now: T0 + 2000 }, WS, "o2", TERM, 1_400_000); // o1 window has passed
  expect(b.amountMinor).toBe(1_400_000);
});

test("unknown terminal throws", () => {
  expect(() => reserve({ db, now: T0 }, WS, "o1", "NOPE", 1000)).toThrow();
});

test("formatMinor renders naira with thousands separators", () => {
  expect(formatMinor(1_400_037)).toBe("14,000.37");
  expect(formatMinor(50)).toBe("0.50");
  expect(formatMinor(100_000_000)).toBe("1,000,000.00");
});
