import type { Database } from "bun:sqlite";
import type { InboundTransfer } from "../moniepoint/types";
import type { UnmappedPaymentRow } from "../store/types";

/** Resolve which workspace a transfer belongs to, by terminal serial then business id. */
export function resolveWorkspace(db: Database, t: InboundTransfer): string | null {
  if (t.terminalSerial) {
    const r = db
      .query<{ workspace: string }, [string]>("SELECT workspace FROM terminal WHERE terminal_serial = ? LIMIT 1")
      .get(t.terminalSerial);
    if (r) return r.workspace;
  }
  if (t.businessId) {
    const r = db
      .query<{ workspace: string }, [string]>("SELECT workspace FROM install WHERE business_id = ? LIMIT 1")
      .get(t.businessId);
    if (r) return r.workspace;
  }
  return null;
}

/**
 * Upsert into the suspense ledger keyed on the Moniepoint txn id — idempotent, and carries the
 * PENDING→APPROVED status forward. Never overwrites a row that has already been resolved.
 */
export function upsertUnmapped(db: Database, t: InboundTransfer, workspace: string | null): void {
  db.query(
    `INSERT INTO unmapped_payment
       (id,workspace,moniepoint_txn_id,terminal_serial,business_id,amount_minor,currency,sender_name,sender_account,status,merchant_reference,received_at,resolution,resolved_order_id,resolved_at,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(moniepoint_txn_id) DO UPDATE SET
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

export function markUnmappedResolved(db: Database, txnId: string, orderId: string, now: number): void {
  db.query(
    "UPDATE unmapped_payment SET resolution='matched', resolved_order_id=?, resolved_at=? WHERE moniepoint_txn_id=?",
  ).run(orderId, now, txnId);
}

export function listUnmapped(db: Database, workspace: string): UnmappedPaymentRow[] {
  return db
    .query<UnmappedPaymentRow, [string]>(
      "SELECT * FROM unmapped_payment WHERE workspace = ? AND resolution = 'unmatched' ORDER BY received_at DESC",
    )
    .all(workspace);
}

export function getUnmapped(db: Database, id: string): UnmappedPaymentRow | null {
  return db.query<UnmappedPaymentRow, [string]>("SELECT * FROM unmapped_payment WHERE id = ?").get(id);
}
