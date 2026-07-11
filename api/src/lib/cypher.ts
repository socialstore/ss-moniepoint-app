// Encryption at rest for the app's own secrets (the merchant's Moniepoint API token, the Sentralbee app
// api-key, the webhook signing secret). Delegates to @sentralbee/app-sdk's createCypher — AES-256-GCM,
// envelope = base64(version[1] || iv[12] || ct+tag) — keyed on the app's OWN MONIEPOINT_APP_KEY.
//
// FAIL CLOSED: with no MONIEPOINT_APP_KEY set we refuse to run — a shared multi-tenant deployment must
// never fall back to a guessable default that would decrypt every tenant's live keys. The SDK's envelope
// is byte-compatible with the previous in-app scheme (same VERSION byte), so existing ciphertext still
// decrypts after the port.

import { createCypher, type Cypher } from "@sentralbee/app-sdk";

// Built lazily + rebuilt only if the key changes, so the fail-closed env check runs on every call.
let cached: { key: string; cypher: Cypher } | null = null;

function cypher(): Cypher {
  const key = Bun.env.MONIEPOINT_APP_KEY;
  if (!key) {
    throw new Error("MONIEPOINT_APP_KEY is not set — refusing to encrypt/decrypt (no insecure default in a multi-tenant deployment)");
  }
  if (!cached || cached.key !== key) {
    cached = { key, cypher: createCypher(key) };
  }
  return cached.cypher;
}

export function encryptSecret(plaintext: string): Promise<string> {
  return cypher().encryptSecret(plaintext);
}

export function decryptSecret(blob: string): Promise<string> {
  return cypher().decryptSecret(blob);
}
