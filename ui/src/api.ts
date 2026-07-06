// The admin UI is served by the app's own API (same origin), so calls are relative. The workspace
// comes from the embed URL for now; the platform session token replaces it in a later pass.
const API = "";

export function workspace(): string {
  return new URLSearchParams(location.search).get("workspace") ?? "";
}

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API + path, { headers: { "content-type": "application/json" }, ...init });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
}

export interface AppConfig {
  configured: boolean;
  businessId: string | null;
  hasMoniepointSecret: boolean;
  hasWebhookSecret: boolean;
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
  config: () => j<AppConfig>(`/admin/config?workspace=${encodeURIComponent(workspace())}`),
  connect: (body: Record<string, unknown>) =>
    j<{ ok: boolean }>(`/install/connect`, { method: "POST", body: JSON.stringify({ workspace: workspace(), ...body }) }),
  terminals: () => j<{ terminals: Terminal[] }>(`/admin/terminals?workspace=${encodeURIComponent(workspace())}`),
  clearingHouse: () => j<{ unmapped: Unmapped[] }>(`/admin/clearing-house?workspace=${encodeURIComponent(workspace())}`),
  resolve: (id: string, orderId: string) =>
    j<{ ok: boolean }>(`/admin/clearing-house/${id}/resolve`, { method: "POST", body: JSON.stringify({ orderId }) }),
};

export function naira(minor: number): string {
  return "₦" + (minor / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 });
}
