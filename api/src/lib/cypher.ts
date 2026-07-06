// Encryption at rest for the app's own secrets (the merchant's Moniepoint API secret, the
// Sentralbee app api-key, the webhook signing secret). AES-256-GCM keyed on the app's OWN
// MONIEPOINT_APP_KEY — NEVER the org-wide secret. Envelope = base64(iv[12] || ciphertext+tag).

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function appKey(): Promise<CryptoKey> {
  const raw = encoder.encode(Bun.env.MONIEPOINT_APP_KEY ?? "dev-insecure-moniepoint-app-key-change-me");
  const digest = await crypto.subtle.digest("SHA-256", raw); // derive a 32-byte key from the passphrase
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await appKey(), encoder.encode(plaintext)),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return Buffer.from(out).toString("base64");
}

export async function decryptSecret(blob: string): Promise<string> {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, 12);
  const ct = buf.subarray(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await appKey(), ct);
  return decoder.decode(pt);
}
