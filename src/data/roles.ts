/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HospitalRole, RoleConfig } from '../types/auth';

export const ROLES_CONFIG: Record<HospitalRole, RoleConfig> = {
  patient: {
    id: 'patient',
    title: 'Patient',
    subtitle: 'Care & Telemetry',
    badge: 'Patient Portal',
    accentColor: 'teal',
    iconName: 'HeartPulse',
    description: 'Access medical history, virtual appointments, lab test results, and direct clinician communication.',
  },
  doctor: {
    id: 'doctor',
    title: 'Doctor',
    subtitle: 'Clinical & Diagnostics',
    badge: 'Physician Access',
    accentColor: 'cyan',
    iconName: 'Stethoscope',
    description: 'Review clinical encounters, digital prescriptions, laboratory telemetry, and AI diagnosis assistance.',
  },
  staff: {
    id: 'staff',
    title: 'Staff',
    subtitle: 'Hospital Operations',
    badge: 'Clinical Support',
    accentColor: 'violet',
    iconName: 'ClipboardCheck',
    description: 'Manage ward assignments, patient admissions, shift schedules, triage queue, and unit logistics.',
  },
  admin: {
    id: 'admin',
    title: 'Admin',
    subtitle: 'Governance & Security',
    badge: 'Restricted Access',
    accentColor: 'indigo',
    iconName: 'ShieldAlert',
    description: 'Configure hospital units, audit security logs, provision role credentials, and oversee Medallion analytics.',
  },
};

export const VALID_ADMIN_INVITATION_CODES = [
  'MEDIAI-SUPERADMIN-2026',
  'HOSPITAL-GOVERNANCE-EXEC-99',
  'CHIEF-MED-DIRECTOR-4401',
];

export const VALID_HOSPITAL_INVITE_CODES = [
  'MED-CLINIC-7721',
  'STJUDE-HOSPITAL-2026',
  'NEURO-SURG-8802',
];

export const MEDICAL_SPECIALIZATIONS = [
  'Cardiology & Vascular Medicine',
  'Neurology & Neurosciences',
  'General Internal Medicine',
  'Emergency Medicine & Trauma',
  'Pediatrics & Neonatology',
  'Oncology & Hematology',
  'Orthopedic Surgery',
  'Obstetrics & Gynecology',
  'Radiology & Diagnostic Imaging',
  'Pulmonology & Critical Care',
];

export const HOSPITAL_DEPARTMENTS = [
  'Emergency Department (ED / ER)',
  'Intensive Care Unit (ICU)',
  'Inpatient Ward & Nursing',
  'Patient Admissions & Registry',
  'Laboratory & Pathology Services',
  'Pharmacy & Dispensing',
  'Surgical Services & Operating Theatres',
  'Outpatient Ambulatory Clinic',
  'Biomedical Engineering & Supplies',
];
