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
    moniepointSecretEnc: string | null;
    sentralbeeKeyEnc: string | null;
    webhookSecretEnc: string | null;
    now: number;
  },
): void {
  db.query(
    `INSERT INTO install (workspace,business_id,moniepoint_secret_enc,sentralbee_key_enc,webhook_secret_enc,created_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(workspace) DO UPDATE SET
       business_id           = COALESCE(excluded.business_id, install.business_id),
       moniepoint_secret_enc = COALESCE(excluded.moniepoint_secret_enc, install.moniepoint_secret_enc),
       sentralbee_key_enc    = COALESCE(excluded.sentralbee_key_enc, install.sentralbee_key_enc),
       webhook_secret_enc    = COALESCE(excluded.webhook_secret_enc, install.webhook_secret_enc)`,
  ).run(r.workspace, r.businessId, r.moniepointSecretEnc, r.sentralbeeKeyEnc, r.webhookSecretEnc, r.now);
}

export function upsertTerminal(
  db: Database,
  r: { workspace: string; terminalSerial: string; nuban: string; accountName: string | null; bankName?: string; now: number },
): void {
  db.query(
    `INSERT INTO terminal (id,workspace,terminal_serial,nuban,account_name,bank_name,created_at)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(workspace,terminal_serial) DO UPDATE SET
       nuban=excluded.nuban, account_name=excluded.account_name, bank_name=excluded.bank_name`,
  ).run(crypto.randomUUID(), r.workspace, r.terminalSerial, r.nuban, r.accountName, r.bankName ?? "Moniepoint MFB", r.now);
}

export function listTerminals(db: Database, workspace: string): TerminalRow[] {
  return db.query<TerminalRow, [string]>("SELECT * FROM terminal WHERE workspace = ? ORDER BY created_at").all(workspace);
}

export function reservationForOrder(db: Database, workspace: string, orderId: string): ReservationRow | null {
  return db
    .query<ReservationRow, [string, string]>(
      "SELECT * FROM reservation WHERE workspace = ? AND order_id = ? ORDER BY created_at DESC",
    )
    .get(workspace, orderId);
}
