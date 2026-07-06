import type { Database } from "bun:sqlite";
import type { InboundTransfer } from "../moniepoint/types";
import type { UnmappedPaymentRow } from "../store/types";

// Resolve which workspace a transfer belongs to. terminal_serial is GLOBALLY unique, so a match is
// unambiguous; we HARD-REJECT (return null) on any ambiguity rather than pick the wrong tenant.
export function resolveWorkspace(db: Database, t: InboundTransfer): string | null {
  if (t.terminalSerial) {
    const rows = db
      .query<{ workspace: string }, [string]>("SELECT workspace FROM terminal WHERE terminal_serial = ?")
      .all(t.terminalSerial);
    if (rows.length === 1) return rows[0]!.workspace;
    if (rows.length > 1) return null; // ambiguous — never guess
  }
  if (t.businessId) {
    const rows = db
      .query<{ workspace: string }, [string]>("SELECT workspace FROM install WHERE business_id = ?")
      .all(t.businessId);
    if (rows.length === 1) return rows[0]!.workspace;
  }
  return null;
}

// Upsert into the suspense ledger keyed on (workspace, txn id) — idempotent PER TENANT (a provider
// txn id is never treated as a global key) and carries PENDING→APPROVED forward. Never overwrites a
// row already resolved.
export function upsertUnmapped(db: Database, t: InboundTransfer, workspace: string | null): void {
  db.query(
    `INSERT INTO unmapped_payment
       (id,workspace,moniepoint_txn_id,terminal_serial,business_id,amount_minor,currency,sender_name,sender_account,status,merchant_reference,received_at,resolution,resolved_order_id,resolved_at,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(workspace, moniepoint_txn_id) DO UPDATE SET
       status = excluded.status,
       amount_minor = excluded.amount_minor,
       terminal_serial = COALESCE(excluded.terminal_serial, unmapped_payment.terminal_serial),
       sender_name = COALESCE(excluded.sender_name, unmapped_payment.sender_name)
     WHERE unmapped_payment.resolution = 'unmatched'`,
  ).run(
    crypto.randomUUID(),
    workspace,
    t.txnId,
    t.terminalSerial,
    t.businessId,
    t.amountMinor,
    t.currency,
    t.senderName,
    t.senderAccount,
    t.status,
    t.merchantReference,
    t.receivedAt,
    "unmatched",
    null,
    null,
    t.receivedAt,
  );
}

export function markUnmappedResolved(db: Database, txnId: string, orderId: string, now: number, workspace: string): void {
  db.query(
    "UPDATE unmapped_payment SET resolution='matched', resolved_order_id=?, resolved_at=? WHERE moniepoint_txn_id=? AND workspace=?",
  ).run(orderId, now, txnId, workspace);
}

export function listUnmapped(db: Database, workspace: string): UnmappedPaymentRow[] {
  return db
    .query<UnmappedPaymentRow, [string]>(
      "SELECT * FROM unmapped_payment WHERE workspace = ? AND resolution = 'unmatched' ORDER BY received_at DESC",
    )
    .all(workspace);
}

// Scoped to the authenticated workspace so a leaked suspense-row id can't be acted on cross-tenant.
export function getUnmapped(db: Database, id: string, workspace: string): UnmappedPaymentRow | null {
  return db
    .query<UnmappedPaymentRow, [string, string]>("SELECT * FROM unmapped_payment WHERE id = ? AND workspace = ?")
    .get(id, workspace);
}
