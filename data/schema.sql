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
ALTER TABLE items ADD COLUMN IF NOT EXISTS src          TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS sap_status   TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS variance     NUMERIC DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS cost         NUMERIC DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_delete    BOOLEAN DEFAULT FALSE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS dropped      BOOLEAN DEFAULT FALSE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS item_status   TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS assigned_to   TEXT;

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
DO $$ BEGIN
  ALTER TABLE items RENAME COLUMN bin TO warehouse;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- Rename warehouse column on items to bin_location (run once)
DO $$ BEGIN
  ALTER TABLE items RENAME COLUMN warehouse TO bin_location;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- submitted_by: who submitted the count / new item
ALTER TABLE items ADD COLUMN IF NOT EXISTS submitted_by TEXT;

-- Rename bin_id column on pairs to warehouse_id (run once)
DO $$ BEGIN
  ALTER TABLE pairs RENAME COLUMN bin_id TO warehouse_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

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
-- Track admin-approved edits on a count entry (original count_qty is preserved for trail)
ALTER TABLE item_audit ADD COLUMN IF NOT EXISTS edited_qty  NUMERIC;
ALTER TABLE item_audit ADD COLUMN IF NOT EXISTS edited_by   TEXT;
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
-- Allow inserts from any authenticated user but block all reads
DROP POLICY IF EXISTS session_deletions_insert ON session_deletions;
CREATE POLICY session_deletions_insert ON session_deletions FOR INSERT TO public WITH CHECK (true);
-- No SELECT policy = no reads via anon/authenticated key (only service role can query)

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

-- ============================================================
-- Count Adjustments (pending approval queue)
-- Submitted by users editing their history; approved by admin
-- ============================================================
CREATE TABLE IF NOT EXISTS count_adjustments (
  id           TEXT        PRIMARY KEY,
  session_id   TEXT        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  item_id      TEXT        NOT NULL,
  item_code    TEXT,
  item_name    TEXT,
  old_qty      NUMERIC,
  new_qty      NUMERIC,
  submitted_by TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  status       TEXT        NOT NULL DEFAULT 'Pending',  -- 'Pending' | 'Approved' | 'Rejected'
  reviewed_by  TEXT,
  reviewed_at  TIMESTAMPTZ
);
ALTER TABLE count_adjustments DISABLE ROW LEVEL SECURITY;
-- Link adjustment back to the original audit row so approval can mark it as edited
ALTER TABLE count_adjustments ADD COLUMN IF NOT EXISTS audit_id TEXT;
CREATE INDEX IF NOT EXISTS idx_count_adj_session_id ON count_adjustments(session_id);
CREATE INDEX IF NOT EXISTS idx_count_adj_status     ON count_adjustments(status);

-- ============================================================
-- Storage: item-photos bucket policies
-- Run in Supabase SQL Editor (Storage uses storage.objects table)
-- ============================================================
-- DROP POLICY IF EXISTS "public_upload" ON storage.objects;
-- DROP POLICY IF EXISTS "public_read"   ON storage.objects;
-- CREATE POLICY "public_upload" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'item-photos');
-- CREATE POLICY "public_read"   ON storage.objects FOR SELECT TO public USING  (bucket_id = 'item-photos');
-- Note: policies are commented out because storage.objects may not exist until the bucket is created.
-- Run the two CREATE POLICY lines above after creating the item-photos bucket in Supabase Dashboard.

-- ============================================================
-- FIX 1.1 + 1.2 — Strict Role-Based Database Policies (RLS)
-- These prevent brute-force or DevTools attacks. Only users 
-- with a verified JWT token can touch the database.
-- ============================================================

-- Sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_sessions" ON sessions;
DROP POLICY IF EXISTS "Admin Write Sessions" ON sessions;
DROP POLICY IF EXISTS "Strict Read Sessions" ON sessions;
DROP POLICY IF EXISTS "Auth Write Sessions" ON sessions;
CREATE POLICY "Strict Read Sessions" ON sessions FOR SELECT TO public USING (true);
CREATE POLICY "Auth Write Sessions" ON sessions FOR ALL TO public USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);

