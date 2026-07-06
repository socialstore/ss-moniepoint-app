import { test, expect } from "bun:test";
import { createHmac } from "node:crypto";
import { verifyWebhookAuth } from "./auth";

const SECRET = "whsec_test";
const body = JSON.stringify({ transactionReference: "TXN1", amount: 14000 });
const sig = createHmac("sha256", SECRET).update(body).digest("hex");

test("fails closed with no secret configured", () => {
  expect(verifyWebhookAuth(body, sig, null)).toBe(false);
});

test("fails closed with no signature header", () => {
  expect(verifyWebhookAuth(body, null, SECRET)).toBe(false);
});

test("rejects a forged/wrong signature", () => {
  expect(verifyWebhookAuth(body, "deadbeef", SECRET)).toBe(false);
  expect(verifyWebhookAuth(body, sig, "wrong-secret")).toBe(false);
});

test("accepts a valid HMAC-SHA256 signature (with or without sha256= prefix)", () => {
  expect(verifyWebhookAuth(body, sig, SECRET)).toBe(true);
  expect(verifyWebhookAuth(body, "sha256=" + sig.toUpperCase(), SECRET)).toBe(true);
});
