export interface MarkOrderPaidArgs {
  orderId: string;
  amountMinor: number;
  currency: string;
  reference: string; // Moniepoint txn id — the endpoint's idempotency key
  provider?: string;
  metadata?: Record<string, unknown>;
}

export interface SentralbeeClient {
  markOrderPaid(args: MarkOrderPaidArgs): Promise<void>;
}

/**
 * The ONLY path this app mutates Sentralbee state: the public commerce API, authenticated as the
 * installed workspace with that install's app api-key. `reference` = the Moniepoint txn id, so a
 * redelivered webhook is a no-op server-side too (the endpoint dedupes on it).
 */
export function httpSentralbee(baseUrl: string, apiKey: string): SentralbeeClient {
  return {
    async markOrderPaid(a) {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/orders/${encodeURIComponent(a.orderId)}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({
          amount: a.amountMinor,
          currency: a.currency,
          provider: a.provider ?? "moniepoint",
          reference: a.reference,
          metadata: a.metadata ?? {},
        }),
      });
      if (res.status === 200 || res.status === 201) return; // 201 created; 200 idempotent replay
      const body = await res.text().catch(() => "");
      throw new Error(`sentralbee payment-write ${res.status}: ${body.slice(0, 200)}`);
    },
  };
}
