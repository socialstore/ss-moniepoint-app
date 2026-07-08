import type { Database } from "bun:sqlite";
import type { ReservationRow, TerminalRow } from "../store/types";

export interface InstructionsPaymentIntent {
  id: string; // the reservation id — also the unguessable bearer for the anonymous hosted pay page
  orderId: string;
  amountMinor: number;
  amountDisplay: string; // "14,000.37"
  currency: string;
  nuban: string;
  accountName: string | null;
  bankName: string;
  reference: string;
  expiresAt: number;
}

const WINDOW_MS = 30 * 60 * 1000; // 30-minute payment window
const MAX_OFFSET = 99; // kobo offsets 0..0.99 → up to 100 concurrent orders per terminal/window

export interface ReserveDeps {
  db: Database;
  now: number;
  ttlMs?: number;
}

export function formatMinor(minor: number): string {
  const [whole, frac] = (minor / 100).toFixed(2).split(".");
  return (whole ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + (frac ?? "00");
}

function toIntent(r: ReservationRow, t: TerminalRow): InstructionsPaymentIntent {
  return {
    id: r.id,
    orderId: r.order_id,
    amountMinor: r.amount_minor,
    amountDisplay: formatMinor(r.amount_minor),
    currency: r.currency,
    nuban: t.nuban,
    accountName: t.account_name,
    bankName: t.bank_name,
    reference: r.reference,
    expiresAt: r.expires_at,
  };
}

/**
 * Reserve a UNIQUE payable amount for an order on a terminal, so a reference-less inbound transfer
 * of that exact amount self-identifies within the window. Idempotent: re-reserving an order with a
 * live reservation returns the same intent.
 */
export function reserve(
  d: ReserveDeps,
  workspace: string,
  orderId: string,
  terminalSerial: string,
  baseMinor: number,
  currency = "NGN",
): InstructionsPaymentIntent {
  const { db, now } = d;
  const ttl = d.ttlMs ?? WINDOW_MS;

  const term = db
    .query<TerminalRow, [string, string]>("SELECT * FROM terminal WHERE workspace = ? AND terminal_serial = ?")
    .get(workspace, terminalSerial);
  if (!term) throw new Error(`unknown terminal ${terminalSerial} for workspace ${workspace}`);

  const existing = db
    .query<ReservationRow, [string, string, number]>(
      "SELECT * FROM reservation WHERE workspace = ? AND order_id = ? AND status = 'open' AND expires_at > ? ORDER BY created_at DESC",
    )
    .get(workspace, orderId, now);
  if (existing) return toIntent(existing, term);

  const held = new Set(
    db
      .query<{ amount_minor: number }, [string, string, number]>(
        "SELECT amount_minor FROM reservation WHERE workspace = ? AND terminal_serial = ? AND status = 'open' AND expires_at > ?",
      )
      .all(workspace, terminalSerial, now)
      .map((r) => r.amount_minor),
  );
  let amount = -1;
  for (let off = 0; off <= MAX_OFFSET; off++) {
    if (!held.has(baseMinor + off)) {
      amount = baseMinor + off;
      break;
    }
  }
  if (amount < 0) throw new Error(`reservation pool exhausted for terminal ${terminalSerial}`);

  const row: ReservationRow = {
    id: crypto.randomUUID(),
    workspace,
    order_id: orderId,
    terminal_serial: terminalSerial,
    amount_minor: amount,
    currency,
    reference: `MNP-${orderId}-${amount}`,
    status: "open",
    expires_at: now + ttl,
    matched_txn_id: null,
    created_at: now,
  };
  db.query(
    `INSERT INTO reservation (id,workspace,order_id,terminal_serial,amount_minor,currency,reference,status,expires_at,matched_txn_id,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    row.id,
    row.workspace,
    row.order_id,
    row.terminal_serial,
    row.amount_minor,
    row.currency,
    row.reference,
    row.status,
    row.expires_at,
    row.matched_txn_id,
    row.created_at,
  );
  return toIntent(row, term);
}

/** Expire past-window open reservations (housekeeping; also enforced by the expires_at filter). */
export function expireStale(db: Database, now: number): number {
  return db.query("UPDATE reservation SET status='expired' WHERE status='open' AND expires_at <= ?").run(now).changes;
}
