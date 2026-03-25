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
  warehouse_id     TEXT        REFERENCES warehouses(id) ON DELETE SET NULL,
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

-- Drop FK on items.warehouse so SAP location codes (e.g. "HQ") can be stored freely
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_bin_fkey;
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_warehouse_fkey;

-- Drop FK on pairs.warehouse_id so any warehouse value can be stored freely
ALTER TABLE pairs DROP CONSTRAINT IF EXISTS pairs_bin_id_fkey;
ALTER TABLE pairs DROP CONSTRAINT IF EXISTS pairs_warehouse_id_fkey;

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

-- Attendance tracking per session
CREATE TABLE IF NOT EXISTS session_attendees (
  session_id  TEXT     NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id     TEXT     NOT NULL,
  user_name   TEXT     NOT NULL,
  attended    BOOLEAN  NOT NULL DEFAULT TRUE,
  PRIMARY KEY (session_id, user_id)
);
ALTER TABLE session_attendees DISABLE ROW LEVEL SECURITY;

-- Role-based access: 'Admin' can access Sessions/admin pages; 'User' is count-only
ALTER TABLE users ADD COLUMN IF NOT EXISTS role           TEXT    DEFAULT 'User';

-- Additional columns for users imported from Azure AD via Power Automate
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email          TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS department     TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country        TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS initials       TEXT;

-- Allow decimal quantities (SAP quantities can be fractional)
ALTER TABLE items ALTER COLUMN sap_qty   TYPE NUMERIC USING sap_qty::NUMERIC;
ALTER TABLE items ALTER COLUMN count_qty TYPE NUMERIC USING count_qty::NUMERIC;

-- Session visibility for Scan & Count
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_visible BOOLEAN DEFAULT TRUE;

-- Scan & Count fields
ALTER TABLE items ADD COLUMN IF NOT EXISTS damaged_qty  NUMERIC DEFAULT NULL;
ALTER TABLE items ADD COLUMN IF NOT EXISTS expired_qty  NUMERIC DEFAULT NULL;
ALTER TABLE items ADD COLUMN IF NOT EXISTS remark       TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS photos          TEXT;  -- JSON array of Supabase Storage URLs
ALTER TABLE items ADD COLUMN IF NOT EXISTS packaging_size  TEXT;  -- e.g. "Box of 12", "24 per carton"

-- Disable RLS so the anon key used by the API can read/write freely
-- (this is a server-side internal tool, not a public-facing app)
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE pairs    DISABLE ROW LEVEL SECURITY;
ALTER TABLE items    DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- Warehouses (formerly bins)
-- ============================================================

-- Warehouses table — receives JSON import with id, name, shelves
-- shelves is a JSONB array of shelf/location objects e.g. [{"id":"A-01-01","level":1}, ...]
CREATE TABLE IF NOT EXISTS warehouses (
  id         TEXT PRIMARY KEY,
  name       TEXT,
  shelves    JSONB    DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE warehouses DISABLE ROW LEVEL SECURITY;

-- Rename bins → warehouses (run once if bins table already exists)
-- DO $$ BEGIN
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bins') THEN
--     ALTER TABLE bins RENAME TO warehouses;
--   END IF;
-- END $$;

-- Rename bin column on items to warehouse (run once)
ALTER TABLE items RENAME COLUMN bin TO warehouse;

-- Rename bin_id column on pairs to warehouse_id (run once)
ALTER TABLE pairs RENAME COLUMN bin_id TO warehouse_id;

-- ============================================================
-- Audit Trail
-- ============================================================
CREATE TABLE IF NOT EXISTS item_audit (
  id           TEXT        PRIMARY KEY,
  session_id   TEXT        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  item_id      TEXT        NOT NULL,
  item_code    TEXT        NOT NULL,
  item_name    TEXT        NOT NULL,
  submitted_by TEXT,        -- "Counter / Checker" label from the pair
  pair_id      TEXT,
  count_qty    NUMERIC,
  damaged_qty  NUMERIC,
  expired_qty  NUMERIC,
  warehouse    TEXT,
  remark       TEXT,
  counted_at   TIMESTAMPTZ  DEFAULT NOW()
);
ALTER TABLE item_audit DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_item_audit_session_id ON item_audit(session_id);
CREATE INDEX IF NOT EXISTS idx_item_audit_item_id    ON item_audit(item_id);

-- ============================================================
-- Session Deletion Log (admin-inaccessible master audit trail)
-- Not exposed in the UI — query directly in Supabase dashboard
-- ============================================================
CREATE TABLE IF NOT EXISTS session_deletions (
  id            TEXT        PRIMARY KEY,
  session_id    TEXT        NOT NULL,   -- no FK — session is already gone
  session_name  TEXT        NOT NULL,
  deleted_by    TEXT        NOT NULL,
  deleted_at    TIMESTAMPTZ DEFAULT NOW()
);
-- Keep RLS enabled so it is NOT readable via the anon key used by the app
-- (rows can only be inserted, never queried, from the frontend)
ALTER TABLE session_deletions ENABLE ROW LEVEL SECURITY;
-- Allow inserts from anon role but block all reads
CREATE POLICY session_deletions_insert ON session_deletions FOR INSERT TO anon WITH CHECK (true);
-- No SELECT policy = no reads for anon key

-- ============================================================
-- OTP Tokens (4-digit codes for custom email auth)
-- Written and read only by Edge Functions via service role key
-- ============================================================
CREATE TABLE IF NOT EXISTS otp_tokens (
  email       TEXT        PRIMARY KEY,
  code        TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
-- Block all access from anon key — only service role (Edge Functions) can read/write
ALTER TABLE otp_tokens ENABLE ROW LEVEL SECURITY;
-- No policies = no access for anon key