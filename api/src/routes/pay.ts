import { Hono } from "hono";
import { getDb } from "../store/db";
import { getReservationById, getTerminal } from "../store/repo";
import { formatMinor } from "../domain/reservation";
import type { ReservationRow } from "../store/types";

// Customer-facing, ANONYMOUS. The reservation id in the path is an unguessable UUID minted by /checkout/
// sessions and handed to exactly one customer via the redirect URL — so it doubles as the bearer. A caller
// can read only that one reservation's payment instructions + status; there is no workspace-wide access and
// no way to enumerate other orders. This router carries NO session auth (unlike /checkout and /admin).
export const pay = new Hono();

type PayStatus = "waiting" | "paid" | "expired" | "cancelled";

function statusOf(r: ReservationRow, now: number): PayStatus {
  if (r.status === "matched") return "paid";
  if (r.status === "cancelled") return "cancelled";
  if (r.status === "expired" || r.expires_at <= now) return "expired";
  return "waiting";
}

// GET /pay/:id/status — the poll feed the pay page (and the storefront modal) watch for "paid".
pay.get("/:id/status", (c) => {
  const r = getReservationById(getDb(), c.req.param("id"));
  if (!r) return c.json({ error: "not found" }, 404);
  return c.json({ status: statusOf(r, Date.now()), expiresAt: r.expires_at });
});

// GET /pay/:id — the hosted pay page. Server-rendered with the bank details inlined (no fetch flash), then
// a tiny inline script polls /status to flip to "received" and postMessage the parent (storefront modal).
pay.get("/:id", (c) => {
  const db = getDb();
  const r = getReservationById(db, c.req.param("id"));
  if (!r) return c.html(notFoundPage(), 404);
  const term = getTerminal(db, r.workspace, r.terminal_serial);
  if (!term) return c.html(notFoundPage(), 404);

  const symbol = r.currency === "NGN" ? "₦" : r.currency + " ";
  const data = {
    id: r.id,
    amount: symbol + formatMinor(r.amount_minor),
    nuban: term.nuban,
    accountName: term.account_name ?? "",
    bankName: term.bank_name,
    reference: r.reference,
    expiresAt: r.expires_at,
    status: statusOf(r, Date.now()),
  };
  return c.html(payPage(data));
});

