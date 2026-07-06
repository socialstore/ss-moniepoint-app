// TEST/DEMO ONLY — mints platform tokens with an ephemeral keypair so tests and the demo can exercise
// the real verifier without the platform. Never imported by the server (app.ts), so it never ships in
// the running bundle. In production the platform holds the private key; the app only ever has the public.
import { exportSPKI, generateKeyPair, SignJWT, type KeyLike } from "jose";

const ALG = "EdDSA";
const AUDIENCE = "moniepoint-app";

export interface TestKeys {
  publicKeyPem: string;
  privateKey: KeyLike;
}

export async function makeTestKeys(): Promise<TestKeys> {
  const { publicKey, privateKey } = await generateKeyPair(ALG);
  return { publicKeyPem: await exportSPKI(publicKey), privateKey };
}

export function signSession(
  priv: KeyLike,
  workspace: string,
  opts?: { scopes?: string[]; handle?: string; aud?: string; expSec?: number },
): Promise<string> {
  return new SignJWT({ wid: workspace, purpose: "session", scopes: opts?.scopes ?? [], handle: opts?.handle })
    .setProtectedHeader({ alg: ALG })
    .setAudience(opts?.aud ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${opts?.expSec ?? 300}s`)
    .sign(priv);
}

export function signProvision(
  priv: KeyLike,
  workspace: string,
  opts?: { scopes?: string[]; jti?: string; aud?: string; expSec?: number },
): Promise<string> {
  return new SignJWT({ wid: workspace, purpose: "provision", scopes: opts?.scopes ?? [] })
    .setProtectedHeader({ alg: ALG })
    .setAudience(opts?.aud ?? AUDIENCE)
    .setJti(opts?.jti ?? crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${opts?.expSec ?? 300}s`)
    .sign(priv);
}
