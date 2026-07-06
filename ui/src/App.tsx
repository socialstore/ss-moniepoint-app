import { useEffect, useState, type CSSProperties } from "react";
import { ready } from "./bridge";
import { api, naira, workspace, type AppConfig, type Terminal, type Unmapped } from "./api";

type Tab = "connect" | "terminals" | "clearing";

export function App() {
  useEffect(() => {
    ready();
  }, []);
  const [tab, setTab] = useState<Tab>("connect");
  const ws = workspace();

  return (
    <main style={S.main}>
      <header style={S.header}>
        <strong>Moniepoint · Pay with Bank</strong>
        <span style={S.badge}>{ws || "no workspace"}</span>
      </header>
      <nav style={S.nav}>
        {(["connect", "terminals", "clearing"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ ...S.tab, ...(tab === t ? S.tabOn : {}) }}>
            {t === "connect" ? "Connect" : t === "terminals" ? "Terminals" : "Clearing-house"}
          </button>
        ))}
      </nav>
      <section style={S.body}>
        {!ws ? (
          <p style={S.dim}>Open this app from your Sentralbee dashboard — no workspace in context.</p>
        ) : tab === "connect" ? (
          <Connect />
        ) : tab === "terminals" ? (
          <Terminals />
        ) : (
          <ClearingHouse />
        )}
      </section>
    </main>
  );
}

function Connect() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [f, setF] = useState({ businessId: "", moniepointSecret: "", sentralbeeKey: "", webhookSecret: "" });
  const [msg, setMsg] = useState("");
  const load = () => api.config().then(setCfg).catch((e) => setMsg(String(e.message)));
  useEffect(() => {
    load();
  }, []);

  async function save() {
    setMsg("saving…");
    try {
      await api.connect(f);
      setF({ businessId: f.businessId, moniepointSecret: "", sentralbeeKey: "", webhookSecret: "" });
      setMsg("saved");
      load();
    } catch (e) {
      setMsg("error: " + (e as Error).message);
    }
  }

  return (
    <div>
      <p style={S.dim}>
        Status: {cfg?.configured ? "✓ connected" : "not connected"}
        {cfg?.hasMoniepointSecret ? " · moniepoint secret set" : ""}
        {cfg?.hasWebhookSecret ? " · webhook secret set" : ""}
      </p>
      <Field label="Moniepoint business id" v={f.businessId} on={(v) => setF({ ...f, businessId: v })} />
      <Field label="Moniepoint API secret" v={f.moniepointSecret} on={(v) => setF({ ...f, moniepointSecret: v })} secret />
      <Field label="Moniepoint webhook secret" v={f.webhookSecret} on={(v) => setF({ ...f, webhookSecret: v })} secret />
      <Field label="Sentralbee app API key (sale-payment)" v={f.sentralbeeKey} on={(v) => setF({ ...f, sentralbeeKey: v })} secret />
      <button style={S.primary} onClick={save}>
        Save connection
      </button>
      <span style={S.msg}>{msg}</span>
    </div>
  );
}

function Terminals() {
  const [rows, setRows] = useState<Terminal[]>([]);
  const [f, setF] = useState({ terminalSerial: "", nuban: "", accountName: "" });
  const [msg, setMsg] = useState("");
  const load = () => api.terminals().then((r) => setRows(r.terminals)).catch((e) => setMsg(String(e.message)));
  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!f.terminalSerial || !f.nuban) return setMsg("serial + NUBAN required");
    setMsg("adding…");
    try {
      await api.connect({ terminals: [f] });
      setF({ terminalSerial: "", nuban: "", accountName: "" });
      setMsg("");
      load();
    } catch (e) {
      setMsg("error: " + (e as Error).message);
    }
  }

  return (
    <div>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Terminal serial</th>
            <th style={S.th}>NUBAN</th>
            <th style={S.th}>Account</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td style={S.td}>{t.terminal_serial}</td>
              <td style={S.td}>
                {t.nuban} · {t.bank_name}
              </td>
              <td style={S.td}>{t.account_name ?? "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td style={S.td} colSpan={3}>
                <span style={S.dim}>No terminals yet.</span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div style={S.row}>
        <input style={S.input} placeholder="serial" value={f.terminalSerial} onChange={(e) => setF({ ...f, terminalSerial: e.target.value })} />
        <input style={S.input} placeholder="NUBAN" value={f.nuban} onChange={(e) => setF({ ...f, nuban: e.target.value })} />
        <input style={S.input} placeholder="account name" value={f.accountName} onChange={(e) => setF({ ...f, accountName: e.target.value })} />
        <button style={S.primary} onClick={add}>
          Add
        </button>
      </div>
      <span style={S.msg}>{msg}</span>
    </div>
  );
}

