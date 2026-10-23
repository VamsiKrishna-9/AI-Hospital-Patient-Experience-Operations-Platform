/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HospitalBranch } from '../types/patient';

// Standard clinic schedule: 09:00 to 17:00 at 30-min increments (excluding lunch break)
export const STANDARD_CLINIC_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
];

export const ALLOWED_CONSULTATION_TYPES = ['In-Person', 'Online', 'Video', 'Telehealth'];

export const CANONICAL_BRANCH_IDS = ['BR-MAIN', 'BR-WEST', 'BR-CARD', 'BR-NEURO'] as const;

export const HOSPITAL_BRANCHES: HospitalBranch[] = [
  {
    branch_id: 'BR-MAIN',
    name: 'MediAI Medical Center — Main Campus',
    address: '400 Medical Center Way, Suite 100',
    city: 'Metro Medical District',
    phone: '+1 (555) 234-8000',
    working_hours: 'Mon-Sun: 24/7 Emergency & Inpatient | Outpatient: 8:00 AM - 8:00 PM',
  },
  {
    branch_id: 'BR-WEST',
    name: 'MediAI West Ambulatory & Imaging Pavilion',
    address: '1850 Valley View Boulevard',
    city: 'Westwood Heights',
    phone: '+1 (555) 234-8100',
    working_hours: 'Mon-Fri: 7:30 AM - 6:30 PM | Sat: 8:00 AM - 2:00 PM',
  },
  {
    branch_id: 'BR-CARD',
    name: 'MediAI Heart & Vascular Specialty Institute',
    address: '920 Cardio Boulevard, Building B',
    city: 'Central Health District',
    phone: '+1 (555) 234-8200',
    working_hours: 'Mon-Fri: 8:00 AM - 6:00 PM | Urgent Cardiology On-Call',
  },
  {
    branch_id: 'BR-NEURO',
    name: 'MediAI Neurosciences & Pediatric Specialty Care',
    address: '310 Pediatric Way',
    city: 'North Hills Campus',
    phone: '+1 (555) 234-8300',
    working_hours: 'Mon-Fri: 8:00 AM - 5:30 PM | Sat: 9:00 AM - 1:00 PM',
  },
];

