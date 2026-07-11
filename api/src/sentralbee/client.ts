import { sentralbeeClient } from "@sentralbee/app-sdk";

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
 * The ONLY path this app mutates Sentralbee state: the public commerce API, authenticated as the installed
 * workspace with that install's app api-key. Built on @sentralbee/app-sdk's `sentralbeeClient`; we go
 * through its `request()` escape hatch (not the typed `markOrderPaid`) so we can attach Moniepoint
 * reconciliation metadata — terminal serial, sender name — which the SDK's typed method intentionally
 * omits. `reference` = the Moniepoint txn id, so a redelivered webhook is a no-op server-side too (the
 * endpoint dedupes on it).
 */
export function httpSentralbee(baseUrl: string, apiKey: string): SentralbeeClient {
  const client = sentralbeeClient({ apiKey, baseUrl });
  return {
    async markOrderPaid(a) {
      await client.request("POST", `/v1/orders/${encodeURIComponent(a.orderId)}/payments`, {
        amount: a.amountMinor,
        currency: a.currency,
        provider: a.provider ?? "moniepoint",
        reference: a.reference,
        metadata: a.metadata ?? {},
      });
    },
  };
}
