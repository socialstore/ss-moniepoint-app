import { Hono } from "hono";
import { getDb } from "../store/db";
import { getInstall } from "../store/repo";
import { decryptSecret } from "../lib/cypher";
import { verifyWebhookAuth } from "../moniepoint/auth";
import { normalizeWebhook, type MoniepointWebhook } from "../moniepoint/types";
import { resolveWorkspace } from "../domain/suspense";
import { reconcile } from "../domain/matcher";
import { httpSentralbee } from "../sentralbee/client";

const SENTRALBEE_API = Bun.env.SENTRALBEE_API_URL ?? "https://api.sentralbee.app";

export const webhook = new Hono();

// POST /webhook — inbound Moniepoint POS transfer. FAIL-CLOSED: verify the HMAC over the raw body
// with the install's webhook secret before anything can flip an order to paid.
webhook.post("/", async (c) => {
  const raw = await c.req.text();
  let payload: MoniepointWebhook;
  try {
    payload = JSON.parse(raw) as MoniepointWebhook;
  } catch {
    return c.json({ error: "bad json" }, 400);
  }

  const db = getDb();
  const transfer = normalizeWebhook(payload, Date.now());

  const workspace = resolveWorkspace(db, transfer);
  if (!workspace) return c.json({ error: "unknown terminal/business" }, 404);
  const install = getInstall(db, workspace);

  const sig = c.req.header("moniepoint-webhook-signature") ?? c.req.header("x-moniepoint-signature") ?? null;
  const secret = install?.webhook_secret_enc ? await decryptSecret(install.webhook_secret_enc) : null;
  if (!verifyWebhookAuth(raw, sig, secret)) return c.json({ error: "unauthorized" }, 401);

  if (!install?.sentralbee_key_enc) return c.json({ error: "install not configured (no api key)" }, 409);
  const client = httpSentralbee(SENTRALBEE_API, await decryptSecret(install.sentralbee_key_enc));

  const outcome = await reconcile(db, transfer, client);
  return c.json({ outcome });
});
