import { test, expect } from "bun:test";
import { memoryDb, setDb } from "../store/db";
import { app } from "../app";
import { encryptSecret } from "../lib/cypher";

const TERM = "P260678997653";
const WS = "ws1";

async function seed(): Promise<void> {
  const db = memoryDb();
  db.query("INSERT INTO terminal (id,workspace,terminal_serial,nuban,bank_name,created_at) VALUES (?,?,?,?,?,?)").run(
    "t1",
    WS,
    TERM,
    "5012345678",
    "Moniepoint MFB",
    Date.now(),
  );
  db.query(
    "INSERT INTO install (workspace,business_id,webhook_secret_enc,sentralbee_key_enc,created_at) VALUES (?,?,?,?,?)",
  ).run(WS, "42", await encryptSecret("whsec"), await encryptSecret("sk_app"), Date.now());
  setDb(db);
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return app.fetch(
    new Request("http://x/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

test("unknown terminal => 404", async () => {
  await seed();
  const res = await post({ transactionReference: "T", terminalSerial: "NOPE", amount: 1, transactionStatus: "APPROVED" });
  expect(res.status).toBe(404);
});

test("known terminal, missing signature => 401 (fail closed — nothing gets paid)", async () => {
  await seed();
  const res = await post({
    transactionReference: "T",
    terminalSerial: TERM,
    businessId: "42",
    amount: 100,
    transactionStatus: "APPROVED",
  });
  expect(res.status).toBe(401);
});

test("health check", async () => {
  const res = await app.fetch(new Request("http://x/health"));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: "ok", app: "ss-moniepoint-app" });
});
