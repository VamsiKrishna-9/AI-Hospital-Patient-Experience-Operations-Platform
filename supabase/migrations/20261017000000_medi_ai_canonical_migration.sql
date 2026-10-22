-- ============================================================================
-- MediAI Canonical Supabase PostgreSQL Migration
-- Target Tables: Exactly 10 Approved Entities
-- Source of Truth: MediAI Approved Database Contract & Final Audit
-- Identity Design: auth.users(id) <-> app_users(id) 1:1 Identity Mapping
-- Staff Assignment: Exact 14-Column Canonical Schema
-- Execution Mode: Non-Destructive, Transactional DDL
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS & SCHEMAS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- ----------------------------------------------------------------------------
-- 2. SEQUENCES FOR APPLICATION-COMPATIBLE IDENTIFIER GENERATION
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS seq_patient_id START WITH 1000 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS seq_doctor_id START WITH 1000 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS seq_staff_id START WITH 1000 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS seq_appointment_id START WITH 1000 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS seq_encounter_id START WITH 1000 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS seq_lab_id START WITH 1000 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS seq_prescription_id START WITH 1000 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS seq_feedback_id START WITH 1000 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS seq_assignment_id START WITH 1000 INCREMENT BY 1;

-- ----------------------------------------------------------------------------
-- 3. CORE AUTH & IDENTITY MAPPING
-- Table 1: app_users
-- Linked 1:1 with auth.users(id) as primary key
-- Includes patient_id, doctor_id, staff_id, and must_change_password
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    patient_id VARCHAR(50),
    doctor_id VARCHAR(50),
    staff_id VARCHAR(50),
    must_change_password BOOLEAN NOT NULL DEFAULT false,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('patient', 'doctor', 'staff', 'admin')),
    full_name VARCHAR(255),
    phone VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_app_users_role ON public.app_users(role);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON public.app_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_patient_id ON public.app_users(patient_id);
CREATE INDEX IF NOT EXISTS idx_app_users_doctor_id ON public.app_users(doctor_id);
CREATE INDEX IF NOT EXISTS idx_app_users_staff_id ON public.app_users(staff_id);

-- ----------------------------------------------------------------------------
-- 4. CLINICAL & OPERATIONAL ENTITIES
-- ----------------------------------------------------------------------------

