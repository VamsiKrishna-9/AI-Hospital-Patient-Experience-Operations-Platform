-- ============================================================================
-- MediAI Hospital Platform: Phase 1 Silver-to-Supabase Migration Inventory
-- SOURCE DATABASE: Local MySQL hospital_db
-- 
-- STRICT READ-ONLY AUDIT SCRIPT FOR MYSQL WORKBENCH / MYSQL CLI
-- Zero modifications, zero transactions, zero temporary tables, zero DDL/DML.
-- Designed for single-pass execution in MySQL Workbench.
-- ============================================================================

USE hospital_db;

-- ----------------------------------------------------------------------------
-- 1. SOURCE SILVER TABLE ROW COUNTS
-- Evaluates the exact volume of source records across all 9 canonical Silver tables.
-- ----------------------------------------------------------------------------
SELECT '1. EXACT ROW COUNTS FOR CANONICAL SILVER TABLES' AS audit_step;

SELECT 
    'silver_patients' AS table_name, COUNT(*) AS row_count FROM silver_patients
UNION ALL
SELECT 
    'silver_doctors' AS table_name, COUNT(*) AS row_count FROM silver_doctors
UNION ALL
SELECT 
    'silver_staff' AS table_name, COUNT(*) AS row_count FROM silver_staff
UNION ALL
SELECT 
    'silver_appointments' AS table_name, COUNT(*) AS row_count FROM silver_appointments
UNION ALL
SELECT 
    'silver_encounters' AS table_name, COUNT(*) AS row_count FROM silver_encounters
UNION ALL
SELECT 
    'silver_prescriptions' AS table_name, COUNT(*) AS row_count FROM silver_prescriptions
UNION ALL
SELECT 
    'silver_lab_results' AS table_name, COUNT(*) AS row_count FROM silver_lab_results
UNION ALL
SELECT 
    'silver_feedback' AS table_name, COUNT(*) AS row_count FROM silver_feedback
UNION ALL
SELECT 
    'silver_staff_assignment' AS table_name, COUNT(*) AS row_count FROM silver_staff_assignment;


-- ----------------------------------------------------------------------------
-- 2. DETAILED COLUMN SCHEMAS & METADATA
-- Retrieves ordinal position, column name, data type, character/numeric length,
-- nullability, default values, and key types from information_schema.
-- ----------------------------------------------------------------------------
SELECT '2. DETAILED COLUMN SCHEMAS FOR 9 SILVER TABLES' AS audit_step;

SELECT 
    table_name,
    ordinal_position,
    column_name,
    column_type,
    data_type,
    is_nullable,
    column_default,
    column_key,
    extra
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name IN (
    'silver_patients',
    'silver_doctors',
    'silver_staff',
    'silver_appointments',
    'silver_encounters',
    'silver_prescriptions',
    'silver_lab_results',
    'silver_feedback',
    'silver_staff_assignment'
  )
ORDER BY table_name, ordinal_position;


-- ----------------------------------------------------------------------------
-- 3. SILVER_STAFF_ASSIGNMENT EXACT 14-COLUMN CONTRACT VERIFICATION
-- Explicit validation that silver_staff_assignment has exactly 14 columns matching
-- the canonical specification in both count and sequence.
-- ----------------------------------------------------------------------------
SELECT '3. SILVER_STAFF_ASSIGNMENT 14-COLUMN CONTRACT CHECK' AS audit_step;

SELECT 
    table_name,
    COUNT(*) AS total_column_count,
    CASE 
        WHEN COUNT(*) = 14 THEN 'PASS: Exactly 14 columns verified'
        ELSE CONCAT('FAIL: Expected 14 columns, detected ', COUNT(*))
    END AS contract_compliance
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'silver_staff_assignment';