export const MEDICAL_SPECIALTIES = [
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

/**
 * Fallback timezone when process.env.HOSPITAL_TIMEZONE is unset.
 * Preserves backward compatibility with prior California deployments.
 */
export const DEFAULT_HOSPITAL_TIMEZONE = 'America/Los_Angeles';

/**
 * Validates an IANA timezone identifier using ECMA-402 Intl.DateTimeFormat.
 */
export function isValidTimezone(tz?: string | null): boolean {
  if (!tz || typeof tz !== 'string' || !tz.trim()) {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the authoritative hospital timezone from process.env.HOSPITAL_TIMEZONE.
 * - If unset: returns the approved backward-compatible fallback ('America/Los_Angeles').
 * - If set and valid: returns the configured timezone (e.g. 'Asia/Kolkata').
 * - If set and invalid: throws a clear server configuration Error rather than silently defaulting.
 */
export function getHospitalTimezone(): string {
  const envTz = process.env.HOSPITAL_TIMEZONE?.trim();
  if (!envTz) {
    return DEFAULT_HOSPITAL_TIMEZONE;
  }

  if (!isValidTimezone(envTz)) {
    throw new Error(
      `Invalid hospital timezone configured in HOSPITAL_TIMEZONE: "${envTz}". Must be a valid IANA timezone identifier (e.g., 'Asia/Kolkata').`
    );
  }

  return envTz;
}

/**
 * Resolves hospital local calendar date (YYYY-MM-DD) and clock time (HH:MM).
 * Uses standard IANA timezone resolution via Intl.DateTimeFormat with hourCycle: 'h23'.
 * Fails safely with an explicit Error if an invalid timezone is supplied or configured.
 */
export function getHospitalLocalDateTime(
  tz?: string,
  referenceDate: Date = new Date()
): { dateStr: string; timeStr: string } {
  const resolvedTz = tz !== undefined ? tz.trim() : getHospitalTimezone();

  if (!isValidTimezone(resolvedTz)) {
    throw new Error(
      `Invalid hospital timezone: "${resolvedTz}". Must be a valid IANA timezone identifier (e.g., 'Asia/Kolkata').`
    );
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: resolvedTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(referenceDate);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;

  if (!year || !month || !day || !hour || !minute) {
    throw new Error(`Failed to format hospital-local date/time for timezone: "${resolvedTz}".`);
  }

  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${hour}:${minute}`,
  };
}

/**
 * Validates appointment calendar date.
 * Rejects invalid formats, non-existent dates, and dates in the past (based on hospital local timezone).
 */
export function validateAppointmentDate(
  dateStr: string,
  hospitalTz?: string,
  referenceDate: Date = new Date()
): { valid: boolean; message?: string } {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { valid: false, message: 'Appointment date must be a valid date in YYYY-MM-DD format.' };
  }

  const [y, m, d] = dateStr.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) {
    return { valid: false, message: 'Appointment date is not a valid calendar date.' };
  }

  const hospitalNow = getHospitalLocalDateTime(hospitalTz, referenceDate);
  if (dateStr < hospitalNow.dateStr) {
    return {
      valid: false,
      message: `Appointments cannot be scheduled for past dates. Today is ${hospitalNow.dateStr}.`,
    };
  }

  return { valid: true };
}

/**
 * Validates appointment time slot.
 * Rejects times outside clinic operating slots, and checks that today's slots have not already passed.
 */
export function validateAppointmentTimeSlot(
  rawTime: string,
  dateStr: string,
  hospitalTz?: string,
  referenceDate: Date = new Date()
): { valid: boolean; normalizedTime: string; message?: string } {
  if (!rawTime) {
    return { valid: false, normalizedTime: '', message: 'Appointment time is required.' };
  }

  const normalizedTime = rawTime.length > 5 ? rawTime.slice(0, 5) : rawTime.padStart(5, '0');
  if (!STANDARD_CLINIC_SLOTS.includes(normalizedTime)) {
    return {
      valid: false,
      normalizedTime,
      message: `Selected appointment time (${normalizedTime}) is outside clinic operating slots. Available slots: ${STANDARD_CLINIC_SLOTS.join(', ')}.`,
    };
  }

  const hospitalNow = getHospitalLocalDateTime(hospitalTz, referenceDate);
  if (dateStr === hospitalNow.dateStr) {
    const [slotH, slotM] = normalizedTime.split(':').map(Number);
    const [nowH, nowM] = hospitalNow.timeStr.split(':').map(Number);
    if (slotH * 60 + slotM <= nowH * 60 + nowM) {
      return {
        valid: false,
        normalizedTime,
        message: `Appointment time ${normalizedTime} has already passed for today. Please select a future time slot.`,
      };
    }
  }

  return { valid: true, normalizedTime };
}

/**
 * Resolves branch query filters for doctor directory search.
 * Matches against branch_id or full name.
 */
export function resolveBranchFilterValues(rawBranch?: string): string[] | null {
  if (!rawBranch) return null;
  const trimmed = rawBranch.trim();
  const matched = HOSPITAL_BRANCHES.find(
    (b) => b.branch_id === trimmed || b.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (matched) {
    return [matched.branch_id, matched.name, trimmed];
  }
  return [trimmed];
}

/**
 * Validates hospitalBranch input for doctor registration.
 * Allows null/undefined/empty string for backward compatibility.
 * When provided, validates against canonical branch IDs (BR-MAIN, BR-WEST, BR-CARD, BR-NEURO) or names.
 */
export function validateHospitalBranch(branchInput?: string | null): {
  valid: boolean;
  branchId: string | null;
  message?: string;
} {
  if (!branchInput || !branchInput.toString().trim()) {
    return { valid: true, branchId: null };
  }

  const cleanInput = branchInput.toString().trim();
  const matched = HOSPITAL_BRANCHES.find(
    (b) => b.branch_id === cleanInput || b.name.toLowerCase() === cleanInput.toLowerCase()
  );

  if (!matched) {
    return {
      valid: false,
      branchId: null,
      message: `Invalid hospital branch "${cleanInput}". Allowed branches: ${CANONICAL_BRANCH_IDS.join(', ')}.`,
    };
  }

  return { valid: true, branchId: matched.branch_id };
}
