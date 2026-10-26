-- ============================================================================
-- MediAI Canonical Silver Schema Alignment Migration (Revised)
-- File: /supabase/migrations/20261023000000_canonical_silver_schema_alignment.sql
-- Goal: Align Supabase silver_* tables with the 9 canonical MySQL hospital_db datasets
-- Design Principles:
--   1. Strict column compatibility with MySQL canonical datasets.
--   2. Additive-first, non-destructive schema modifications.
--   3. Zero synthetic fabrication of historical source data.
--   4. Bidirectional backward compatibility for application queries.
--   5. Total protection of auth.users, public.app_users, and test patient P1001.
-- Status: PREPARED FOR USER REVIEW (DO NOT EXECUTE WITHOUT EXPLICIT APPROVAL)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. TABLE: silver_patients
-- Canonical Source Columns (12):
--   patient_id, name, date_of_birth, age, gender, city, state,
--   socioeconomic_status, occupation, registration_date, phone_number, email
-- Persistent Application Extensions Retained:
--   user_id (Auth linking to app_users), address, emergency_contact, blood_group
-- ----------------------------------------------------------------------------
ALTER TABLE public.silver_patients
    ADD COLUMN IF NOT EXISTS city VARCHAR(100),
    ADD COLUMN IF NOT EXISTS state VARCHAR(100),
    ADD COLUMN IF NOT EXISTS socioeconomic_status VARCHAR(100),
    ADD COLUMN IF NOT EXISTS occupation VARCHAR(100);

-- ----------------------------------------------------------------------------
-- 2. TABLE: silver_doctors
-- Canonical Source Columns (13):
--   doctor_id, doctor_name, department_id, department_name, specialization,
--   qualification, experience_years, city, employment_type, availability,
--   joining_date, phone_number, email
-- Persistent Application Extensions Retained:
--   user_id (Auth linking to app_users), specialty (alias), hospital_branch (alias),
--   consultation_fee, availability_schedule, rating, rating_count, is_active
-- ----------------------------------------------------------------------------
ALTER TABLE public.silver_doctors
    ADD COLUMN IF NOT EXISTS department_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS department_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS specialization VARCHAR(150),
    ADD COLUMN IF NOT EXISTS city VARCHAR(100),
    ADD COLUMN IF NOT EXISTS employment_type VARCHAR(100),
    ADD COLUMN IF NOT EXISTS availability TEXT,
    ADD COLUMN IF NOT EXISTS joining_date DATE;

-- Safe 1:1 Aliasing Backfills for existing destination rows:
-- - specialization mirrors specialty
-- - availability mirrors availability_schedule
-- Note: city is deliberately NOT backfilled from hospital_branch (branch IDs != cities).
-- It remains NULL until genuine source city data is imported.
UPDATE public.silver_doctors
SET specialization = specialty
WHERE specialization IS NULL AND specialty IS NOT NULL;

UPDATE public.silver_doctors
SET availability = availability_schedule
WHERE availability IS NULL AND availability_schedule IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. TABLE: silver_staff
-- Canonical Source Columns (13):
--   staff_id, staff_name, staff_type, role, department_name, ward_id,
--   shift_type, shift_start, shift_end, employment_type, experience_years, status, joining_date
-- Persistent Application Extensions Retained:
--   user_id (Auth linking to app_users), department (alias), shift (alias),
--   contact_number, email, is_active
-- ----------------------------------------------------------------------------
ALTER TABLE public.silver_staff
    ADD COLUMN IF NOT EXISTS staff_type VARCHAR(100),
    ADD COLUMN IF NOT EXISTS department_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS ward_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS shift_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS shift_start TIME,
    ADD COLUMN IF NOT EXISTS shift_end TIME,
    ADD COLUMN IF NOT EXISTS employment_type VARCHAR(100),
    ADD COLUMN IF NOT EXISTS experience_years NUMERIC(4, 1),
    ADD COLUMN IF NOT EXISTS status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS joining_date DATE;

-- Safe 1:1 Aliasing Backfills for existing destination rows:
UPDATE public.silver_staff
SET department_name = department
WHERE department_name IS NULL AND department IS NOT NULL;

