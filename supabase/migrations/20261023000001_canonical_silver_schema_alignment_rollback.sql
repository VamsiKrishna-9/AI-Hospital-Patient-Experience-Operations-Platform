-- ============================================================================
-- MediAI Canonical Silver Schema Alignment Rollback Script (Non-Destructive by Default)
-- File: /supabase/migrations/20261023000001_canonical_silver_schema_alignment_rollback.sql
-- Goal: Safely revert 20261023000000_canonical_silver_schema_alignment.sql
-- Safety Guarantee:
--   Non-destructive by default. Reverts application view definitions without
--   dropping columns that may hold data written after migration.
--   Destructive column purging requires explicit, separate manual review.
-- Status: PREPARED FOR USER REVIEW (DO NOT EXECUTE WITHOUT EXPLICIT APPROVAL)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. RESTORE PUBLIC VIEW TO PRIOR CANONICAL DEFINITION
-- Restores public.silver_doctors_public view to use only legacy destination columns.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.silver_doctors_public AS
SELECT 
    doctor_id,
    doctor_name,
    specialty,
    qualification,
    experience_years,
    hospital_branch,
    consultation_fee,
    availability_schedule,
    rating,
    is_active
FROM public.silver_doctors
WHERE is_active = true;

GRANT SELECT ON public.silver_doctors_public TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. SAFETY ASSERTION: PROTECT P1001 & USER IDENTITIES
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    patient_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO patient_count FROM public.app_users WHERE patient_id = 'P1001';
    IF patient_count = 0 THEN
        RAISE EXCEPTION 'Safety check failed: Patient P1001 must exist in app_users';
    END IF;
    RAISE NOTICE 'Non-destructive rollback successful: View restored to prior definition. Canonical columns retained to prevent data loss.';
END $$;

COMMIT;

-- ============================================================================
-- OPTIONAL: DESTRUCTIVE COLUMN PURGE (REQUIRES SEPARATE EXPLICIT REVIEW)
-- WARNING: Executing the statements below will PERMANENTLY DESTROY any data
-- written to canonical columns after migration deployment.
-- DO NOT EXECUTE unless you explicitly intend to purge all canonical fields.
-- ============================================================================
/*
BEGIN;

ALTER TABLE public.silver_feedback
    DROP COLUMN IF EXISTS resolution_notes,
    DROP COLUMN IF EXISTS feedback_status,
    DROP COLUMN IF EXISTS sentiment,
    DROP COLUMN IF EXISTS feedback_channel,
    DROP COLUMN IF EXISTS communication_rating,
    DROP COLUMN IF EXISTS cleanliness_rating,
    DROP COLUMN IF EXISTS facility_rating,
    DROP COLUMN IF EXISTS waiting_time_rating,
    DROP COLUMN IF EXISTS staff_rating,
    DROP COLUMN IF EXISTS doctor_rating,
    DROP COLUMN IF EXISTS appointment_id;

ALTER TABLE public.silver_lab_results
    DROP COLUMN IF EXISTS result_value;

ALTER TABLE public.silver_prescriptions
    DROP COLUMN IF EXISTS prescription_status,
    DROP COLUMN IF EXISTS refill_allowed,
    DROP COLUMN IF EXISTS quantity,
    DROP COLUMN IF EXISTS route,
    DROP COLUMN IF EXISTS medicine_category,
    DROP COLUMN IF EXISTS prescription_date;

ALTER TABLE public.silver_encounters
    DROP COLUMN IF EXISTS consultation_duration_minutes,
    DROP COLUMN IF EXISTS wait_time_minutes,
    DROP COLUMN IF EXISTS encounter_mode,
    DROP COLUMN IF EXISTS appointment_type,
    DROP COLUMN IF EXISTS treatment_outcome,
    DROP COLUMN IF EXISTS treatment_type,
    DROP COLUMN IF EXISTS primary_diagnosis,
    DROP COLUMN IF EXISTS symptoms,
    DROP COLUMN IF EXISTS department_name,
    DROP COLUMN IF EXISTS department_id;

ALTER TABLE public.silver_appointments
    DROP COLUMN IF EXISTS wait_time_minutes,
    DROP COLUMN IF EXISTS priority,
    DROP COLUMN IF EXISTS booking_channel,
    DROP COLUMN IF EXISTS department_name,
    DROP COLUMN IF EXISTS appointment_type;

ALTER TABLE public.silver_staff
    DROP COLUMN IF EXISTS joining_date,
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS experience_years,
    DROP COLUMN IF EXISTS employment_type,
    DROP COLUMN IF EXISTS shift_end,
    DROP COLUMN IF EXISTS shift_start,
    DROP COLUMN IF EXISTS shift_type,
    DROP COLUMN IF EXISTS ward_id,
    DROP COLUMN IF EXISTS department_name,
    DROP COLUMN IF EXISTS staff_type;

ALTER TABLE public.silver_doctors
    DROP COLUMN IF EXISTS joining_date,
    DROP COLUMN IF EXISTS availability,
    DROP COLUMN IF EXISTS employment_type,
    DROP COLUMN IF EXISTS city,
    DROP COLUMN IF EXISTS specialization,
    DROP COLUMN IF EXISTS department_name,
    DROP COLUMN IF EXISTS department_id;

ALTER TABLE public.silver_patients
    DROP COLUMN IF EXISTS occupation,
    DROP COLUMN IF EXISTS socioeconomic_status,
    DROP COLUMN IF EXISTS state,
    DROP COLUMN IF EXISTS city;

COMMIT;
*/
