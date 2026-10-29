# Dynamic Supabase Identity Synchronization & Zero-Mock Clinical Dashboards

## Title & Summary
Synchronize user authentication and dashboard views directly with the connected Supabase database (`app_users`, `silver_patients`, `silver_doctors`), eliminate all synthetic fallback identities (`Elena Rostova`, `Dr. Marcus Vance`, `Dr. Marcus Chen`), route users automatically to their correct role workspace upon login, and render only genuine clinical records with clean empty states.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions have been confirmed through your clarifying answers:

- **Confirmed Identity**: Account `nsharan1862@gmail.com` is registered in Supabase with the `doctor` role (profile name: `karan111` in `app_users` table).
- **Confirmed Routing**: When signing in, the platform will strictly use the role returned from the authoritative Supabase `app_users` record and automatically route to the matching dashboard (`doctor` &rarr; Clinical Doctor Workspace, `patient` &rarr; Patient Care Portal, `staff` &rarr; Staff Portal, `admin` &rarr; Admin Dashboard).
- **Confirmed Data Discipline**: Zero mock fallbacks. If any user, doctor, appointment, lab, or prescription field is null or has no records in Supabase, the UI will display a clean, unboxed empty state or omit the field rather than generating placeholder names.
- **Profile Name Updating**: A quick profile name editor will be provided in the header/account menu so you can update your displayed name (e.g., from `karan111` to your preferred clinical title) and persist it directly into Supabase `app_users` and `silver_doctors`.

---

## 1. Overview & Core Concept

### What It Does
- **Direct Supabase Authentication & Role Resolution**: Logs into Supabase Auth and queries the authoritative `app_users` row to obtain the user's authentic `role`, `full_name`, `doctor_id`, and `patient_id`.
- **Automatic Role-Based Navigation**: Directs the user immediately to the correct portal without incorrect heuristic guessing or forced patient defaulting.
- **Strictly Grounded Clinical Data**: Fetches and renders live database records from `silver_doctors`, `silver_patients`, `silver_appointments`, `silver_encounters`, `silver_prescriptions`, and `silver_lab_results`.
- **Zero-Mock Policy**: Removes synthetic fallback objects (fake doctors like "Dr. Marcus Vance", fake patients like "Elena Rostova", and hardcoded test labs/prescriptions) across the entire codebase.

### Target Audience & Personas
- **Attending Physicians & Specialists**: Doctors signing in with their clinical accounts (e.g., `nsharan1862@gmail.com`) who need their actual schedule, patient appointments, inpatient rounds, and lab reviews.
- **Patients**: Registered patients seeing strictly their own health records and assigned care team.
- **Hospital Administrators & Staff**: Governance and triage staff viewing live operational feeds.

---

## 2. User Experience & Visual Design

### Key User Flows

```
┌────────────────────────┐      ┌───────────────────────────┐      ┌─────────────────────────────┐
│      Login Screen      │ ───> │ Supabase Auth & app_users │ ───> │  Role-Specific Dashboard    │
│  (Email & Password)    │      │ (Authentic Role & Name)   │      │  (Doctor / Patient / Staff) │
└────────────────────────┘      └───────────────────────────┘      └─────────────────────────────┘
                                                                                  │
                                                                   ┌──────────────┴──────────────┐
                                                                   ▼                             ▼
                                                        [Live Database Records]       [Empty State if 0 items]
                                                        Real Supabase data only       "No appointments scheduled"
```

1. **Sign-In Flow**:
   - User inputs `nsharan1862@gmail.com` and credentials.
   - Backend queries Supabase `app_users` and authenticates session.
   - Response returns `{ role: 'doctor', name: 'karan111', email: 'nsharan1862@gmail.com', ... }`.
   - Frontend automatically transitions to the **Clinical Physician Workspace (`DoctorDashboard`)**.

2. **Physician Workspace View**:
   - **Header**: Shows authentic user name and email from Supabase (e.g., `karan111` · `DOC-2596` or `ID: P1011`).
   - **Schedule Tab**: Loads appointments from `silver_appointments` where `doctor_id` matches the user or shows `"No appointments scheduled for today"`.
   - **Inpatients Tab**: Loads active encounters or presents clean empty state.
   - **Labs Tab**: Loads pending laboratory reports or displays `"No pending lab reports requiring physician sign-off"`.
   - **Profile Name Edit Modal**: Allows the user to easily update their display name to reflect their full medical title, saving directly to Supabase `app_users`.