UPDATE public.silver_staff
SET shift_type = shift
WHERE shift_type IS NULL AND shift IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. TABLE: silver_appointments
-- Canonical Source Columns (12):
--   appointment_id, patient_id, doctor_id, appointment_date, appointment_time,
--   appointment_type, department_name, booking_channel, priority, status,
--   wait_time_minutes, consultation_duration_minutes
-- Persistent Application Extensions Retained:
--   consultation_type (alias), consultation_fee, payment_status, cancellation_reason,
--   reason, symptoms, notes
-- ----------------------------------------------------------------------------
ALTER TABLE public.silver_appointments
    ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS department_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS booking_channel VARCHAR(50),
    ADD COLUMN IF NOT EXISTS priority VARCHAR(50),
    ADD COLUMN IF NOT EXISTS wait_time_minutes INTEGER;

-- Safe 1:1 Aliasing Backfill for existing destination rows:
UPDATE public.silver_appointments
SET appointment_type = consultation_type
WHERE appointment_type IS NULL AND consultation_type IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. TABLE: silver_encounters
-- Canonical Source Columns (14):
--   encounter_id, patient_id, doctor_id, department_id, department_name,
--   encounter_date, symptoms, primary_diagnosis, treatment_type, treatment_outcome,
--   appointment_type, encounter_mode, wait_time_minutes, consultation_duration_minutes
-- CRITICAL CONSTRAINT:
--   appointment_id is NOT present in MySQL source. It must remain strictly optional/nullable.
-- Persistent Application Extensions Retained:
--   appointment_id (strictly nullable), chief_complaint (alias), diagnosis (alias),
--   treatment_plan (alias), encounter_type (alias), notes
-- ----------------------------------------------------------------------------
ALTER TABLE public.silver_encounters
    ADD COLUMN IF NOT EXISTS department_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS department_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS symptoms TEXT,
    ADD COLUMN IF NOT EXISTS primary_diagnosis TEXT,
    ADD COLUMN IF NOT EXISTS treatment_type VARCHAR(150),
    ADD COLUMN IF NOT EXISTS treatment_outcome VARCHAR(150),
    ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS encounter_mode VARCHAR(50),
    ADD COLUMN IF NOT EXISTS wait_time_minutes INTEGER,
    ADD COLUMN IF NOT EXISTS consultation_duration_minutes INTEGER;

-- Ensure appointment_id is strictly nullable for historical encounters (never enforce NOT NULL)
ALTER TABLE public.silver_encounters
    ALTER COLUMN appointment_id DROP NOT NULL;

-- Safe 1:1 Aliasing Backfills for existing destination rows:
-- Note: treatment_type is deliberately NOT backfilled from treatment_plan
-- to prevent truncation or misclassification of narrative clinical plans.
UPDATE public.silver_encounters
SET symptoms = chief_complaint
WHERE symptoms IS NULL AND chief_complaint IS NOT NULL;

UPDATE public.silver_encounters
SET primary_diagnosis = diagnosis
WHERE primary_diagnosis IS NULL AND diagnosis IS NOT NULL;

UPDATE public.silver_encounters
SET appointment_type = encounter_type
WHERE appointment_type IS NULL AND encounter_type IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 6. TABLE: silver_prescriptions
-- Canonical Source Columns (13):
--   prescription_id, patient_id, encounter_id, prescription_date, medicine_name,
--   medicine_category, dosage, frequency, duration_days, route, quantity,
--   refill_allowed, prescription_status
-- Persistent Application Extensions Retained:
--   prescribed_date (alias), instructions
-- ----------------------------------------------------------------------------
ALTER TABLE public.silver_prescriptions
    ADD COLUMN IF NOT EXISTS prescription_date DATE,
    ADD COLUMN IF NOT EXISTS medicine_category VARCHAR(100),
    ADD COLUMN IF NOT EXISTS route VARCHAR(50),
    ADD COLUMN IF NOT EXISTS quantity INTEGER,
    ADD COLUMN IF NOT EXISTS refill_allowed BOOLEAN,
    ADD COLUMN IF NOT EXISTS prescription_status VARCHAR(50);

-- Safe 1:1 Aliasing Backfill for existing destination rows:
-- Note: prescription_status is deliberately NOT defaulted to 'Active' across historical rows.
-- Actual source prescription statuses ('Active', 'Completed', 'Discontinued') will be imported cleanly.
UPDATE public.silver_prescriptions
SET prescription_date = prescribed_date
WHERE prescription_date IS NULL AND prescribed_date IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 7. TABLE: silver_lab_results
-- Canonical Source Columns (10):
--   lab_id, patient_id, encounter_id, test_name, test_category, test_date,
--   result_value, unit, reference_range, status
-- Persistent Application Extensions Retained:
--   test_value (alias), notes
-- ----------------------------------------------------------------------------
ALTER TABLE public.silver_lab_results
    ADD COLUMN IF NOT EXISTS result_value VARCHAR(100);