SELECT 
    ordinal_position,
    column_name,
    column_type,
    is_nullable,
    CASE ordinal_position
        WHEN 1 THEN IF(column_name = 'assignment_id', 'PASS', 'MISMATCH: Expected assignment_id')
        WHEN 2 THEN IF(column_name = 'staff_id', 'PASS', 'MISMATCH: Expected staff_id')
        WHEN 3 THEN IF(column_name = 'patient_id', 'PASS', 'MISMATCH: Expected patient_id')
        WHEN 4 THEN IF(column_name = 'doctor_id', 'PASS', 'MISMATCH: Expected doctor_id')
        WHEN 5 THEN IF(column_name = 'encounter_id', 'PASS', 'MISMATCH: Expected encounter_id')
        WHEN 6 THEN IF(column_name = 'appointment_id', 'PASS', 'MISMATCH: Expected appointment_id')
        WHEN 7 THEN IF(column_name = 'assignment_type', 'PASS', 'MISMATCH: Expected assignment_type')
        WHEN 8 THEN IF(column_name = 'assignment_date', 'PASS', 'MISMATCH: Expected assignment_date')
        WHEN 9 THEN IF(column_name = 'start_time', 'PASS', 'MISMATCH: Expected start_time')
        WHEN 10 THEN IF(column_name = 'end_time', 'PASS', 'MISMATCH: Expected end_time')
        WHEN 11 THEN IF(column_name = 'priority', 'PASS', 'MISMATCH: Expected priority')
        WHEN 12 THEN IF(column_name = 'assignment_status', 'PASS', 'MISMATCH: Expected assignment_status')
        WHEN 13 THEN IF(column_name = 'assigned_by', 'PASS', 'MISMATCH: Expected assigned_by')
        WHEN 14 THEN IF(column_name = 'notes', 'PASS', 'MISMATCH: Expected notes')
        ELSE 'EXTRA_COLUMN'
    END AS column_contract_validation
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'silver_staff_assignment'
ORDER BY ordinal_position;


-- ----------------------------------------------------------------------------
-- 4. PRIMARY KEY DEFINITIONS, NULL CHECKS, AND DUPLICATE DETECTION
-- Verifies primary key integrity across all 9 source tables.
-- ----------------------------------------------------------------------------
SELECT '4. PRIMARY KEYS & UNIQUE CONSTRAINTS' AS audit_step;

SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    kcu.ordinal_position
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_schema = kcu.constraint_schema
   AND tc.table_name = kcu.table_name
   AND tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = DATABASE()
  AND tc.table_name IN (
    'silver_patients', 'silver_doctors', 'silver_staff',
    'silver_appointments', 'silver_encounters', 'silver_prescriptions',
    'silver_lab_results', 'silver_feedback', 'silver_staff_assignment'
  )
  AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position;

-- Null & Duplicate Primary Key Checks
SELECT '4.1 PRIMARY KEY NULL & DUPLICATE AUDIT' AS audit_step;

SELECT 'silver_patients' AS table_name,
    COUNT(CASE WHEN patient_id IS NULL THEN 1 END) AS null_pk_count,
    COUNT(patient_id) - COUNT(DISTINCT patient_id) AS duplicate_pk_count
FROM silver_patients
UNION ALL
SELECT 'silver_doctors' AS table_name,
    COUNT(CASE WHEN doctor_id IS NULL THEN 1 END) AS null_pk_count,
    COUNT(doctor_id) - COUNT(DISTINCT doctor_id) AS duplicate_pk_count
FROM silver_doctors
UNION ALL
SELECT 'silver_staff' AS table_name,
    COUNT(CASE WHEN staff_id IS NULL THEN 1 END) AS null_pk_count,
    COUNT(staff_id) - COUNT(DISTINCT staff_id) AS duplicate_pk_count
FROM silver_staff
UNION ALL
SELECT 'silver_appointments' AS table_name,
    COUNT(CASE WHEN appointment_id IS NULL THEN 1 END) AS null_pk_count,
    COUNT(appointment_id) - COUNT(DISTINCT appointment_id) AS duplicate_pk_count
FROM silver_appointments
UNION ALL
SELECT 'silver_encounters' AS table_name,
    COUNT(CASE WHEN encounter_id IS NULL THEN 1 END) AS null_pk_count,
    COUNT(encounter_id) - COUNT(DISTINCT encounter_id) AS duplicate_pk_count
FROM silver_encounters
UNION ALL
SELECT 'silver_prescriptions' AS table_name,
    COUNT(CASE WHEN prescription_id IS NULL THEN 1 END) AS null_pk_count,
    COUNT(prescription_id) - COUNT(DISTINCT prescription_id) AS duplicate_pk_count
