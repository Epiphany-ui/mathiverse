-- Migration 014: Enable RLS on admin_audit_log + deny direct writes from anon/authenticated
-- Migration 007 created the table without RLS, leaving it world-readable/writable.
-- The app writes audit rows via the service-role client (bypasses RLS), so we deny
-- all direct operations from anon/authenticated keys.  Only admins/owners can read.

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins and owners can read the audit log
CREATE POLICY audit_read_admin ON admin_audit_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'owner')
  ));

-- No direct inserts, updates, or deletes from anon/authenticated.
-- The service-role client bypasses RLS entirely.
