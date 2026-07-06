import { requestSessionToken } from "./bridge";

// The admin UI is served by the app's own API (same origin), so calls are relative. Auth is a short-lived
// platform SESSION TOKEN obtained from the embed host (or a ?token= param in dev) and sent as a Bearer
// token. The app derives the workspace from the verified token — the UI never sends a workspace and never
// holds an api key.
const API = "";

let _tokenPromise: Promise<string> | null = null;
export function sessionToken(): Promise<string> {
  if (!_tokenPromise) {
    const fromUrl = new URLSearchParams(location.search).get("token");
    _tokenPromise = fromUrl ? Promise.resolve(fromUrl) : requestSessionToken();
  }
  return _tokenPromise;
}

/** Best-effort, DISPLAY-ONLY decode of the workspace from the token (never trusted for authz). */
export function workspaceFromToken(token: string): string {
  try {
    const payload = JSON.parse(atob((token.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.wid === "string" ? payload.wid : "";
  } catch {
    return "";
  }
}

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await sessionToken();
  const res = await fetch(API + path, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
}

export interface AppConfig {
  configured: boolean;
  businessId: string | null;
  hasClientCreds: boolean;
  webhookConfigured: boolean;
  subscriptionId: string | null;
}
export interface WebhookSetup {
  ok: boolean;
  subscriptionId?: string;
  error?: string;
}
export interface Terminal {
  id: string;
  terminal_serial: string;
  nuban: string;
  account_name: string | null;
  bank_name: string;
}
export interface Unmapped {
  id: string;
  moniepoint_txn_id: string;
  terminal_serial: string | null;
  amount_minor: number;
  currency: string;
  sender_name: string | null;
  status: string;
  received_at: number;
}

export const api = {
  config: () => j<AppConfig>(`/admin/config`),
  connect: (body: Record<string, unknown>) =>
    j<{ ok: boolean; webhookSetup?: WebhookSetup }>(`/install/connect`, { method: "POST", body: JSON.stringify(body) }),
  terminals: () => j<{ terminals: Terminal[] }>(`/admin/terminals`),
  clearingHouse: () => j<{ unmapped: Unmapped[] }>(`/admin/clearing-house`),
  resolve: (id: string, orderId: string) =>
    j<{ ok: boolean }>(`/admin/clearing-house/${id}/resolve`, { method: "POST", body: JSON.stringify({ orderId }) }),
};

export function naira(minor: number): string {
  return "₦" + (minor / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 });
}