-- Table 2: silver_patients
-- Canonical Silver schema: patient_id, name, date_of_birth, age, gender, city, state, socioeconomic_status, occupation, registration_date
-- Compatible persistent extensions: user_id, email, phone_number, address, emergency_contact, blood_group
CREATE TABLE IF NOT EXISTS public.silver_patients (
    patient_id VARCHAR(50) PRIMARY KEY DEFAULT ('P' || nextval('seq_patient_id')::text),
    user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    age INTEGER CHECK (age >= 0 AND age <= 130),
    gender VARCHAR(50),
    city VARCHAR(100),
    state VARCHAR(100),
    socioeconomic_status VARCHAR(100),
    occupation VARCHAR(100),
    registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
    email VARCHAR(255),
    phone_number VARCHAR(50),
    address TEXT,
    emergency_contact VARCHAR(100),
    blood_group VARCHAR(10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_silver_patients_user_id ON public.silver_patients(user_id);
CREATE INDEX IF NOT EXISTS idx_silver_patients_name ON public.silver_patients(name);
CREATE INDEX IF NOT EXISTS idx_silver_patients_phone ON public.silver_patients(phone_number);

-- Table 3: silver_doctors
-- Canonical Silver schema: doctor_id, doctor_name, specialty, qualification, experience_years, hospital_branch, consultation_fee, availability_schedule, rating
-- Compatible persistent extensions: user_id, email, phone_number, is_active
CREATE TABLE IF NOT EXISTS public.silver_doctors (
    doctor_id VARCHAR(50) PRIMARY KEY DEFAULT ('DOC' || nextval('seq_doctor_id')::text),
    user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    doctor_name VARCHAR(255) NOT NULL,
    specialty VARCHAR(150) NOT NULL,
    qualification VARCHAR(255),
    experience_years NUMERIC(4, 1) DEFAULT 0,
    hospital_branch VARCHAR(150),
    consultation_fee NUMERIC(10, 2) DEFAULT 0.00,
    availability_schedule TEXT,
    rating NUMERIC(3, 2) DEFAULT 5.00 CHECK (rating >= 0 AND rating <= 5),
    email VARCHAR(255),
    phone_number VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_silver_doctors_user_id ON public.silver_doctors(user_id);
CREATE INDEX IF NOT EXISTS idx_silver_doctors_specialty ON public.silver_doctors(specialty);
CREATE INDEX IF NOT EXISTS idx_silver_doctors_branch ON public.silver_doctors(hospital_branch);

-- Table 4: silver_staff
-- Canonical Silver schema: staff_id, staff_name, role, department, hospital_branch, shift, contact_number, email
-- Compatible persistent extensions: user_id, is_active
CREATE TABLE IF NOT EXISTS public.silver_staff (
    staff_id VARCHAR(50) PRIMARY KEY DEFAULT ('STF' || nextval('seq_staff_id')::text),
    user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    staff_name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    department VARCHAR(150) NOT NULL,
    hospital_branch VARCHAR(150),
    shift VARCHAR(50),
    contact_number VARCHAR(50),
    email VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_silver_staff_user_id ON public.silver_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_silver_staff_department ON public.silver_staff(department);

-- Deferrable Foreign Keys linking app_users back to the clinical entities
ALTER TABLE public.app_users 
    ADD CONSTRAINT fk_app_users_patient 
    FOREIGN KEY (patient_id) REFERENCES public.silver_patients(patient_id) 
    ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.app_users 
    ADD CONSTRAINT fk_app_users_doctor 
    FOREIGN KEY (doctor_id) REFERENCES public.silver_doctors(doctor_id) 
    ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.app_users 
    ADD CONSTRAINT fk_app_users_staff 
    FOREIGN KEY (staff_id) REFERENCES public.silver_staff(staff_id) 
    ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

-- Table 5: silver_appointments
-- Canonical Silver schema: appointment_id, patient_id, doctor_id, appointment_date, appointment_time, status, consultation_duration_minutes, consultation_type, consultation_fee, payment_status, cancellation_reason
-- Compatible persistent extensions: reason, symptoms, notes
CREATE TABLE IF NOT EXISTS public.silver_appointments (
    appointment_id VARCHAR(50) PRIMARY KEY DEFAULT ('APT' || nextval('seq_appointment_id')::text),
    patient_id VARCHAR(50) NOT NULL REFERENCES public.silver_patients(patient_id) ON DELETE RESTRICT,
    doctor_id VARCHAR(50) NOT NULL REFERENCES public.silver_doctors(doctor_id) ON DELETE RESTRICT,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'No Show')),
    consultation_duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (consultation_duration_minutes > 0),
    consultation_type VARCHAR(50) NOT NULL DEFAULT 'In-Person' CHECK (consultation_type IN ('In-Person', 'Online', 'Video', 'Telehealth')),
    consultation_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Paid', 'Refunded', 'Failed')),
    cancellation_reason TEXT,
    reason TEXT,
    symptoms TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_silver_appointments_patient ON public.silver_appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_silver_appointments_doctor ON public.silver_appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_silver_appointments_datetime ON public.silver_appointments(appointment_date, appointment_time);
CREATE INDEX IF NOT EXISTS idx_silver_appointments_status ON public.silver_appointments(status);

-- Table 6: silver_encounters
-- Canonical Silver schema: encounter_id, patient_id, doctor_id, appointment_id, encounter_date, encounter_type, chief_complaint, diagnosis, treatment_plan, notes
CREATE TABLE IF NOT EXISTS public.silver_encounters (
    encounter_id VARCHAR(50) PRIMARY KEY DEFAULT ('ENC' || nextval('seq_encounter_id')::text),
    patient_id VARCHAR(50) NOT NULL REFERENCES public.silver_patients(patient_id) ON DELETE RESTRICT,
    doctor_id VARCHAR(50) NOT NULL REFERENCES public.silver_doctors(doctor_id) ON DELETE RESTRICT,
    appointment_id VARCHAR(50) REFERENCES public.silver_appointments(appointment_id) ON DELETE SET NULL,
    encounter_date DATE NOT NULL DEFAULT CURRENT_DATE,
    encounter_type VARCHAR(50) NOT NULL DEFAULT 'Consultation',
    chief_complaint TEXT,
    diagnosis TEXT,
    treatment_plan TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_silver_encounters_patient ON public.silver_encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_silver_encounters_doctor ON public.silver_encounters(doctor_id);
CREATE INDEX IF NOT EXISTS idx_silver_encounters_appointment ON public.silver_encounters(appointment_id);

-- Table 7: silver_prescriptions
-- Canonical Silver schema: prescription_id, encounter_id, patient_id, medicine_name, dosage, frequency, duration_days, instructions, prescribed_date
CREATE TABLE IF NOT EXISTS public.silver_prescriptions (
    prescription_id VARCHAR(50) PRIMARY KEY DEFAULT ('RX' || nextval('seq_prescription_id')::text),
    encounter_id VARCHAR(50) REFERENCES public.silver_encounters(encounter_id) ON DELETE SET NULL,
    patient_id VARCHAR(50) NOT NULL REFERENCES public.silver_patients(patient_id) ON DELETE RESTRICT,
    medicine_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    instructions TEXT,
    prescribed_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_silver_prescriptions_patient ON public.silver_prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_silver_prescriptions_encounter ON public.silver_prescriptions(encounter_id);

-- Table 8: silver_lab_results
-- Canonical Silver schema: lab_id, patient_id, encounter_id, test_name, test_category, test_date, test_value, reference_range, unit, status, notes
CREATE TABLE IF NOT EXISTS public.silver_lab_results (
    lab_id VARCHAR(50) PRIMARY KEY DEFAULT ('LAB' || nextval('seq_lab_id')::text),
    patient_id VARCHAR(50) NOT NULL REFERENCES public.silver_patients(patient_id) ON DELETE RESTRICT,
    encounter_id VARCHAR(50) REFERENCES public.silver_encounters(encounter_id) ON DELETE SET NULL,
    test_name VARCHAR(255) NOT NULL,
    test_category VARCHAR(150),
    test_date DATE NOT NULL DEFAULT CURRENT_DATE,
    test_value VARCHAR(100) NOT NULL,
    reference_range VARCHAR(100),
    unit VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'Completed' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_silver_lab_results_patient ON public.silver_lab_results(patient_id);
CREATE INDEX IF NOT EXISTS idx_silver_lab_results_encounter ON public.silver_lab_results(encounter_id);

-- Table 9: silver_feedback
-- Canonical Silver schema: feedback_id, patient_id, doctor_id, encounter_id, rating, wait_time_rating, cleanliness_rating, staff_behavior_rating, comments, feedback_date
CREATE TABLE IF NOT EXISTS public.silver_feedback (
    feedback_id VARCHAR(50) PRIMARY KEY DEFAULT ('FB' || nextval('seq_feedback_id')::text),
    patient_id VARCHAR(50) NOT NULL REFERENCES public.silver_patients(patient_id) ON DELETE RESTRICT,
    doctor_id VARCHAR(50) NOT NULL REFERENCES public.silver_doctors(doctor_id) ON DELETE RESTRICT,
    encounter_id VARCHAR(50) REFERENCES public.silver_encounters(encounter_id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    wait_time_rating INTEGER CHECK (wait_time_rating >= 1 AND wait_time_rating <= 5),
    cleanliness_rating INTEGER CHECK (cleanliness_rating >= 1 AND cleanliness_rating <= 5),
    staff_behavior_rating INTEGER CHECK (staff_behavior_rating >= 1 AND staff_behavior_rating <= 5),
    comments TEXT,
    feedback_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_silver_feedback_patient ON public.silver_feedback(patient_id);
CREATE INDEX IF NOT EXISTS idx_silver_feedback_doctor ON public.silver_feedback(doctor_id);

-- Table 10: silver_staff_assignment
-- Canonical Silver Schema (EXACTLY 14 Columns in Specified Order):
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
CREATE TABLE IF NOT EXISTS public.silver_staff_assignment (
    assignment_id VARCHAR(50) PRIMARY KEY DEFAULT ('ASG' || nextval('seq_assignment_id')::text),
    staff_id VARCHAR(50) NOT NULL REFERENCES public.silver_staff(staff_id) ON DELETE CASCADE,
    patient_id VARCHAR(50) REFERENCES public.silver_patients(patient_id) ON DELETE SET NULL,
    doctor_id VARCHAR(50) REFERENCES public.silver_doctors(doctor_id) ON DELETE SET NULL,
    encounter_id VARCHAR(50) REFERENCES public.silver_encounters(encounter_id) ON DELETE SET NULL,
    appointment_id VARCHAR(50) REFERENCES public.silver_appointments(appointment_id) ON DELETE SET NULL,
    assignment_type VARCHAR(100) NOT NULL,
    assignment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TIME,
    end_time TIME,
    priority VARCHAR(50) DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent', 'Critical')),
    assignment_status VARCHAR(50) NOT NULL DEFAULT 'Scheduled' CHECK (assignment_status IN ('Scheduled', 'Active', 'In Progress', 'Completed', 'Cancelled', 'Reassigned')),
    assigned_by VARCHAR(50) REFERENCES public.silver_staff(staff_id) ON DELETE SET NULL,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_silver_staff_assignment_staff ON public.silver_staff_assignment(staff_id);
CREATE INDEX IF NOT EXISTS idx_silver_staff_assignment_patient ON public.silver_staff_assignment(patient_id);
CREATE INDEX IF NOT EXISTS idx_silver_staff_assignment_doctor ON public.silver_staff_assignment(doctor_id);
CREATE INDEX IF NOT EXISTS idx_silver_staff_assignment_encounter ON public.silver_staff_assignment(encounter_id);
CREATE INDEX IF NOT EXISTS idx_silver_staff_assignment_appointment ON public.silver_staff_assignment(appointment_id);
CREATE INDEX IF NOT EXISTS idx_silver_staff_assignment_date ON public.silver_staff_assignment(assignment_date);
CREATE INDEX IF NOT EXISTS idx_silver_staff_assignment_assigned_by ON public.silver_staff_assignment(assigned_by);

-- ----------------------------------------------------------------------------
-- 5. PUBLIC VIEW FOR DOCTOR DIRECTORY (LEAST PRIVILEGE)
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

-- ----------------------------------------------------------------------------
-- 6. SECURITY DEFINER HELPER FUNCTIONS
-- Optimized to read directly from app_users using auth.uid() = id
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_app_user()
RETURNS public.app_users
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT *
    FROM public.app_users
    WHERE id = auth.uid()
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS VARCHAR
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT role
    FROM public.app_users
    WHERE id = auth.uid()
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_current_patient_id()
RETURNS VARCHAR
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT patient_id
    FROM public.app_users
    WHERE id = auth.uid()
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_current_doctor_id()
RETURNS VARCHAR
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT doctor_id
    FROM public.app_users
    WHERE id = auth.uid()
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_current_staff_id()
RETURNS VARCHAR
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT staff_id
    FROM public.app_users
    WHERE id = auth.uid()
    LIMIT 1;
$$;

-- ----------------------------------------------------------------------------
-- 7. TRIGGERS: AUDIT TIMESTAMP, SIGNUP PROVISIONING, CONFLICT CHECK
-- ----------------------------------------------------------------------------

-- A. Timestamp Updater Trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_app_users_updated BEFORE UPDATE ON public.app_users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON public.silver_patients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_doctors_updated BEFORE UPDATE ON public.silver_doctors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON public.silver_staff FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON public.silver_appointments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_encounters_updated BEFORE UPDATE ON public.silver_encounters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_prescriptions_updated BEFORE UPDATE ON public.silver_prescriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_lab_results_updated BEFORE UPDATE ON public.silver_lab_results FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_feedback_updated BEFORE UPDATE ON public.silver_feedback FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- B. Strict Patient Signup Trigger: Executes strictly on public signups
-- Privileged accounts (Doctor, Staff, Admin) must be provisioned via trusted backend service-role API.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_patient_id VARCHAR(50);
    v_full_name VARCHAR(255);
    v_phone VARCHAR(50);
    v_dob DATE;
    v_gender VARCHAR(50);
    v_city VARCHAR(100);
    v_state VARCHAR(100);
    v_occupation VARCHAR(100);
    v_blood_group VARCHAR(10);
    v_emergency_contact VARCHAR(100);
    v_age INTEGER;
    v_raw_dob TEXT;
BEGIN
    -- If created via trusted server-side provisioning, backend provisions roles directly; bypass trigger
    IF (NEW.raw_app_meta_data->>'server_provisioned')::boolean = true THEN
        RETURN NEW;
    END IF;

    -- Validate email requirement
    IF NEW.email IS NULL OR TRIM(NEW.email) = '' THEN
        RAISE EXCEPTION 'A valid email address is required for registration.';
    END IF;

    -- Extract signup metadata
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
    v_phone := NEW.raw_user_meta_data->>'phone';
    v_gender := NEW.raw_user_meta_data->>'gender';
    v_city := NEW.raw_user_meta_data->>'city';
    v_state := NEW.raw_user_meta_data->>'state';
    v_occupation := NEW.raw_user_meta_data->>'occupation';
    v_blood_group := NEW.raw_user_meta_data->>'blood_group';
    v_emergency_contact := NEW.raw_user_meta_data->>'emergency_contact';

    v_raw_dob := NEW.raw_user_meta_data->>'date_of_birth';
    IF v_raw_dob IS NOT NULL AND TRIM(v_raw_dob) <> '' THEN
        BEGIN
            v_dob := v_raw_dob::DATE;
            v_age := EXTRACT(YEAR FROM age(CURRENT_DATE, v_dob))::INTEGER;
        EXCEPTION WHEN OTHERS THEN
            v_dob := NULL;
            v_age := NULL;
        END;
    END IF;

    -- 1. Create silver_patients profile first with user_id = NEW.id
    INSERT INTO public.silver_patients (
        user_id,
        name,
        date_of_birth,
        age,
        gender,
        city,
        state,
        occupation,
        registration_date,
        email,
        phone_number,
        emergency_contact,
        blood_group
    ) VALUES (
        NEW.id,
        v_full_name,
        v_dob,
        v_age,
        v_gender,
        v_city,
        v_state,
        v_occupation,
        CURRENT_DATE,
        NEW.email,
        v_phone,
        v_emergency_contact,
        v_blood_group
    ) RETURNING patient_id INTO v_patient_id;

    -- 2. Create app_users record directly linked to auth.users(id)
    INSERT INTO public.app_users (
        id,
        patient_id,
        doctor_id,
        staff_id,
        must_change_password,
        email,
        role,
        full_name,
        phone,
        is_active
    ) VALUES (
        NEW.id,
        v_patient_id,
        NULL,
        NULL,
        false,
        NEW.email,
        'patient',
        v_full_name,
        v_phone,
        true
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- C. Concurrency-Safe Appointment Duplicate Check Trigger
CREATE OR REPLACE FUNCTION public.check_appointment_conflict()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status IN ('Scheduled', 'Confirmed') THEN
        IF EXISTS (
            SELECT 1 FROM public.silver_appointments
            WHERE doctor_id = NEW.doctor_id
              AND appointment_date = NEW.appointment_date
              AND appointment_time = NEW.appointment_time
              AND status IN ('Scheduled', 'Confirmed')
              AND appointment_id <> COALESCE(NEW.appointment_id, '')
        ) THEN
            RAISE EXCEPTION 'This doctor already has an active appointment at % on %.', NEW.appointment_time, NEW.appointment_date;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_appointment_conflict
    BEFORE INSERT OR UPDATE OF doctor_id, appointment_date, appointment_time, status
    ON public.silver_appointments
    FOR EACH ROW EXECUTE FUNCTION public.check_appointment_conflict();

-- ----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.silver_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.silver_doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.silver_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.silver_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.silver_encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.silver_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.silver_lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.silver_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.silver_staff_assignment ENABLE ROW LEVEL SECURITY;

-- 8.1 app_users policies
CREATE POLICY "Users can read their own app_user record"
    ON public.app_users FOR SELECT
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Staff and admin can view all app_users"
    ON public.app_users FOR SELECT
    TO authenticated
    USING (public.get_current_role() IN ('staff', 'admin'));

CREATE POLICY "Only admins can update app_users"
    ON public.app_users FOR UPDATE
    TO authenticated
    USING (public.get_current_role() = 'admin')
    WITH CHECK (public.get_current_role() = 'admin');

-- 8.2 silver_patients policies
CREATE POLICY "Patients can view own patient record"
    ON public.silver_patients FOR SELECT
    TO authenticated
    USING (patient_id = public.get_current_patient_id());

CREATE POLICY "Patients can update own demographics"
    ON public.silver_patients FOR UPDATE
    TO authenticated
    USING (patient_id = public.get_current_patient_id())
    WITH CHECK (patient_id = public.get_current_patient_id());

CREATE POLICY "Clinical staff can view patient records"
    ON public.silver_patients FOR SELECT
    TO authenticated
    USING (public.get_current_role() IN ('doctor', 'staff', 'admin'));

CREATE POLICY "Clinical staff can update patient records"
    ON public.silver_patients FOR UPDATE
    TO authenticated
    USING (public.get_current_role() IN ('doctor', 'staff', 'admin'))
    WITH CHECK (public.get_current_role() IN ('doctor', 'staff', 'admin'));

-- 8.3 silver_doctors policies
CREATE POLICY "Doctors can view and update own doctor record"
    ON public.silver_doctors FOR ALL
    TO authenticated
    USING (doctor_id = public.get_current_doctor_id())
    WITH CHECK (doctor_id = public.get_current_doctor_id());

CREATE POLICY "Staff and Admin can manage doctor records"
    ON public.silver_doctors FOR ALL
    TO authenticated
    USING (public.get_current_role() IN ('staff', 'admin'))
    WITH CHECK (public.get_current_role() IN ('staff', 'admin'));

-- 8.4 silver_staff policies
CREATE POLICY "Staff members can view own staff record"
    ON public.silver_staff FOR SELECT
    TO authenticated
    USING (staff_id = public.get_current_staff_id());

CREATE POLICY "Staff and Admin can manage all staff records"
    ON public.silver_staff FOR ALL
    TO authenticated
    USING (public.get_current_role() IN ('staff', 'admin'))
    WITH CHECK (public.get_current_role() IN ('staff', 'admin'));

-- 8.5 silver_appointments policies
CREATE POLICY "Patients can view own appointments"
    ON public.silver_appointments FOR SELECT
    TO authenticated
    USING (patient_id = public.get_current_patient_id());

CREATE POLICY "Patients can book appointments"
    ON public.silver_appointments FOR INSERT
    TO authenticated
    WITH CHECK (
        patient_id = public.get_current_patient_id()
        AND status = 'Scheduled'
    );

-- Strict Patient Cancellation: Only status can be changed to Cancelled, no other fields altered
CREATE POLICY "Patients can cancel own appointments"
    ON public.silver_appointments FOR UPDATE
    TO authenticated
    USING (
        patient_id = public.get_current_patient_id()
        AND status IN ('Scheduled', 'Confirmed')
    )
    WITH CHECK (
        patient_id = public.get_current_patient_id()
        AND status = 'Cancelled'
    );

CREATE POLICY "Doctors can view assigned appointments"
    ON public.silver_appointments FOR SELECT
    TO authenticated
    USING (doctor_id = public.get_current_doctor_id());

CREATE POLICY "Doctors can update status of assigned appointments"
    ON public.silver_appointments FOR UPDATE
    TO authenticated
    USING (doctor_id = public.get_current_doctor_id())
    WITH CHECK (doctor_id = public.get_current_doctor_id());

CREATE POLICY "Staff and Admin full access to appointments"
    ON public.silver_appointments FOR ALL
    TO authenticated
    USING (public.get_current_role() IN ('staff', 'admin'))
    WITH CHECK (public.get_current_role() IN ('staff', 'admin'));

-- 8.6 silver_encounters policies
CREATE POLICY "Patients can view own encounters"
    ON public.silver_encounters FOR SELECT
    TO authenticated
    USING (patient_id = public.get_current_patient_id());

CREATE POLICY "Doctors can view and manage their encounters"
    ON public.silver_encounters FOR ALL
    TO authenticated
    USING (doctor_id = public.get_current_doctor_id())
    WITH CHECK (doctor_id = public.get_current_doctor_id());

CREATE POLICY "Staff and Admin can view all encounters"
    ON public.silver_encounters FOR SELECT
    TO authenticated
    USING (public.get_current_role() IN ('staff', 'admin'));

-- 8.7 silver_prescriptions policies
CREATE POLICY "Patients can view own prescriptions"
    ON public.silver_prescriptions FOR SELECT
    TO authenticated
    USING (patient_id = public.get_current_patient_id());

CREATE POLICY "Doctors can manage prescriptions"
    ON public.silver_prescriptions FOR ALL
    TO authenticated
    USING (public.get_current_role() = 'doctor')
    WITH CHECK (public.get_current_role() = 'doctor');

CREATE POLICY "Staff and Admin can view prescriptions"
    ON public.silver_prescriptions FOR SELECT
    TO authenticated
    USING (public.get_current_role() IN ('staff', 'admin'));

-- 8.8 silver_lab_results policies
CREATE POLICY "Patients can view own lab results"
    ON public.silver_lab_results FOR SELECT
    TO authenticated
    USING (patient_id = public.get_current_patient_id());

CREATE POLICY "Doctors and Staff can manage lab results"
    ON public.silver_lab_results FOR ALL
    TO authenticated
    USING (public.get_current_role() IN ('doctor', 'staff', 'admin'))
    WITH CHECK (public.get_current_role() IN ('doctor', 'staff', 'admin'));

-- 8.9 silver_feedback policies
CREATE POLICY "Patients can view own feedback"
    ON public.silver_feedback FOR SELECT
    TO authenticated
    USING (patient_id = public.get_current_patient_id());

CREATE POLICY "Patients can insert feedback for own appointments"
    ON public.silver_feedback FOR INSERT
    TO authenticated
    WITH CHECK (patient_id = public.get_current_patient_id());

CREATE POLICY "Doctors can view received feedback"
    ON public.silver_feedback FOR SELECT
    TO authenticated
    USING (doctor_id = public.get_current_doctor_id());

CREATE POLICY "Staff and Admin can view all feedback"
    ON public.silver_feedback FOR SELECT
    TO authenticated
    USING (public.get_current_role() IN ('staff', 'admin'));

-- 8.10 silver_staff_assignment policies
-- Internal clinical operations: strictly isolated from ordinary patients
CREATE POLICY "Staff can view own assignments"
    ON public.silver_staff_assignment FOR SELECT
    TO authenticated
    USING (staff_id = public.get_current_staff_id());

CREATE POLICY "Supervisors and Admins can manage staff assignments"
    ON public.silver_staff_assignment FOR ALL
    TO authenticated
    USING (public.get_current_role() IN ('staff', 'admin'))
    WITH CHECK (public.get_current_role() IN ('staff', 'admin'));

-- ----------------------------------------------------------------------------
-- 9. LEAST-PRIVILEGE PERMISSION GRANTS
-- ----------------------------------------------------------------------------
-- Grant schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Sequences granted exclusively to authenticated and service_role (never anon)
GRANT USAGE ON SEQUENCE 
    seq_patient_id, 
    seq_doctor_id, 
    seq_staff_id, 
    seq_appointment_id, 
    seq_encounter_id, 
    seq_lab_id, 
    seq_prescription_id, 
    seq_feedback_id, 
    seq_assignment_id 
TO authenticated, service_role;

-- Public doctor directory view grant for browsing before signin
GRANT SELECT ON public.silver_doctors_public TO anon, authenticated, service_role;

-- Table permissions guarded by RLS policies
GRANT SELECT, INSERT, UPDATE ON public.app_users TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.silver_patients TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.silver_doctors TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.silver_staff TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.silver_appointments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.silver_encounters TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.silver_prescriptions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.silver_lab_results TO authenticated, service_role;
GRANT SELECT, INSERT ON public.silver_feedback TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.silver_staff_assignment TO authenticated, service_role;

-- Function execution grants
GRANT EXECUTE ON FUNCTION public.get_current_app_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_patient_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_doctor_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_staff_id() TO authenticated, service_role;

COMMIT;
