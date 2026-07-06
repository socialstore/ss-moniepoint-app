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
bun test ./api       # includes the Level-2 boundary gate + tenant + platform-auth suites
bun run demo         # end-to-end loop against mocks: provision → connect → reserve → webhook → paid → uninstall
```

## Auth & env

The app trusts the platform via **asymmetric JWTs** (the platform signs with its private key; the app
only ever holds the public key, so it can verify but never forge). Two token purposes, both `aud` =
this app so app A's token can't be replayed to app B:

- **provision** (one-time, server-to-server) — the platform delivers a workspace's auto-minted Sentralbee
  api key to `POST /install/provision`; also authorises `POST /install/uninstall`. The `jti` is consumed
  in `consumed_jti` to block replay.
- **session** (short-lived) — the embed UI + storefront present it on `/install/connect`, `/admin/*`, and
  `/checkout/*`. The workspace comes from the verified claim, never a query param or body.

| Env var | Purpose |
| --- | --- |
| `MONIEPOINT_APP_KEY` | AES-256-GCM key for at-rest secret encryption. **Fails closed** if unset. |
| `PLATFORM_JWT_PUBLIC_KEY` | Platform's Ed25519 **public** key (SPKI PEM). Fails closed if unset. |
| `MONIEPOINT_APP_AUDIENCE` | Expected `aud` on platform tokens (default `moniepoint-app`). |
| `MONIEPOINT_APP_PUBLIC_URL` | Public base URL; the webhook subscription is created at `…/webhook`. |
| `SENTRALBEE_API_URL` | Public commerce API base for the mark-paid write. |
| `MONIEPOINT_API_BASE` / `MONIEPOINT_AUTH_URL` | Moniepoint endpoints (partner-gated; confirm before go-live). |

## Status

**Built + tested** (28 tests, `tsc` clean, `bun run demo` green end-to-end):
- Reconciliation loop — unique-amount reservation, fail-closed HMAC webhook, suspense/clearing-house
  ledger, idempotent mark-paid to the public API.
- **Tenant-safe data layer** — global-unique terminal serials (no squatting), per-tenant txn idempotency,
  workspace-scoped matcher/suspense/reservations.
- **Platform-token auth (Track B1)** — asymmetric provision + session JWTs, one-time provision, session
  gate on connect/admin/checkout, `/uninstall` purge + Moniepoint subscription teardown. Embed UI carries
  the session token via the host bridge (`?token=` in dev).

**Next (Track B2, platform-side):** app-catalog trust anchor, auto-mint on consent, asymmetric token
signing + server-to-server provision dispatcher, consent screen, session-token exchange, separate app-key
quota bucket, uninstall orchestration — across `ss-workspace-service` + `colossal-db` + `ss-platform-app`.
The swarm's hermetic floor uses a **Bun/Vite profile** for this repo (bun install --frozen-lockfile · tsc
· bun test · vite build) — it is not a `go-service`.