function ClearingHouse() {
  const [rows, setRows] = useState<Unmapped[]>([]);
  const [orderIds, setOrderIds] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const load = () => api.clearingHouse().then((r) => setRows(r.unmapped)).catch((e) => setMsg(String(e.message)));
  useEffect(() => {
    load();
  }, []);

  async function resolve(id: string) {
    const orderId = orderIds[id];
    if (!orderId) return setMsg("enter an order id");
    setMsg("resolving…");
    try {
      await api.resolve(id, orderId);
      setMsg("");
      load();
    } catch (e) {
      setMsg("error: " + (e as Error).message);
    }
  }

  return (
    <div>
      <p style={S.dim}>Unmatched transfers awaiting reconciliation. Bind one to an order to mark it paid.</p>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Amount</th>
            <th style={S.th}>Sender / status</th>
            <th style={S.th}>Bind to order</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td style={S.td}>
                <strong>{naira(u.amount_minor)}</strong>
                <div style={S.dim}>{u.terminal_serial ?? "—"}</div>
              </td>
              <td style={S.td}>
                {u.sender_name ?? "unknown"}
                <div style={S.dim}>{u.status}</div>
              </td>
              <td style={S.td}>
                <input style={S.input} placeholder="order id" value={orderIds[u.id] ?? ""} onChange={(e) => setOrderIds({ ...orderIds, [u.id]: e.target.value })} />
                <button style={S.primary} onClick={() => resolve(u.id)}>
                  Match
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td style={S.td} colSpan={3}>
                <span style={S.dim}>Nothing unmatched — clean.</span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <span style={S.msg}>{msg}</span>
    </div>
  );
}

function Field(p: { label: string; v: string; on: (v: string) => void; secret?: boolean }) {
  return (
    <label style={S.label}>
      <span style={S.dim}>{p.label}</span>
      <input style={S.input} type={p.secret ? "password" : "text"} value={p.v} onChange={(e) => p.on(e.target.value)} />
    </label>
  );
}

const S: Record<string, CSSProperties> = {
  main: { fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "0 auto", padding: 16, color: "#111" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12 },
  badge: { fontSize: 12, background: "#eef", borderRadius: 6, padding: "2px 8px", color: "#446" },
  nav: { display: "flex", gap: 6, borderBottom: "1px solid #e5e5e5", marginBottom: 16 },
  tab: { border: "none", background: "none", padding: "8px 10px", cursor: "pointer", borderBottom: "2px solid transparent", fontSize: 14 },
  tabOn: { borderBottom: "2px solid #3355ff", fontWeight: 600 },
  body: { fontSize: 14 },
  dim: { color: "#888", fontSize: 12 },
  label: { display: "block", marginBottom: 10 },
  input: { display: "block", width: "100%", boxSizing: "border-box", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 6, fontSize: 14 },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 6, marginTop: 8 },
  primary: { background: "#3355ff", color: "#fff", border: "none", borderRadius: 6, padding: "7px 12px", cursor: "pointer", fontSize: 14 },
  msg: { marginLeft: 10, fontSize: 12, color: "#666" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e5e5e5", color: "#666", fontWeight: 600 },
  td: { padding: "8px", borderBottom: "1px solid #f0f0f0", verticalAlign: "top" },
};
