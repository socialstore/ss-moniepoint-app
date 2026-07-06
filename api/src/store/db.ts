import { Database } from "bun:sqlite";

// The app's OWN embedded datastore (Level-2: it owns its tables and never reaches the platform's
// shared database — it talks to Sentralbee only over the public API). SQLite keeps it
// dependency-free + hermetically testable; swap the driver for Postgres later without changing
// the repo layer.

let _db: Database | null = null;

export function migrate(d: Database): void {
  d.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS install (
      workspace              TEXT PRIMARY KEY,
      business_id            TEXT,
      moniepoint_secret_enc  TEXT,   -- merchant's Moniepoint API secret, encrypted with the app key
      sentralbee_key_enc     TEXT,   -- the app-kind Sentralbee api-key used to call the public API
      webhook_secret_enc     TEXT,   -- Moniepoint webhook signing secret (for fail-closed auth)
      created_at             INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS terminal (
      id              TEXT PRIMARY KEY,
      workspace       TEXT NOT NULL,
      terminal_serial TEXT NOT NULL,
      nuban           TEXT NOT NULL,
      account_name    TEXT,
      bank_name       TEXT NOT NULL DEFAULT 'Moniepoint MFB',
      created_at      INTEGER NOT NULL,
      UNIQUE(workspace, terminal_serial)
    );

    -- A checkout reservation: a UNIQUE payable amount held for one order on one terminal, so a
    -- reference-less inbound transfer of that exact amount self-identifies within the window.
    CREATE TABLE IF NOT EXISTS reservation (
      id              TEXT PRIMARY KEY,
      workspace       TEXT NOT NULL,
      order_id        TEXT NOT NULL,
      terminal_serial TEXT NOT NULL,
      amount_minor    INTEGER NOT NULL,   -- unique payable amount (base + offset), in kobo
      currency        TEXT NOT NULL DEFAULT 'NGN',
      reference       TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'open',  -- open|matched|expired|cancelled
      expires_at      INTEGER NOT NULL,
      matched_txn_id  TEXT,
      created_at      INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS reservation_match_idx
      ON reservation(terminal_serial, amount_minor, status, expires_at);
    CREATE INDEX IF NOT EXISTS reservation_order_idx
      ON reservation(workspace, order_id, status);

    -- The suspense / clearing-house ledger: inbound transfers that did NOT match an open
    -- reservation (the reference-less blind spot), awaiting auto- or manual reconciliation.
    CREATE TABLE IF NOT EXISTS unmapped_payment (
      id                 TEXT PRIMARY KEY,
      workspace          TEXT,
      moniepoint_txn_id  TEXT NOT NULL UNIQUE,   -- idempotency backstop
      terminal_serial    TEXT,
      business_id        TEXT,
      amount_minor       INTEGER NOT NULL,
      currency           TEXT NOT NULL DEFAULT 'NGN',
      sender_name        TEXT,
      sender_account     TEXT,
      status             TEXT NOT NULL,          -- Moniepoint txn status: PENDING|APPROVED
      merchant_reference TEXT,                   -- often empty
      received_at        INTEGER NOT NULL,
      resolution         TEXT NOT NULL DEFAULT 'unmatched',  -- unmatched|matched|manually_resolved|rejected
      resolved_order_id  TEXT,
      resolved_at        INTEGER,
      created_at         INTEGER NOT NULL
    );
  `);
}

export function openDb(path?: string): Database {
  const d = new Database(path ?? Bun.env.MONIEPOINT_DB ?? "moniepoint.sqlite", { create: true });
  migrate(d);
  return d;
}

export function getDb(): Database {
  if (!_db) _db = openDb();
  return _db;
}

/** Swap the process-wide handle — used by tests to inject a fresh in-memory database. */
export function setDb(d: Database): void {
  _db = d;
}

/** A fresh in-memory database with the schema applied (test helper). */
export function memoryDb(): Database {
  const d = new Database(":memory:");
  migrate(d);
  return d;
}