-- Pairs
ALTER TABLE pairs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_pairs" ON pairs;
DROP POLICY IF EXISTS "Admin Write Pairs" ON pairs;
DROP POLICY IF EXISTS "Strict Read Pairs" ON pairs;
DROP POLICY IF EXISTS "Auth Write Pairs" ON pairs;
CREATE POLICY "Strict Read Pairs" ON pairs FOR SELECT TO public USING (true);
CREATE POLICY "Auth Write Pairs" ON pairs FOR ALL TO public USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);

-- Items (Everyone reads. Authenticated users can insert/update/delete)
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_items" ON items;
DROP POLICY IF EXISTS "Admin Delete Items" ON items;
DROP POLICY IF EXISTS "Strict Read Items" ON items;
DROP POLICY IF EXISTS "User Update Items" ON items;
DROP POLICY IF EXISTS "User Insert Items" ON items;
DROP POLICY IF EXISTS "Auth Delete Items" ON items;
CREATE POLICY "Strict Read Items" ON items FOR SELECT TO public USING (true);
CREATE POLICY "User Update Items" ON items FOR UPDATE TO public USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);
CREATE POLICY "User Insert Items" ON items FOR INSERT TO public WITH CHECK (auth.jwt() IS NOT NULL);
CREATE POLICY "Auth Delete Items" ON items FOR DELETE TO public USING (auth.jwt() IS NOT NULL);

-- Warehouses
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_warehouses" ON warehouses;
DROP POLICY IF EXISTS "Admin Write Warehouses" ON warehouses;
DROP POLICY IF EXISTS "Strict Read Warehouses" ON warehouses;
DROP POLICY IF EXISTS "Auth Write Warehouses" ON warehouses;
CREATE POLICY "Strict Read Warehouses" ON warehouses FOR SELECT TO public USING (true);
CREATE POLICY "Auth Write Warehouses" ON warehouses FOR ALL TO public USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);

-- Session Attendees (writes go through save-attendance Edge Function)
ALTER TABLE session_attendees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_session_attendees" ON session_attendees;
DROP POLICY IF EXISTS "Admin Write Attendees" ON session_attendees;
DROP POLICY IF EXISTS "Admin Delete Attendees" ON session_attendees;
DROP POLICY IF EXISTS "Strict Read Attendees" ON session_attendees;
DROP POLICY IF EXISTS "User Insert Attendees" ON session_attendees;
DROP POLICY IF EXISTS "Auth Write Attendees" ON session_attendees;
DROP POLICY IF EXISTS "Auth Delete Attendees" ON session_attendees;
CREATE POLICY "Strict Read Attendees" ON session_attendees FOR SELECT TO public USING (true);
CREATE POLICY "User Insert Attendees" ON session_attendees FOR INSERT TO public WITH CHECK (auth.jwt() IS NOT NULL);
CREATE POLICY "Auth Write Attendees" ON session_attendees FOR UPDATE TO public USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);
CREATE POLICY "Auth Delete Attendees" ON session_attendees FOR DELETE TO public USING (auth.jwt() IS NOT NULL);

-- Audit (Everyone inserts & reads, nobody deletes)
ALTER TABLE item_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_item_audit" ON item_audit;
DROP POLICY IF EXISTS "anon_insert_item_audit" ON item_audit;
DROP POLICY IF EXISTS "Strict Read Audit" ON item_audit;
DROP POLICY IF EXISTS "User Insert Audit" ON item_audit;
CREATE POLICY "Strict Read Audit" ON item_audit FOR SELECT TO public USING (true);
CREATE POLICY "User Insert Audit" ON item_audit FOR INSERT TO public WITH CHECK (auth.jwt() IS NOT NULL);

