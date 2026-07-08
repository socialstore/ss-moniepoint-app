// Moniepoint POS developer API client. Moniepoint authenticates with a single API TOKEN — the merchant
// pastes it in on connect and the app uses it DIRECTLY on the Moniepoint API (no OAuth client-credentials
// exchange). We use it to CREATE a webhook subscription, so Moniepoint returns the signing secret and the
// merchant never hand-copies it.
//
// The exact subscription paths/payloads (and the precise token header) are PARTNER-GATED (best-guess from
// the public research). They are configurable via env and the client is injectable (setMoniepointClient)
// so dev/tests/demo never hit real Moniepoint — confirm the real endpoints against Moniepoint before go-live.

export interface WebhookSubscription {
  subscriptionId: string;
  secret: string;
}

export interface MoniepointClient {
  createWebhookSubscription(apiToken: string, webhookUrl: string, events?: string[]): Promise<WebhookSubscription>;
  deleteWebhookSubscription(apiToken: string, subscriptionId: string): Promise<void>;
}

const DEFAULT_EVENTS = ["V1_POS_TRANSFER_TRANSACTION", "V1_TRANSFER_TRANSACTION"];

export function httpMoniepoint(cfg?: { apiBase?: string }): MoniepointClient {
  const apiBase = (cfg?.apiBase ?? Bun.env.MONIEPOINT_API_BASE ?? "https://api.pos.moniepoint.com").replace(/\/$/, "");
  const auth = (apiToken: string) => ({ authorization: `Bearer ${apiToken}` });
  return {
    async createWebhookSubscription(apiToken, webhookUrl, events = DEFAULT_EVENTS) {
      const res = await fetch(`${apiBase}/v1/webhooks/subscriptions`, {
        method: "POST",
        headers: { "content-type": "application/json", ...auth(apiToken) },
        body: JSON.stringify({ url: webhookUrl, events }),
      });
      if (!res.ok) throw new Error(`moniepoint subscription failed (${res.status})`);
      const data = (await res.json()) as { id?: string; subscriptionId?: string; secret?: string; signingSecret?: string };
      const secret = data.secret ?? data.signingSecret;
      if (!secret) throw new Error("moniepoint subscription returned no signing secret");
      return { subscriptionId: data.subscriptionId ?? data.id ?? "", secret };
    },
    async deleteWebhookSubscription(apiToken, subscriptionId) {
      if (!subscriptionId) return;
      const res = await fetch(`${apiBase}/v1/webhooks/subscriptions/${encodeURIComponent(subscriptionId)}`, {
        method: "DELETE",
        headers: auth(apiToken),
      });
      if (!res.ok && res.status !== 404) throw new Error(`moniepoint delete subscription failed (${res.status})`);
    },
  };
}

let _client: MoniepointClient | null = null;

export function getMoniepointClient(): MoniepointClient {
  if (!_client) _client = httpMoniepoint();
  return _client;
}

/** Override the client (tests/demo) so the connect flow never calls real Moniepoint. */
export function setMoniepointClient(c: MoniepointClient): void {
  _client = c;
}
