import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { webhook } from "./routes/webhook";
import { checkout } from "./routes/checkout";
import { install } from "./routes/install";
import { admin } from "./routes/admin";

export const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok", app: "ss-moniepoint-app" }));

// Inbound Moniepoint POS transfers → reconcile (FAIL-CLOSED auth).
app.route("/webhook", webhook);
// Storefront: reserve a unique payable amount + poll status.
app.route("/checkout", checkout);
// AppInstaller: store merchant creds + register terminals.
app.route("/install", install);
// Embedded admin backend: connect · terminals · clearing-house.
app.route("/admin", admin);

// Serve the built embed UI (ui/dist) from the same origin — registered LAST so the API routes win.
app.use("/*", serveStatic({ root: "./ui/dist" }));
