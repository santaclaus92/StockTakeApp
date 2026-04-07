-- Section 3 hardening migration
-- Date: 2026-04-05
-- Goal: backend-only writes, performance indexes, and safer client access.

BEGIN;

-- ------------------------------------------------------------
-- Performance indexes for high-volume queries
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_items_session_pair_dropped
  ON public.items(session_id, pair_id, dropped);

CREATE INDEX IF NOT EXISTS idx_items_session_new_item_status
  ON public.items(session_id, new_item, item_status);

CREATE INDEX IF NOT EXISTS idx_item_audit_session_counted_at
  ON public.item_audit(session_id, counted_at DESC);

CREATE INDEX IF NOT EXISTS idx_count_adjustments_session_status_created
  ON public.count_adjustments(session_id, status, created_at DESC);

-- ------------------------------------------------------------
-- Force RLS and switch client access to read-only
-- ------------------------------------------------------------
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.count_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Remove broad write policies used before backend-only writes
DROP POLICY IF EXISTS "Auth Write Sessions" ON public.sessions;
DROP POLICY IF EXISTS "Auth Write Pairs" ON public.pairs;
DROP POLICY IF EXISTS "User Update Items" ON public.items;
DROP POLICY IF EXISTS "User Insert Items" ON public.items;
DROP POLICY IF EXISTS "Auth Delete Items" ON public.items;
DROP POLICY IF EXISTS "Auth Write Warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "User Insert Attendees" ON public.session_attendees;
DROP POLICY IF EXISTS "Auth Write Attendees" ON public.session_attendees;
DROP POLICY IF EXISTS "Auth Delete Attendees" ON public.session_attendees;
DROP POLICY IF EXISTS "User Insert Audit" ON public.item_audit;
DROP POLICY IF EXISTS "User Insert Adjustments" ON public.count_adjustments;
DROP POLICY IF EXISTS "Auth Write Adjustments" ON public.count_adjustments;
DROP POLICY IF EXISTS "Auth Delete Adjustments" ON public.count_adjustments;
DROP POLICY IF EXISTS "Auth Write Users" ON public.users;

-- Normalize read policies (authenticated read-only)
DROP POLICY IF EXISTS "Strict Read Sessions" ON public.sessions;
DROP POLICY IF EXISTS "Readonly sessions" ON public.sessions;
CREATE POLICY "Readonly sessions"
  ON public.sessions
  FOR SELECT
  TO authenticated
  USING (is_deleted = false);

DROP POLICY IF EXISTS "Strict Read Pairs" ON public.pairs;
DROP POLICY IF EXISTS "Readonly pairs" ON public.pairs;
CREATE POLICY "Readonly pairs"
  ON public.pairs
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Strict Read Items" ON public.items;
DROP POLICY IF EXISTS "Readonly items" ON public.items;
CREATE POLICY "Readonly items"
  ON public.items
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Strict Read Warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "Readonly warehouses" ON public.warehouses;
CREATE POLICY "Readonly warehouses"
  ON public.warehouses
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Strict Read Attendees" ON public.session_attendees;
DROP POLICY IF EXISTS "Readonly attendees" ON public.session_attendees;
CREATE POLICY "Readonly attendees"
  ON public.session_attendees
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Strict Read Audit" ON public.item_audit;
DROP POLICY IF EXISTS "Readonly audit" ON public.item_audit;
CREATE POLICY "Readonly audit"
  ON public.item_audit
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Strict Read Adjustments" ON public.count_adjustments;
DROP POLICY IF EXISTS "Readonly adjustments" ON public.count_adjustments;
CREATE POLICY "Readonly adjustments"
  ON public.count_adjustments
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Strict Read Users" ON public.users;
DROP POLICY IF EXISTS "Readonly users" ON public.users;
CREATE POLICY "Readonly users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

-- Remove table-level client write grants (service role remains unaffected)
REVOKE INSERT, UPDATE, DELETE ON TABLE public.sessions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.pairs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.items FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.warehouses FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.session_attendees FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.item_audit FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.count_adjustments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.users FROM anon, authenticated;

GRANT SELECT ON TABLE public.sessions TO authenticated;
GRANT SELECT ON TABLE public.pairs TO authenticated;
GRANT SELECT ON TABLE public.items TO authenticated;
GRANT SELECT ON TABLE public.warehouses TO authenticated;
GRANT SELECT ON TABLE public.session_attendees TO authenticated;
GRANT SELECT ON TABLE public.item_audit TO authenticated;
GRANT SELECT ON TABLE public.count_adjustments TO authenticated;
GRANT SELECT ON TABLE public.users TO authenticated;

COMMIT;
