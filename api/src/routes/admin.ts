import { Hono } from "hono";
import { getDb } from "../store/db";
import { getInstall, listTerminals } from "../store/repo";
import { getUnmapped, listUnmapped, markUnmappedResolved } from "../domain/suspense";
import { decryptSecret } from "../lib/cypher";
import { httpSentralbee } from "../sentralbee/client";
import { sessionAuth, type SessionVars } from "../auth/platform";

const SENTRALBEE_API = Bun.env.SENTRALBEE_API_URL ?? "https://api.sentralbee.app";

// The embedded admin backend. Every route is session-authed: the workspace is taken from the VERIFIED
// session token (minted by the platform for the embed), so the iframe never holds an api key and can
// only ever act as its own tenant.
export const admin = new Hono<{ Variables: SessionVars }>();
admin.use("*", sessionAuth);

admin.get("/config", (c) => {
  const i = getInstall(getDb(), c.get("workspace"));
  return c.json({
    configured: !!i?.sentralbee_key_enc,
    businessId: i?.business_id ?? null,
    hasToken: !!i?.moniepoint_token_enc,
    webhookConfigured: !!i?.webhook_secret_enc,
    subscriptionId: i?.moniepoint_subscription_id ?? null,
  });
});

admin.get("/terminals", (c) => {
  return c.json({ terminals: listTerminals(getDb(), c.get("workspace")) });
});

admin.get("/clearing-house", (c) => {
  return c.json({ unmapped: listUnmapped(getDb(), c.get("workspace")) });
});

// POST /admin/clearing-house/:id/resolve { orderId } — manually bind a suspense payment to an order.
// The suspense row + the install are BOTH scoped to the token's workspace, so a leaked row id can never
// be resolved cross-tenant.
admin.post("/clearing-house/:id/resolve", async (c) => {
  const id = c.req.param("id");
  const workspace = c.get("workspace");
  const body = (await c.req.json().catch(() => ({}))) as { orderId?: string };
  if (!body.orderId) return c.json({ error: "orderId required" }, 400);

  const db = getDb();
  const row = getUnmapped(db, id, workspace);
  if (!row || row.resolution !== "unmatched") return c.json({ error: "not found or already resolved" }, 404);

  const install = getInstall(db, workspace);
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
  markUnmappedResolved(db, row.moniepoint_txn_id, body.orderId, Date.now(), workspace);
  return c.json({ ok: true, orderId: body.orderId });
});
