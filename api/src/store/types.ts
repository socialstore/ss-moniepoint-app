// Row shapes for the app's datastore. All money is integer minor units (kobo); all timestamps
// are epoch milliseconds.

export interface InstallRow {
  workspace: string;
  business_id: string | null;
  moniepoint_secret_enc: string | null;
  sentralbee_key_enc: string | null;
  webhook_secret_enc: string | null;
  created_at: number;
}

export interface TerminalRow {
  id: string;
  workspace: string;
  terminal_serial: string;
  nuban: string;
  account_name: string | null;
  bank_name: string;
  created_at: number;
}

export type ReservationStatus = "open" | "matched" | "expired" | "cancelled";

export interface ReservationRow {
  id: string;
  workspace: string;
  order_id: string;
  terminal_serial: string;
  amount_minor: number;
  currency: string;
  reference: string;
  status: ReservationStatus;
  expires_at: number;
  matched_txn_id: string | null;
  created_at: number;
}

export type UnmappedResolution = "unmatched" | "matched" | "manually_resolved" | "rejected";

export interface UnmappedPaymentRow {
  id: string;
  workspace: string | null;
  moniepoint_txn_id: string;
  terminal_serial: string | null;
  business_id: string | null;
  amount_minor: number;
  currency: string;
  sender_name: string | null;
  sender_account: string | null;
  status: string; // PENDING | APPROVED
  merchant_reference: string | null;
  received_at: number;
  resolution: UnmappedResolution;
  resolved_order_id: string | null;
  resolved_at: number | null;
  created_at: number;
}
