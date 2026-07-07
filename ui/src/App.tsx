import { useEffect, useState } from "react";
import { Inbox, Landmark, ShieldCheck, Wifi, type LucideIcon } from "lucide-react";
import { ready } from "./bridge";
import { useHostTheme } from "./theme";
import { api, naira, sessionToken, workspaceFromToken, type AppConfig, type Terminal, type Unmapped } from "./api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Tab = "connect" | "terminals" | "clearing";

// The Moniepoint "window" mark: a blue rounded-square tile holding a white window/aperture glyph.
function MoniepointMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[28%] bg-primary text-primary-foreground shadow-sm",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-[58%]" fill="none" aria-hidden="true">
        <rect x="4.5" y="4.5" width="15" height="15" rx="4.5" stroke="currentColor" strokeWidth="2.4" />
        <line x1="12" y1="5.4" x2="12" y2="18.6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function App() {
  useHostTheme();
  const [tab, setTab] = useState<Tab>("connect");
  const [ws, setWs] = useState<string | undefined>(undefined); // undefined = resolving the session token
  useEffect(() => {
    ready();
    sessionToken().then((t) => setWs(t ? workspaceFromToken(t) : ""));
  }, []);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <header className="flex items-center justify-between gap-3 pb-6">
          <div className="flex items-center gap-3">
            <MoniepointMark className="size-11" />
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight">Moniepoint</div>
              <div className="text-xs text-muted-foreground">Pay with Bank Transfer</div>
            </div>
          </div>
          {ws ? (
            <Badge variant="secondary" className="max-w-[45%] truncate font-normal text-muted-foreground">
              {ws}
            </Badge>
          ) : null}
        </header>

        {ws === undefined ? (
          <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : !ws ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-1 py-14 text-center">
              <MoniepointMark className="mb-3 size-12" />
              <div className="font-medium">No session in context</div>
              <div className="text-sm text-muted-foreground">Open this app from your Sentralbee dashboard.</div>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList className="mb-5">
              <TabsTrigger value="connect">Connect</TabsTrigger>
              <TabsTrigger value="terminals">Terminals</TabsTrigger>
              <TabsTrigger value="clearing">Clearing-house</TabsTrigger>
            </TabsList>
            <TabsContent value="connect">
              <Connect />
            </TabsContent>
            <TabsContent value="terminals">
              <Terminals />
            </TabsContent>
            <TabsContent value="clearing">
              <ClearingHouse />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

function StatusPill({ ok, icon: Icon, on, off }: { ok: boolean; icon: LucideIcon; on: string; off: string }) {
  return (
    <Badge variant={ok ? "default" : "secondary"} className={cn("gap-1 font-normal", !ok && "text-muted-foreground")}>
      <Icon className="size-3" />
      {ok ? on : off}
    </Badge>
  );
}

function Field(p: { label: string; v: string; on: (v: string) => void; secret?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{p.label}</Label>
      <Input type={p.secret ? "password" : "text"} value={p.v} onChange={(e) => p.on(e.target.value)} />
    </div>
  );
}

function Connect() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [f, setF] = useState({ businessId: "", moniepointClientId: "", moniepointClientSecret: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => api.config().then(setCfg).catch((e) => setMsg(String(e.message)));
  useEffect(() => {
    load();
  }, []);

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      const res = await api.connect(f);
      setF({ ...f, moniepointClientSecret: "" });
      const w = res.webhookSetup;
      setMsg(w?.ok ? `Connected · webhook subscription created (${w.subscriptionId || "ok"})` : `Saved · webhook: ${w?.error ?? "pending"}`);
      load();
    } catch (e) {
      setMsg("Error: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection</CardTitle>
        <CardDescription>Link your Moniepoint account so transfers reconcile to orders automatically.</CardDescription>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <StatusPill ok={!!cfg?.configured} icon={ShieldCheck} on="Connected" off="Not connected" />
          {cfg?.hasClientCreds ? (
            <Badge variant="secondary" className="gap-1 font-normal">
              <Landmark className="size-3" /> Moniepoint creds
            </Badge>
          ) : null}
          {cfg?.webhookConfigured ? (
            <Badge variant="secondary" className="gap-1 font-normal">
              <Wifi className="size-3" /> Webhook active
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Moniepoint business ID" v={f.businessId} on={(v) => setF({ ...f, businessId: v })} />
        <Field label="Moniepoint API client ID" v={f.moniepointClientId} on={(v) => setF({ ...f, moniepointClientId: v })} />
        <Field label="Moniepoint API client secret" v={f.moniepointClientSecret} on={(v) => setF({ ...f, moniepointClientSecret: v })} secret />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Your Sentralbee API access was provisioned automatically on install — the app also creates the Moniepoint webhook
          subscription for you, so there are no keys or secrets to copy.
        </p>
      </CardContent>
      <CardFooter className="gap-3">
        <Button className="rounded-full px-5" disabled={busy} onClick={save}>
          {busy ? "Connecting…" : "Connect"}
        </Button>
        {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
      </CardFooter>
    </Card>
  );
}

function Terminals() {
  const [rows, setRows] = useState<Terminal[]>([]);
  const [f, setF] = useState({ terminalSerial: "", nuban: "", accountName: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => api.terminals().then((r) => setRows(r.terminals)).catch((e) => setMsg(String(e.message)));
  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!f.terminalSerial || !f.nuban) return setMsg("Serial + NUBAN required");
    setBusy(true);
    setMsg("");
    try {
      await api.connect({ terminals: [f] });
      setF({ terminalSerial: "", nuban: "", accountName: "" });
      load();
    } catch (e) {
      setMsg("Error: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Terminals</CardTitle>
        <CardDescription>POS terminals whose transfers this app reconciles.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Terminal serial</TableHead>
                <TableHead>NUBAN</TableHead>
                <TableHead>Account</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.terminal_serial}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.nuban} · {t.bank_name}
                  </TableCell>
                  <TableCell>{t.account_name ?? "—"}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                    No terminals yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Input placeholder="Serial" value={f.terminalSerial} onChange={(e) => setF({ ...f, terminalSerial: e.target.value })} />
          <Input placeholder="NUBAN" value={f.nuban} onChange={(e) => setF({ ...f, nuban: e.target.value })} />
          <Input placeholder="Account name" value={f.accountName} onChange={(e) => setF({ ...f, accountName: e.target.value })} />
          <Button className="rounded-full" disabled={busy} onClick={add}>
            Add
          </Button>
        </div>
        {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
      </CardContent>
    </Card>
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
    if (!orderId) return setMsg("Enter an order id");
    setMsg("");
    try {
      await api.resolve(id, orderId);
      load();
    } catch (e) {
      setMsg("Error: " + (e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clearing-house</CardTitle>
        <CardDescription>Unmatched transfers awaiting reconciliation. Bind one to an order to mark it paid.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Amount</TableHead>
                <TableHead>Sender / status</TableHead>
                <TableHead className="text-right">Bind to order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-semibold">{naira(u.amount_minor)}</div>
                    <div className="text-xs text-muted-foreground">{u.terminal_serial ?? "—"}</div>
                  </TableCell>
                  <TableCell>
                    <div>{u.sender_name ?? "unknown"}</div>
                    <div className="text-xs text-muted-foreground">{u.status}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Input
                        className="h-8 w-32"
                        placeholder="Order id"
                        value={orderIds[u.id] ?? ""}
                        onChange={(e) => setOrderIds({ ...orderIds, [u.id]: e.target.value })}
                      />
                      <Button size="sm" className="rounded-full" onClick={() => resolve(u.id)}>
                        Match
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                    <Inbox className="mx-auto mb-2 size-5 opacity-60" />
                    Nothing unmatched — clean.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {msg ? <p className="pt-3 text-xs text-muted-foreground">{msg}</p> : null}
      </CardContent>
    </Card>
  );
}
