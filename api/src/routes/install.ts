import { Hono } from "hono";
import { getDb } from "../store/db";
import { decryptSecret, encryptSecret } from "../lib/cypher";
import { getInstall, listTerminals, purgeWorkspace, setWebhookSecret, upsertInstall, upsertTerminal } from "../store/repo";
import { getMoniepointClient } from "../moniepoint/client";
import { bearer, verifyProvision, verifySession, type SessionVars } from "../auth/platform";

// The install lifecycle has THREE actors, each authenticated differently:
//   - PLATFORM  → /provision + /uninstall  (one-time provision JWT; workspace from the signed claim)
//   - MERCHANT  → /connect                 (session JWT; workspace from the signed claim)
// The workspace is NEVER read from the request body — it always comes from a verified token.
export const install = new Hono<{ Variables: SessionVars }>();

// POST /install/provision — the PLATFORM delivers a workspace's auto-minted Sentralbee api key after the
// merchant consents in the app-store. No manual key paste. The live key transits backend-to-backend in
// the TLS body; the one-time provision JWT authenticates the platform and names the workspace.
install.post("/provision", async (c) => {
  const token = bearer(c);
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const db = getDb();
  let claims;
  try {
    claims = await verifyProvision(db, token);
  } catch (e) {
    return c.json({ error: "unauthorized", detail: (e as Error).message }, 401);
  }
  const body = (await c.req.json().catch(() => ({}))) as { apiKey?: string };
  if (!body.apiKey) return c.json({ error: "apiKey required" }, 400);

  upsertInstall(db, {
    workspace: claims.workspace,
    businessId: null,
    moniepointClientId: null,
    moniepointSecretEnc: null,
    sentralbeeKeyEnc: await encryptSecret(body.apiKey),
    now: Date.now(),
  });
  return c.json({ ok: true, workspace: claims.workspace });
});

interface ConnectBody {
  businessId?: string;
  moniepointClientId?: string; // merchant's Moniepoint API client id
  moniepointClientSecret?: string; // merchant's Moniepoint API client secret
  webhookUrl?: string; // where Moniepoint should POST (defaults to MONIEPOINT_APP_PUBLIC_URL + /webhook)
  terminals?: { terminalSerial?: string; nuban?: string; accountName?: string; bankName?: string }[];
}

// POST /install/connect — the MERCHANT supplies ONLY app-specific config (Moniepoint creds + terminals)
// from the embed UI. Session-authed; workspace from the token. Using the merchant's Moniepoint creds the
// app CREATES the webhook subscription so Moniepoint returns the signing secret (never hand-copied). The
// Sentralbee key was already delivered by /provision, so it is not accepted here.
install.post("/connect", async (c) => {
  const token = bearer(c);
  if (!token) return c.json({ error: "unauthorized" }, 401);
  let workspace: string;
  try {
    workspace = (await verifySession(token)).workspace;
  } catch {
    return c.json({ error: "unauthorized" }, 401);
  }

  const b = (await c.req.json().catch(() => ({}))) as ConnectBody;
  const db = getDb();
  const now = Date.now();

  upsertInstall(db, {
    workspace,
    businessId: b.businessId ?? null,
    moniepointClientId: b.moniepointClientId ?? null,
    moniepointSecretEnc: b.moniepointClientSecret ? await encryptSecret(b.moniepointClientSecret) : null,
    sentralbeeKeyEnc: null, // provisioned separately by the platform
    now,
  });

  let terminals = 0;
  const rejectedTerminals: string[] = [];
  for (const t of b.terminals ?? []) {
    if (t?.terminalSerial && t?.nuban) {
      try {
        upsertTerminal(db, {
          workspace,
          terminalSerial: t.terminalSerial,
          nuban: t.nuban,
          accountName: t.accountName ?? null,
          bankName: t.bankName,
          now,
        });
        terminals++;
      } catch {
        rejectedTerminals.push(t.terminalSerial); // already registered to another workspace
      }
    }
  }

  // Provision the webhook subscription with Moniepoint and store the secret it returns.
  let webhookSetup: { ok: boolean; subscriptionId?: string; error?: string } = { ok: false };
  if (b.moniepointClientId && b.moniepointClientSecret) {
    const base = (Bun.env.MONIEPOINT_APP_PUBLIC_URL ?? "").replace(/\/$/, "");
    const webhookUrl = b.webhookUrl ?? (base ? `${base}/webhook` : "");
    if (!webhookUrl) {
      webhookSetup = { ok: false, error: "no webhook URL (set MONIEPOINT_APP_PUBLIC_URL or pass webhookUrl)" };
    } else {
      try {
        const client = getMoniepointClient();
        const mtoken = await client.authenticate(b.moniepointClientId, b.moniepointClientSecret);
        const sub = await client.createWebhookSubscription(mtoken, webhookUrl);
        setWebhookSecret(db, workspace, await encryptSecret(sub.secret), sub.subscriptionId);
        webhookSetup = { ok: true, subscriptionId: sub.subscriptionId };
      } catch (e) {
        webhookSetup = { ok: false, error: (e as Error).message };
      }
    }
  } else {
    webhookSetup = { ok: false, error: "moniepointClientId + moniepointClientSecret required to set up webhooks" };
  }

  return c.json({
    ok: true,
    workspace,
    terminals: listTerminals(db, workspace).length,
    added: terminals,
    rejectedTerminals,
    webhookSetup,
  });
});

// POST /install/uninstall — the PLATFORM tears down an install when the merchant uninstalls (or the
// api-key is revoked). One-time provision JWT authed. Delete the Moniepoint webhook subscription
// (best-effort, using the stored creds) then purge every local row for the workspace, so no orphaned
// inbound routing or encrypted secret survives.
install.post("/uninstall", async (c) => {
  const token = bearer(c);
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const db = getDb();
  let workspace: string;
  try {
    workspace = (await verifyProvision(db, token)).workspace;
  } catch (e) {
    return c.json({ error: "unauthorized", detail: (e as Error).message }, 401);
  }

  const inst = getInstall(db, workspace);
  let subscriptionDeleted = false;
  if (inst?.moniepoint_subscription_id && inst.moniepoint_client_id && inst.moniepoint_secret_enc) {
    try {
      const client = getMoniepointClient();
      const secret = await decryptSecret(inst.moniepoint_secret_enc);
      const mtoken = await client.authenticate(inst.moniepoint_client_id, secret);
      await client.deleteWebhookSubscription(mtoken, inst.moniepoint_subscription_id);
      subscriptionDeleted = true;
    } catch {
      // best-effort — still purge locally so a revoked install leaves nothing behind
    }
  }
  purgeWorkspace(db, workspace);
  return c.json({ ok: true, workspace, subscriptionDeleted });
});
