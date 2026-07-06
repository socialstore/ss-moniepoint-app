# ss-moniepoint-app

The Moniepoint **"Pay with Bank Transfer"** marketplace app for Sentralbee.

A **Level-2 app**: it reaches Sentralbee **only through the public HTTP API** (never an
`ss-*-service` internal package, the `colossal-db` client, or the org-wide `SECRET_32`). It
holds its own datastore + encryption key and verifies platform tokens via the platform JWKS.
That boundary is enforced by `api/src/level2.test.ts` and is the mechanical proof of
"reconcile a real order with no core edit".

## Stack

- **API layer** — Bun + [Hono](https://hono.dev). Receives Moniepoint webhooks, reconciles
  (unique-amount match + suspense ledger), calls the Sentralbee public API to mark orders
  paid, and serves the embed UI.
- **Embed UI** — React + Vite. Iframed by `ss-platform-app` from the app's `app_url`;
  talks only to this app's `/admin` backend using a short-lived platform session token.

## Layout

```
api/   Bun + Hono API           (@ss-moniepoint/api)
  src/index.ts   Bun.serve entrypoint
  src/app.ts     Hono routes: /webhook /checkout /install /admin
  src/level2.test.ts   Level-2 isolation gate
ui/    React + Vite embed UI    (@ss-moniepoint/ui)
  src/App.tsx    admin shell (Connect · Terminals · Clearing-house)
  src/bridge.ts  postMessage bridge to the platform host
```

## Develop

```sh
bun install
bun run dev          # api on :8080 (serves the UI in prod)
bun run --filter '@ss-moniepoint/ui' dev   # vite dev server for the UI
bun run typecheck
bun test ./api       # includes the Level-2 boundary gate
```

## Status

Skeleton. Routes/datastore/UI are stubs; the Phase-2 build units flesh them out
(p2-app-scaffold, p2-publicapi-client, p2-install-connect, p2-reservation,
p2-webhook-reconciler, p2-checkout-descriptor, p2-admin-ui). The swarm's hermetic floor
needs a **Bun/Vite profile** for this repo (bun install --frozen-lockfile · bun test · tsc ·
vite build) — it is not a `go-service`.
