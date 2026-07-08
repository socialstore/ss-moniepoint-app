process.env.MONIEPOINT_APP_KEY ??= "test-app-key";

import { test, expect, beforeAll, beforeEach } from "bun:test";
import { memoryDb, setDb, getDb } from "../store/db";
import { app } from "../app";
import { setMoniepointClient } from "../moniepoint/client";
import { makeTestKeys, signProvision, signSession } from "../auth/testsign";
import { _setPlatformKey } from "../auth/platform";
import { importSPKI, type KeyLike } from "jose";

let keys: Awaited<ReturnType<typeof makeTestKeys>>;
let pubKey: KeyLike;

beforeAll(async () => {
  keys = await makeTestKeys();
  pubKey = await importSPKI(keys.publicKeyPem, "EdDSA");
  setMoniepointClient({
    createWebhookSubscription: async () => ({ subscriptionId: "sub", secret: "whsec" }),
    deleteWebhookSubscription: async () => {},
  });
});

beforeEach(() => {
  setDb(memoryDb());
  _setPlatformKey(pubKey);
});

const H = { "content-type": "application/json" };
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
const req = (path: string, init?: RequestInit) => app.fetch(new Request("http://app" + path, init));

async function installWithTerminal(ws: string, nuban = "5012345678") {
  await req("/install/provision", {
    method: "POST",
    headers: { ...H, ...bearer(await signProvision(keys.privateKey, ws)) },
    body: JSON.stringify({ apiKey: "sk_" + ws }),
  });
  await req("/install/connect", {
    method: "POST",
    headers: { ...H, ...bearer(await signSession(keys.privateKey, ws)) },
    body: JSON.stringify({
      moniepointApiToken: "t",
      webhookUrl: "https://x/webhook",
      terminals: [{ terminalSerial: "T-" + ws, nuban, accountName: "ACME LTD" }],
    }),
  });
}

test("POST /checkout/sessions creates a session and returns a hosted pay-page URL (session-authed)", async () => {
  await installWithTerminal("A");
  const res = await req("/checkout/sessions", {
    method: "POST",
    headers: { ...H, ...bearer(await signSession(keys.privateKey, "A")) },
    body: JSON.stringify({ orderId: "order-1", amountMinor: 1_400_000 }),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { sessionId: string; redirectUrl: string; amountMinor: number };
  expect(body.sessionId).toBeTruthy();
  expect(body.redirectUrl).toBe(`/pay/${body.sessionId}`); // PUBLIC base unset in tests → relative
  expect(body.amountMinor).toBe(1_400_000); // first offset, no collision
});

test("the hosted pay page is ANONYMOUS and shows the bank details for that reservation only", async () => {
  await installWithTerminal("A", "9988776655");
  const create = await req("/checkout/sessions", {
    method: "POST",
    headers: { ...H, ...bearer(await signSession(keys.privateKey, "A")) },
    body: JSON.stringify({ orderId: "order-9", amountMinor: 500_000 }),
  });
  const { sessionId } = (await create.json()) as { sessionId: string };

  // No auth header — the unguessable id is the bearer.
  const page = await req(`/pay/${sessionId}`);
  expect(page.status).toBe(200);
  expect(page.headers.get("content-type")).toContain("text/html");
  const html = await page.text();
  expect(html).toContain("9988776655"); // the terminal NUBAN
  expect(html).toContain("5,000.00"); // the amount to transfer

  const status = await req(`/pay/${sessionId}/status`);
  expect(status.status).toBe(200);
  expect(await status.json()).toMatchObject({ status: "waiting" });
});

test("pay status flips to 'paid' once the reservation is matched", async () => {
  await installWithTerminal("A");
  const create = await req("/checkout/sessions", {
    method: "POST",
    headers: { ...H, ...bearer(await signSession(keys.privateKey, "A")) },
    body: JSON.stringify({ orderId: "order-2", amountMinor: 250_000 }),
  });
  const { sessionId } = (await create.json()) as { sessionId: string };

  getDb().query("UPDATE reservation SET status='matched', matched_txn_id='TXN-1' WHERE id=?").run(sessionId);

  expect(await (await req(`/pay/${sessionId}/status`)).json()).toMatchObject({ status: "paid" });
  const html = await (await req(`/pay/${sessionId}`)).text();
  expect(html).toContain("Payment received");
});

test("checkout session needs a terminal — 409 when none is registered", async () => {
  // provision only (delivers the sentralbee key) but no /connect terminal
  await req("/install/provision", {
    method: "POST",
    headers: { ...H, ...bearer(await signProvision(keys.privateKey, "B")) },
    body: JSON.stringify({ apiKey: "sk_B" }),
  });
  const res = await req("/checkout/sessions", {
    method: "POST",
    headers: { ...H, ...bearer(await signSession(keys.privateKey, "B")) },
    body: JSON.stringify({ orderId: "order-1", amountMinor: 1000 }),
  });
  expect(res.status).toBe(409);
});

test("checkout session create is session-authed (401 without a token)", async () => {
  const res = await req("/checkout/sessions", {
    method: "POST",
    headers: H,
    body: JSON.stringify({ orderId: "order-1", amountMinor: 1000 }),
  });
  expect(res.status).toBe(401);
});

test("an unknown pay id 404s (no leak)", async () => {
  expect((await req(`/pay/does-not-exist`)).status).toBe(404);
  expect((await req(`/pay/does-not-exist/status`)).status).toBe(404);
});
