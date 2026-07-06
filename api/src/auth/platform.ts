import { importSPKI, jwtVerify, type KeyLike } from "jose";
import { createMiddleware } from "hono/factory";
import type { Database } from "bun:sqlite";
import type { Context } from "hono";

// Trust the platform via ASYMMETRIC JWTs: the platform signs with its PRIVATE key, this app verifies
// with the platform's PUBLIC key only — so a hosted app can verify but never FORGE a token (unlike a
// shared HS256 secret). Every token must carry aud = this app's audience, so app A's token can never
// be replayed to app B. Two purposes:
//   - "provision" (server-to-server, one-time): platform delivers a workspace's minted api key.
//   - "session"   (embed/storefront): authenticates a request AS a workspace.

const ALG = "EdDSA"; // Ed25519 — small keys, modern. (Platform may switch to RS256; keep in lockstep.)
const AUDIENCE = Bun.env.MONIEPOINT_APP_AUDIENCE ?? "moniepoint-app";

let _key: KeyLike | null = null;
async function platformKey(): Promise<KeyLike> {
  if (_key) return _key;
  const raw = Bun.env.PLATFORM_JWT_PUBLIC_KEY;
  if (!raw) throw new Error("PLATFORM_JWT_PUBLIC_KEY is not set — refusing to verify platform tokens");
  _key = await importSPKI(decodeKeyMaterial(raw), ALG);
  return _key;
}

// Accept a PEM (raw multiline, or "\n"-escaped) OR a base64-encoded PEM — base64 is the single-line form
// that survives secret-manager + shell-sourced env delivery, and matches how the platform signer loads.
function decodeKeyMaterial(raw: string): string {
  const s = raw.trim();
  if (s.includes("-----BEGIN")) return s.replace(/\\n/g, "\n");
  try {
    const decoded = Buffer.from(s, "base64").toString("utf8");
    if (decoded.includes("-----BEGIN")) return decoded;
  } catch {
    /* fall through */
  }
  return s;
}

/** Test/reset hook so tests can inject a public key without env. */
export function _setPlatformKey(k: KeyLike | null): void {
  _key = k;
}

export interface PlatformClaims {
  workspace: string;
  purpose: "provision" | "session";
  scopes: string[];
  handle?: string;
  jti?: string;
}

async function verify(token: string, purpose: "provision" | "session"): Promise<PlatformClaims> {
  const { payload } = await jwtVerify(token, await platformKey(), { audience: AUDIENCE, algorithms: [ALG] });
  if (payload["purpose"] !== purpose) throw new Error(`token purpose is not '${purpose}'`);
  const workspace = payload["wid"];
  if (typeof workspace !== "string" || !workspace) throw new Error("token carries no workspace (wid)");
  return {
    workspace,
    purpose,
    scopes: Array.isArray(payload["scopes"]) ? (payload["scopes"] as string[]) : [],
    handle: typeof payload["handle"] === "string" ? payload["handle"] : undefined,
    jti: payload.jti,
  };
}

/** A session token authenticates an embed/storefront request AS a workspace. Reusable within exp. */
export function verifySession(token: string): Promise<PlatformClaims> {
  return verify(token, "session");
}

/** A provision token is ONE-TIME: its jti is consumed in the app db so a captured token can't replay. */
export async function verifyProvision(db: Database, token: string): Promise<PlatformClaims> {
  const claims = await verify(token, "provision");
  if (!claims.jti) throw new Error("provision token has no jti");
  const res = db.query("INSERT OR IGNORE INTO consumed_jti (jti, consumed_at) VALUES (?, ?)").run(claims.jti, Date.now());
  if (res.changes === 0) throw new Error("provision token already used (replay)");
  return claims;
}

/** Pull a Bearer token off the Authorization header (null if absent). */
export function bearer(c: Context): string | null {
  const h = c.req.header("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1]! : null;
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
