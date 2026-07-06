import { test, expect } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Level-2 isolation gate: ss-moniepoint-app must reach Sentralbee ONLY through the public
// HTTP API. This fails the build if any NON-TEST source hard-codes a forbidden data path
// instead — a direct colossal-db / CockroachDB / Hasura connection, the org-wide SECRET_32,
// or the prisma migration table. p2-app-scaffold hardens this (dependency + env allowlist).
const FORBIDDEN: RegExp[] = [
  /\bSECRET_32\b/,
  /colossal/i,
  /x-hasura-admin-secret/i,
  /:26257\b/, // CockroachDB port
  /_prisma_migrations/,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p) && !/\.test\.ts$/.test(p)) out.push(p);
  }
  return out;
}

test("Level-2 boundary: no direct Sentralbee data-plane access", () => {
  const apiRoot = join(import.meta.dir, ".."); // api/src -> api
  for (const file of walk(apiRoot)) {
    const src = readFileSync(file, "utf8");
    for (const bad of FORBIDDEN) {
      expect(
        bad.test(src),
        `${file} must not reference ${bad} — reach Sentralbee only via the public API`,
      ).toBe(false);
    }
  }
});
