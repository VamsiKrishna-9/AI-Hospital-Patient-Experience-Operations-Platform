# MediAI — Hospital Patient Experience & Operations Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38bdf8.svg)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_%26_Auth-3ecf8e.svg)](https://supabase.com/)
[![Google Gen AI](https://img.shields.io/badge/Gemini-3.8_Flash-orange.svg)](https://ai.google.dev/)
[![Tests](https://img.shields.io/badge/Tests-40_Passing_(100%25)-success.svg)](https://nodejs.org/api/test.html)

**MediAI** is an intelligent, full-stack hospital patient experience and clinical operations platform. It unifies patient access, appointment scheduling, electronic health records (EHR), clinical workflows, staff operational management, and hospital telemetry into a single, cohesive system.

Built on modern cloud standards and the Medallion Data Architecture, MediAI bridges legacy hospital databases with modern web-based clinical interfaces, robust PostgreSQL Row Level Security (RLS), real-time scheduling controls, and an intelligent **AI Hospital Assistant** grounded in verified clinical knowledge and emergency safety guardrails.

---

## Table of Contents

- [Key Objectives](#key-objectives)
- [System Architecture](#system-architecture)
- [User Roles & Implemented Features](#user-roles--implemented-features)
- [Date-Filtered Admin Dashboard (Phase 1)](#date-filtered-admin-dashboard-phase-1)
- [AI Hospital Assistant & Clinical Safety Architecture](#ai-hospital-assistant--clinical-safety-architecture)
- [Unified Authentication & Security Architecture](#unified-authentication--security-architecture)
- [Medallion Architecture & Canonical Silver Schema](#medallion-architecture--canonical-silver-schema)
- [Supabase Database & Security Model](#supabase-database--security-model)
- [Environment Configuration](#environment-configuration)
- [Local Development & Testing](#local-development--testing)
- [Recent Pull Requests & Feature Changelog](#recent-pull-requests--feature-changelog)
- [Current Project Status — October 29, 2026](#current-project-status--october-29-2026)
- [Deployment & GitHub Publishing](#deployment--github-publishing)
- [License & Compliance Notice](#license--compliance-notice)

---

## Key Objectives

1. **Patient Empowerment**: Seamless self-service booking, consultation history, lab telemetry review, prescription tracking, multi-dimensional feedback submission, and 24/7 intelligent patient guidance through the AI Hospital Assistant.
2. **Clinical Operational Integrity**: Conflict-free scheduling with database-enforced exclusion constraints, clinical shift management, and strict separation of patient clinical narratives across dedicated role workspaces.
3. **Medical Safety & Emergency Escalation**: Automated detection of acute clinical symptoms (chest pain, stroke, severe trauma) with immediate escalation directives to 911 / Emergency Services.
4. **Enterprise Security & Governance**: Strict multi-tenant role-based access control (RBAC), Supabase Auth with custom service-role isolation, generated clinical IDs (`P######`, `D######`, `S######`), and PostgreSQL Row-Level Security (RLS) guaranteeing that patients and providers only access authorized records.
5. **Data Continuity & Schema Parity**: Clean, bidirectional alignment between canonical MySQL enterprise warehouse datasets (`hospital_db`) and Supabase PostgreSQL.

---

## System Architecture

MediAI is engineered as a unified full-stack application using Vite and Express:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    Client Interface                                     │
│   React 19 SPA • Tailwind CSS v4 • Lucide React • Motion                               │
│   - Patient, Doctor, Staff & Admin Operational Workspaces                               │
│   - AI Hospital Assistant Launcher (FAB) & Dedicated Chat Window                        │
│   - Custom Brand SVG: AiHospitalAssistantLogo                                          │
└────────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │ HTTP / JSON (Port 3000)
┌────────────────────────────────────────────▼────────────────────────────────────────────┐
│                              Backend API Server (`server.ts`)                            │
│  Express 4.21 • TSX Runtime • Vite Dev Middleware                                       │
│  - Strict IANA Hospital Timezone Validation (`Asia/Kolkata`)                             │
│  - Conflict Prevention & Slot Boundary Checks                                           │
│  - Concurrency-Safe Atomic Hospital ID Allocator (`P`, `D`, `S` prefixes)               │
│  - AI Hospital Assistant Chat Engine (`POST /api/ai/chat`)                              │
│    ├─ Primary: Google Gen AI SDK (`gemini-3.8-flash`)                                   │
│    └─ Resilient Grounded Fallback: 10 Specialties, 4 Branches, Visiting Hours           │
│  - Emergency Safety Detection (Acute Symptom Advisory)                                  │
│  - User Preferences API (`GET/POST /api/user/preferences`)                              │
│  - Supabase Service-Role Admin & Auth Broker                                            │
└──────────────────────────────┬──────────────────────────────────────────┬───────────────┘
                               │                                          │
                   Admin/Service-Role Client                       Public Anon Client
                               │                                          │
┌──────────────────────────────▼──────────────────────────────────────────▼───────────────┐
│                                Supabase Managed Cloud                                   │
│  ┌─────────────────────────┐                 ┌───────────────────────────────────────┐  │
│  │      Supabase Auth      │                 │          PostgreSQL Database          │  │
│  │   `auth.users` Store    │◄───────────────►│  Row-Level Security (RLS)             │  │
│  └─────────────────────────┘                 │  PL/pgSQL Triggers & Sequences        │  │
│                                              │  Canonical Silver Tables (10 Entities)│  │
│                                              │  `app_users.preferences` JSONB Column │  │
│                                              └───────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 19.0, TypeScript 7.0 |
| **Build & Tooling** | Vite 8.3, TSX (TypeScript Execute) |
| **Styling & Motion** | Tailwind CSS v4.0, Motion (Framer Motion engine) |
| **Iconography & Visuals** | Lucide React, Custom Medical Robot SVG Vector Logo |
| **Backend API** | Node.js (v22 LTS), Express 4.21 |
| **Database & Identity** | Supabase PostgreSQL 15+, Supabase Auth (`@supabase/supabase-js` v2.118) |
| **AI Integration** | Google Gen AI SDK (`@google/genai` v2.4.0) with Gemini 3.8 Flash model |
| **Testing** | Node.js Native Test Runner (`tsx --test`) |

---

## User Roles & Implemented Features

MediAI provides specialized operational workspaces for four distinct hospital roles with strict role isolation (no cross-acting or confusing role-switching):

### 1. Patient (`patient`) — `PatientDashboard.tsx`
- **Interactive Patient Portal**: Real-time overview of current care journey, upcoming consultations, care team, and clinical records.
- **AI Hospital Assistant Integration**: 24/7 floating assistant with one-click quick actions to book appointments, inspect labs, check visiting hours, or view prescriptions. Users can also configure or remove the assistant non-destructively.
- **Appointment Booking Wizard**: Multi-step booking engine with doctor specialty filters, clinic slot selection (08:00–18:00 standard clinic slots), channel selection (`Online`, `In-Person`, `Emergency`), and priority designation (`Low`, `Medium`, `High`, `Urgent`).
- **Electronic Medical Records (EMR)**:
  - **Clinical Encounters**: Comprehensive records of diagnoses, symptoms, vitals, and treatment plans.
  - **Prescription Tracker**: Active and past medications, dosages, frequencies, routes, refills, and prescribed duration.
  - **Diagnostic Lab Telemetry**: Laboratory reports, reference range flags (`Normal`, `Abnormal`, `Critical`), and status tracking.
- **Patient Experience Feedback**: 6 distinct evaluation dimensions (1–5 scale):
  - Overall Rating, Doctor Rating, Staff Rating, Wait Time Rating, Cleanliness Rating, Recommendation Likelihood (`likely_to_recommend`).
  - Qualitative comments and automated sentiment categorization (`Positive`, `Neutral`, `Negative`).

### 2. Doctor / Physician (`doctor`) — `DoctorDashboard.tsx`
- **Clinical Consult Agenda**: Daily consultation schedule, patient arrival status, consult room assignment, and chief complaints.
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

## Date-Filtered Admin Dashboard (Phase 1)

Integrating functionality inspired by the hospital system's Power BI Admin Dashboard, MediAI provides a unified, date-filtered operational command center directly in `AdminDashboard.tsx` adhering to MediAI's signature dark navy background, teal/cyan accents, and responsive layout:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MediAI Date-Filtered Admin Command Center                       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  [Date Picker: 2026-09-29]  [Today]  [Latest Ops: 2026-09-30]  [< Day >]  [Refresh ⟳]   │
│  Hospital Timezone: Asia/Kolkata (IST)                                                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐ │
│  │  Patient Visits  │  │  Doctors on Duty │  │   Staff Present  │  │Total Appts (49) │ │
│  │        43        │  │       120        │  │       104        │  │   49 Bookings   │ │
│  │ silver_encounters│  │appts & assignments│  │silver_staff_asgn │  │silver_appoint   │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  └─────────────────┘ │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │   Appointments by Department (Bar Chart)│  │ Appointment Status Distribution      │ │
│  │   - Child Specialist: 5 appts (10.2%)   │  │ [======== Completed: 67.3% (33)    ]│ │
│  │   - Internal Medicine: 5 appts (10.2%)  │  │ [===      Scheduled: 14.3% (7)     ]│ │
│  │   - Orthopedic Surgery: 4 appts (8.2%)  │  │ [==       Cancelled: 10.2% (5)     ]│ │
│  │   - Emergency Medicine: 4 appts (8.2%)  │  │ [==       No Show:    8.2% (4)     ]│ │
│  └─────────────────────────────────────────┘  └──────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│  │               7-Day Patient Visits & Appointments Comparative Trend               │ │
│  │      [Visits: 43 | Appts: 49] on Selected Date • Click column to switch date      │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1. Key Metrics & Data Sources

| Dashboard Metric | Data Source (Canonical Silver Table) | Calculation Methodology |
| :--- | :--- | :--- |
| **Patient Visits** | `silver_encounters` | Exact count of clinical encounters matching `encounter_date = selectedDate`. |
| **Total Appointments** | `silver_appointments` | Exact count of patient bookings matching `appointment_date = selectedDate`. |
| **Appointment Status Distribution** | `silver_appointments` | Grouped breakdown by `status` (`Completed`, `Scheduled`, `Cancelled`, `No Show`, `Confirmed`) with percentages. |
| **Appointments by Department** | `silver_appointments` ⋈ `silver_doctors` | Joins appointments with physician specialties (`specialty`) on `doctor_id` for `selectedDate`, ordered descending. |
| **Staff Present** | `silver_staff_assignment` | Distinct active `staff_id` with non-cancelled shift assignments on `assignment_date = selectedDate`. |
| **Doctors on Duty** | `silver_appointments` ∪ `silver_staff_assignment` | Union of distinct `doctor_id` with active consultations or duty assignments on `selectedDate`. |
| **7-Day Volume Trend** | `silver_encounters` & `silver_appointments` | Comparative daily counts across the 7 days ending on `selectedDate`. |

### 2. Timezone & Boundary Guarantees
- **Strict Hospital Timezone**: All date boundaries default to and respect `Asia/Kolkata` (IST) using IANA resolution (`getHospitalLocalDateTime('Asia/Kolkata')`).
- **No UTC Shift Errors**: Date arithmetic computes boundaries explicitly without local host machine drift.
- **Empty State & Zero Handling**: Unrecorded dates (e.g. future dates or dates with no visits) cleanly display 0 values and offer 1-click navigation to the latest operational date (`2026-09-30`).

### 3. Backend Endpoints & Role Authorization
- `GET /api/admin/dashboard-stats?date=YYYY-MM-DD`: Protected endpoint requiring verified `admin` role via `authenticateToken` and `requireAdminRole`. Returns compact aggregated datasets in < 2 seconds.
- `GET /api/admin/daily-analytics`: Alias route forwarding directly to `/api/admin/dashboard-stats`.

---

## AI Hospital Assistant & Clinical Safety Architecture

The **MediAI AI Hospital Assistant** is a 24/7 intelligent patient companion engineered to enhance patient navigation, improve access to hospital services, and enforce strict clinical safety boundaries.

### 1. Grounded Hospital Knowledge Directory
The assistant is deeply grounded in verified MediAI hospital operations:
- **10 Accredited Specialties**: Cardiology & Vascular Medicine, Neurology & Neurosciences, General Internal Medicine, Emergency Medicine & Trauma, Pediatrics & Neonatology, Oncology & Hematology, Orthopedic Surgery, Obstetrics & Gynecology, Radiology & Diagnostic Imaging, Pulmonology & Critical Care.
- **4 Hospital Campuses & Facilities**:
  - `BR-MAIN`: MediAI Medical Center — Main Campus (400 Medical Center Way; 24/7 Emergency & Inpatient).
  - `BR-WEST`: MediAI West Ambulatory & Imaging Pavilion (1850 Valley View Boulevard).
  - `BR-CARD`: MediAI Heart & Vascular Specialty Institute (920 Cardio Boulevard).
  - `BR-NEURO`: MediAI Neurosciences & Pediatric Specialty Care (310 Pediatric Way).
- **Verified Inpatient Visiting Hours**:
  - General Wards (2A–5C): 10:00 AM – 8:00 PM daily (maximum 2 visitors per bedside).
  - Intensive Care Units (ICU & CICU): 12:00 PM – 2:00 PM and 5:00 PM – 7:00 PM (immediate family only).
  - Pediatric Care Pavilion: 24/7 bedside access for parents and legal guardians.
  - Emergency Department: Open 24/7/365 at Main Campus.

### 2. Clinical Emergency Safety Guardrails
The assistant incorporates medical safety detection that inspects all user prompts for acute, life-threatening symptoms:
- **Emergency Keywords**: Chest pain, shortness of breath, cannot breathe, stroke, numbness, heart attack, dying, severe trauma, active bleeding.
- **Immediate Escalation Protocol**: The assistant immediately surfaces a high-priority advisory directing the patient to call **911** or proceed directly to the **MediAI 24/7 Emergency Department** (+1 (555) 234-8099).
- **Zero Diagnosis Rule**: The assistant strictly avoids medical diagnoses, prescribing medications, or altering physician-directed treatment plans.

### 3. Authenticated Schedule Isolation & Patient Privacy
When an authenticated patient interacts with the assistant:
- The backend resolves the user's verified identity from their `Bearer` authentication token.
- Only the authenticated patient's active consultations are retrieved from `silver_appointments`.
- Cross-patient schedule leakage is strictly prevented through authenticated session boundaries and RLS policies.

### 4. Dual-Engine Architecture (Gemini 3.8 Flash + Resilient Directory Fallback)
- **Primary Engine**: Generates contextual, compassionate responses using `@google/genai` with model `gemini-3.8-flash`. System instructions ground the model in verified hospital data, schedule parameters, and safety directives.
- **Resilient Fallback Engine**: If the external API experiences latency, quota exhaustion, or is offline, the backend seamlessly falls back to a deterministic, rule-grounded hospital reply engine without interrupting the user experience.

### 5. Non-Destructive User Preferences & Removal
- **Customizable Experience**: Patients can dismiss, toggle, or permanently remove the AI Hospital Assistant launcher via the user interface.
- **Database Persistence**: User preferences are persisted in `public.app_users.preferences` JSONB via `/api/user/preferences`.
- **Absolute Clinical Isolation**: Removing or disabling the chatbot changes **only** the `preferences.chatbot_enabled` flag. Patient medical records, clinical encounters, lab results, prescriptions, and appointment schedules remain completely untouched.

### 6. Component Architecture & Endpoints

| Component / File | Purpose |
| :--- | :--- |
| `AiHospitalAssistantLauncher.tsx` | Floating action button (FAB) with pulse indicator, tooltip, badge, and dismiss actions. |
| `AiHospitalAssistantLogo.tsx` | Custom SVG vector logo combining medical cross, healthcare robotic visor, and speech bubble. |
| `AiHospitalAssistant.tsx` | Slide-out chat panel featuring message history, clear chat, dynamic quick action chips, and preference toggles. |
| `aiChatService.ts` | Client-side service managing chat requests (`/api/ai/chat`), local session storage, and preference syncing. |
| `20261028000000_add_user_preferences_chatbot.sql` | Supabase migration adding `preferences JSONB` to `public.app_users` with GIN indexing. |
| `tests/aiChatbot.test.ts` | Automated test suite validating input sanitization, emergency directives, directory grounding, and preference isolation. |

---

## Unified Authentication & Security Architecture

MediAI implements a hardened, unified authentication system designed specifically for healthcare environments:

### 1. Unified Common Login (`POST /api/auth/common-login`)
- **Common Credential Entry**: A single login interface where users log in with their **Email Address or ID**:
  - Patients can use their Patient ID (e.g. `P1001`, `P182162`) or registered email.
  - Physicians can use their Doctor ID (e.g. `D100001`, `DOC-7721`) or hospital email.
  - Clinical staff can use their Staff ID (e.g. `S100001`, `STF-4401`) or hospital email.
  - Administrators use their administrative email.
- **Automatic Identity Recognition**: Server-side and client-side regex detection (`/^P\d+$/i`, `/^D\d+$/i`, `/^S\d+$/i`) automatically identifies the user type and routes them to their authorized dashboard (`patient-dashboard`, `doctor-dashboard`, `staff-dashboard`, `admin-dashboard`).

### 2. Streamlined Role-Based Signup (`POST /api/auth/common-register`)
- **Account Type Selector**: The public registration interface allows users to select from:
  1. **Patient**
  2. **Doctor**
  3. **Staff**
- **Public Admin Removal**: The `admin` role has been completely removed from public signup to prevent self-elevation exploits. Administrative accounts can only be provisioned by existing administrators through internal governance workflows.
- **Field Streamlining**:
  - **Doctor Signup**: Removed the `Medical Registration Number` field. Retains full name, email, phone, date of birth, specialization, qualifications, department, experience, and password.
  - **Staff Signup**: Removed the `Staff ID` field. Retains full name, email, phone, date of birth, department, designation, experience, and password.
  - **Patient Signup**: Full name, email, phone, date of birth, password, and privacy consent.

### 3. Concurrency-Safe Atomic Hospital ID Allocator (`HospitalIdAllocator`)
- Unique, permanent IDs are generated for new hospital users:
  - **`P` Prefix for Patients** (e.g. `P100001`)
  - **`D` Prefix for Doctors** (e.g. `D100001`)
  - **`S` Prefix for Clinical Staff** (e.g. `S100001`)
- Allocations use a concurrency-safe queue with collision detection against existing records and database sequences, preventing duplicate IDs.

### 4. Executive Role Governance & Clinical ID Retention (`POST /api/admin/users/update-role`)
- **Strict Administrator Guard (`requireAdminRole`)**: Guarded against unauthorized callers (returning HTTP `403 Forbidden`).
- **Clinical Identifier Preservation**: When an administrator reassigns a doctor or staff member to a patient role, their clinical identifiers (`doctor_id`, `staff_id`) are preserved in `historical_identifiers` for longitudinal medical audit compliance while immediately revoking privileged dashboard access.
- **Dual-Layer Synchronization**: Updates synchronously commit to both the active application registry and Supabase PostgreSQL `public.app_users` and `public.audit_logs`.

### 5. Account-to-Employee Mapping & Shift Governance (`GET /api/admin/users`)
- **Verified Primary Key Relationships**: Links platform user accounts (`app_users`) to physical employee tables using canonical foreign keys rather than heuristic name matching:
  - Doctor accounts: `app_users.doctor_id` ➔ `silver_doctors.doctor_id` (Primary Key).
  - Staff accounts: `app_users.staff_id` ➔ `silver_staff.staff_id` (Primary Key).
  - Patient accounts: `app_users.patient_id` ➔ `silver_patients.patient_id`.
  - Supabase Auth: `app_users.id` ➔ `auth.users.id` (UUID).
- **Verified Mapping States**:
  - `Linked`: Account is confirmed and bound to an existing row in `silver_doctors` or `silver_staff`.
  - `Unlinked`: Registered doctor/staff account lacks an assigned employee ID in their profile.
  - `Needs Review`: Account has an assigned ID, but no matching record exists in the silver database table.
  - `Administrator`: Privileged executive governance accounts with full platform management rights.
  - `Patient`: Outpatient and inpatient consumer accounts.
- **Shared Date Synchronization (`Asia/Kolkata`)**: Roster schedules and shift activities dynamically synchronize with the Admin Operations & Clinical Performance selected date without requiring re-authentication or page reloads.
- **Multi-Assignment Preservation Without Row Duplication**: When an employee has multiple clinical assignments or booked consultations on the selected date (`silver_staff_assignment`, `silver_appointments`), they are displayed in a clean multi-assignment badge stack within their unified profile rather than duplicating the employee record.
- **Department & Shift Filtering**:
  - Filter and group workforce by verified department (`silver_doctors.specialty` and `silver_staff.department`).
  - Filter by clinical shift window (`Morning`, `Evening`, `Night`, `Rotational`, `Off Duty`).
  - Search by Name, Email, Employee ID, or account UUID.
- **Scheduled vs. Physical Attendance Distinction**: Explicitly identifies operational status as `Scheduled`, `In Progress`, `Completed`, or `Off Duty` based on assignment and consultation status without falsely claiming biometric badge-in attendance.

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
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
 ┌──────▼──────────┐  ┌────────▼────────┐   ┌─────────▼────────┐
 │ silver_patients │  │ silver_doctors  │   │   silver_staff   │
 └──────┬──────────┘  └────────┬────────┘   └─────────┬────────┘
        │                      │                      │
        ├──────────────────────┼──────────────────────┘
        │                      │
 ┌──────▼──────────────┐       │
 │ silver_appointments │       │
 └──────┬──────────────┘       │
        │                      │
        ├──────────────────────┤
        │                      │
 ┌──────▼───────────┐ ┌────────▼──────────┐ ┌──────────────────┐
 │ silver_encounters│ │  silver_feedback  │ │silver_staff_     │
 └──────┬───────────┘ └───────────────────┘ │assignment        │
        │                                   └──────────────────┘
        ├──────────────────────┐
        │                      │
 ┌──────▼──────────────┐┌──────▼───────────┐
 │silver_prescriptions ││silver_lab_results│
 └─────────────────────┘└──────────────────┘
```

### Table Specifications

| # | Entity | Primary Key | Description & Canonical Fields |
| :--- | :--- | :--- | :--- |
| **1** | `public.app_users` | `id` (UUID) | 1:1 linkage to `auth.users(id)`. Attributes: `patient_id`, `role`, `preferences` (JSONB), `must_change_password`, `is_active`. |
| **2** | `silver_patients` | `patient_id` (TEXT) | `name`, `date_of_birth`, `age`, `gender`, `city`, `state`, `socioeconomic_status`, `occupation`, `registration_date`, `phone_number`, `email`. |
| **3** | `silver_doctors` | `doctor_id` (TEXT) | `doctor_name`, `department_id`, `department_name`, `specialization`, `qualification`, `experience_years`, `city`, `employment_type`, `availability`, `joining_date`, `phone_number`, `email`, `is_active`. |
| **4** | `silver_staff` | `staff_id` (TEXT) | `staff_name`, `staff_type`, `role`, `department_name`, `ward_id`, `shift_type`, `shift_start`, `shift_end`, `employment_type`, `experience_years`, `status`, `joining_date`, `is_active`. |
| **5** | `silver_appointments` | `appointment_id` (TEXT) | `patient_id`, `doctor_id`, `appointment_date`, `appointment_time`, `appointment_type`, `department_name`, `booking_channel`, `priority`, `status`, `wait_time_minutes`, `consultation_duration_minutes`. |
| **6** | `silver_encounters` | `encounter_id` (TEXT) | `patient_id`, `doctor_id`, `department_id`, `department_name`, `encounter_type`, `encounter_date`, `admission_date`, `discharge_date`, `diagnosis_code`, `diagnosis_description`, `treatment_type`, `treatment_outcome`, `follow_up_date`, `notes`, `appointment_id` (optional). |
| **7** | `silver_prescriptions` | `prescription_id` (TEXT) | `encounter_id`, `patient_id`, `doctor_id`, `medication_name`, `dosage`, `frequency`, `duration_days`, `route`, `refill_allowed`, `prescription_date`, `prescription_status`, `start_date`, `end_date`, `instructions`. |
| **8** | `silver_lab_results` | `lab_result_id` (TEXT) | `encounter_id`, `patient_id`, `test_type`, `test_name`, `result_value`, `reference_range`, `test_status`, `test_ordered_date`, `result_date`, `interpretation`. |
| **9** | `silver_feedback` | `feedback_id` (TEXT) | `patient_id`, `doctor_id`, `department_id`, `appointment_id`, `rating`, `doctor_rating`, `staff_rating`, `cleanliness_rating`, `wait_time_rating`, `likely_to_recommend`, `feedback_date`, `sentiment`, `feedback_text`. |
| **10** | `silver_staff_assignment` | `assignment_id` (TEXT) | 14-column clinical assignment ledger: `staff_id`, `staff_name`, `role`, `department_id`, `department_name`, `ward_id`, `shift_id`, `shift_date`, `shift_type`, `shift_start_time`, `shift_end_time`, `assignment_status`, `assigned_by`. |

---

## Supabase Database & Security Model

### 1. Row Level Security (RLS)
Every table under `public` has Row Level Security enabled:
- **Patients**: Restricted strictly to viewing and updating their own linked records using `auth.uid() = app_users.id AND app_users.patient_id = silver_*.patient_id`.
- **Doctors & Clinical Staff**: Granted read and write access scoped to their assigned departments and patient appointments.
- **Service-Role Isolation**: Administrative write operations (e.g. system provisioning, conflict auditing) run exclusively through `supabaseAdmin` in `server.ts` utilizing the private `SUPABASE_SERVICE_ROLE_KEY`.

### 2. Views & Information Hiding
- **`public.silver_doctors_public`**: Secure view exposed to `anon` and `authenticated` roles for doctor lookup and booking wizards.
  - Column layout preserves application contracts (`doctor_id`, `doctor_name`, `specialty`, `qualification`, `experience_years`, `hospital_branch`, `consultation_fee`, `availability_schedule`, `rating`, `is_active`) while making canonical fields (`department_id`, `department_name`, `city`, `phone_number`, `email`) accessible.
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
| `GEMINI_API_KEY` | Optional | Server Only | API key for Google Gemini generative AI features (Gemini 3.8 Flash). |
| `APP_URL` | Optional | Server Only | Application public origin for OAuth callbacks and links. |
| `PORT` | Optional | Server Only | Server listening port (default: `3000`). |

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
   The application starts on `http://localhost:3000` with hot-module reloading and integrated Express API middleware.

3. **Type Checking & Code Quality**:
   ```bash
   npm run lint
   ```
   Runs TypeScript compiler verification (`tsc --noEmit`) to confirm zero type errors.

4. **Automated Unit & Integration Test Suites**:
   - **Combined Test Suite** (25 passing tests):
     ```bash
     npm run test
     ```
     Executes both:
     - `tests/bookingValidation.test.ts` (17 tests): Slot boundary validation, timezone drift (`Asia/Kolkata`), duplicate booking prevention, and doctor onboarding.
     - `tests/aiChatbot.test.ts` (8 tests): Chat input sanitization, acute emergency symptom directives, approved hospital directory grounding, visiting hours policies, patient schedule privacy, and preference isolation without affecting clinical data.

5. **End-to-End Verification Suites**:
   - **Unified Auth & RBAC Verification Suite** (20 tests):
     ```bash
     node scripts/test_unified_auth_flow.js
     ```
     Verifies common login, role auto-routing, default patient assignment, self-elevation prevention, and admin governance.
   - **Admin Governance & Database Sync Suite** (24 tests):
     ```bash
     node scripts/test_admin_role_change.js
     ```
     Tests administrative user directory querying, role elevation, Supabase `app_users` synchronization, and audit logging.

6. **Production Build**:
   ```bash
   npm run build
   ```
   Compiles the frontend bundle into `/dist` via Vite.

---

## Recent Pull Requests & Feature Changelog

### PR #1 — Unified Authentication & Common Login Flow
- **Single Entry Point (`POST /api/auth/common-login`)**: Single unified form accepting Patient ID or official hospital email.
- **Dynamic Role Recognition**: Intelligent regex detection routes users directly to their designated dashboard.
- **Google SSO Integration (`POST /api/auth/google`)**: One-click Google authentication with default assignment to `'patient'`.

### PR #2 — Public Registration Security Hardening
- **Strict Default Patient Enrollment (`POST /api/auth/common-register`)**: Eliminated public self-assignment of privileged roles.
- **Surface Area Reduction**: Removed `<RoleSelector />` from public registration.

### PR #3 — Specialized Operational Workspaces & Clinical Dashboards
- **Dedicated Role Workspaces**: Implemented `DoctorDashboard.tsx`, `StaffDashboard.tsx`, `AdminDashboard.tsx`, and `PatientDashboard.tsx`.

### PR #4 — Administrative User Governance & Audit Ledger
- **Role Elevation Middleware (`requireAdminRole`)**: Guarded `/api/admin/users`, `/api/admin/users/update-role`, and `/api/admin/audit-logs`.
- **Clinical ID Archiving**: Archived clinical identifiers in `historical_identifiers` during transitions.

### PR #5 — Automated Verification Suites & Dependency Optimization
- **End-to-End Verification**: Created `test_unified_auth_flow.js` and `test_admin_role_change.js`.
- **Dependency Cleanups**: Removed unnecessary dependencies to streamline container footprint.

### PR #6 — End-to-End Live Supabase Database Integration
- **Elimination of Fabricated Data**: Audited all pages, services, and backend endpoints to remove static mock arrays and synthetic metrics.
- **Direct PostgreSQL Connections**: Connected consultation schedules, inpatient rounds, lab queues, and executive metrics to live Supabase tables.

### PR #7 — Medical ID Generation & Streamlined Role-Based Signup
- **Concurrency-Safe Atomic Hospital ID Allocator**: Generates unique permanent IDs (`P######` for Patients, `D######` for Doctors, `S######` for Staff).
- **Public Signup Dropdown**: Allows public registration for Patient, Doctor, and Staff roles; Admin role is strictly restricted to internal creation.
- **Doctor & Staff Form Simplification**: Removed Medical Registration Number from Doctor signup and Staff ID from Staff signup.
- **Login with Email or ID**: Updated common login to accept both registered emails and generated IDs across all user types.

### PR #8 — AI Hospital Assistant, Clinical Safety Guardrails & User Preferences Persistence
- **24/7 AI Hospital Assistant**: Slide-out assistant backed by Google Gen AI SDK (`gemini-3.8-flash`) with sub-second verified hospital fallback.
- **Clinical Emergency Guardrails**: Automated symptom detection routing acute emergencies (chest pain, stroke, breathlessness) to 911 / 24/7 Emergency Room.
- **Hospital Knowledge Grounding**: Grounded in 10 clinical specialties, 4 regional campuses, and official visiting hours.
- **User Preference Persistence**: Added `preferences JSONB` to `public.app_users` via non-destructive migration (`20261028000000_add_user_preferences_chatbot.sql`) with GIN indexing.
- **Non-Destructive Removal**: Assistant can be enabled or removed from the patient portal without altering or deleting any patient clinical records.
- **Custom Brand Assets**: Added custom SVG vector robot logo (`AiHospitalAssistantLogo.tsx`) and floating action launcher (`AiHospitalAssistantLauncher.tsx`).
- **Comprehensive Automated Testing**: Added `tests/aiChatbot.test.ts` bringing unit test coverage to 25/25 passing tests.

---

## Current Project Status — October 28, 2026

### 1. Architecture & Backend Implementation
- **Implemented Stack**: React 19 SPA, Node.js/Express server in `server.ts` (with TSX runtime and Vite middleware), and Supabase PostgreSQL with Row Level Security (RLS).
- **Multi-Role Workspaces**: Four dedicated operational dashboards (**Patient**, **Doctor**, **Clinical Staff**, **Administrator**) with strict role isolation.
- **AI Hospital Assistant**: Operational 24/7 assistant with Gemini 3.8 Flash, emergency detection, grounded hospital knowledge, quick actions, and user preferences persistence.
- **Unified Authentication**: Single common login supporting Email Address or ID (`P######`, `D######`, `S######`); streamlined signup for Patient, Doctor, and Staff; Admin role managed via internal governance.
- **Codebase Verification**: 
  - **25/25 automated unit & integration tests pass** (`npm run test`).
  - **20/20 automated unified auth and RBAC verification tests pass** (`node scripts/test_unified_auth_flow.js`).
  - **24/24 admin role governance and database synchronization tests pass** (`node scripts/test_admin_role_change.js`).
  - **Static type-checking passes cleanly with zero errors** (`npm run lint`).
  - **Production build succeeds cleanly** (`npm run build`).

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
| `app_users` | **Active** | 1:1 mapped identity store with Supabase Auth (`auth.users`), RBAC roles, `preferences` JSONB, audit logs. |

---

## Deployment & GitHub Publishing

### Publishing to GitHub
1. Initialize git (if not already initialized):
   ```bash
   git init
   git add .
   git commit -m "feat: complete MediAI platform with AI Hospital Assistant and unified authentication"
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
  - Run `supabase/migrations/20261028000000_add_user_preferences_chatbot.sql` and previous staged migrations using the Supabase CLI (`supabase db push`) or through the Supabase Dashboard SQL Editor during an authorized maintenance window.

---

## License & Compliance Notice

This software is designed for healthcare administrative demonstration and clinical operational workflows. Ensure strict compliance with **HIPAA**, **HITECH**, **GDPR**, or relevant regional medical data privacy legislation before deploying to clinical production environments with real Patient Health Information (PHI).
