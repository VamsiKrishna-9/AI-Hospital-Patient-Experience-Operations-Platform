-- ============================================================================
-- MediAI Authorization & Row Level Security (RLS) Policy Corrections
-- File: /supabase/migrations/20261102000000_authorization_rls_corrections.sql
-- Goal: Ensure PostgreSQL RLS policies enforce record ownership when queried
--       with user-scoped JWTs (complementing backend server-side checks).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. TABLE: silver_staff_assignment
-- Issue: Previous policy restricted management exclusively to staff and admin,
-- blocking attending physicians from creating staff assignments. Furthermore,
-- staff were granted universal write access across all hospital staff tasks.
-- Correction:
-- - Doctors can insert assignments referencing their own doctor_id.
-- - Doctors can view assignments for their patients.
-- - Staff can view and update status ONLY on assignments matching their own staff_id.
-- - Admins retain supervisory management.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff can view own assignments" ON public.silver_staff_assignment;
DROP POLICY IF EXISTS "Supervisors and Admins can manage staff assignments" ON public.silver_staff_assignment;
DROP POLICY IF EXISTS "Staff can update own assignments" ON public.silver_staff_assignment;
DROP POLICY IF EXISTS "Doctors can create staff assignments" ON public.silver_staff_assignment;

-- Read policy: Staff see only their tasks; Doctors see tasks for their patients or created by them; Admins see all
CREATE POLICY "Role scoped staff assignment read"
    ON public.silver_staff_assignment FOR SELECT
    TO authenticated
    USING (
        (public.get_current_role() = 'staff' AND staff_id = public.get_current_staff_id())
        OR (public.get_current_role() = 'doctor' AND doctor_id = public.get_current_doctor_id())
        OR public.get_current_role() = 'admin'
    );

-- Insert policy: Doctors can create assignments for their patients; Admins can assign staff
CREATE POLICY "Doctors and admins can insert staff assignments"
    ON public.silver_staff_assignment FOR INSERT
    TO authenticated
    WITH CHECK (
        public.get_current_role() = 'admin'
        OR (public.get_current_role() = 'doctor' AND doctor_id = public.get_current_doctor_id())
    );

-- Update policy: Staff can update only their own assigned assignments; Admins have full update rights
CREATE POLICY "Staff can update own assignment status"
    ON public.silver_staff_assignment FOR UPDATE
    TO authenticated
    USING (
        (public.get_current_role() = 'staff' AND staff_id = public.get_current_staff_id())
        OR public.get_current_role() = 'admin'
    )
    WITH CHECK (
        (public.get_current_role() = 'staff' AND staff_id = public.get_current_staff_id())
        OR public.get_current_role() = 'admin'
    );

COMMIT;
