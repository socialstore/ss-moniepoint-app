// End-to-end demo of the Moniepoint reconciliation loop WITHOUT the full Sentralbee stack.
// A mock stands in for the public commerce API and captures the payment-write call, so you can see
// the whole flow — install → reserve (unique amount) → signed webhook → reconcile → mark-paid — work.
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

const { app } = await import("../api/src/app");
const { memoryDb, setDb } = await import("../api/src/store/db");
setDb(memoryDb());

const WS = "workspace-demo";
const TERM = "P260678997653";
const WHSEC = "whsec_demo";

async function jj(path: string, init?: RequestInit) {
  const r = await app.fetch(new Request("http://app" + path, init));
  return { status: r.status, body: await r.json().catch(() => null) };
}
const json = (o: unknown) => JSON.stringify(o);
const H = { "content-type": "application/json" };

console.log("① install — store creds + register a terminal");
console.log("  ", json(await jj("/install/connect", { method: "POST", headers: H, body: json({
  workspace: WS, businessId: "42", sentralbeeKey: "sk_demo_app_key", webhookSecret: WHSEC,
  terminals: [{ terminalSerial: TERM, nuban: "5012345678", accountName: "ACME LTD" }],
}) })));

console.log("\n② checkout reserve — order-42, base ₦14,000.00");
const reserve = await jj("/checkout/orders/order-42/reserve", { method: "POST", headers: H, body: json({ workspace: WS, terminalSerial: TERM, amountMinor: 1_400_000 }) });
console.log("  ", json(reserve.body));
const amountMinor = (reserve.body as { intent: { amountMinor: number } }).intent.amountMinor;

console.log("\n③ customer transfers the EXACT amount → signed Moniepoint webhook (APPROVED)");
const payload = json({ transactionReference: "MNP-TXN-001", terminalSerial: TERM, businessId: "42", amount: amountMinor / 100, transactionStatus: "APPROVED", merchantReference: "" });
const sig = createHmac("sha256", WHSEC).update(payload).digest("hex");
console.log("  ", json(await jj("/webhook", { method: "POST", headers: { ...H, "moniepoint-webhook-signature": sig }, body: payload })));

console.log("\n④ what the app sent to Sentralbee (the payment-write call it made):");
console.log("  ", json(captured));

console.log("\n⑤ checkout status (what the storefront polls):");
console.log("  ", json((await jj(`/checkout/orders/order-42/status?workspace=${WS}`)).body));

console.log("\n⑥ fail-closed — the SAME transfer with a BAD signature is rejected:");
console.log("  ", json(await jj("/webhook", { method: "POST", headers: { ...H, "moniepoint-webhook-signature": "deadbeef" }, body: payload })));

console.log("\n⑦ redelivery — the SAME valid webhook again is idempotent (no double-pay):");
console.log("  ", json(await jj("/webhook", { method: "POST", headers: { ...H, "moniepoint-webhook-signature": sig }, body: payload })));

mock.stop();
