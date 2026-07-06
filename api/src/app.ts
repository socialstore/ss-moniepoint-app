import { Hono } from "hono";
import { webhook } from "./routes/webhook";
import { checkout } from "./routes/checkout";
import { install } from "./routes/install";

export const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok", app: "ss-moniepoint-app" }));

// Inbound Moniepoint POS transfers → reconcile (FAIL-CLOSED auth).
app.route("/webhook", webhook);
// Storefront: reserve a unique payable amount + poll status.
app.route("/checkout", checkout);
// AppInstaller: store merchant creds + register terminals.
app.route("/install", install);

// Embedded admin backend (session-token verified) — next pass (p2-admin-ui).
app.get("/admin/ping", (c) => c.json({ error: "not implemented (skeleton)" }, 501));