3. **Patient Portal View (when logged in as patient)**:
   - Header and Welcome Banner show only the patient's actual name, MRN, and database records.
   - If no primary doctor is assigned in `silver_patients`, it explicitly displays `"No primary physician assigned yet"`.

### Visual Identity & Layout
- **Style**: Clean clinical SaaS interface following the `3_saas_dashboard` guidelines.
- **Color Palette**: Neutral dark slate (`#0B0F19`), clean medical teal (`#0D9488`), and emerald accents. Status indicators use muted semantic colors.
- **Zero-Pill Discipline**: Metadata displayed as clean, unboxed typography with dot separators (`karan111 · Attending Physician · nsharan1862@gmail.com`), eliminating redundant capsule badges.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Automatic Role-Based Routing vs. Hardcoded Guesses
- **Chosen Approach**: Route purely based on the `role` column in Supabase `public.app_users`.
- **Why**: Eliminates email pattern guessing (`detectRoleFromInput` looking for substring `"doc"`), which caused `nsharan1862@gmail.com` to be misidentified as a patient.
- **Trade-Off**: Requires 1 database query on login, which is already executed and cached in the session token.

### Decision 2: Elimination of In-Memory Persona Fallbacks
- **Chosen Approach**: Completely purge hardcoded test personas (`Elena Rostova`, `Dr. Marcus Vance`, `Sarah Jenkins`) from the active database handlers.
- **Why**: Protects clinical integrity and prevents confusing fake names from appearing in user sessions.
- **Trade-Off**: Accounts with 0 appointments will show an empty state instead of fake demo data, which is authentic and desirable.

### Decision 3: Profile Name Management
- **Chosen Approach**: Provide an in-app "Edit Profile Name" dialog in the header so the user can easily update `karan111` to their real name (`N. Sharan` or `Dr. Sharan`) with immediate Supabase persistence.
- **Why**: Avoids requiring manual SQL updates in the Supabase table editor.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          React Frontend (SPA)                          │
├──────────────────────────┬─────────────────────────────┬───────────────┤
│       LoginScreen        │       DoctorDashboard       │  PatientPortal│
│  (Common Authentication) │  (Clinical Physician View)  │  (Care Portal)│
└────────────┬─────────────┴──────────────┬──────────────┴───────┬───────┘
             │                            │                      │
             ▼                            ▼                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Express API (server.ts)                         │
├────────────────────────────────────────────────────────────────────────┤
│ POST /api/auth/common-login  ───> Authenticates against Supabase Auth   │
│                                   & public.app_users                   │
│ GET  /api/doctor/overview    ───> Queries silver_appointments &        │
│                                   silver_encounters for doctor_id      │
│ POST /api/user/update-profile ──> Updates full_name in app_users       │
│                                   and silver_doctors/silver_patients   │
│ GET  /api/patient/dashboard  ───> Queries silver_patients & records    │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Supabase PostgreSQL Database                       │
├────────────────────────────────────────────────────────────────────────┤
│ • auth.users (Credentials & Session JWT)                               │
│ • public.app_users (1:1 mapped profile, role='doctor', full_name)      │
│ • public.silver_doctors & public.silver_patients                       │
│ • public.silver_appointments & public.silver_encounters                │
└────────────────────────────────────────────────────────────────────────┘
```

### Execution Steps
1. **Server Login Refactoring (`server.ts`)**:
   - In `/api/auth/common-login`, remove hardcoded fallback personas and ensure `userRecord.role` from `app_users` is authoritatively returned.
   - For `/api/doctor/overview`, query real data for the authenticated doctor's ID; return empty arrays if no records exist.
   - Add `/api/user/update-profile` endpoint allowing users to update their name in `app_users` and linked role tables.
2. **Frontend Routing Refactoring (`LoginScreen.tsx` & `App.tsx`)**:
   - Update `LoginScreen.tsx` to route strictly based on the server-returned `user.role` (directing `doctor` &rarr; `doctor-dashboard`).
   - In `DoctorDashboard.tsx`, replace the hardcoded `'Dr. Marcus Vance, MD'` fallback with `user.name` and email, and provide an "Edit Profile" action to update display name.
   - Ensure clean empty states on schedule, inpatient rounds, and lab tabs when arrays are empty.
3. **Verification**:
   - Run compilation and verify that logging in as `nsharan1862@gmail.com` opens the Doctor Dashboard displaying `karan111` (or their updated name), with zero fake names.