interface PayData {
  id: string;
  amount: string;
  nuban: string;
  accountName: string;
  bankName: string;
  reference: string;
  expiresAt: number;
  status: PayStatus;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function shell(title: string, body: string): string {
  // Moniepoint-blue, theme-aware, self-contained. Neutral card that reads well on any storefront backdrop
  // and inside an iframe modal.
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<title>${esc(title)}</title>
<style>
  :root{--mp:#2f4bff;--mp-ink:#0b1220;--bg:#f6f7fa;--card:#ffffff;--line:#e6e8ef;--muted:#6b7280;--ink:#0f1420;--ok:#0ca678}
  @media (prefers-color-scheme: dark){:root{--bg:#0b0f1a;--card:#141a29;--line:#232c40;--muted:#9aa3b8;--ink:#eef1f7;--mp:#5b73ff}}
  *{box-sizing:border-box}
  html,body{margin:0}
  body{background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,sans-serif;
       min-height:100dvh;display:flex;align-items:flex-start;justify-content:center;
       padding:max(16px,env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom))}
  .wrap{width:100%;max-width:420px;margin-top:6vh}
  .brand{display:flex;align-items:center;gap:10px;margin-bottom:18px}
  .mark{width:38px;height:38px;border-radius:11px;background:var(--mp);display:flex;align-items:center;justify-content:center;flex:none;box-shadow:0 1px 3px rgba(0,0,0,.14)}
  .mark svg{width:58%;height:58%}
  .brand b{font-size:15px;letter-spacing:-.01em}
  .brand span{display:block;font-size:12px;color:var(--muted);font-weight:400}
  .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px;box-shadow:0 6px 24px rgba(16,22,40,.06)}
  .lead{font-size:13px;color:var(--muted);margin:0 0 6px}
  .amount{font-size:30px;font-weight:700;letter-spacing:-.02em;margin:0 0 2px}
  .amount small{font-size:12px;font-weight:500;color:var(--muted);display:block;margin-top:4px}
  .rows{margin:18px 0 6px;border-top:1px solid var(--line)}
  .row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}
  .row .k{font-size:12px;color:var(--muted)}
  .row .v{font-size:15px;font-weight:600;text-align:right;word-break:break-all}
  .copy{border:1px solid var(--line);background:transparent;color:var(--mp);font:inherit;font-size:12px;font-weight:600;
        border-radius:8px;padding:5px 9px;cursor:pointer;flex:none;margin-left:8px}
  .copy:active{transform:translateY(1px)}
  .status{display:flex;align-items:center;gap:9px;margin-top:16px;font-size:13px;color:var(--muted)}
  .dot{width:9px;height:9px;border-radius:50%;background:var(--mp);flex:none;animation:pulse 1.4s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:.35}50%{opacity:1}}
  .timer{margin-left:auto;font-variant-numeric:tabular-nums;font-weight:600;color:var(--ink)}
  .paid .dot{background:var(--ok);animation:none}
  .paid .status{color:var(--ok);font-weight:600}
  .note{font-size:12px;color:var(--muted);margin:14px 2px 0;line-height:1.5}
  .done{display:none;text-align:center;padding:10px 0 2px}
  .done .check{width:52px;height:52px;border-radius:50%;background:var(--ok);color:#fff;display:flex;align-items:center;justify-content:center;margin:0 auto 12px}
  .paid .done{display:block}
  .paid .rows,.paid .lead,.paid .amount,.paid .note{opacity:.4}
</style></head><body>${body}</body></html>`;
}

const MARK = `<span class="mark"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4.5" y="4.5" width="15" height="15" rx="4.5" stroke="#fff" stroke-width="2.4"/><line x1="12" y1="5.4" x2="12" y2="18.6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg></span>`;

function payPage(d: PayData): string {
  const acctName = d.accountName ? `<div class="row"><span class="k">Account name</span><span class="v">${esc(d.accountName)}</span></div>` : "";
  const body = `<div class="wrap" id="root">
  <div class="brand">${MARK}<div><b>Moniepoint</b><span>Pay with Bank Transfer</span></div></div>
  <div class="card">
    <p class="lead">Transfer exactly this amount</p>
    <div class="amount">${esc(d.amount)}<small>Send the exact amount so we can match your payment automatically.</small></div>
    <div class="rows">
      <div class="row"><span class="k">Bank</span><span class="v">${esc(d.bankName)}</span></div>
      <div class="row"><span class="k">Account number</span><span class="v" id="nuban">${esc(d.nuban)}</span><button class="copy" data-copy="${esc(d.nuban)}">Copy</button></div>
      ${acctName}
      <div class="row"><span class="k">Reference</span><span class="v">${esc(d.reference)}</span></div>
    </div>
    <div class="status"><span class="dot"></span><span id="statusText">Waiting for your transfer…</span><span class="timer" id="timer"></span></div>
    <div class="done">
      <div class="check"><svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div style="font-size:17px;font-weight:700">Payment received</div>
      <div class="note" style="opacity:1">You can close this window — your order is confirmed.</div>
    </div>
    <p class="note">Keep this page open. It updates automatically when your transfer arrives; no need to enter anything back here.</p>
  </div>
</div>
<script>
(function(){
  var id=${JSON.stringify(d.id)}, expiresAt=${d.expiresAt}, done=${JSON.stringify(d.status === "paid")};
  var root=document.getElementById('root'), statusText=document.getElementById('statusText'), timerEl=document.getElementById('timer');
  document.querySelectorAll('.copy').forEach(function(b){b.addEventListener('click',function(){
    var t=b.getAttribute('data-copy'); (navigator.clipboard&&navigator.clipboard.writeText(t)||Promise.reject()).then(function(){
      var o=b.textContent; b.textContent='Copied'; setTimeout(function(){b.textContent=o},1400);
    }).catch(function(){});
  });});
  function post(s){ try{ if(window.parent&&window.parent!==window) window.parent.postMessage({source:'sentralbee-checkout',app:'moniepoint',status:s},'*'); }catch(e){} }
  function markPaid(){ if(done)return; done=true; root.classList.add('paid'); statusText.textContent='Payment received'; timerEl.textContent=''; post('paid'); }
  function markExpired(){ if(done)return; statusText.textContent='This payment window has expired'; timerEl.textContent=''; post('expired'); }
  function tick(){
    if(done)return;
    var ms=expiresAt-Date.now();
    if(ms<=0){ timerEl.textContent='00:00'; return; }
    var s=Math.floor(ms/1000), m=Math.floor(s/60); s=s%60;
    timerEl.textContent=(m<10?'0':'')+m+':'+(s<10?'0':'')+s;
  }
  function poll(){
    fetch('/pay/'+id+'/status',{headers:{'accept':'application/json'}}).then(function(r){return r.json()}).then(function(j){
      if(j.status==='paid') markPaid(); else if(j.status==='expired'||j.status==='cancelled') markExpired();
    }).catch(function(){});
  }
  if(done){ markPaid(); } else { tick(); setInterval(tick,1000); poll(); setInterval(poll,4000); }
})();
</script>`;
  return shell("Pay with Bank Transfer", body);
}

function notFoundPage(): string {
  return shell(
    "Checkout not found",
    `<div class="wrap"><div class="brand">${MARK}<div><b>Moniepoint</b><span>Pay with Bank Transfer</span></div></div>
     <div class="card"><p class="lead">This checkout link is invalid or has expired.</p>
     <p class="note" style="margin-top:8px">Head back to the store and try again.</p></div></div>`,
  );
}
