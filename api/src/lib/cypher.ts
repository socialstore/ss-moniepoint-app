// Encryption at rest for the app's own secrets (the merchant's Moniepoint API secret, the
// Sentralbee app api-key, the webhook signing secret). AES-256-GCM keyed on the app's OWN
// MONIEPOINT_APP_KEY — NEVER the org-wide secret. Envelope = base64(version[1] || iv[12] || ct+tag).
//
// FAIL CLOSED: with no MONIEPOINT_APP_KEY set we refuse to run — a shared multi-tenant deployment
// must never fall back to a guessable default that would decrypt every tenant's live keys. The
// version byte lets us rotate the key/scheme later without bricking existing ciphertext.

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const VERSION = 1;

async function appKey(): Promise<CryptoKey> {
  const secret = Bun.env.MONIEPOINT_APP_KEY;
  if (!secret) {
    throw new Error("MONIEPOINT_APP_KEY is not set — refusing to encrypt/decrypt (no insecure default in a multi-tenant deployment)");
  }
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret)); // derive a 32-byte key
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await appKey(), encoder.encode(plaintext)),
  );
  const out = new Uint8Array(1 + iv.length + ct.length);
  out[0] = VERSION;
  out.set(iv, 1);
  out.set(ct, 1 + iv.length);
  return Buffer.from(out).toString("base64");
}

export async function decryptSecret(blob: string): Promise<string> {
  const buf = Buffer.from(blob, "base64");
  if (buf.length < 14 || buf[0] !== VERSION) {
    throw new Error(`unsupported cypher envelope (version ${buf[0]})`);
  }
  const iv = buf.subarray(1, 13);
  const ct = buf.subarray(13);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await appKey(), ct);
  return decoder.decode(pt);
}
