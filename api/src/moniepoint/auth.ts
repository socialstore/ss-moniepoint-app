import { createHmac, timingSafeEqual } from "node:crypto";

// FAIL-CLOSED webhook authenticity. The public webhook is the ONLY thing that can flip a real
// order to PAID, so a fabricated APPROVED event must never be trusted. Verify an HMAC-SHA256 over
// the raw body with the install's per-subscription secret. Until a real secret is configured,
// EVERY event is rejected — never a no-op that passes tests while prod is forgeable.
export function verifyWebhookAuth(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string | null | undefined,
): boolean {
  if (!secret || !signatureHeader) return false; // fail closed
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const got = signatureHeader.trim().toLowerCase().replace(/^sha256=/, "");
  if (got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
