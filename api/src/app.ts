import { Hono, type Context } from "hono";

export const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok", app: "ss-moniepoint-app" }));

// Skeleton stub — every route surface returns 501 until the Phase-2 build units implement it.
const ni = (c: Context) => c.json({ error: "not implemented (skeleton)" }, 501);

// Inbound Moniepoint V1_POS_TRANSFER_TRANSACTION webhooks. Auth is FAIL-CLOSED: until the
// real Moniepoint scheme is confirmed + wired, every event is rejected (p2-webhook-reconciler).
app.post("/webhook", ni);

// Storefront reserve + poll (p2-checkout-descriptor). Reserve returns the unique
// InstructionsPaymentIntent (amount + terminal NUBAN); status is the poll target.
app.post("/checkout/orders/:id/reserve", ni);
app.get("/checkout/orders/:id/status", ni);

// AppInstaller connect landing (p2-install-connect): validates the install token, captures
// the merchant's Moniepoint creds + terminals, and stores the app-kind api_key.
app.post("/install/connect", ni);

// Embedded admin backend (p2-admin-ui). Every request is authenticated by the short-lived
// platform session token, verified against the platform JWKS (aud = this app); the workspace
// api-key never enters the iframe — it stays here, server-side.
app.get("/admin/ping", ni);