-- Safe 1:1 Aliasing Backfill for existing destination rows:
UPDATE public.silver_lab_results
SET result_value = test_value
WHERE result_value IS NULL AND test_value IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 8. TABLE: silver_feedback
-- Canonical Source Columns (18):
--   feedback_id, patient_id, appointment_id, encounter_id, doctor_id, feedback_date,
--   rating, doctor_rating, staff_rating, waiting_time_rating, facility_rating,
--   cleanliness_rating, communication_rating, comments, feedback_channel, sentiment,
--   feedback_status, resolution_notes
-- Persistent Application Extensions Retained:
--   wait_time_rating (alias), staff_behavior_rating (alias)
-- ----------------------------------------------------------------------------
ALTER TABLE public.silver_feedback
    ADD COLUMN IF NOT EXISTS appointment_id VARCHAR(50) REFERENCES public.silver_appointments(appointment_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS doctor_rating INTEGER CHECK (doctor_rating >= 1 AND doctor_rating <= 5),
    ADD COLUMN IF NOT EXISTS staff_rating INTEGER CHECK (staff_rating >= 1 AND staff_rating <= 5),
    ADD COLUMN IF NOT EXISTS waiting_time_rating INTEGER CHECK (waiting_time_rating >= 1 AND waiting_time_rating <= 5),
    ADD COLUMN IF NOT EXISTS facility_rating INTEGER CHECK (facility_rating >= 1 AND facility_rating <= 5),
    ADD COLUMN IF NOT EXISTS communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
    ADD COLUMN IF NOT EXISTS feedback_channel VARCHAR(50),
    ADD COLUMN IF NOT EXISTS sentiment VARCHAR(50),
    ADD COLUMN IF NOT EXISTS feedback_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

-- Safe 1:1 Aliasing Backfills for existing destination rows:
-- Note: doctor_rating is deliberately NOT backfilled from rating.
-- Overall facility rating and physician-specific rating remain independent.
UPDATE public.silver_feedback
SET staff_rating = staff_behavior_rating
WHERE staff_rating IS NULL AND staff_behavior_rating IS NOT NULL;

UPDATE public.silver_feedback
SET waiting_time_rating = wait_time_rating
WHERE waiting_time_rating IS NULL AND wait_time_rating IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 9. TABLE: silver_staff_assignment (Preserve Exact 14-Column Contract)
-- 1. assignment_id
-- 2. staff_id
-- 3. patient_id
-- 4. doctor_id
-- 5. encounter_id
-- 6. appointment_id
-- 7. assignment_type
-- 8. assignment_date
-- 9. start_time
-- 10. end_time
-- 11. priority
-- 12. assignment_status
-- 13. assigned_by
-- 14. notes
-- (Already exact 14 columns in canonical ordinal order; preserved intact)
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 10. UPDATE PUBLIC VIEWS WITH COALESCED COMPATIBILITY
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.silver_doctors_public AS
SELECT 
    doctor_id,
    doctor_name,
    COALESCE(specialty, specialization) AS specialty,
    qualification,
    experience_years,
    COALESCE(hospital_branch, city) AS hospital_branch,
    consultation_fee,
    COALESCE(availability_schedule, availability) AS availability_schedule,
    rating,
    is_active,
    -- Appended canonical columns (valid in PostgreSQL CREATE OR REPLACE VIEW):
    COALESCE(specialization, specialty) AS specialization,
    department_id,
    department_name,
    city,
    employment_type,
    COALESCE(availability, availability_schedule) AS availability
FROM public.silver_doctors
WHERE is_active = true;

GRANT SELECT ON public.silver_doctors_public TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 11. SAFETY ASSERTION: PROTECT P1001 & USER IDENTITIES
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    patient_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO patient_count FROM public.app_users WHERE patient_id = 'P1001';
    IF patient_count = 0 THEN
        RAISE EXCEPTION 'Safety check failed: Patient P1001 must exist in app_users';
    END IF;
END $$;

COMMIT;
