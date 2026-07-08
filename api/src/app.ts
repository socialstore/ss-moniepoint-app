import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { webhook } from "./routes/webhook";
import { checkout } from "./routes/checkout";
import { pay } from "./routes/pay";
import { install } from "./routes/install";
import { admin } from "./routes/admin";

export const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok", app: "ss-moniepoint-app" }));

// The app's brand mark (white window glyph on transparent) — declared in the catalog as the checkout
// button's leading icon, so the storefront renders it without knowing anything Moniepoint-specific.
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><rect x="4.5" y="4.5" width="15" height="15" rx="4.5" stroke="#fff" stroke-width="2.4"/><line x1="12" y1="5.4" x2="12" y2="18.6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`;
app.get("/icon.svg", () => new Response(ICON_SVG, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=86400" } }));

// Inbound Moniepoint POS transfers → reconcile (FAIL-CLOSED auth).
app.route("/webhook", webhook);
// Storefront: create a checkout session (session-authed) + reserve a unique payable amount.
app.route("/checkout", checkout);
// Customer-facing hosted pay page + status feed (ANONYMOUS, scoped by unguessable reservation id).
app.route("/pay", pay);
// AppInstaller: store merchant creds + register terminals.
app.route("/install", install);
// Embedded admin backend: connect · terminals · clearing-house.
app.route("/admin", admin);

// Serve the built embed UI (ui/dist) from the same origin — registered LAST so the API routes win.
app.use("/*", serveStatic({ root: "./ui/dist" }));
