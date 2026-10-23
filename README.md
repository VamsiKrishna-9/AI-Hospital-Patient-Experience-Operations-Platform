# MediAI — Hospital Patient Experience & Operations Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38bdf8.svg)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_%26_Auth-3ecf8e.svg)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Tests-17_Passing-success.svg)](https://nodejs.org/api/test.html)

**MediAI** is an intelligent, full-stack hospital patient experience and clinical operations platform. It unifies patient access, appointment scheduling, electronic health records (EHR), clinical workflows, staff operational management, and hospital telemetry into a single, cohesive system.

Built on modern cloud standards and the Medallion Data Architecture, MediAI bridges legacy hospital databases with modern web-based clinical interfaces, robust PostgreSQL Row Level Security (RLS), and real-time scheduling controls.

---

## Table of Contents

- [Key Objectives](#key-objectives)
- [System Architecture](#system-architecture)
- [User Roles & Implemented Features](#user-roles--implemented-features)
- [Medallion Architecture & Canonical Silver Schema](#medallion-architecture--canonical-silver-schema)
- [Supabase Database & Security Model](#supabase-database--security-model)
- [Environment Configuration](#environment-configuration)
- [Local Development & Testing](#local-development--testing)
- [Current Implementation Status & Migration Roadmap](#current-implementation-status--migration-roadmap)
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

The application supports four distinct user roles defined in `src/types/auth.ts`:

### 1. Patient (`patient`)
- **Interactive Patient Portal**: Real-time overview of current care journey, upcoming consultations, and clinical records.
- **Appointment Booking Wizard**: Multi-step booking engine with doctor specialty filters, clinic slot selection (09:00–16:30 standard clinic slots), channel selection (`Online`, `In-Person`, `Emergency`), and priority designation (`Low`, `Medium`, `High`, `Urgent`).
- **Electronic Medical Records**:
  - **Clinical Encounters**: Detailed records of diagnoses, symptoms, vitals, and treatment plans.
  - **Prescription Tracker**: Active and past medications, dosages, frequencies, routes, refills, and prescribed duration.
  - **Diagnostic Lab Telemetry**: Laboratory reports, reference range flags (`Normal`, `Abnormal`, `Critical`), and status tracking.
- **Patient Experience Feedback**: 6 distinct evaluation dimensions (1–5 scale):
  - Overall Rating
  - Doctor Rating
  - Staff Rating
  - Wait Time Rating
  - Cleanliness Rating
  - Recommendation Likelihood (`likely_to_recommend`)
  - Qualitative comments and sentiment categorization (`Positive`, `Neutral`, `Negative`).

### 2. Doctor / Physician (`doctor`)
- **Clinical Roster**: Scheduled appointments, patient queue monitoring, and consultation time tracking.
- **Patient Encounters**: Direct access to patient medical histories and encounter documentation.
- **Public Directory**: Managed doctor profile published via `public.silver_doctors_public`.

### 3. Clinical Staff & Nursing (`staff`)
- **Operations & Shift Ledger**: Department assignment, ward identification, shift types (`Morning`, `Afternoon`, `Night`, `Rotational`), and working schedules.
- **Patient Reception & Coordination**: Queue management and intake status confirmation.

### 4. Hospital Administrator (`admin`)
- **Executive Operations Dashboard**: Cross-departmental utilization, scheduling volume, wait time analytics, and hospital-wide satisfaction scores.
- **Account Provisioning**: Secure onboarding of clinical staff and physicians via cryptographic invitation codes.

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

4. **Automated Test Suite**:
   ```bash
   npm run test
   ```
   Runs the 17 automated unit and integration tests for appointment booking validation, timezone handling, slot conflict checks, and priority rules.

5. **Production Build**:
   ```bash
   npm run build
   ```
   Compiles the frontend bundle into `/dist` via Vite.

---

## Current Implementation Status & Migration Roadmap

### Current Codebase Status
- **Application Code & Backend**: Fully implemented, compiled, and aligned with canonical Silver entities. All application endpoints and types in `src/types/patient.ts` support both canonical column names and backward-compatible aliases.
- **Test Patient Identity**: Active patient `P1001` exists in the database with verified credentials, matching `auth.users` and `public.app_users`.
- **Read-Only MySQL Inventory Script**: `mysql_hospital_db_read_only_inventory.sql` is prepared and verified for running in MySQL Workbench against local source databases without modifying records.
- **Automated Validation**: 17/17 test cases passing for scheduling constraints, slot boundaries, and hospital timezone conversions.

### Pending Database Migration (Phase 2)
The canonical Silver alignment migration script has been authored, audited, and staged, but **has NOT yet been executed against the database**:

- **Staged Migration File**: `supabase/migrations/20261023000000_canonical_silver_schema_alignment.sql`
- **Rollback Script**: `supabase/migrations/20261023000001_canonical_silver_schema_alignment_rollback.sql`
- **Scope of Staged Migration**:
  - Adds missing canonical source columns to Supabase tables.
  - Fixes column order and definitions on `silver_doctors_public`.
  - Ensures `silver_encounters.appointment_id` is nullable (since MySQL source encounters do not link directly to appointment IDs).
  - Maintains strict non-destructive safety (zero destructive column drops, zero synthetic historical defaults).
- **Pending Historical Data Import**:
  - Direct ETL bulk import of historical records from MySQL `hospital_db` to Supabase `silver_*` tables remains to be performed following user authorization of the migration script.

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
