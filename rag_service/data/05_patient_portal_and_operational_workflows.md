# MediAI Digital Platform, Patient Portal, and Operational Processes

## MediAI Platform Overview and User Portals
MediAI unifies hospital patient experience and clinical operations across four dedicated role-based portals with strict role isolation and security governance:
- **Patient Portal:** Self-service appointment booking, upcoming consultation schedule, clinical encounter summaries, diagnostic lab results, prescription tracking, and patient experience feedback submission.
- **Doctor Workspace:** Daily consultation agenda, inpatient ward rounds, diagnostic lab review and electronic sign-off, encounter documentation, and digital e-prescribing.
- **Clinical Staff & Nursing Portal:** Ward bed management (Occupied, Available, Cleaning, Reserved), ESI triage intake queue, patient vitals telemetry logging, and shift coordination.
- **Administrator Command Center:** Date-filtered hospital operations analytics, departmental capacity matrix, workforce roster governance, and audit logs.

## Account Registration and Hospital Identifiers
- Patients, Doctors, and Clinical Staff can register through the MediAI Signup flow; Administrator accounts are provisioned strictly through internal governance and cannot be self-assigned publicly or through Google sign-up.
- MediAI assigns unique permanent hospital identifiers upon registration:
  - **Patients:** `P`-prefixed Patient ID (e.g., `P100001`).
  - **Doctors:** `D`-prefixed Doctor ID (e.g., `D100001`).
  - **Clinical Staff:** `S`-prefixed Staff ID (e.g., `S100001`).
- Users can sign in using either their registered email address or their assigned Hospital ID, and patients may also sign in with Google authentication.

## Navigating Patient Medical Records
Once signed into the Patient Portal, patients can access their authenticated records across dedicated navigation tabs:
- **Appointments Tab:** View upcoming and past visits, check confirmation IDs, cancel appointments, or launch the Booking Wizard.
- **Clinical Encounters / Visits:** Review attending physician visit summaries, diagnoses, symptoms, treatment plans, and follow-up dates.
- **Lab Results Tab:** Open detailed finalized laboratory reports with numeric values, reference ranges, and status indicators.
- **Prescriptions Tab:** View active and historical medications, dosages, frequencies, routes, and refill allowances.
- **Feedback Tab:** Submit patient experience ratings on a 1–5 scale across six dimensions: Overall Rating, Doctor Rating, Staff Rating, Wait Time Rating, Cleanliness Rating, and Recommendation Likelihood, along with qualitative comments.

## Privacy, Security, and AI Assistant Controls
- All personal clinical records are protected by authenticated JWT sessions and PostgreSQL Row Level Security (RLS), ensuring patients can only access their own records.
- Private patient details, personal appointments, and medical records are **never** stored in or retrieved from the general hospital knowledge base.
- Users can start a new chat, clear conversation history, or disable/remove the Medi AI Assistant launcher from their interface without affecting any medical records or appointments, and can restore the assistant at any time.
