-- ============================================================
-- StockTake Pro — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT        PRIMARY KEY,
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL,          -- 'Year End' | 'Cycle Count'
  entity      TEXT        NOT NULL,          -- e.g. 'BMS', 'BMSG'
  country     TEXT        NOT NULL,
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'Active',  -- 'Active' | 'Draft' | 'Closed'
  progress    INTEGER     NOT NULL DEFAULT 0,
  is_recount  BOOLEAN     NOT NULL DEFAULT FALSE,
  parent_id   TEXT        REFERENCES sessions(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ          DEFAULT NOW()
);

-- Add session_id to items (links each item to the session it was imported for)
ALTER TABLE items ADD COLUMN IF NOT EXISTS session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE;

-- Pairs table (counter + checker assignments per session)
CREATE TABLE IF NOT EXISTS pairs (
  id               TEXT        PRIMARY KEY,
  session_id       TEXT        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  counter_name     TEXT        NOT NULL,
  checker_name     TEXT        NOT NULL,
  bin_id           TEXT        REFERENCES bins(id) ON DELETE SET NULL,
  role             TEXT        NOT NULL DEFAULT 'User',   -- 'Admin' | 'User'
  counter_absent   BOOLEAN     NOT NULL DEFAULT FALSE,
  checker_absent   BOOLEAN     NOT NULL DEFAULT FALSE,
  progress         INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ          DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_items_session_id ON items(session_id);
CREATE INDEX IF NOT EXISTS idx_pairs_session_id ON pairs(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_parent_id ON sessions(parent_id);

-- New columns for SAP import data
ALTER TABLE items ADD COLUMN IF NOT EXISTS entity       TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS wh_code      TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS expiry_date  DATE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS category     TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS new_item     TEXT    DEFAULT 'No';
ALTER TABLE items ADD COLUMN IF NOT EXISTS sap_status   TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS variance     NUMERIC DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS cost         NUMERIC DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_delete    BOOLEAN DEFAULT FALSE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS dropped      BOOLEAN DEFAULT FALSE;

-- Disable RLS so the anon key used by the API can read/write freely
-- (this is a server-side internal tool, not a public-facing app)
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE pairs    DISABLE ROW LEVEL SECURITY;
ALTER TABLE items    DISABLE ROW LEVEL SECURITY;