FROM silver_prescriptions
UNION ALL
SELECT 'silver_lab_results' AS table_name,
    COUNT(CASE WHEN lab_id IS NULL THEN 1 END) AS null_pk_count,
    COUNT(lab_id) - COUNT(DISTINCT lab_id) AS duplicate_pk_count
FROM silver_lab_results
UNION ALL
SELECT 'silver_feedback' AS table_name,
    COUNT(CASE WHEN feedback_id IS NULL THEN 1 END) AS null_pk_count,
    COUNT(feedback_id) - COUNT(DISTINCT feedback_id) AS duplicate_pk_count
FROM silver_feedback
UNION ALL
SELECT 'silver_staff_assignment' AS table_name,
    COUNT(CASE WHEN assignment_id IS NULL THEN 1 END) AS null_pk_count,
    COUNT(assignment_id) - COUNT(DISTINCT assignment_id) AS duplicate_pk_count
FROM silver_staff_assignment;


-- ----------------------------------------------------------------------------
-- 5. DECLARED FOREIGN KEYS AND INDEXES
-- ----------------------------------------------------------------------------
SELECT '5. DECLARED FOREIGN KEY CONSTRAINTS' AS audit_step;

SELECT 
    kcu.table_name,
    kcu.column_name,
    kcu.constraint_name,
    kcu.referenced_table_name,
    kcu.referenced_column_name,
    rc.update_rule,
    rc.delete_rule
FROM information_schema.key_column_usage kcu
JOIN information_schema.referential_constraints rc
    ON kcu.constraint_schema = rc.constraint_schema
   AND kcu.constraint_name = rc.constraint_name
WHERE kcu.table_schema = DATABASE()
  AND kcu.table_name IN (
    'silver_patients', 'silver_doctors', 'silver_staff',
    'silver_appointments', 'silver_encounters', 'silver_prescriptions',
    'silver_lab_results', 'silver_feedback', 'silver_staff_assignment'
  )
ORDER BY kcu.table_name, kcu.column_name;

SELECT '5.1 EXISTING TABLE INDEXES' AS audit_step;

SELECT 
    table_name,
    index_name,
    non_unique,
    seq_in_index,
    column_name,
    collation,
    cardinality,
    index_type
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name IN (
    'silver_patients', 'silver_doctors', 'silver_staff',
    'silver_appointments', 'silver_encounters', 'silver_prescriptions',
    'silver_lab_results', 'silver_feedback', 'silver_staff_assignment'
  )
ORDER BY table_name, index_name, seq_in_index;


-- ----------------------------------------------------------------------------
-- 6. ORPHANED FOREIGN KEY AUDIT (LOGICAL INTEGRITY)
-- Evaluates whether any child records reference non-existent parent IDs.
-- High impact: Supabase PostgreSQL enforcers will reject orphaned records on INSERT!
-- ----------------------------------------------------------------------------
SELECT '6. ORPHANED FOREIGN KEY AUDIT (CHILD RECORDS MISSING PARENTS)' AS audit_step;

-- silver_appointments -> patients & doctors
SELECT 
    'silver_appointments -> silver_patients' AS relationship,
    COUNT(a.appointment_id) AS orphaned_count
FROM silver_appointments a
LEFT JOIN silver_patients p ON a.patient_id = p.patient_id
WHERE a.patient_id IS NOT NULL AND p.patient_id IS NULL
UNION ALL
SELECT 
    'silver_appointments -> silver_doctors' AS relationship,
    COUNT(a.appointment_id) AS orphaned_count
FROM silver_appointments a
LEFT JOIN silver_doctors d ON a.doctor_id = d.doctor_id
WHERE a.doctor_id IS NOT NULL AND d.doctor_id IS NULL
UNION ALL
-- silver_encounters -> patients, doctors, appointments
SELECT 
    'silver_encounters -> silver_patients' AS relationship,
    COUNT(e.encounter_id) AS orphaned_count
FROM silver_encounters e
LEFT JOIN silver_patients p ON e.patient_id = p.patient_id
WHERE e.patient_id IS NOT NULL AND p.patient_id IS NULL
UNION ALL
SELECT 
    'silver_encounters -> silver_doctors' AS relationship,
    COUNT(e.encounter_id) AS orphaned_count
