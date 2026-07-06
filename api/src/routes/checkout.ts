import { Hono } from "hono";
import { getDb } from "../store/db";
import { reserve } from "../domain/reservation";
import { reservationForOrder } from "../store/repo";

export const checkout = new Hono();

// NOTE: workspace is taken from the request for now; the storefront call is authenticated by the
// platform session token in a later pass (p2 auth). Money is minor units (kobo).

// POST /checkout/orders/:id/reserve  { workspace, terminalSerial, amountMinor, currency? }
checkout.post("/orders/:id/reserve", async (c) => {
  const orderId = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as {
    workspace?: string;
    terminalSerial?: string;
    amountMinor?: number;
    currency?: string;
  };
  if (!body.workspace || !body.terminalSerial || typeof body.amountMinor !== "number") {
    return c.json({ error: "workspace, terminalSerial, amountMinor required" }, 400);
  }
  try {
    const intent = reserve(
      { db: getDb(), now: Date.now() },
      body.workspace,
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

// GET /checkout/orders/:id/status?workspace=...  — reservation status (matched => paid)
checkout.get("/orders/:id/status", (c) => {
  const orderId = c.req.param("id");
  const workspace = c.req.query("workspace");
  if (!workspace) return c.json({ error: "workspace required" }, 400);
  const r = reservationForOrder(getDb(), workspace, orderId);
  if (!r) return c.json({ status: "none" });
  return c.json({
    status: r.status === "matched" ? "paid" : r.status,
    amountMinor: r.amount_minor,
    reference: r.reference,
    expiresAt: r.expires_at,
  });
});
