-- Migration 012: Fix profiles RLS — prevent regular users from changing role/banned_until
-- Replaces the overly permissive profiles_update_own policy (supabase-migration.sql:126)
-- that allowed any authenticated user to self-promote to admin or clear their own ban.
--
-- Uses a BEFORE UPDATE trigger instead of WITH CHECK subqueries, which would cause
-- PostgreSQL error 42P17 "infinite recursion detected in policy" when the WITH CHECK
-- sub-select re-enters RLS on the same table.

DROP POLICY IF EXISTS profiles_update_own ON profiles;

CREATE POLICY profiles_update_own ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger prevents non-admin/non-owner users from escalating privileges.
-- The service-role client (used by admin routes) bypasses RLS entirely.
CREATE OR REPLACE FUNCTION profiles_prevent_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT role FROM profiles WHERE id = auth.uid()) NOT IN ('admin', 'owner') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Only admins can change roles';
    END IF;
    IF NEW.banned_until IS DISTINCT FROM OLD.banned_until THEN
      RAISE EXCEPTION 'Only admins can change banned_until';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_profiles_prevent_escalation ON profiles;
CREATE TRIGGER trg_profiles_prevent_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_prevent_privilege_escalation();
