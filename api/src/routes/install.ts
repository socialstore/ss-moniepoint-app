import { Hono } from "hono";
import { getDb } from "../store/db";
import { encryptSecret } from "../lib/cypher";
import { listTerminals, setWebhookSecret, upsertInstall, upsertTerminal } from "../store/repo";
import { getMoniepointClient } from "../moniepoint/client";

export const install = new Hono();

interface ConnectBody {
  workspace?: string;
  businessId?: string;
  moniepointClientId?: string; // merchant's Moniepoint API client id
  moniepointClientSecret?: string; // merchant's Moniepoint API client secret
  sentralbeeKey?: string; // the app-kind Sentralbee api-key used to call the public API
  webhookUrl?: string; // where Moniepoint should POST (defaults to MONIEPOINT_APP_PUBLIC_URL + /webhook)
  terminals?: { terminalSerial?: string; nuban?: string; accountName?: string; bankName?: string }[];
}

// POST /install/connect — store (encrypted) merchant creds, register terminals, and — using the
// merchant's Moniepoint credentials — CREATE the webhook subscription so Moniepoint returns the
// signing secret (we never ask the merchant for it). The installer flow is authenticated by the
// platform AppInstaller token in a later pass.
install.post("/connect", async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as ConnectBody;
  if (!b.workspace) return c.json({ error: "workspace required" }, 400);
  const db = getDb();
  const now = Date.now();

  upsertInstall(db, {
    workspace: b.workspace,
    businessId: b.businessId ?? null,
    moniepointClientId: b.moniepointClientId ?? null,
    moniepointSecretEnc: b.moniepointClientSecret ? await encryptSecret(b.moniepointClientSecret) : null,
    sentralbeeKeyEnc: b.sentralbeeKey ? await encryptSecret(b.sentralbeeKey) : null,
    now,
  });

  let terminals = 0;
  for (const t of b.terminals ?? []) {
    if (t?.terminalSerial && t?.nuban) {
      upsertTerminal(db, {
        workspace: b.workspace,
        terminalSerial: t.terminalSerial,
        nuban: t.nuban,
        accountName: t.accountName ?? null,
        bankName: t.bankName,
        now,
      });
      terminals++;
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
        const token = await client.authenticate(b.moniepointClientId, b.moniepointClientSecret);
        const sub = await client.createWebhookSubscription(token, webhookUrl);
        setWebhookSecret(db, b.workspace, await encryptSecret(sub.secret), sub.subscriptionId);
        webhookSetup = { ok: true, subscriptionId: sub.subscriptionId };
      } catch (e) {
        webhookSetup = { ok: false, error: (e as Error).message };
      }
    }
  } else {
    webhookSetup = { ok: false, error: "moniepointClientId + moniepointClientSecret required to set up webhooks" };
  }

  return c.json({ ok: true, workspace: b.workspace, terminals: listTerminals(db, b.workspace).length, added: terminals, webhookSetup });
});
