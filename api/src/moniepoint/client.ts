// Moniepoint POS developer API client. When a merchant connects, the app uses THEIR client
// credentials to authenticate and CREATE a webhook subscription — Moniepoint returns the signing
// secret, so the merchant never hand-copies it and the app never asks for it.
//
// The exact auth + subscription paths/payloads are PARTNER-GATED (best-guess from the public
// research: channel.moniepoint.com + the "Subscription Management" webhook docs). They are fully
// configurable via env and the client is injectable (setMoniepointClient) so dev/tests/demo never
// hit real Moniepoint — confirm the real endpoints against Moniepoint before go-live.

export interface WebhookSubscription {
  subscriptionId: string;
  secret: string;
}

export interface MoniepointClient {
  authenticate(clientId: string, clientSecret: string): Promise<string>; // -> bearer token
  createWebhookSubscription(token: string, webhookUrl: string, events?: string[]): Promise<WebhookSubscription>;
}

const DEFAULT_EVENTS = ["V1_POS_TRANSFER_TRANSACTION", "V1_TRANSFER_TRANSACTION"];

export function httpMoniepoint(cfg?: { apiBase?: string; authUrl?: string }): MoniepointClient {
  const apiBase = (cfg?.apiBase ?? Bun.env.MONIEPOINT_API_BASE ?? "https://channel.moniepoint.com").replace(/\/$/, "");
  const authUrl = cfg?.authUrl ?? Bun.env.MONIEPOINT_AUTH_URL ?? `${apiBase}/oauth/token`;
  return {
    async authenticate(clientId, clientSecret) {
      const res = await fetch(authUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
      });
      if (!res.ok) throw new Error(`moniepoint auth failed (${res.status})`);
      const data = (await res.json()) as { access_token?: string };
      if (!data.access_token) throw new Error("moniepoint auth returned no access_token");
      return data.access_token;
    },
    async createWebhookSubscription(token, webhookUrl, events = DEFAULT_EVENTS) {
      const res = await fetch(`${apiBase}/v1/webhooks/subscriptions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: webhookUrl, events }),
      });
      if (!res.ok) throw new Error(`moniepoint subscription failed (${res.status})`);
      const data = (await res.json()) as { id?: string; subscriptionId?: string; secret?: string; signingSecret?: string };
      const secret = data.secret ?? data.signingSecret;
      if (!secret) throw new Error("moniepoint subscription returned no signing secret");
      return { subscriptionId: data.subscriptionId ?? data.id ?? "", secret };
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
