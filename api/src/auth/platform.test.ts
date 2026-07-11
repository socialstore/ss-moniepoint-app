process.env.MONIEPOINT_APP_KEY ??= "test-app-key";

import { test, expect, beforeAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { memoryDb, setDb } from "../store/db";
import { app } from "../app";
import { setMoniepointClient } from "../moniepoint/client";
import { makeTestKeys, signProvision, signSession } from "./testsign";
import { _setPlatformKey, verifyProvision, verifySession } from "./platform";

let keys: Awaited<ReturnType<typeof makeTestKeys>>;

beforeAll(async () => {
  keys = await makeTestKeys();
  // Moniepoint client is stubbed so /connect never reaches the network.
  setMoniepointClient({
    createWebhookSubscription: async () => ({ subscriptionId: "sub_test", secret: "whsec_test" }),
    deleteWebhookSubscription: async () => {},
  });
});

let db: Database;
beforeEach(() => {
  db = memoryDb();
  setDb(db);
  _setPlatformKey(keys.publicKeyPem); // inject the platform public key PEM (no env needed)
});

const H = { "content-type": "application/json" };
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
function req(path: string, init?: RequestInit) {
  return app.fetch(new Request("http://app" + path, init));
}

test("session/provision verification fails closed when no platform key is configured", async () => {
  _setPlatformKey(null); // simulate missing PLATFORM_JWT_PUBLIC_KEY
  const saved = Bun.env.PLATFORM_JWT_PUBLIC_KEY;
  delete Bun.env.PLATFORM_JWT_PUBLIC_KEY; // a dev .env may auto-load a key; clear it so "not configured" is real
  try {
    const tok = await signSession(keys.privateKey, "A");
    await expect(verifySession(tok)).rejects.toThrow(/PLATFORM_JWT_PUBLIC_KEY is not set/);
  } finally {
    if (saved !== undefined) Bun.env.PLATFORM_JWT_PUBLIC_KEY = saved;
  }
});

test("a session token is rejected as a provision token, and vice-versa (purpose is bound)", async () => {
  const sess = await signSession(keys.privateKey, "A");
  const prov = await signProvision(keys.privateKey, "A");
  await expect(verifyProvision(db, sess)).rejects.toThrow(/purpose is not 'provision'/);
  await expect(verifySession(prov)).rejects.toThrow(/purpose is not 'session'/);
});

test("a token minted for another app (wrong aud) is rejected", async () => {
  const tok = await signSession(keys.privateKey, "A", { aud: "some-other-app" });
  await expect(verifySession(tok)).rejects.toThrow();
});

test("provision tokens are one-time: a replayed jti is refused", async () => {
  const tok = await signProvision(keys.privateKey, "A", { jti: "fixed-jti" });
  const first = await verifyProvision(db, tok);
  expect(first.workspace).toBe("A");
  await expect(verifyProvision(db, tok)).rejects.toThrow(/already used/);
});

test("/provision stores the key for the token's workspace — body can't override it", async () => {
  const tok = await signProvision(keys.privateKey, "workspace-real");
  const res = await req("/install/provision", {
    method: "POST",
    headers: { ...H, ...bearer(tok) },
    // note: no workspace field is even read; the claim decides
    body: JSON.stringify({ apiKey: "sk_live_x", workspace: "workspace-attacker" }),
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, workspace: "workspace-real" });

  const row = db.query<{ n: number }, [string]>("SELECT count(*) n FROM install WHERE workspace = ?").get("workspace-real");
  expect(row!.n).toBe(1);
  const attacker = db.query<{ n: number }, [string]>("SELECT count(*) n FROM install WHERE workspace = ?").get("workspace-attacker");
  expect(attacker!.n).toBe(0);
});

test("session-gated routes reject a missing/garbage token with 401", async () => {
  expect((await req("/admin/config")).status).toBe(401);
  expect((await req("/admin/config", { headers: bearer("not-a-jwt") })).status).toBe(401);
  expect((await req("/checkout/orders/o1/status", { headers: bearer("not-a-jwt") })).status).toBe(401);
});

test("connect + reserve are scoped to the session token's workspace (not the body)", async () => {
  // provision A, then connect A over a session token
  await req("/install/provision", { method: "POST", headers: { ...H, ...bearer(await signProvision(keys.privateKey, "A")) }, body: JSON.stringify({ apiKey: "sk_A" }) });
  const sessA = await signSession(keys.privateKey, "A");
  const connect = await req("/install/connect", {
    method: "POST",
    headers: { ...H, ...bearer(sessA) },
    body: JSON.stringify({ businessId: "42", moniepointApiToken: "t", webhookUrl: "https://x/webhook", terminals: [{ terminalSerial: "T-A", nuban: "5001", accountName: "A LTD" }] }),
  });
  expect(connect.status).toBe(200);
  expect(await connect.json()).toMatchObject({ workspace: "A", added: 1, webhookSetup: { ok: true } });

  // reserve with A's token lands under A
  const reserve = await req("/checkout/orders/order-1/reserve", { method: "POST", headers: { ...H, ...bearer(sessA) }, body: JSON.stringify({ terminalSerial: "T-A", amountMinor: 500_000 }) });
  expect(reserve.status).toBe(200);
  const owner = db.query<{ workspace: string }, [string]>("SELECT workspace FROM reservation WHERE order_id = ?").get("order-1");
  expect(owner!.workspace).toBe("A");
});

test("/uninstall purges the workspace and deletes the Moniepoint subscription", async () => {
  // provision + connect A (registers a terminal + subscription)
  await req("/install/provision", { method: "POST", headers: { ...H, ...bearer(await signProvision(keys.privateKey, "A")) }, body: JSON.stringify({ apiKey: "sk_A" }) });
  await req("/install/connect", { method: "POST", headers: { ...H, ...bearer(await signSession(keys.privateKey, "A")) }, body: JSON.stringify({ moniepointApiToken: "t", webhookUrl: "https://x/webhook", terminals: [{ terminalSerial: "T-A", nuban: "5001" }] }) });
  expect(db.query("SELECT count(*) n FROM install WHERE workspace='A'").get()).toMatchObject({ n: 1 });
  expect(db.query("SELECT count(*) n FROM terminal WHERE workspace='A'").get()).toMatchObject({ n: 1 });

  const res = await req("/install/uninstall", { method: "POST", headers: { ...H, ...bearer(await signProvision(keys.privateKey, "A")) }, body: "{}" });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, workspace: "A", subscriptionDeleted: true });
  expect(db.query("SELECT count(*) n FROM install WHERE workspace='A'").get()).toMatchObject({ n: 0 });
  expect(db.query("SELECT count(*) n FROM terminal WHERE workspace='A'").get()).toMatchObject({ n: 0 });
});
