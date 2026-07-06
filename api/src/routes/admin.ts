import { Hono } from "hono";
import { getDb } from "../store/db";
import { getInstall, listTerminals } from "../store/repo";
import { getUnmapped, listUnmapped, markUnmappedResolved } from "../domain/suspense";
import { decryptSecret } from "../lib/cypher";
import { httpSentralbee } from "../sentralbee/client";

const SENTRALBEE_API = Bun.env.SENTRALBEE_API_URL ?? "https://api.sentralbee.app";

// The embedded admin backend. NOTE: workspace is via query for now; the platform session token
// (verified against the platform JWKS) replaces it in a later pass so the iframe never holds a key.
export const admin = new Hono();

admin.get("/config", (c) => {
  const workspace = c.req.query("workspace");
  if (!workspace) return c.json({ error: "workspace required" }, 400);
  const i = getInstall(getDb(), workspace);
  return c.json({
    configured: !!i?.sentralbee_key_enc,
    businessId: i?.business_id ?? null,
    hasClientCreds: !!i?.moniepoint_secret_enc,
    webhookConfigured: !!i?.webhook_secret_enc,
    subscriptionId: i?.moniepoint_subscription_id ?? null,
  });
});

admin.get("/terminals", (c) => {
  const workspace = c.req.query("workspace");
  if (!workspace) return c.json({ error: "workspace required" }, 400);
  return c.json({ terminals: listTerminals(getDb(), workspace) });
});

admin.get("/clearing-house", (c) => {
  const workspace = c.req.query("workspace");
  if (!workspace) return c.json({ error: "workspace required" }, 400);
  return c.json({ unmapped: listUnmapped(getDb(), workspace) });
});

// POST /admin/clearing-house/:id/resolve { orderId } — manually bind a suspense payment to an order.
admin.post("/clearing-house/:id/resolve", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { orderId?: string };
  if (!body.orderId) return c.json({ error: "orderId required" }, 400);

  const db = getDb();
  const row = getUnmapped(db, id);
  if (!row || row.resolution !== "unmatched") return c.json({ error: "not found or already resolved" }, 404);
  if (!row.workspace) return c.json({ error: "payment has no workspace" }, 409);

  const install = getInstall(db, row.workspace);
  if (!install?.sentralbee_key_enc) return c.json({ error: "install not configured" }, 409);

  const client = httpSentralbee(SENTRALBEE_API, await decryptSecret(install.sentralbee_key_enc));
  await client.markOrderPaid({
    orderId: body.orderId,
    amountMinor: row.amount_minor,
    currency: row.currency,
    reference: row.moniepoint_txn_id, // idempotency key = the same txn id
    provider: "moniepoint",
    metadata: { manual: true, terminalSerial: row.terminal_serial, senderName: row.sender_name },
  });
  markUnmappedResolved(db, row.moniepoint_txn_id, body.orderId, Date.now());
  return c.json({ ok: true, orderId: body.orderId });
});