FROM silver_encounters e
LEFT JOIN silver_doctors d ON e.doctor_id = d.doctor_id
WHERE e.doctor_id IS NOT NULL AND d.doctor_id IS NULL
UNION ALL
SELECT 
    'silver_encounters -> silver_appointments' AS relationship,
    COUNT(e.encounter_id) AS orphaned_count
FROM silver_encounters e
LEFT JOIN silver_appointments a ON e.appointment_id = a.appointment_id
WHERE e.appointment_id IS NOT NULL AND a.appointment_id IS NULL
UNION ALL
-- silver_prescriptions -> patients, encounters
SELECT 
    'silver_prescriptions -> silver_patients' AS relationship,
    COUNT(pr.prescription_id) AS orphaned_count
FROM silver_prescriptions pr
LEFT JOIN silver_patients p ON pr.patient_id = p.patient_id
WHERE pr.patient_id IS NOT NULL AND p.patient_id IS NULL
UNION ALL
SELECT 
    'silver_prescriptions -> silver_encounters' AS relationship,
    COUNT(pr.prescription_id) AS orphaned_count
FROM silver_prescriptions pr
LEFT JOIN silver_encounters e ON pr.encounter_id = e.encounter_id
WHERE pr.encounter_id IS NOT NULL AND e.encounter_id IS NULL
UNION ALL
-- silver_lab_results -> patients, encounters
SELECT 
    'silver_lab_results -> silver_patients' AS relationship,
    COUNT(l.lab_id) AS orphaned_count
FROM silver_lab_results l
LEFT JOIN silver_patients p ON l.patient_id = p.patient_id
WHERE l.patient_id IS NOT NULL AND p.patient_id IS NULL
UNION ALL
SELECT 
    'silver_lab_results -> silver_encounters' AS relationship,
    COUNT(l.lab_id) AS orphaned_count
FROM silver_lab_results l
LEFT JOIN silver_encounters e ON l.encounter_id = e.encounter_id
WHERE l.encounter_id IS NOT NULL AND e.encounter_id IS NULL
UNION ALL
-- silver_feedback -> patients, doctors, encounters
SELECT 
    'silver_feedback -> silver_patients' AS relationship,
    COUNT(f.feedback_id) AS orphaned_count
FROM silver_feedback f
LEFT JOIN silver_patients p ON f.patient_id = p.patient_id
WHERE f.patient_id IS NOT NULL AND p.patient_id IS NULL
UNION ALL
SELECT 
    'silver_feedback -> silver_doctors' AS relationship,
    COUNT(f.feedback_id) AS orphaned_count
FROM silver_feedback f
LEFT JOIN silver_doctors d ON f.doctor_id = d.doctor_id
WHERE f.doctor_id IS NOT NULL AND d.doctor_id IS NULL
UNION ALL
SELECT 
    'silver_feedback -> silver_encounters' AS relationship,
    COUNT(f.feedback_id) AS orphaned_count
FROM silver_feedback f
LEFT JOIN silver_encounters e ON f.encounter_id = e.encounter_id
WHERE f.encounter_id IS NOT NULL AND e.encounter_id IS NULL
UNION ALL
-- silver_staff_assignment -> staff, patients, doctors, encounters, appointments, assigned_by
SELECT 
    'silver_staff_assignment -> silver_staff (staff_id)' AS relationship,
    COUNT(sa.assignment_id) AS orphaned_count
FROM silver_staff_assignment sa
LEFT JOIN silver_staff s ON sa.staff_id = s.staff_id
WHERE sa.staff_id IS NOT NULL AND s.staff_id IS NULL
UNION ALL
SELECT 
    'silver_staff_assignment -> silver_patients' AS relationship,
    COUNT(sa.assignment_id) AS orphaned_count
FROM silver_staff_assignment sa
LEFT JOIN silver_patients p ON sa.patient_id = p.patient_id
WHERE sa.patient_id IS NOT NULL AND p.patient_id IS NULL
UNION ALL
SELECT 
    'silver_staff_assignment -> silver_doctors' AS relationship,
    COUNT(sa.assignment_id) AS orphaned_count
