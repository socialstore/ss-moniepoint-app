import type { Database } from "bun:sqlite";
import type { ReservationRow } from "../store/types";
import type { InboundTransfer } from "../moniepoint/types";
import type { SentralbeeClient } from "../sentralbee/client";
import { markUnmappedResolved, upsertUnmapped } from "./suspense";

export type MatchOutcome =
  | { kind: "reconciled"; orderId: string; reservationId: string }
  | { kind: "pending"; orderId: string } // matched a reservation but Moniepoint status is PENDING (escrow)
  | { kind: "duplicate" }
  | { kind: "unmapped"; reason: "no_match" | "ambiguous" };

/**
 * Reconcile one inbound transfer WITHIN a single resolved tenant (workspace) — the caller resolves
 * the workspace from the terminal + verifies the webhook HMAC against that workspace's secret first.
 * Every query here is scoped to `workspace`, so the matched reservation, the paying key, and the
 * webhook secret are provably the same tenant; a shared/duplicate terminal serial can never cross.
 *   1. idempotency (per-tenant) — a txn we already reconciled is a no-op;
 *   2. match an OPEN reservation on (workspace, terminal, exact amount, within window);
 *   3. ONLY when Moniepoint status is APPROVED do we mark the order paid (PENDING = funds still in
 *      escrow awaiting the cashier's Accept);
 *   4. anything unmatched/ambiguous/pending lands in the suspense ledger for the clearing-house.
 */
export async function reconcile(
  db: Database,
  t: InboundTransfer,
  client: SentralbeeClient,
  workspace: string,
): Promise<MatchOutcome> {
  const already = db
    .query<{ c: number }, [string, string]>(
      "SELECT count(*) c FROM reservation WHERE matched_txn_id = ? AND workspace = ?",
    )
    .get(t.txnId, workspace);
  if ((already?.c ?? 0) > 0) return { kind: "duplicate" };

  const candidates: ReservationRow[] = t.terminalSerial
    ? db
        .query<ReservationRow, [string, number, number, string]>(
          "SELECT * FROM reservation WHERE terminal_serial = ? AND amount_minor = ? AND status = 'open' AND expires_at > ? AND workspace = ?",
        )
        .all(t.terminalSerial, t.amountMinor, t.receivedAt, workspace)
    : [];

  if (t.status === "APPROVED" && candidates.length === 1) {
    const r = candidates[0]!;
    // Pay FIRST; only then commit local state. If the API call throws, the reservation stays open so
    // Moniepoint's redelivery retries — and the endpoint dedupes on `reference`, so a
    // paid-but-not-yet-committed race can never double-credit.
    await client.markOrderPaid({
      orderId: r.order_id,
      amountMinor: r.amount_minor,
      currency: r.currency,
      reference: t.txnId,
      provider: "moniepoint",
      metadata: { terminalSerial: t.terminalSerial, businessId: t.businessId, senderName: t.senderName },
    });
    db.query("UPDATE reservation SET status='matched', matched_txn_id=? WHERE id=?").run(t.txnId, r.id);
    markUnmappedResolved(db, t.txnId, r.order_id, t.receivedAt, workspace);
    return { kind: "reconciled", orderId: r.order_id, reservationId: r.id };
  }

  upsertUnmapped(db, t, workspace);
  if (t.status !== "APPROVED" && candidates.length >= 1) return { kind: "pending", orderId: candidates[0]!.order_id };
  return { kind: "unmapped", reason: candidates.length > 1 ? "ambiguous" : "no_match" };
}
