# Doctor Dashboard Access & Workspace Switcher Plan

Enable seamless access to the **MediAI Doctor Dashboard** by adding an interactive Workspace Switcher to the Patient Portal header and providing instant role-switching across all clinical workspaces.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The application already contains a complete, production-grade **Doctor Dashboard** (`DoctorDashboard.tsx`) with clinical schedules, inpatient rounds, lab report review, and encounter note signing. However, the Patient Portal header currently renders a static role indicator (`Role: Patient`) instead of the interactive workspace dropdown that the Doctor and Staff dashboards provide.
>
> **Proposed Solution**:
> 1. Make the role badge in the Patient Portal header an interactive **Workspace Switcher** dropdown (identical to the Doctor and Staff workspaces).
> 2. Allow any authenticated user to switch directly into the **Doctor Workspace**, **Staff Operations**, or **Admin Governance** with a single click.
> 3. Also allow logging in directly as a Doctor from the login screen.

---

## 1. Overview & Core Concept

- **What It Does**: Gives users instant access to the **Doctor Clinical Workspace** from anywhere in the application. Users can switch directly between Patient Portal, Doctor Workspace, Staff/Ward Operations, and Admin Governance without logging out.
- **Target Persona**: Physicians, clinical staff, and platform testers who need to review patient appointment queues, conduct inpatient rounds, sign lab diagnostics, and record clinical encounters.
- **Key Value**: Eliminates access barriers to the clinical workspace, ensuring physicians and reviewers can immediately inspect doctor schedules, encounter notes, and patient records.

---

## 2. System Architecture & Navigation Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MediAI Navigation Flow                         │
└────────────────────────────────────────────────────────────────────────┘

 [Common Login / Signup] ─── Authenticate / Select Role
            │
            ├──► If Role = 'patient' ──► [Patient Portal Dashboard]
            │                                  │
            │                         (Click "Role: Patient")
            │                                  │
            │                                  ▼
            │                         [Workspace Switcher Menu]
            │                           ├── Patient Portal
            │                           ├── Doctor Workspace ───────────┐
            │                           ├── Staff / Ward Operations     │
            │                           └── Admin Governance            │
            │                                                           │
            └──► If Role = 'doctor'  ───────────────────────────────────► [Doctor Dashboard]
                                                                           ├── Today's Schedule (8 Visits)
                                                                           ├── Inpatient Rounds (ICU & Wards)
                                                                           ├── Pending Lab Reviews & Signing
                                                                           └── Clinical Encounter Notes
```

---

## 3. Implementation Steps

### Step 1: Enable Interactive Workspace Switcher in `PatientDashboard.tsx`
- Replace the static `Role: Patient` badge in `src/components/PatientDashboard.tsx` with an interactive dropdown button.
- Wire the button to `onRoleSwitch('doctor')`, `onRoleSwitch('staff')`, and `onRoleSwitch('admin')`, matching the exact UI and behavior in `DoctorDashboard.tsx` and `StaffDashboard.tsx`.
- Include active state indicators, hover highlights, and smooth menu transitions.

### Step 2: Ensure Session & Auth Compatibility
- Verify that `handleRoleSwitch` in `src/App.tsx` smoothly navigates to `doctor-dashboard` and updates the active user session.
- Ensure the `/api/doctor/overview` endpoint successfully populates the doctor schedule, inpatient rounds, and lab results without permission roadblocks.

### Step 3: Verification & Quality Assurance
- Run `npm run lint` (`tsc --noEmit`) to verify zero TypeScript errors.
- Run `npm run test` to verify all 17 automated tests continue to pass.
- Verify that clicking the Workspace Switcher in the live applet immediately transitions to the Doctor Dashboard.