FROM silver_staff_assignment sa
LEFT JOIN silver_doctors d ON sa.doctor_id = d.doctor_id
WHERE sa.doctor_id IS NOT NULL AND d.doctor_id IS NULL
UNION ALL
SELECT 
    'silver_staff_assignment -> silver_encounters' AS relationship,
    COUNT(sa.assignment_id) AS orphaned_count
FROM silver_staff_assignment sa
LEFT JOIN silver_encounters e ON sa.encounter_id = e.encounter_id
WHERE sa.encounter_id IS NOT NULL AND e.encounter_id IS NULL
UNION ALL
SELECT 
    'silver_staff_assignment -> silver_appointments' AS relationship,
    COUNT(sa.assignment_id) AS orphaned_count
FROM silver_staff_assignment sa
LEFT JOIN silver_appointments a ON sa.appointment_id = a.appointment_id
WHERE sa.appointment_id IS NOT NULL AND a.appointment_id IS NULL
UNION ALL
SELECT 
    'silver_staff_assignment -> silver_staff (assigned_by)' AS relationship,
    COUNT(sa.assignment_id) AS orphaned_count
FROM silver_staff_assignment sa
LEFT JOIN silver_staff s ON sa.assigned_by = s.staff_id
WHERE sa.assigned_by IS NOT NULL AND s.staff_id IS NULL;


-- ----------------------------------------------------------------------------
-- 7. FOREIGN KEY NULLABILITY PROFILES
-- Identifies mandatory vs optional relationships in source tables.
-- ----------------------------------------------------------------------------
SELECT '7. FOREIGN KEY NULLABILITY METRICS' AS audit_step;

SELECT 
    'silver_appointments' AS table_name,
    COUNT(*) AS total_rows,
    SUM(CASE WHEN patient_id IS NULL THEN 1 ELSE 0 END) AS null_patient_id,
    SUM(CASE WHEN doctor_id IS NULL THEN 1 ELSE 0 END) AS null_doctor_id
FROM silver_appointments
UNION ALL
SELECT 
    'silver_encounters' AS table_name,
    COUNT(*) AS total_rows,
    SUM(CASE WHEN patient_id IS NULL THEN 1 ELSE 0 END) AS null_patient_id,
    SUM(CASE WHEN doctor_id IS NULL THEN 1 ELSE 0 END) AS null_doctor_id
FROM silver_encounters
UNION ALL
SELECT 
    'silver_prescriptions' AS table_name,
    COUNT(*) AS total_rows,
    SUM(CASE WHEN patient_id IS NULL THEN 1 ELSE 0 END) AS null_patient_id,
    SUM(CASE WHEN encounter_id IS NULL THEN 1 ELSE 0 END) AS null_encounter_id
FROM silver_prescriptions
UNION ALL
SELECT 
    'silver_lab_results' AS table_name,
    COUNT(*) AS total_rows,
    SUM(CASE WHEN patient_id IS NULL THEN 1 ELSE 0 END) AS null_patient_id,
    SUM(CASE WHEN encounter_id IS NULL THEN 1 ELSE 0 END) AS null_encounter_id
FROM silver_lab_results
UNION ALL
SELECT 
    'silver_feedback' AS table_name,
    COUNT(*) AS total_rows,
    SUM(CASE WHEN patient_id IS NULL THEN 1 ELSE 0 END) AS null_patient_id,
    SUM(CASE WHEN doctor_id IS NULL THEN 1 ELSE 0 END) AS null_doctor_id
FROM silver_feedback
UNION ALL
SELECT 
    'silver_staff_assignment' AS table_name,
    COUNT(*) AS total_rows,
    SUM(CASE WHEN staff_id IS NULL THEN 1 ELSE 0 END) AS null_staff_id,
    SUM(CASE WHEN patient_id IS NULL THEN 1 ELSE 0 END) AS null_patient_id
FROM silver_staff_assignment;


-- ----------------------------------------------------------------------------
-- 8. DATA TYPE, FORMAT & RANGE VALIDATION
-- Validates dates, times, enumerated status codes, ratings, and numeric bounds.
-- ----------------------------------------------------------------------------
SELECT '8. DATE/TIME FORMAT & NUMERIC RANGE AUDIT' AS audit_step;

