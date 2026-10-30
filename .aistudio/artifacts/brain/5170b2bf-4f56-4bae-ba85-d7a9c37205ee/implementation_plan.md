# Implementation Plan: Differentiating Outpatient Checkups from Admitted Inpatients in Doctor Dashboard

## Overview & Clinical Rationale
In hospital clinical operations, **outpatient checkup patients** (routine clinical consultations, diagnostic reviews, scheduled checkups) require a different workflow, data model, and care management process from **admitted inpatient ward patients** (hospital ward beds, telemetry monitoring, inpatient census, daily rounding, and continuous bedside nursing care).

This plan outlines the architecture and UI enhancements to explicitly separate checkup clinic patients from admitted ward patients in the MediAI Doctor Dashboard, including an integrated **"Admit to Hospital Bed"** workflow directly from outpatient checkup encounters.

---

## 1. User Choices & Requirements
1. **Navigation Structure**:
   - Dedicated tabs:
     - **Checkup Clinic (Outpatients)**: Scheduled consultations, checkup queue, trend analytics, encounter documentation, and outpatient staff delegation.
     - **Inpatient Rounds (Admitted)**: Admitted hospital ward patients, bed and room assignments, acuity tracking, telemetry vitals, daily care plans, and bedside nurse delegation.
     - **Diagnostic Labs**: Laboratory test signing and critical value reviews.
     - **Care Team Assignments**: Complete register of doctor-to-staff clinical delegations.
2. **Admission Workflow**:
   - An interactive **"Admit to Hospital Bed"** button inside the consultation workspace during checkup visits.
   - Allows the physician to directly transfer an outpatient to an inpatient ward bed with admission orders, acuity rating, and optional bedside nursing assignment.
3. **Clinical Metrics & KPI Strip**:
   - Clear visual differentiation between **Clinic Outpatient** metrics (Today's Checkups, Completed Visits, Average Consult Duration) and **Inpatient Ward** metrics (Active Inpatient Census, Ward Bed Occupancy).
   - Contextual emphasis highlighting clinic metrics when viewing outpatient checkups and ward metrics when viewing inpatient rounds.

---

## 2. Technical Architecture & Data Flow

### A. Backend (`server.ts`)
1. **Admit Patient API (`POST /api/doctor/admit-patient`)**:
   - Authenticated doctor endpoint receiving:
     - `patientId`: MRN of the outpatient.
     - `appointmentId`: Optional source checkup appointment ID.
     - `bedId` & `room`: Selected available ward bed (e.g., Bed 301-A, East Wing).
     - `diagnosis`: Primary admitting diagnosis.
     - `acuity`: 'Stable' | 'Observation' | 'Moderate' | 'Acute Monitored'.
     - `admittingNotes`: Clinical admission orders and instructions.
     - `assignedStaffId`: Optional bedside staff/nurse to assign immediately.
   - Persistence operations:
     - Creates new record in `silver_encounters` with `encounter_type = 'Inpatient Admission'`.
     - Updates ward bed status to `Occupied` in `activeHospitalWardBeds` and links patient MRN and attending doctor.
     - If staff is selected, creates record in `silver_staff_assignment` with `assignment_type = 'Inpatient Bedside Care'`.
     - Updates source appointment in `silver_appointments` to status `Completed (Admitted)`.
   - Returns updated inpatient record, updated ward bed list, and audit confirmation.

2. **Overview Endpoint (`GET /api/doctor/overview`)**:
   - Refines metric calculations:
     - `todayAppointments`: Outpatient checkups scheduled for today.
     - `completedConsultations`: Outpatient checkup encounters completed.
     - `inpatientCensus`: Current active inpatients occupying ward beds.
     - `wardBedOccupancy`: Occupied beds vs. total ward beds.

### B. Frontend (`src/components/DoctorDashboard.tsx`)
1. **Tab Reorganization & Badging**:
   - Primary Tabs:
     - `Checkup Clinic (Outpatients)` with live count of appointments.
     - `Inpatient Rounds (Admitted)` with live count of admitted ward patients and bed status.
     - `Diagnostic Labs` and `Staff Care Team`.
2. **Context-Aware KPI Cards**:
   - **Clinic Metrics**:
     - `Today's Checkups`: Scheduled outpatient visits for today.
     - `Completed Checkups`: Clinic consultations finalized today with completion rate.
     - `Checkup Duration`: Average outpatient consultation time in minutes.
   - **Ward Metrics**:
     - `Inpatient Census`: Number of admitted patients currently under the doctor's service.
     - `Ward Bed Capacity`: Real-time hospital ward bed occupancy (e.g. 10/12 occupied).
3. **Outpatient Consultation Workspace Enhancements**:
   - Distinct "Outpatient Checkup" clinical banner.
   - Dual-action clinical bar:
     - **Sign & Finalize Checkup** (for standard outpatient discharge).
     - **Admit to Hospital Bed** (with Bed icon and prominent styling).
4. **Admission Modal**:
   - Displays real-time available hospital ward beds filtered by wing/type (Telemetry, Cardiac Stepdown, General Ward).
   - Acuity selector (Observation, Stable, Monitored, Acute).
   - Admitting orders & primary reason for admission.
   - Bedside nurse selection from available hospital staff.
   - On submission:
     - Displays success confirmation.
     - Updates outpatient queue status to `Completed (Admitted)`.
     - Automatically refreshes inpatient rounds and ward bed states.
     - Provides a direct link to switch to "Inpatient Rounds" tab to view the admitted patient in their new bed.

---

## 3. Implementation Steps

1. **Backend Integration (`server.ts`)**:
   - Implement `POST /api/doctor/admit-patient` handling encounter creation, bed occupancy update, bedside staff assignment, and appointment status update.
   - Ensure ward bed sync and live census calculations.

2. **Frontend Component Updates (`src/components/DoctorDashboard.tsx`)**:
   - Update tab definitions, labels, and badges to explicitly contrast Outpatient Checkup Clinic with Inpatient Rounds.
   - Update top KPI metric cards with clear `CLINIC` vs `INPATIENT WARD` categorization.
   - Add the **"Admit to Hospital Bed"** action button to the consultation workspace.
   - Implement the **Inpatient Bed Admission Modal** with bed selector, acuity selector, admitting orders, and bedside nurse picker.
   - Add quick-navigation notifications upon successful admission.

3. **Verification & Testing**:
   - Verify TypeScript compilation via `compile_applet`.
   - Test outpatient consultation flow: selecting a checkup patient, entering encounter notes, and standard signing.
   - Test admission flow: selecting an outpatient, clicking "Admit to Hospital Bed", selecting an available ward bed and bedside nurse, and confirming admission.
   - Verify that the admitted patient immediately appears under the "Inpatient Rounds" tab in the selected bed.
   - Verify that staff assignments and bed occupancy reflect the new admission across all views.
