// End-to-end demo of the Moniepoint reconciliation loop WITHOUT the full Sentralbee stack.
// A mock stands in for the public commerce API and captures the payment-write call, so you can see
// the whole flow — platform provision → merchant connect → reserve → signed webhook → reconcile →
// mark-paid — work, all under the real asymmetric-JWT auth (a test keypair stands in for the platform).
//
//   bun run demo            (from ss-moniepoint-app/)
//
// Env is set before the app is imported so it points at the mock.
import { createHmac } from "node:crypto";

process.env.SENTRALBEE_API_URL = "http://127.0.0.1:8899";
process.env.MONIEPOINT_APP_KEY = "demo-app-key";

// --- mock Sentralbee public API: captures POST /v1/orders/:id/payments ---
let captured: unknown = null;
const mock = Bun.serve({
  port: 8899,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "POST" && /\/v1\/orders\/[^/]+\/payments$/.test(url.pathname)) {
      captured = { path: url.pathname, apiKey: req.headers.get("x-api-key"), body: await req.json() };
      return Response.json({ id: "pay_demo", payment_status: "PAID" }, { status: 201 });
    }
    return new Response("not found", { status: 404 });
  },
});

// A test keypair stands in for the platform: it signs provision + session tokens the app verifies.
const { makeTestKeys, signProvision, signSession } = await import("../api/src/auth/testsign");
const keys = await makeTestKeys();
process.env.PLATFORM_JWT_PUBLIC_KEY = keys.publicKeyPem; // the app trusts tokens signed by this platform

const { app } = await import("../api/src/app");
const { memoryDb, setDb } = await import("../api/src/store/db");
const { setMoniepointClient } = await import("../api/src/moniepoint/client");
setDb(memoryDb());

const WS = "workspace-demo";
const TERM = "P260678997653";
const WHSEC = "whsec_from_moniepoint_subscription";

// Stand in for Moniepoint's API: on connect the app uses the merchant's client creds to create a
// webhook subscription; Moniepoint returns this signing secret (the merchant never hand-copies it).
setMoniepointClient({
  authenticate: async () => "fake-moniepoint-token",
  createWebhookSubscription: async () => ({ subscriptionId: "sub_demo", secret: WHSEC }),
  deleteWebhookSubscription: async () => {},
});

async function jj(path: string, init?: RequestInit) {
  const r = await app.fetch(new Request("http://app" + path, init));
  return { status: r.status, body: await r.json().catch(() => null) };
}
const json = (o: unknown) => JSON.stringify(o);
const H = { "content-type": "application/json" };
const auth = (t: string) => ({ ...H, authorization: `Bearer ${t}` });

// Tokens the platform would mint after the merchant consents in the app-store.
const provisionTok = await signProvision(keys.privateKey, WS);
const sessionTok = await signSession(keys.privateKey, WS);

console.log("① platform provisions — auto-minted Sentralbee api key delivered server-to-server (no manual paste)");
console.log("  ", json(await jj("/install/provision", { method: "POST", headers: auth(provisionTok), body: json({ apiKey: "sk_demo_app_key" }) })));

console.log("\n② merchant connects — hands over Moniepoint API creds; the app creates the webhook subscription");
console.log("  ", json(await jj("/install/connect", { method: "POST", headers: auth(sessionTok), body: json({
  businessId: "42",
  moniepointClientId: "mp_client_demo", moniepointClientSecret: "mp_secret_demo",
  webhookUrl: "https://demo-app.example/webhook",
  terminals: [{ terminalSerial: TERM, nuban: "5012345678", accountName: "ACME LTD" }],
}) })));

console.log("\n③ checkout reserve — order-42, base ₦14,000.00");
const reserve = await jj("/checkout/orders/order-42/reserve", { method: "POST", headers: auth(sessionTok), body: json({ terminalSerial: TERM, amountMinor: 1_400_000 }) });
console.log("  ", json(reserve.body));
const amountMinor = (reserve.body as { intent: { amountMinor: number } }).intent.amountMinor;

console.log("\n④ customer transfers the EXACT amount → signed Moniepoint webhook (APPROVED)");
const payload = json({ transactionReference: "MNP-TXN-001", terminalSerial: TERM, businessId: "42", amount: amountMinor / 100, transactionStatus: "APPROVED", merchantReference: "" });
const sig = createHmac("sha256", WHSEC).update(payload).digest("hex");
console.log("  ", json(await jj("/webhook", { method: "POST", headers: { ...H, "moniepoint-webhook-signature": sig }, body: payload })));

console.log("\n⑤ what the app sent to Sentralbee (the payment-write call it made):");
console.log("  ", json(captured));

console.log("\n⑥ checkout status (what the storefront polls, session-authed):");
console.log("  ", json((await jj(`/checkout/orders/order-42/status`, { headers: auth(sessionTok) })).body));

console.log("\n⑦ fail-closed — the SAME transfer with a BAD signature is rejected:");
console.log("  ", json(await jj("/webhook", { method: "POST", headers: { ...H, "moniepoint-webhook-signature": "deadbeef" }, body: payload })));

console.log("\n⑧ redelivery — the SAME valid webhook again is idempotent (no double-pay):");
console.log("  ", json(await jj("/webhook", { method: "POST", headers: { ...H, "moniepoint-webhook-signature": sig }, body: payload })));

console.log("\n⑨ uninstall — platform tears down the install; Moniepoint subscription deleted, all rows purged:");
console.log("  ", json(await jj("/install/uninstall", { method: "POST", headers: auth(await signProvision(keys.privateKey, WS)), body: "{}" })));

mock.stop();
