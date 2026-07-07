import type { Database } from "bun:sqlite";
import type { InstallRow, ReservationRow, TerminalRow } from "./types";

export function getInstall(db: Database, workspace: string): InstallRow | null {
  return db.query<InstallRow, [string]>("SELECT * FROM install WHERE workspace = ?").get(workspace);
}

export function upsertInstall(
  db: Database,
  r: {
    workspace: string;
    businessId: string | null;
    moniepointTokenEnc: string | null;
    sentralbeeKeyEnc: string | null;
    now: number;
  },
): void {
  db.query(
    `INSERT INTO install (workspace,business_id,moniepoint_token_enc,sentralbee_key_enc,created_at)
     VALUES (?,?,?,?,?)
     ON CONFLICT(workspace) DO UPDATE SET
       business_id          = COALESCE(excluded.business_id, install.business_id),
       moniepoint_token_enc = COALESCE(excluded.moniepoint_token_enc, install.moniepoint_token_enc),
       sentralbee_key_enc   = COALESCE(excluded.sentralbee_key_enc, install.sentralbee_key_enc)`,
  ).run(r.workspace, r.businessId, r.moniepointTokenEnc, r.sentralbeeKeyEnc, r.now);
}

// setWebhookSecret persists the signing secret + subscription id returned by Moniepoint when the
// app created the webhook subscription during connect (never asked from the merchant).
export function setWebhookSecret(db: Database, workspace: string, webhookSecretEnc: string, subscriptionId: string): void {
  db.query("UPDATE install SET webhook_secret_enc=?, moniepoint_subscription_id=? WHERE workspace=?").run(
    webhookSecretEnc,
    subscriptionId,
    workspace,
  );
}

export class TerminalOwnedByOtherWorkspace extends Error {}

// Register (or idempotently update) a terminal. terminal_serial is GLOBALLY unique, so if the serial
// already belongs to ANOTHER workspace we refuse — a tenant can never squat or silently overwrite
// another tenant's terminal. (Connect should also verify ownership with Moniepoint before calling.)
export function upsertTerminal(
  db: Database,
  r: { workspace: string; terminalSerial: string; nuban: string; accountName: string | null; bankName?: string; now: number },
): void {
  const existing = db
    .query<{ workspace: string }, [string]>("SELECT workspace FROM terminal WHERE terminal_serial = ?")
    .get(r.terminalSerial);
  if (existing && existing.workspace !== r.workspace) {
    throw new TerminalOwnedByOtherWorkspace(`terminal ${r.terminalSerial} is registered to another workspace`);
  }
  db.query(
    `INSERT INTO terminal (id,workspace,terminal_serial,nuban,account_name,bank_name,created_at)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(terminal_serial) DO UPDATE SET
       nuban=excluded.nuban, account_name=excluded.account_name, bank_name=excluded.bank_name`,
  ).run(crypto.randomUUID(), r.workspace, r.terminalSerial, r.nuban, r.accountName, r.bankName ?? "Moniepoint MFB", r.now);
}

export function listTerminals(db: Database, workspace: string): TerminalRow[] {
  return db.query<TerminalRow, [string]>("SELECT * FROM terminal WHERE workspace = ? ORDER BY created_at").all(workspace);
}

// Tear down EVERYTHING a workspace owns (uninstall). Ordered leaf-first; a terminal serial is freed for
// re-registration and no inbound routing, reservation, or encrypted secret survives the api-key revocation.
export function purgeWorkspace(db: Database, workspace: string): void {
  db.query("DELETE FROM reservation WHERE workspace = ?").run(workspace);
  db.query("DELETE FROM unmapped_payment WHERE workspace = ?").run(workspace);
  db.query("DELETE FROM terminal WHERE workspace = ?").run(workspace);
  db.query("DELETE FROM install WHERE workspace = ?").run(workspace);
}

export function reservationForOrder(db: Database, workspace: string, orderId: string): ReservationRow | null {
  return db
    .query<ReservationRow, [string, string]>(
      "SELECT * FROM reservation WHERE workspace = ? AND order_id = ? ORDER BY created_at DESC",
    )
    .get(workspace, orderId);
}