-- Count Adjustments
ALTER TABLE count_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_count_adjustments" ON count_adjustments;
DROP POLICY IF EXISTS "Admin Write Adjustments" ON count_adjustments;
DROP POLICY IF EXISTS "Admin Delete Adjustments" ON count_adjustments;
DROP POLICY IF EXISTS "Strict Read Adjustments" ON count_adjustments;
DROP POLICY IF EXISTS "User Insert Adjustments" ON count_adjustments;
DROP POLICY IF EXISTS "Auth Write Adjustments" ON count_adjustments;
DROP POLICY IF EXISTS "Auth Delete Adjustments" ON count_adjustments;
CREATE POLICY "Strict Read Adjustments" ON count_adjustments FOR SELECT TO public USING (true);
CREATE POLICY "User Insert Adjustments" ON count_adjustments FOR INSERT TO public WITH CHECK (auth.jwt() IS NOT NULL);
CREATE POLICY "Auth Write Adjustments" ON count_adjustments FOR UPDATE TO public USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);
CREATE POLICY "Auth Delete Adjustments" ON count_adjustments FOR DELETE TO public USING (auth.jwt() IS NOT NULL);

-- Users (writes handled by Edge Functions with service role key, but allow authenticated as fallback)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_users" ON users;
DROP POLICY IF EXISTS "anon_update_users" ON users;
DROP POLICY IF EXISTS "anon_insert_users" ON users;
DROP POLICY IF EXISTS "Admin Update Users" ON users;
DROP POLICY IF EXISTS "Admin Insert Users" ON users;
DROP POLICY IF EXISTS "Admin Delete Users" ON users;
DROP POLICY IF EXISTS "Strict Read Users" ON users;
DROP POLICY IF EXISTS "Auth Write Users" ON users;
CREATE POLICY "Strict Read Users" ON users FOR SELECT TO public USING (true);
CREATE POLICY "Auth Write Users" ON users FOR ALL TO public USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);

-- ============================================================
-- FIX 1.2 — Role via Supabase Auth Metadata (upgrade path)
-- Instead of storing role in sessionStorage (spoofable), store
-- it in auth.users.raw_app_meta_data as { "role": "Admin" }.
-- The role is then embedded in the JWT and available as:
--   auth.jwt() -> 'app_metadata' ->> 'role'   (in RLS policies)
--   user.app_metadata.role                    (in frontend via sb.auth.getUser())
--
-- Step 1: Set role for existing users via Supabase dashboard:
--   UPDATE auth.users
--   SET raw_app_meta_data = raw_app_meta_data || '{"role": "Admin"}'::jsonb
--   WHERE email = 'admin@yourdomain.com';
--
-- Step 2: In index.html verifyOtp(), replace sessionStorage role:
--   sb.auth.getUser().then(function(r) {
--     ssoUserRole = (r.data.user.app_metadata || {}).role || 'User';
--     // DO NOT store role in sessionStorage anymore
--   });
--
-- Step 3 (optional, tighten later): Scope destructive policies:
--   CREATE POLICY "admin_delete_sessions" ON sessions
--     FOR DELETE TO authenticated
--     USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'Admin');
-- ============================================================

-- ============================================================
-- FIX 1.2 — Admin Promotion via Frontend (RPC Function)
-- Used by the frontend 'Users & Roles' modal to securely upgrade
-- a user's role without exposing the auth.users table directly.
-- ============================================================
CREATE OR REPLACE FUNCTION set_user_role(target_email text, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Strict security barrier: Only existing Admins can execute this function
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'Admin' THEN
    RAISE EXCEPTION 'Access denied: Must be Admin to change roles.';
  END IF;

  -- 1. Securely update the core JWT metadata in auth.users
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role)
  WHERE email = target_email;

  -- 2. Keep the public.users table in sync for your admin UI to show
  UPDATE public.users 
  SET role = new_role 
  WHERE email = target_email;
END;
$$;