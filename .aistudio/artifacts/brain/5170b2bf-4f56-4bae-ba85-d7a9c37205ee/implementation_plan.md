# Unified Authentication, Default Patient Registration & Executive Role Governance

Streamline MediAI's authentication architecture into a unified, common login and registration pipeline where all new users register securely as Patients, while hospital administrators retain exclusive privilege in the Admin Dashboard to reassign and manage roles directly synchronized with the database.

> [!IMPORTANT]
> **Confirmed User Decisions & Requirements:**
> - **Zero UI Redesign / Strict Visual Preservation**: Preserve all existing design aesthetics, dark navy background (`#0B0F19`), cyan/teal accents, typography, spacing, button/input styles, and the left-side patient journey animation.
> - **Common Login**: Unified login for all roles (Patient, Doctor, Staff, Admin) without role selectors. Dynamic backend role resolution routes users to their respective authorized dashboard.
> - **Common Registration**: Remove the role selector from registration. All new users register through the same single form with default Patient assignment.
> - **Admin-Only Role Modification**: Strictly enforce Admin-only role modification across all APIs. Deprecate public self-elevation endpoints.
> - **Clinical ID Lifecycle**: Retain clinical IDs (`DOC-XXXX`, `STF-XXXX`) in user profile history upon demotion/reassignment while revoking active staff/physician dashboard access.

---

## 1. Overview & Core Concept

- **Unified Hospital Login**: A single, elegant login portal accepting either Patient ID (`PXXXXXX`) or Hospital Institutional Email. Upon authentication, the backend returns the user's verified role and dispatches to the authorized dashboard.
- **Default Patient Onboarding**: Public signup assigns `patient` status exclusively. No public user can self-select or elevate to Doctor, Staff, or Admin during registration.
- **Executive Role Governance**: Hospital administrators use the dedicated **User Governance** tab within the Admin Dashboard to promote or reassign user roles across the complete matrix (`Patient ↔ Doctor`, `Patient ↔ Staff`, `Patient ↔ Admin`). All updates persist immediately to the database and register in the executive audit ledger.

---

## 2. User Experience & Visual Design

### Strict UI Preservation Guarantee
- **Login Screen (`LoginScreen.tsx`)**:
  - Keep the existing two-column layout: left column features the animated Patient Journey steps; right column hosts the login card.
  - Maintain the existing single identifier field (`Patient ID or Hospital Email`), password field with visibility toggle, remember device checkbox, and Google sign-in button.
  - No role selector on the login card.
- **Registration Screen (`SignupScreen.tsx`)**:
  - Remove the `<RoleSelector />` component and role-specific conditional branches (medical registration number, invite codes, department dropdowns).
  - Form displays only standard patient registration inputs: Full Legal Name, Email Address, Phone Number, Date of Birth, Password, Confirm Password, and Terms of Service consent checkbox.
  - Retain the Google Quick Signup button with automatic Patient role assignment.
  - Preserve exact padding, colors, font styling, animations, and container geometry.
- **Admin Dashboard (`AdminDashboard.tsx`)**:
  - Maintain the existing **User Governance** tab with real-time search, role filtering, high-density accounts table, inline role adjustment menu, and audit trail ledger.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Removal of Public Self-Elevation API**
  - *Chosen Approach*: Restrict `/api/auth/update-role` or replace it strictly with authenticated admin verification via `POST /api/admin/users/update-role`.
  - *Why*: Eliminates security vulnerabilities where non-admin callers could escalate their privileges.
- **Decision 2: Retention of Historical Clinical Credentials on Demotion**
  - *Chosen Approach*: When a Doctor or Staff member is reassigned to Patient, their `doctor_id` / `staff_id` is preserved in `historical_identifiers` or metadata, while their active `role` is set to `'patient'` and access tokens are restricted.
  - *Why*: Satisfies hospital compliance and licensing records while immediately cutting off clinical dashboard access.
- **Decision 3: Backend-Authoritative Dashboard Routing**
  - *Chosen Approach*: The client receives `{ user: { role: 'patient' | 'doctor' | 'staff' | 'admin' } }` from the server. `App.tsx` routes strictly based on verified server role. Direct URL manipulation is guarded by role state.

---

## 4. Technical Architecture & System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    MediAI Client Application                │
│                                                             │
│   ┌──────────────────────────┐  ┌────────────────────────┐  │
│   │ LoginScreen              │  │ SignupScreen           │  │
│   │ (Common - Single Form)   │  │ (Default Patient Only) │  │
│   └────────────┬─────────────┘  └───────────┬────────────┘  │
│                │ POST /api/auth/login       │ POST /api/auth/common-register
└────────────────┼────────────────────────────┼───────────────┘
                 │                            │
                 ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Express Backend Gateway                   │
│                                                             │
│  ├─ POST /api/auth/common-register:                         │
│  │    └─ Force role='patient', generate P-ID, save to DB    │
│  ├─ POST /api/auth/login:                                   │
│  │    └─ Lookup in app_users, return verified role & token  │
│  ├─ POST /api/admin/users/update-role:                      │
│  │    ├─ Check requireAdminRole middleware                  │
│  │    ├─ Update role in DB & sync clinical IDs              │
│  │    └─ Log event to executive audit ledger                │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                 Supabase PostgreSQL DB                      │
│  ├─ public.app_users (Authoritative role store)             │
│  └─ public.audit_logs (Immutable role transition ledger)    │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Implementation Steps

1. **Signup Screen (`src/components/SignupScreen.tsx`)**:
   - Remove `<RoleSelector />` and role-selection state.
   - Set fixed role to `'patient'` for all new registrations.
   - Remove doctor, staff, and admin invitation code / specialization input branches.
   - Keep only patient fields (Name, Email, Phone, Date of Birth, Password, Terms).
   - Ensure submit button reads "Complete Patient Registration" and preserves existing gradient styling.
2. **Backend Hardening (`server.ts`)**:
   - Ensure `POST /api/auth/common-register` always assigns `role = 'patient'`.
   - Lock down `POST /api/admin/users/update-role` with `requireAdminRole`.
   - Update user role modification logic to retain clinical IDs in user metadata when reassigned to Patient.
   - Remove or secure any leftover self-elevation test endpoints.
3. **Session & Routing Verification (`src/App.tsx`)**:
   - Confirm common login navigates to appropriate dashboard based on backend `user.role`.
   - Confirm active session updates if an admin modifies the user's role.
4. **End-to-End Verification**:
   - Register a new user and verify they receive Patient role and ID.
   - Log in as Admin and navigate to User Governance.
   - Modify the user's role to Doctor, Staff, or Admin.
   - Verify database persistence and audit log entry.
   - Log in as the updated user and verify navigation to the corresponding dashboard.
   - Run compilation and automated test suites.
