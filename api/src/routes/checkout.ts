import { Hono } from "hono";
import { getDb } from "../store/db";
import { reserve } from "../domain/reservation";
import { firstTerminal, reservationForOrder } from "../store/repo";
import { sessionAuth, type SessionVars } from "../auth/platform";

// The browser-reachable base for the hosted pay page (via the gateway). Falls back to same-origin-relative
// so a redirect still works in dev if unset.
const PUBLIC_BASE = (Bun.env.MONIEPOINT_APP_PUBLIC_URL ?? "").replace(/\/$/, "");

// Storefront-facing. Every route is session-authed: the workspace comes from the VERIFIED token, never
// the body — so a caller can't exhaust another tenant's reservation pool or read another tenant's status.
// Money is minor units (kobo).
export const checkout = new Hono<{ Variables: SessionVars }>();
checkout.use("*", sessionAuth);

// POST /checkout/sessions  { orderId, amountMinor, currency? }
// The GENERIC pluggable-checkout entrypoint: the platform broker calls this (server-to-server, session
// token) to CREATE a payment for an order and get back a hosted pay-page URL — the same init→redirect
// shape as Stripe/Paystack. The storefront never sees a terminal or account; the app auto-routes the
// transfer to the workspace's default terminal and hands back the URL of its OWN pay page.
checkout.post("/sessions", async (c) => {
  const workspace = c.get("workspace");
  const body = (await c.req.json().catch(() => ({}))) as { orderId?: string; amountMinor?: number; currency?: string };
  if (!body.orderId || typeof body.amountMinor !== "number") {
    return c.json({ error: "orderId, amountMinor required" }, 400);
  }
  const term = firstTerminal(getDb(), workspace);
  if (!term) return c.json({ error: "no terminal configured for this workspace" }, 409);
  try {
    const intent = reserve({ db: getDb(), now: Date.now() }, workspace, body.orderId, term.terminal_serial, body.amountMinor, body.currency);
    return c.json({
      sessionId: intent.id,
      redirectUrl: `${PUBLIC_BASE}/pay/${intent.id}`,
      reference: intent.reference,
      amountMinor: intent.amountMinor,
      currency: intent.currency,
      expiresAt: intent.expiresAt,
    });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
});

// POST /checkout/orders/:id/reserve  { terminalSerial, amountMinor, currency? }
checkout.post("/orders/:id/reserve", async (c) => {
  const orderId = c.req.param("id");
  const workspace = c.get("workspace");
  const body = (await c.req.json().catch(() => ({}))) as {
    terminalSerial?: string;
    amountMinor?: number;
    currency?: string;
  };
  if (!body.terminalSerial || typeof body.amountMinor !== "number") {
    return c.json({ error: "terminalSerial, amountMinor required" }, 400);
  }
  try {
    const intent = reserve(
      { db: getDb(), now: Date.now() },
      workspace,
      orderId,
      body.terminalSerial,
      body.amountMinor,
      body.currency,
    );
    return c.json({ intent });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
});

// GET /checkout/orders/:id/status  — reservation status (matched => paid), scoped to the token's workspace
checkout.get("/orders/:id/status", (c) => {
  const orderId = c.req.param("id");
  const workspace = c.get("workspace");
  const r = reservationForOrder(getDb(), workspace, orderId);
  if (!r) return c.json({ status: "none" });
  return c.json({
    status: r.status === "matched" ? "paid" : r.status,
    amountMinor: r.amount_minor,
    reference: r.reference,
    expiresAt: r.expires_at,
  });
});
