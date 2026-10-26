# Dynamic User Identity Binding & Clean Patient Dashboard Architecture

Eliminate hardcoded persona overrides (`Elena Rostova`) and establish an authoritative, dynamic user data pipeline where newly registered accounts display their exact registered legal name, email, phone, and patient ID, accompanied by a clean clinical record ready for real-time appointment scheduling.

> [!IMPORTANT]
> **Confirmed User Decisions (Phase 1 Clarification):**
> - **Dashboard Initial State**: Start with a clean patient record ready for booking (`upcomingAppointments: []`, `completedEncounters: []`, `labReports: []`, `prescriptions: []`) with a personalized onboarding welcome notification.
> - **Storage Strategy**: Dynamic storage that maps directly to the live PostgreSQL/Supabase database when credentials are set, with zero hardcoded persona fallbacks.

---

## 1. Overview & Core Concept

- **The Problem**: Previously, `authenticateToken` and `/api/patient/dashboard` in `server.ts` hardcoded fallback values for patient identity (`Elena Rostova`, `P182162`, `elena.rostova@patient.org`) and synthetic historical appointments whenever requests used session tokens. Consequently, a user who registered with their own name saw "Elena Rostova" on their dashboard.
- **The Solution**: 
  1. Token generation embeds the user's real account identifier and securely resolves their exact registered identity (`name`, `email`, `phone`, `date_of_birth`, `patient_id`) from the user registry or Supabase `app_users`.
  2. `/api/patient/dashboard` dynamically constructs the patient profile using the authenticated user's actual registered credentials.
  3. New patients start with a clean clinical record and can book dynamic appointments via the existing Appointment Booking Wizard, which immediately persist and display on their dashboard under their own name.

---

## 2. User Experience & Visual Design

- **Strict UI Preservation**:
  - Zero modifications to CSS classes, dark navy background, teal/cyan accent palette, layout, typography, or the left-side patient journey animation.
  - The Patient Dashboard top navigation bar immediately reflects the user's actual registered name in the profile avatar pill (`{user.name}`) and their assigned Patient ID (`{user.patient_id}`).
  - The welcome banner displays: `"Welcome back, [Registered Full Name]"` with their actual date of birth, contact number, and medical record identifier.
- **Clean Slate Onboarding Experience**:
  - The **Upcoming Consultations** section gracefully displays an active empty state: *"No upcoming consultations scheduled. Use the Schedule Appointment wizard to book your visit."*
  - The **Appointments**, **Encounters**, **Lab Reports**, and **Prescriptions** tabs reflect the patient's real history rather than third-party mock records.
  - Personalized welcome notification in the notification dropdown: *"Welcome to MediAI, [Name]. Your official Patient ID is [PXXXXXX]."*

---

## 3. Key Technical Decisions & Trade-Offs

- **Decision 1: Token-to-Identity Dynamic Resolution**
  - *Chosen Approach*: Update session tokens to be user-bound (`session-token-${user.id}-${Date.now()}` or lookup token). In `authenticateToken`, lookup the actual user record by ID or email in the registered accounts store / `app_users`.
  - *Why*: Guarantees that `req.appUser` and `req.authenticatedPatientId` always match the person who actually registered or logged in, completely eliminating hardcoded "Elena Rostova" substitutions.
- **Decision 2: Dynamic Patient Dashboard Generator**
  - *Chosen Approach*: `/api/patient/dashboard` reads `req.appUser` directly to generate the `patient` profile. If the patient is newly registered, return their exact demographic profile with an empty appointment queue.
  - *Why*: Accurately reflects their real-time state and immediately updates when the patient uses the appointment booking wizard.
- **Decision 3: Seamless Supabase PostgreSQL Transition**
  - *Chosen Approach*: When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured in `.env`, the system queries `public.silver_patients` and `public.app_users` for the user. When not yet configured, the server uses the verified in-memory registry without reverting to hardcoded fictitious names.
  - *Why*: Adheres to the user's preference for dynamic data that utilizes the live database whenever credentials are provided.

---

## 4. Technical Architecture & System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    MediAI React Client                      │
│                                                             │
│   [SignupScreen] ──(Full Name: John Doe)──► POST /api/auth/common-register
│   [LoginScreen]  ──(Login as John Doe)───► POST /api/auth/common-login
│                                                  │
│   [PatientDashboard] ◄──(Dynamic John Doe Data)──┘ GET /api/patient/dashboard
└──────────────────────────────┬──────────────────────────────┘
                               │ Bearer session-token-usr-...
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Express Backend Gateway                   │
│                                                             │
│  1. authenticateToken Middleware:                           │
│     ├─ Extracts user identifier from token                  │
│     └─ Resolves real RegisteredAccount (Name, Email, P-ID)  │
│                                                             │
│  2. GET /api/patient/dashboard:                             │
│     ├─ Constructs patient profile from real user account    │
│     ├─ Returns clean slate for new patients                 │
│     └─ Binds dynamic booked appointments to user.patient_id │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
       [Live Supabase DB]           [Dynamic Server Registry]
     (When credentials set)          (Zero Hardcoded Personas)
```

---

## 5. Implementation Steps

1. **Token Generation & Authentication Middleware (`server.ts`)**:
   - In `POST /api/auth/common-register` and `POST /api/auth/common-login`, issue tokens tied to the account's unique ID: `session-token-${account.id}-${Date.now()}`.
   - In `authenticateToken`, resolve `(req as any).appUser` dynamically from `REGISTERED_ACCOUNTS.get(accountId)` or `app_users`. Remove hardcoded `'Elena Rostova'` and `'P182162'`.
2. **Dynamic Patient Dashboard Endpoint (`server.ts`)**:
   - Refactor `GET /api/patient/dashboard` to build the patient object using the authenticated user's actual `full_name`, `email`, `phone`, `date_of_birth`, and `patient_id`.
   - Remove hardcoded Elena Rostova appointments, lab reports, and prescriptions. Return dynamic appointments filtered by the user's `patient_id` (empty for new patients, populated upon booking).
3. **Appointment Booking Integration (`server.ts`)**:
   - Verify `POST /api/patient/appointments/book` saves appointments under `req.authenticatedPatientId` and reflects immediately in the patient's dashboard.
4. **Automated Verification**:
   - Run end-to-end test registering a user with a custom name (e.g., "Sarah Connor"), logging in, and verifying `GET /api/patient/dashboard` returns "Sarah Connor", their real ID, and a clean appointment list.
