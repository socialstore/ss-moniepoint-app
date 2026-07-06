import { Hono } from "hono";
import { getDb } from "../store/db";
import { reserve } from "../domain/reservation";
import { reservationForOrder } from "../store/repo";
import { sessionAuth, type SessionVars } from "../auth/platform";

// Storefront-facing. Every route is session-authed: the workspace comes from the VERIFIED token, never
// the body — so a caller can't exhaust another tenant's reservation pool or read another tenant's status.
// Money is minor units (kobo).
export const checkout = new Hono<{ Variables: SessionVars }>();
checkout.use("*", sessionAuth);

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
