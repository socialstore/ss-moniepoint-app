import { createTokenVerifier, bearer as bearerOf, type PlatformClaims as SdkPlatformClaims, type TokenVerifier } from "@sentralbee/app-sdk";
import { createMiddleware } from "hono/factory";
import type { Database } from "bun:sqlite";
import type { Context } from "hono";

// Trust the platform via ASYMMETRIC JWTs: the platform signs with its PRIVATE key, this app verifies with
// the platform's PUBLIC key only — so a hosted app can verify but never FORGE a token. The verification +
// claim shape live in @sentralbee/app-sdk (createTokenVerifier); this module wires it to the app's env +
// db and preserves the app's install-lifecycle contract. Every token must carry aud = this app's audience
// AND iss = the platform issuer (both enforced by the SDK). Two purposes:
//   - "provision" (server-to-server, one-time): platform delivers a workspace's minted api key.
//   - "session"   (embed/storefront): authenticates a request AS a workspace.

const AUDIENCE = Bun.env.MONIEPOINT_APP_AUDIENCE ?? "moniepoint-app";

/** Re-export the SDK's claim shape (its `provider` supersedes the old `handle`). */
export type PlatformClaims = SdkPlatformClaims;

let _pemOverride: string | null = null; // test hook
let _verifier: TokenVerifier | null = null;
let _verifierPem: string | null = null;

// Build (and cache) the SDK verifier from the injected test key or PLATFORM_JWT_PUBLIC_KEY. Fails CLOSED:
// with no public key we refuse to verify, rather than trusting anything.
function verifier(): TokenVerifier {
  const pem = _pemOverride ?? Bun.env.PLATFORM_JWT_PUBLIC_KEY ?? "";
  if (!pem) throw new Error("PLATFORM_JWT_PUBLIC_KEY is not set — refusing to verify platform tokens");
  if (!_verifier || _verifierPem !== pem) {
    _verifier = createTokenVerifier({ publicKeyPem: pem, audience: AUDIENCE });
    _verifierPem = pem;
  }
  return _verifier;
}

/** Test/reset hook so tests can inject the platform PUBLIC key (PEM) without env; null clears it. */
export function _setPlatformKey(pem: string | null): void {
  _pemOverride = pem;
  _verifier = null;
  _verifierPem = null;
}

/** A session token authenticates an embed/storefront request AS a workspace. Reusable within exp. `async`
 *  so a fail-closed verifier() (no key configured) surfaces as a REJECTION, not a synchronous throw. */
export async function verifySession(token: string): Promise<PlatformClaims> {
  return verifier().verifySession(token);
}

/** A provision token is ONE-TIME: the SDK validates it (signature/aud/iss/purpose + jti present); we then
 *  consume its jti in the app db so a captured token can't replay. */
export async function verifyProvision(db: Database, token: string): Promise<PlatformClaims> {
  const claims = await verifier().verifyProvision(token);
  const res = db.query("INSERT OR IGNORE INTO consumed_jti (jti, consumed_at) VALUES (?, ?)").run(claims.jti!, Date.now());
  if (res.changes === 0) throw new Error("provision token already used (replay)");
  return claims;
}

/** Pull a Bearer token off the Authorization header (null if absent). */
export function bearer(c: Context): string | null {
  return bearerOf(c.req.header("authorization"));
}

/** Vars a session-authed route can read: the tenant + consented scopes, both derived from the token. */
export type SessionVars = { workspace: string; scopes: string[] };

// Gate embed/storefront routes: the workspace is taken from the VERIFIED session token, never from a
// query param or body — so a caller can only ever act as the tenant the platform minted the token for.
export const sessionAuth = createMiddleware<{ Variables: SessionVars }>(async (c, next) => {
  const token = bearer(c);
  if (!token) return c.json({ error: "unauthorized" }, 401);
  try {
    const claims = await verifySession(token);
    c.set("workspace", claims.workspace);
    c.set("scopes", claims.scopes);
  } catch {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});
