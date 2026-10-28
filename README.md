# MediAI — Hospital Patient Experience & Operations Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38bdf8.svg)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_%26_Auth-3ecf8e.svg)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Tests-17_Unit_%2B_44_E2E_Passing-success.svg)](https://nodejs.org/api/test.html)

**MediAI** is an intelligent, full-stack hospital patient experience and clinical operations platform. It unifies patient access, appointment scheduling, electronic health records (EHR), clinical workflows, staff operational management, and hospital telemetry into a single, cohesive system.

Built on modern cloud standards and the Medallion Data Architecture, MediAI bridges legacy hospital databases with modern web-based clinical interfaces, robust PostgreSQL Row Level Security (RLS), and real-time scheduling controls.

---

## Table of Contents

- [Key Objectives](#key-objectives)
- [System Architecture](#system-architecture)
- [User Roles & Implemented Features](#user-roles--implemented-features)
- [Unified Authentication & Security Architecture](#unified-authentication--security-architecture)
- [Medallion Architecture & Canonical Silver Schema](#medallion-architecture--canonical-silver-schema)
- [Supabase Database & Security Model](#supabase-database--security-model)
- [Environment Configuration](#environment-configuration)
- [Local Development & Testing](#local-development--testing)
- [Recent Pull Requests & Feature Changelog](#recent-pull-requests--feature-changelog)
- [Current Project Status — October 27, 2026](#current-project-status--october-27-2026)
- [Deployment & GitHub Publishing](#deployment--github-publishing)
- [License & Compliance Notice](#license--compliance-notice)

---

## Key Objectives

1. **Patient Empowerment**: Seamless self-service booking, consultation history, lab telemetry review, prescription tracking, and multi-dimensional feedback submission.
2. **Clinical Operational Integrity**: Conflict-free scheduling with database-enforced exclusion constraints, clinical shift management, and strict separation of patient clinical narratives.
3. **Enterprise Security & Governance**: Strict multi-tenant role-based access control (RBAC), Supabase Auth with custom service-role isolation, and PostgreSQL Row-Level Security (RLS) guaranteeing that patients and providers only access authorized records.
4. **Data Continuity & Schema Parity**: Clean, bidirectional alignment between canonical MySQL enterprise warehouse datasets (`hospital_db`) and Supabase PostgreSQL.

---

## System Architecture

MediAI is engineered as a unified full-stack application using Vite and Express:

```
┌──────────────────────────────────────────────────────────────────┐
│                         Client Interface                         │
│   React 19 SPA • Tailwind CSS v4 • Lucide React • Motion        │
└─────────────────────────────────┬────────────────────────────────┘
                                  │ HTTP / JSON (Port 3000)
┌─────────────────────────────────▼────────────────────────────────┐
│                   Backend API Server (`server.ts`)               │
│  Express 4.21 • TSX Runtime • Vite Dev Middleware               │
│  - Strict IANA Hospital Timezone Validation (Asia/Kolkata)       │
│  - Conflict Prevention & Slot Boundary Checks                   │
│  - Supabase Service-Role Admin & Auth Broker                     │
└──────────────────┬─────────────────────────────┬─────────────────┘
                   │                             │
       Admin/Service-Role Client          Public Anon Client
                   │                             │
┌──────────────────▼─────────────────────────────▼─────────────────┐
│                     Supabase Managed Cloud                       │
│  ┌─────────────────────────┐     ┌────────────────────────────┐  │
│  │      Supabase Auth      │     │    PostgreSQL Database     │  │
│  │   `auth.users` Store    │◄───►│  Row-Level Security (RLS)  │  │
│  └─────────────────────────┘     │  PL/pgSQL Triggers         │  │
│                                  │  Canonical Silver Tables   │  │
│                                  └────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 19.0, TypeScript 7.0 |
| **Build & Tooling** | Vite 8.3, TSX (TypeScript Execute) |
| **Styling & Motion** | Tailwind CSS v4.0, Motion (Framer Motion engine) |
| **Iconography** | Lucide React |
| **Backend API** | Node.js (v22), Express 4.21 |
| **Database & Identity** | Supabase PostgreSQL, Supabase Auth (`@supabase/supabase-js` v2.118) |
| **AI Integration** | Google Gen AI SDK (`@google/genai` v2.4.0) |
| **Testing** | Node.js Native Test Runner (`tsx --test`) |

---

## User Roles & Implemented Features

MediAI provides specialized operational workspaces for four distinct hospital roles:

### 1. Patient (`patient`) — `PatientDashboard.tsx`
- **Interactive Patient Portal**: Real-time overview of current care journey, upcoming consultations, care team, and clinical records.
- **Appointment Booking Wizard**: Multi-step booking engine with doctor specialty filters, clinic slot selection (09:00–16:30 standard clinic slots), channel selection (`Online`, `In-Person`, `Emergency`), and priority designation (`Low`, `Medium`, `High`, `Urgent`).
- **Electronic Medical Records (EMR)**:
  - **Clinical Encounters**: Comprehensive records of diagnoses, symptoms, vitals, and treatment plans.
  - **Prescription Tracker**: Active and past medications, dosages, frequencies, routes, refills, and prescribed duration.
  - **Diagnostic Lab Telemetry**: Laboratory reports, reference range flags (`Normal`, `Abnormal`, `Critical`), and status tracking.
- **Patient Experience Feedback**: 6 distinct evaluation dimensions (1–5 scale):
  - Overall Rating, Doctor Rating, Staff Rating, Wait Time Rating, Cleanliness Rating, Recommendation Likelihood (`likely_to_recommend`).
  - Qualitative comments and automated sentiment categorization (`Positive`, `Neutral`, `Negative`).

### 2. Doctor / Physician (`doctor`) — `DoctorDashboard.tsx`
- **Clinical Consult Agenda**: Daily consultation schedule (8 active clinic visits), patient arrival status, consult room assignment, and chief complaints.
- **Inpatient Ward Rounds**: Direct clinical visibility into admitted patients (Cardiology & Intensive Care Units), bed numbers, length of stay, acuity levels, real-time vitals, and current care plans.
- **Diagnostic Lab Review & Sign-Off**: Electronic review queue for pending lab investigations (Troponin-I, Lipid Panels, HbA1c, CBC) with one-click clinical sign-off and abnormal value flagging.
- **Encounter Documentation & E-Prescriptions**: Modal authoring workflow for clinical notes, diagnostic codes, prescription dosages, routes, frequencies, and follow-up orders.
- **Public Directory Integration**: Managed doctor profile published via `public.silver_doctors_public`.

### 3. Clinical Staff & Nursing (`staff`) — `StaffDashboard.tsx`
- **Ward 4B Bed Management Grid**: Interactive 32-bed spatial matrix across West and North wings with dynamic status controls (`Occupied`, `Available`, `Cleaning`, `Reserved`), assigned nurses, and oxygen delivery modes (`Room Air`, `High-Flow Nasal Cannula`, `Ventilator`).
- **Triage Intake Queue**: Emergency Severity Index (ESI Levels 1–5) triage prioritization list with chief complaints, wait durations, acuity badges, and bed assignment workflows.
- **Vitals Telemetry Logging**: Nursing modal for recording heart rate, blood pressure, SpO2, and body temperature with automated abnormal threshold alerts.
- **Shift & Department Coordination**: Shift schedules (`Morning`, `Afternoon`, `Night`), ward assignments, and duty handoff notes.

### 4. Hospital Administrator (`admin`) — `AdminDashboard.tsx`
- **Executive Operations Dashboard**: High-level telemetry tracking bed occupancy rate (84%), average wait times (14.2 min), patient satisfaction score (4.8/5.0), and active provider counts.
- **Departmental Capacity Matrix**: Real-time breakdown of total vs. occupied beds and on-duty physicians across Cardiology, Neurology, Emergency, Orthopedics, and Oncology.
- **User Governance & Access Control**: Centralized administrative directory of all hospital accounts (`/api/admin/users`), dynamic role reassignment (`/api/admin/users/update-role`), and clinical identifier preservation.
- **Immutable Audit Ledger**: Real-time audit log viewer (`/api/admin/audit-logs`) tracking every administrative role transition, acting administrator, timestamp, reason, and database commit status.

---

## Unified Authentication & Security Architecture

MediAI implements a hardened, unified authentication system designed specifically for healthcare environments:

### 1. Unified Common Login (`POST /api/auth/common-login`)
- **Frictionless Credential Entry**: A single, clean login interface where patients enter their Patient ID (e.g. `P182162`) and healthcare professionals/administrators enter their official hospital email.
- **Automatic Identity Recognition**: Real-time client-side and server-side pattern detection (`/^P\d+$/i` vs. email patterns) automatically detects the user persona without requiring role toggle buttons.
- **Authoritative Server Resolution**: Validates credentials against Supabase PostgreSQL `app_users` and resolves role boundaries, routing authenticated sessions directly to their corresponding operational workspace (`patient-dashboard`, `doctor-dashboard`, `staff-dashboard`, `admin-dashboard`).

### 2. Public Registration Security Hardening (`POST /api/auth/common-register`)
- **Patient-Only Default Enrollment**: Public registration has been strictly hardened to provision only `'patient'` accounts.
- **Elimination of Self-Elevation Exploits**: Role selectors, doctor/staff invite codes, and administrative keys have been completely removed from public signup screens. Any attempt to supply elevated roles in the registration payload is authoritatively overridden server-side.
- **Automated Identifier Generation**: New registrants are automatically assigned a verified Patient ID (`P######`) linked to `silver_patients` and `app_users`.

### 3. Google Single Sign-On (`POST /api/auth/google`)
- **Secure OAuth / SSO Integration**: Provides seamless one-click authentication.
- **Default Patient Scoping**: New Google SSO sign-ins default to the `patient` role unless previously elevated by a hospital administrator.

### 4. Executive Role Governance & Clinical ID Retention (`POST /api/admin/users/update-role`)
- **Strict Administrator Guard (`requireAdminRole`)**: Only users authenticated with active administrative privileges can access user directory and role modification endpoints. Attempts by regular patients or staff return HTTP `403 Forbidden`.
- **Clinical Identifier Preservation**: When a physician or clinical staff member is transitioned to a patient role, their clinical identifiers (`doctor_id`, `staff_id`) are preserved in `historical_identifiers` for audit trail continuity, while immediately revoking privileged dashboard access.
- **Dual-Layer Synchronization**: Role changes are committed in real-time to both the active application registry and Supabase PostgreSQL `public.app_users`.
- **Audit Logging**: Every role alteration is logged to `public.audit_logs` and the in-memory audit ledger with actor details, target details, timestamp, justification, and commit status.

---

## Medallion Architecture & Canonical Silver Schema

MediAI adopts the **Medallion Data Architecture**. The Supabase PostgreSQL layer houses the **Silver Layer** (curated, validated, typed, and structured relational tables). 

The application model conforms to **10 Canonical Silver Entities**, matching the enterprise MySQL `hospital_db` schema while extending it for authenticated web applications:

```
                     ┌───────────────────┐
                     │    auth.users     │
                     └─────────┬─────────┘
                               │ 1:1
                     ┌─────────▼─────────┐
                     │ public.app_users  │
                     └─────────┬─────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       │                       │                       │
┌──────▼──────────┐   ┌────────▼────────┐    ┌─────────▼────────┐
│ silver_patients │   │ silver_doctors  │    │   silver_staff   │
└──────┬──────────┘   └────────┬────────┘    └─────────┬────────┘
       │                       │                       │
       ├───────────────────────┼───────────────────────┘
       │                       │
┌──────▼──────────────┐        │
│ silver_appointments │        │
└──────┬──────────────┘        │
       │                       │
       ├───────────────────────┤
       │                       │
┌──────▼───────────┐  ┌────────▼──────────┐  ┌──────────────────┐
│ silver_encounters│  │  silver_feedback  │  │silver_staff_     │
└──────┬───────────┘  └───────────────────┘  │assignment        │
       │                                     └──────────────────┘
       ├───────────────────────┐
       │                       │
┌──────▼──────────────┐ ┌──────▼───────────┐
│silver_prescriptions │ │silver_lab_results│
└─────────────────────┘ └──────────────────┘
```

### Table Specifications

| # | Entity | Primary Key | Description & Canonical Fields |
| :--- | :--- | :--- | :--- |
| **1** | `public.app_users` | `id` (UUID) | 1:1 linkage to `auth.users(id)`. Attributes: `patient_id`, `role`, `must_change_password`, `is_active`. |
| **2** | `silver_patients` | `patient_id` (TEXT) | `name`, `date_of_birth`, `age`, `gender`, `city`, `state`, `socioeconomic_status`, `occupation`, `registration_date`, `phone_number`, `email`. |
| **3** | `silver_doctors` | `doctor_id` (TEXT) | `doctor_name`, `department_id`, `department_name`, `specialization`, `qualification`, `experience_years`, `city`, `employment_type`, `availability`, `joining_date`, `phone_number`, `email`, `is_active`. |
| **4** | `silver_staff` | `staff_id` (TEXT) | `staff_name`, `staff_type`, `role`, `department_name`, `ward_id`, `shift_type`, `shift_start`, `shift_end`, `employment_type`, `experience_years`, `status`, `joining_date`, `is_active`. |
| **5** | `silver_appointments` | `appointment_id` (TEXT) | `patient_id`, `doctor_id`, `appointment_date`, `appointment_time`, `appointment_type`, `department_name`, `booking_channel`, `priority`, `status`, `wait_time_minutes`, `consultation_duration_minutes`. |
| **6** | `silver_encounters` | `encounter_id` (TEXT) | `patient_id`, `doctor_id`, `department_id`, `department_name`, `encounter_type`, `encounter_date`, `admission_date`, `discharge_date`, `diagnosis_code`, `diagnosis_description`, `treatment_type`, `treatment_outcome`, `follow_up_date`, `notes`, `appointment_id` (optional). |
| **7** | `silver_prescriptions` | `prescription_id` (TEXT) | `encounter_id`, `patient_id`, `doctor_id`, `medication_name`, `dosage`, `frequency`, `duration_days`, `route`, `refill_allowed`, `prescription_date`, `prescription_status`, `start_date`, `end_date`, `instructions`. |
| **8** | `silver_lab_results` | `lab_result_id` (TEXT) | `encounter_id`, `patient_id`, `test_type`, `test_name`, `result_value`, `reference_range`, `test_status`, `test_ordered_date`, `result_date`, `interpretation`. |
| **9** | `silver_feedback` | `feedback_id` (TEXT) | `patient_id`, `doctor_id`, `department_id`, `appointment_id`, `rating`, `doctor_rating`, `staff_rating`, `cleanliness_rating`, `wait_time_rating`, `likely_to_recommend`, `feedback_date`, `sentiment`, `feedback_text`. |
| **10** | `silver_staff_assignment` | `assignment_id` (TEXT) | Exact 14-column clinical assignment ledger: `staff_id`, `staff_name`, `role`, `department_id`, `department_name`, `ward_id`, `shift_id`, `shift_date`, `shift_type`, `shift_start_time`, `shift_end_time`, `assignment_status`, `assigned_by`. |

---

## Supabase Database & Security Model

### 1. Row Level Security (RLS)
Every table under `public` has Row Level Security enabled:
- **Patients**: Restricted strictly to viewing and updating their own linked records using `auth.uid() = app_users.id AND app_users.patient_id = silver_*.patient_id`.
- **Doctors & Clinical Staff**: Granted read and write access scoped to their assigned departments and patient appointments.
- **Service-Role Isolation**: Administrative write operations (e.g. system provisioning, conflict auditing) run exclusively through `supabaseAdmin` in `server.ts` utilizing the private `SUPABASE_SERVICE_ROLE_KEY`.

### 2. Views & Information Hiding
- **`public.silver_doctors_public`**: Secure view exposed to `anon` and `authenticated` roles for doctor lookup and booking wizards.
  - Column layout preserves existing application contracts (`doctor_id`, `doctor_name`, `specialty`, `qualification`, `experience_years`, `hospital_branch`, `consultation_fee`, `availability_schedule`, `rating`, `is_active`) while making new canonical fields (`department_id`, `department_name`, `city`, `phone_number`, `email`) accessible.
  - Filters out inactive practitioners (`WHERE is_active = true`).

### 3. Concurrency & Conflict Prevention
- **Trigger `trg_prevent_appointment_conflict`**: Database-level function preventing duplicate active appointment bookings for the same doctor at the same date and time slot.
- **Backend Timezone Validation**: Enforced in `src/server/bookingValidation.ts` using the hospital's local IANA timezone (`Asia/Kolkata`) to avoid UTC day-boundary drift.

---

## Environment Configuration

MediAI requires environment configuration for local development and production deployments. 

> **Security Rule**: Never commit secrets, service-role keys, or invitation codes to version control. Set these in your hosting environment or local `.env`.

### Variable Reference

| Variable Name | Required | Context | Description |
| :--- | :---: | :--- | :--- |
| `SUPABASE_URL` | **Yes** | Server & Client | HTTPS URL for the Supabase project REST & Auth endpoint. |
| `SUPABASE_ANON_KEY` | **Yes** | Server & Client | Public anonymous key for client-side queries and authentication. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Server Only | **Confidential.** High-privilege secret key for server-side provisioning and administrative operations in `server.ts`. |
| `DATABASE_URL` | Optional | Server Only | Direct/pooled PostgreSQL connection string for migrations or external ORM tools. |
| `HOSPITAL_INVITE_CODES` | Optional | Server Only | Comma-separated authorization tokens for clinical staff onboarding. |
| `ADMIN_INVITATION_CODES` | Optional | Server Only | Comma-separated authorization tokens for system administrator onboarding. |
| `HOSPITAL_TIMEZONE` | Optional | Server Only | Standard IANA timezone (e.g. `Asia/Kolkata`). Defaults to `America/Los_Angeles` if unset. |
| `GEMINI_API_KEY` | Optional | Server Only | API key for Google Gemini generative AI features. |
| `APP_URL` | Optional | Server Only | Application public origin for OAuth callbacks and links. |
| `PORT` | Optional | Server Only | Server listening port (default: `3000`). |

### Setting Up `.env`
Copy `.env.example` to create your local `.env` file:
```bash
cp .env.example .env
```
Populate `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` with credentials from your Supabase Project Settings.

---

## Local Development & Testing

### Prerequisites
- **Node.js**: v20+ or v22 LTS
- **Package Manager**: `npm` (v10+)
- **Supabase Account**: An active Supabase project with PostgreSQL 15+

### Installation & Startup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   The application will start on `http://localhost:3000` with hot-module reloading and integrated Express API middleware.

3. **Type Checking & Code Quality**:
   ```bash
   npm run lint
   ```
   Runs TypeScript compiler verification (`tsc --noEmit`) to confirm zero type errors.

4. **Automated Test Suites**:
   - **Booking & Scheduling Unit Tests** (17 tests):
     ```bash
     npm run test
     ```
     Runs the 17 automated unit and integration tests for appointment booking validation, timezone handling (`Asia/Kolkata`), slot conflict checks, and priority rules.
   - **Unified Auth & RBAC Verification Suite** (20 tests):
     ```bash
     node scripts/test_unified_auth_flow.js
     ```
     Verifies all 20 core authentication and security criteria: common login, default patient assignment, self-elevation prevention (403 Forbidden), admin role changes, clinical ID archiving, and Google SSO.
   - **Admin Governance & Database Sync Suite** (24 tests):
     ```bash
     node scripts/test_admin_role_change.js
     ```
     Tests administrative user directory querying, role elevation, Supabase `app_users` synchronization, and audit logging.

5. **Production Build**:
   ```bash
   npm run build
   ```
   Compiles the frontend bundle into `/dist` via Vite.

---

## Recent Pull Requests & Feature Changelog

Between October 24 and October 26, 2026, the MediAI platform underwent major architectural enhancements to deliver an end-to-end unified authentication experience, role-based access control, dedicated operational dashboards, and executive governance:

### PR #1 — Unified Authentication & Common Login Flow
- **Single Entry Point (`POST /api/auth/common-login`)**: Replaced fragmented, role-specific login cards with a single unified form accepting either a Patient ID (e.g. `P182162`, `P1001`) or official hospital email (`doctor@hospital.org`, `staff@hospital.org`, `admin@hospital.org`).
- **Dynamic Role Recognition**: Intelligent client/server regex detection routes users directly to their designated dashboard without requiring manual role selection.
- **Google SSO Integration (`POST /api/auth/google`)**: One-click Google authentication with default assignment to the `'patient'` role and automatic Patient ID provisioning.
- **Files Affected**: `/server.ts`, `/src/components/LoginScreen.tsx`, `/src/services/authService.ts`, `/src/types/auth.ts`.

### PR #2 — Public Registration Security Hardening
- **Strict Default Patient Enrollment (`POST /api/auth/common-register`)**: Completely eliminated public self-assignment of privileged roles (`doctor`, `staff`, `admin`).
- **Surface Area Reduction**: Removed `<RoleSelector />`, physician medical registration codes, staff badges, and admin invitation code inputs from the public signup flow.
- **Server-Side Enforcement**: Any attempts to inject elevated roles in the registration payload are authoritatively overridden to `'patient'`.
- **Files Affected**: `/src/components/SignupScreen.tsx`, `/server.ts`, `/src/services/authService.ts`.

### PR #3 — Specialized Operational Workspaces & Clinical Dashboards
- **Dedicated Role Dashboards**: Implemented rich, role-specific clinical workspaces:
  - **`DoctorDashboard.tsx` (`doctor-dashboard`)**: Today's consult schedule (8 visits), patient check-in statuses, inpatient ward rounds with acuity indicators, diagnostic lab sign-off queue, and modal authoring for clinical notes and e-prescriptions.
  - **`StaffDashboard.tsx` (`staff-dashboard`)**: Spatial bed matrix for Ward 4B (32 beds across West & North wings) with live status toggling (`Occupied`, `Available`, `Cleaning`, `Reserved`), oxygen mode tracking, emergency triage intake queue with ESI acuity sorting, and vitals recording modal.
  - **`AdminDashboard.tsx` (`admin-dashboard`)**: Executive hospital telemetry, departmental capacity breakdown, staff rosters, patient satisfaction feedback sentiment analysis, and the User Governance management console.
- **Files Affected**: `/src/components/DoctorDashboard.tsx`, `/src/components/StaffDashboard.tsx`, `/src/components/AdminDashboard.tsx`, `/src/App.tsx`.

### PR #4 — Administrative User Governance & Audit Ledger
- **Role Elevation Middleware (`requireAdminRole`)**: Guarded `/api/admin/users`, `/api/admin/users/update-role`, and `/api/admin/audit-logs` against non-administrative callers (returning HTTP 403 Forbidden).
- **Clinical ID Archiving**: When an administrator reassigns a doctor or staff member to a patient role, their operational IDs (`doctor_id`, `staff_id`) are preserved in `historical_identifiers` for longitudinal medical audit compliance while immediately terminating clinical dashboard access.
- **Dual-Layer Database Sync**: Role updates synchronously commit to the active memory registry and Supabase PostgreSQL `public.app_users` and `public.audit_logs`.
- **Files Affected**: `/server.ts`, `/src/services/adminService.ts`, `/src/components/AdminDashboard.tsx`.

### PR #5 — Automated Verification Suites & Dependency Optimization
- **End-to-End Verification Suites**: Created automated test scripts in `/scripts`:
  - `test_unified_auth_flow.js`: 20/20 automated checks validating registration, common login, unauthorized elevation blocking, admin role changes, clinical ID archiving, and Google SSO.
  - `test_admin_role_change.js` & `test_dynamic_auth_and_elevation.js`: 24/24 automated checks for administrative user governance and Supabase `app_users` synchronization.
- **Dependency Cleanups**: Pruned unused `mysql2` driver from `package.json` to reduce container footprint.
- **Files Affected**: `/scripts/test_unified_auth_flow.js`, `/scripts/test_admin_role_change.js`, `/scripts/test_dynamic_auth_and_elevation.js`, `/package.json`.

### PR #6 — End-to-End Live Supabase Database Integration & Elimination of Fabricated Data
- **Complete Elimination of Simulated / Hardcoded Data**: Audited all pages, services, and backend endpoints to remove static mock arrays, hardcoded patient counts, dummy rosters, and synthetic metrics.
- **Physician Workspace Database Connection (`/api/doctor/overview`)**:
  - Daily consultation schedule dynamically queries `silver_appointments` joined with `silver_patients(name)`.
  - Inpatient rounds dynamically load admitted patients and diagnoses from `silver_encounters` joined with `silver_patients(name, age)`.
  - Diagnostic lab review queue queries live records from `silver_lab_results`.
- **Clinical Encounter & E-Prescription Persistence (`/api/doctor/encounter`, `/api/doctor/sign-lab`)**:
  - Physician consultation notes authoring writes directly to `silver_encounters` and `silver_prescriptions` with automatic appointment status update to `'Completed'`.
  - Diagnostic review electronically signs lab records directly in `silver_lab_results`.
- **Staff Ward & Triage Operations Connection (`/api/staff/overview`, `/api/staff/log-vitals`)**:
  - Ward 4B spatial bed grid dynamically reflects real patient admissions from `silver_encounters`.
  - Emergency triage intake queue populated from recent hospital appointments and encounters.
  - Real-time vitals logging persists nursing observations directly to `silver_encounters`.
- **Executive Governance & Hospital Metrics (`/api/admin/overview`)**:
  - Real-time aggregation of active database records: **95,085+** patients in `silver_patients`, **1,380+** active physicians in `silver_doctors`, **8,796+** active clinical staff in `silver_staff`, and **158,398+** encounters in `silver_encounters`.
  - Patient satisfaction score and wait-time metrics computed directly from 127,828+ feedback records in `silver_feedback`.
  - Staff rosters dynamically constructed from active providers in `silver_doctors` and `silver_staff`.
- **Dynamic Booking Wizard Catalog (`/api/booking/specialties`, `/api/booking/doctors`)**:
  - Dynamically queries 43 distinct medical specialties directly from `silver_doctors`.
  - Enhances physician search to query across hospital branches with case-insensitive specialty matching.
- **Frontend Hardening & Empty States**:
  - Removed static numerical fallback values in `AdminDashboard.tsx`, ensuring all statistics render from verified database metrics.
  - Added clean empty-state banners to `DoctorDashboard.tsx` and `StaffDashboard.tsx` for optimal UX when queues are clear.
- **Files Affected**: `/server.ts`, `/src/components/AdminDashboard.tsx`, `/src/components/DoctorDashboard.tsx`, `/src/components/StaffDashboard.tsx`.

---

## Current Project Status — October 27, 2026

### 1. Architecture & Backend Implementation
- **Implemented Stack**: MediAI operates on a React 19 frontend SPA, full-stack Node.js/Express server in `server.ts` (with TSX runtime and Vite dev middleware), and Supabase PostgreSQL with Row Level Security (RLS).
- **Multi-Role Workspaces**: All four hospital roles (**Patient**, **Doctor**, **Clinical Staff**, **Administrator**) have dedicated, fully functional operational dashboards.
- **Live Database Integration**: All four operational workspaces are directly wired to live Supabase PostgreSQL tables; zero mock, simulated, or fabricated records are rendered.
- **Unified Authentication & Security**: Common login (`/api/auth/common-login`) auto-routes users by verified role; public registration (`/api/auth/common-register`) is hardened to default exclusively to the `'patient'` role; and administrative role governance (`/api/admin/users/update-role`) is secured with `requireAdminRole` and audit logging.
- **Identity Integrity**: The existing identity mapping through Supabase Auth (`auth.users`), `public.app_users`, and `public.silver_patients` remains strictly intact, including the active test patient `P1001` account.
- **Codebase Verification**: 
  - 17/17 booking validation tests pass (`npm run test`).
  - 20/20 automated end-to-end unified auth and RBAC verification tests pass (`node scripts/test_unified_auth_flow.js`).
  - 24/24 admin role governance and database synchronization tests pass (`node scripts/test_admin_role_change.js`).
  - Static type-checking passes cleanly with zero errors (`npm run lint`).
  - Applet compilation and production build succeed cleanly with zero errors (`compile_applet` / `npm run build`).
  - Application endpoints support both canonical field names and backward-compatible aliases.

### 2. Active Canonical Silver Database Counts
The Supabase PostgreSQL canonical Silver tables are actively connected to the application:

| Canonical Table | Verified Live Rows | Role in Production Workspaces |
| :--- | :---: | :--- |
| `silver_patients` | **95,085+** | Patient Portal identity mapping, patient demographics, EMR access. |
| `silver_doctors` | **1,383+** | Booking Wizard catalog, physician profiles, specialty directory (43 specialties). |
| `silver_staff` | **8,796+** | Inpatient ward operations, nurse lead shifts, clinical roster management. |
| `silver_appointments` | **634+** | Physician consult agenda, check-in tracking, patient booking calendar. |
| `silver_encounters` | **158,398+** | Inpatient bed assignments, clinical notes, discharge summaries, vitals triage logs. |
| `silver_prescriptions` | **279,790+** | Electronic medication orders, dosage tracking, prescription renewals. |
| `silver_lab_results` | **326,714+** | Diagnostic investigation queue, abnormal flags, electronic physician sign-off. |
| `silver_feedback` | **127,828+** | Patient satisfaction telemetry, wait-time analytics, verified comments. |
| `silver_staff_assignment` | **Schema Defined** | Exact 14-column clinical staff assignment ledger. |
| `app_users` | **Active** | 1:1 mapped identity store with Supabase Auth (`auth.users`), RBAC roles, audit logs. |

### 3. Silver Data Staging
The nine source MySQL `hospital_db` Silver tables remain safely stored in `public.medi_ai_migration_staging` in Supabase:

| Staged Silver Table | Verified Staged Rows | Status |
| :--- | :---: | :--- |
| `silver_patients` | **95,067** | Transferred & Verified |
| `silver_doctors` | **1,375** | Transferred & Verified |
| `silver_encounters` | **250,493** | Transferred & Verified |
| `silver_feedback` | **200,595** | Transferred & Verified |
| `silver_lab_results` | **350,592** | Transferred & Verified |
| `silver_prescriptions` | **300,584** | Transferred & Verified |
| `silver_staff` | **10,295** | Transferred & Verified |
| `silver_staff_assignment` | **400,790** | Transferred & Verified |
| `silver_appointments` | **253,200** | Transferred & Verified |
| **Total Staged Records** | **1,862,991** | **Complete Staging Transfer** |

### 4. Staging Validation
- **Row Count Parity**: All nine tables have staged row counts matching the expected source counts from the local MySQL `hospital_db`.
- **Primary Staging Key Uniqueness**: The verification check for duplicate `(source_table, source_row_number)` pairs returned **zero duplicates** across all nine tables.
- **Metadata & Payload Integrity**: Staging metadata inspection confirmed:
  - **Zero null** `raw_record` values across all tables.
  - **Zero non-object** `raw_record` structures across all tables.
  - **Zero missing** `imported_at` timestamps across all tables.
- **Validation Boundary**: These structural and metadata checks confirm staging volume and payload integrity; they do not by themselves prove that every source row matches its staged contents at the individual field level.

### 5. Content Reconciliation — NOT COMPLETE
- **Reconciliation Engine**: Full-row source-to-staging content reconciliation is actively being performed via Jupyter Notebook.
- **Reconciliation Progress as of October 27, 2026**:
  - `silver_patients`: **MATCH** (95,067 source rows; zero missing occurrences, zero extra staged occurrences).
  - `silver_doctors`: **MATCH** (1,375 source rows; zero missing occurrences, zero extra staged occurrences).
  - `silver_encounters`: Reconciliation commenced and in progress.
  - Remaining tables (`silver_feedback`, `silver_lab_results`, `silver_prescriptions`, `silver_staff`, `silver_staff_assignment`, `silver_appointments`): Content reconciliation is **not yet confirmed complete**.
- **Network Resilience**: Checkpointed recovery handles any intermittent database connection drops during batch verification. All 1,862,991 staged rows remain safely stored.

### 6. Canonical Migration — NOT YET PERFORMED
- **No Canonical Loading**: No canonical Silver table loading has been performed as part of this staging transfer.
- **Migration Status**: Canonical migration is **NOT complete**. Staged migration files (`supabase/migrations/20261023000000_canonical_silver_schema_alignment.sql` and its rollback script `20261023000001_canonical_silver_schema_alignment_rollback.sql`) remain staged and unexecuted.
- **Prerequisites Prior to Loading**:
  - Complete full source-to-staging content reconciliation for all 9 tables.
  - Validate canonical target data types, constraints, and required fields against staged raw payloads.
  - Review logical duplicate IDs, date formats, and foreign-key orphans.
  - Prepare and approve a controlled, auditable migration execution plan.
- **Safety Commitments**:
  - Existing canonical tables, `public.app_users` identity mappings, and patient `P1001` account are strictly preserved.
  - Staging data in `public.medi_ai_migration_staging` will **not** be deleted or truncated.
  - Zero synthetic data fabrication: no records will be invented, and no source rows will be silently dropped.

### 7. Next Steps
1. **Resume Jupyter Reconciliation**: Complete content reconciliation for `silver_encounters` and proceed through the remaining 6 tables from the current checkpoint.
2. **Confirm Content Parity**: Validate complete row equality and verify duplicate occurrence counts across all nine datasets.
3. **Schema Compatibility Audit**: Validate target data types, type conversions, nullability, logical duplicate IDs, and foreign-key relationships.
4. **Controlled Loading Plan Review**: Formulate, review, and approve the canonical loading procedure prior to executing any DDL/DML against the destination canonical tables.
5. **Documentation Updates**: Update the project status in this README once reconciliation and migration steps are actually completed.

---

## Deployment & GitHub Publishing

### Publishing to GitHub
1. Initialize git (if not already initialized):
   ```bash
   git init
   git add .
   git commit -m "feat: complete MediAI platform with canonical Silver schema alignment"
   ```
2. Link your remote repository and push:
   ```bash
   git remote add origin https://github.com/[your-organization]/[your-repo].git
   git branch -M main
   git push -u origin main
   ```

### Production Deployment
- **Container / Cloud Run / Node Host**:
  - Start command: `npm run start` (or `tsx server.ts`).
  - Set `NODE_ENV=production`.
  - Ensure all environment variables listed in [Environment Configuration](#environment-configuration) are injected via the hosting provider's secure secret manager.
- **Supabase Migration Execution**:
  - Run `supabase/migrations/20261023000000_canonical_silver_schema_alignment.sql` using the Supabase CLI (`supabase db push`) or through the Supabase Dashboard SQL Editor during an authorized maintenance window.

---

## License & Compliance Notice

This software is designed for healthcare administrative demonstration and clinical operational workflows. Ensure strict compliance with **HIPAA**, **HITECH**, **GDPR**, or relevant regional medical data privacy legislation before deploying to clinical production environments with real Patient Health Information (PHI).