-- Check date validity in appointments
SELECT 
    'silver_appointments' AS table_name,
    COUNT(*) AS total_rows,
    SUM(CASE WHEN appointment_date IS NULL OR appointment_date = '0000-00-00' THEN 1 ELSE 0 END) AS invalid_date_count,
    SUM(CASE WHEN appointment_time IS NULL THEN 1 ELSE 0 END) AS null_time_count,
    MIN(appointment_date) AS earliest_date,
    MAX(appointment_date) AS latest_date
FROM silver_appointments
UNION ALL
-- Check date validity in encounters
SELECT 
    'silver_encounters' AS table_name,
    COUNT(*) AS total_rows,
    SUM(CASE WHEN encounter_date IS NULL OR encounter_date = '0000-00-00' THEN 1 ELSE 0 END) AS invalid_date_count,
    0 AS null_time_count,
    MIN(encounter_date) AS earliest_date,
    MAX(encounter_date) AS latest_date
FROM silver_encounters
UNION ALL
-- Check date validity in prescriptions
SELECT 
    'silver_prescriptions' AS table_name,
    COUNT(*) AS total_rows,
    SUM(CASE WHEN prescribed_date IS NULL OR prescribed_date = '0000-00-00' THEN 1 ELSE 0 END) AS invalid_date_count,
    0 AS null_time_count,
    MIN(prescribed_date) AS earliest_date,
    MAX(prescribed_date) AS latest_date
FROM silver_prescriptions
UNION ALL
-- Check date validity in lab results
SELECT 
    'silver_lab_results' AS table_name,
    COUNT(*) AS total_rows,
    SUM(CASE WHEN test_date IS NULL OR test_date = '0000-00-00' THEN 1 ELSE 0 END) AS invalid_date_count,
    0 AS null_time_count,
    MIN(test_date) AS earliest_date,
    MAX(test_date) AS latest_date
FROM silver_lab_results;

-- Status and enum distribution checks
SELECT '8.1 APPOINTMENT STATUS DISTRIBUTION' AS audit_step;
SELECT status, COUNT(*) AS count_by_status FROM silver_appointments GROUP BY status;

SELECT '8.2 APPOINTMENT CONSULTATION TYPES' AS audit_step;
SELECT consultation_type, COUNT(*) AS count_by_type FROM silver_appointments GROUP BY consultation_type;

SELECT '8.3 FEEDBACK RATINGS RANGE AUDIT' AS audit_step;
SELECT 
    COUNT(*) AS total_feedback,
    MIN(rating) AS min_rating,
    MAX(rating) AS max_rating,
    SUM(CASE WHEN rating < 1 OR rating > 5 THEN 1 ELSE 0 END) AS out_of_range_ratings
FROM silver_feedback;

-- ----------------------------------------------------------------------------
-- 9. DOCTOR DIRECTORY & HOSPITAL BRANCH AUDIT
-- Analyzes doctor availability, active flags, and branch distributions.
-- ----------------------------------------------------------------------------
SELECT '9. DOCTOR DIRECTORY & BRANCH BREAKDOWN' AS audit_step;

SELECT 
    COUNT(*) AS total_doctors,
    SUM(CASE WHEN is_active = 1 OR is_active = true THEN 1 ELSE 0 END) AS active_doctors,
    SUM(CASE WHEN is_active = 0 OR is_active = false THEN 1 ELSE 0 END) AS inactive_doctors,
    COUNT(DISTINCT specialty) AS distinct_specialties,
    COUNT(DISTINCT hospital_branch) AS distinct_branches
FROM silver_doctors;

SELECT 
    hospital_branch,
    COUNT(*) AS doctors_in_branch,
    SUM(CASE WHEN is_active = 1 OR is_active = true THEN 1 ELSE 0 END) AS active_in_branch
FROM silver_doctors
GROUP BY hospital_branch;

SELECT 
    specialty,
    COUNT(*) AS doctors_in_specialty
FROM silver_doctors
GROUP BY specialty
ORDER BY doctors_in_specialty DESC;

-- ============================================================================
-- END OF READ-ONLY INVENTORY SCRIPT
-- ============================================================================
