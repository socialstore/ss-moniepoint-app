// The inbound Moniepoint POS transfer webhook (e.g. V1_POS_TRANSFER_TRANSACTION), plus a
// normalized internal shape. Field names mirror Moniepoint's documented payload; merchantReference
// is frequently EMPTY (the reference-less blind spot this app exists to reconcile).

export interface MoniepointWebhook {
  eventType?: string;
  transactionReference: string; // unique per transaction — our idempotency key
  terminalSerial?: string;
  businessId?: string | number;
  amount: number; // MAJOR units (naira) as Moniepoint sends
  currency?: string;
  transactionStatus: string; // PENDING | APPROVED
  merchantReference?: string; // often empty
  senderName?: string;
  senderAccountNumber?: string;
  paidAt?: string;
}

export interface InboundTransfer {
  txnId: string;
  terminalSerial: string | null;
  businessId: string | null;
  amountMinor: number; // kobo
  currency: string;
  status: string; // PENDING | APPROVED
  merchantReference: string | null;
  senderName: string | null;
  senderAccount: string | null;
  receivedAt: number;
}

export function normalizeWebhook(w: MoniepointWebhook, now: number): InboundTransfer {
  return {
    txnId: w.transactionReference,
    terminalSerial: w.terminalSerial ?? null,
    businessId: w.businessId != null ? String(w.businessId) : null,
    amountMinor: Math.round(w.amount * 100),
    currency: w.currency ?? "NGN",
    status: (w.transactionStatus ?? "").toUpperCase(),
    merchantReference: w.merchantReference?.trim() || null,
    senderName: w.senderName ?? null,
    senderAccount: w.senderAccountNumber ?? null,
    receivedAt: now,
  };
}
