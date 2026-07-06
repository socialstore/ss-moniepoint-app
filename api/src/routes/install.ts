import { Hono } from "hono";
import { getDb } from "../store/db";
import { encryptSecret } from "../lib/cypher";
import { listTerminals, upsertInstall, upsertTerminal } from "../store/repo";

export const install = new Hono();

interface ConnectBody {
  workspace?: string;
  businessId?: string;
  moniepointSecret?: string; // merchant's Moniepoint API secret
  sentralbeeKey?: string; // the app-kind Sentralbee api-key used to call the public API
  webhookSecret?: string; // Moniepoint webhook signing secret
  terminals?: { terminalSerial?: string; nuban?: string; accountName?: string; bankName?: string }[];
}

// POST /install/connect — store (encrypted) merchant creds + register terminals for a workspace.
// The installer flow is authenticated by the platform AppInstaller token in a later pass.
install.post("/connect", async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as ConnectBody;
  if (!b.workspace) return c.json({ error: "workspace required" }, 400);
  const db = getDb();
  const now = Date.now();

  upsertInstall(db, {
    workspace: b.workspace,
    businessId: b.businessId ?? null,
    moniepointSecretEnc: b.moniepointSecret ? await encryptSecret(b.moniepointSecret) : null,
    sentralbeeKeyEnc: b.sentralbeeKey ? await encryptSecret(b.sentralbeeKey) : null,
    webhookSecretEnc: b.webhookSecret ? await encryptSecret(b.webhookSecret) : null,
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
  return c.json({ ok: true, workspace: b.workspace, terminals: listTerminals(db, b.workspace).length, added: terminals });
});
