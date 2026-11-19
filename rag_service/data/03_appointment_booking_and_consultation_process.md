# MediAI Appointment Booking and Consultation Procedures

## How to Book an Appointment
Patients can schedule outpatient consultations through the MediAI Patient Portal Appointment Booking Wizard in five structured steps:
1. **Open the Booking Wizard:** Click **Book New Appointment** in the Patient Portal header or Appointments tab.
2. **Select Hospital Campus:** Choose one of the four verified MediAI campuses (Main Campus, West Ambulatory & Imaging Pavilion, Heart & Vascular Specialty Institute, or Neurosciences & Pediatric Specialty Care).
3. **Select Medical Specialty:** Choose from the 10 accredited clinical specialties offered at MediAI.
4. **Select Physician and Clinic Slot:** Browse active physicians matching the chosen campus and specialty, then pick an available date and clinic time slot during standard clinic hours (**08:00 AM – 06:00 PM**).
5. **Review and Confirm:** Enter the reason for visit or consultation notes and confirm the booking. The appointment receives an official confirmation ID and is immediately recorded in the hospital scheduling system.

## Booking Channels and Priority Levels
- **Supported Booking Channels:** Online Portal (`Online`), In-Person Reception (`In-Person`), and Emergency Intake (`Emergency`).
- **Consultation Types:** In-Person Consultation and virtual/telehealth follow-ups where offered by the department.
- **Appointment Priority Levels:** `Low`, `Medium`, `High`, and `Urgent`.
- **Appointment Statuses:** `Scheduled`, `Confirmed`, `Completed`, `Cancelled`, and `No Show`.

## Scheduling Rules and Conflict Prevention
- **Conflict-Free Scheduling:** MediAI enforces strict database-level conflict prevention so two active appointments cannot be booked for the same physician at the exact same date and time slot.
- **Date and Time Validation:** Past dates and invalid clinic time slots outside standard operating hours are rejected automatically.
- **Hospital Timezone:** All operational appointment dates and clinic schedules are validated using the configured hospital IANA timezone (defaulting to **Asia/Kolkata / IST** in MediAI hospital operations).

## Rescheduling and Cancelling Appointments
Authenticated patients can view upcoming consultations, review assigned doctors and branches, or cancel scheduled appointments directly from the **Appointments** tab in the Patient Portal.

## Consultation Procedures and Clinical Encounters
During a completed consultation or hospital visit:
- Patients check in at the designated campus outpatient desk or clinical reception.
- For triage intake in acute settings, clinical staff prioritize patients using the **Emergency Severity Index (ESI Levels 1–5)** and log vital signs (heart rate, blood pressure, SpO2, and body temperature).
- Following the consultation, the attending physician documents the clinical encounter summary—including chief complaint, symptoms, primary diagnosis, treatment plan, any e-prescriptions, lab orders, and recommended follow-up date—which becomes accessible in the patient's Electronic Medical Records (EMR).
