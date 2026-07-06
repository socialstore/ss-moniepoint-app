import { app } from "./app";
import { getDb } from "./store/db";

getDb(); // open + migrate the app's datastore on boot

const port = Number(Bun.env.PORT ?? 8080);

// Bun.serve wires Hono's fetch handler. In production this same server also serves the
// built embed UI (ui/dist) — added by p2-admin-ui.
const server = Bun.serve({ port, fetch: app.fetch });

console.log(`ss-moniepoint-app api listening on :${server.port}`);
