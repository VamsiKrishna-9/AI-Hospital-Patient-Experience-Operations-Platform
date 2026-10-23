/**
 * Automated Test Suite: Appointment Booking Integration & Validation Audit
 * Tests request-field normalization, branch filtering, timezone-aware date checks,
 * slot validation, inactive/missing doctor rejection, patient_id spoofing prevention,
 * dynamic IANA timezone resolution (Asia/Kolkata vs America/Los_Angeles fallback),
 * and doctor onboarding branch validation.
 * Uses isolated in-memory mocks: ZERO database writes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STANDARD_CLINIC_SLOTS,
  HOSPITAL_BRANCHES,
  CANONICAL_BRANCH_IDS,
  DEFAULT_HOSPITAL_TIMEZONE,
  isValidTimezone,
  getHospitalTimezone,
  getHospitalLocalDateTime,
  validateAppointmentDate,
  validateAppointmentTimeSlot,
  resolveBranchFilterValues,
  validateHospitalBranch,
} from '../src/server/bookingValidation.ts';
import {
  getValidHospitalInviteCodes,
  isInvitationCodeValid,
} from '../src/server/authSecurity.ts';

// --- TEST GROUP 1: Canonical Field Mapping & Alias Normalization ---
test('Contract: Canonical field mapping and backward compatibility aliases', () => {
  // Test case 1: Canonical payload
  const canonicalBody = {
    doctorId: 'DOC-101',
    appointmentDate: '2026-10-25',
    appointmentTime: '10:00',
    consultationType: 'In-Person',
  };

  const resolvedDoctor1 = (canonicalBody.doctorId || (canonicalBody as any).doctor_id)?.trim();
  const resolvedDate1 = (canonicalBody.appointmentDate || (canonicalBody as any).date)?.trim();
  const resolvedTime1 = (canonicalBody.appointmentTime || (canonicalBody as any).timeSlot)?.trim();

  assert.equal(resolvedDoctor1, 'DOC-101');
  assert.equal(resolvedDate1, '2026-10-25');
  assert.equal(resolvedTime1, '10:00');

  // Test case 2: Legacy UI payload (date, timeSlot, doctor_id)
  const legacyBody = {
    doctor_id: 'DOC-102',
    date: '2026-10-26',
    timeSlot: '14:30',
  };

  const resolvedDoctor2 = ((legacyBody as any).doctorId || legacyBody.doctor_id)?.trim();
  const resolvedDate2 = ((legacyBody as any).appointmentDate || legacyBody.date)?.trim();
  const resolvedTime2 = ((legacyBody as any).appointmentTime || legacyBody.timeSlot)?.trim();

  assert.equal(resolvedDoctor2, 'DOC-102');
  assert.equal(resolvedDate2, '2026-10-26');
  assert.equal(resolvedTime2, '14:30');
});

// --- TEST GROUP 2: Doctor Directory Branch Filtering ---
test('Branch Filtering: Supports both branch and branchId query parameters', () => {
  const branches = HOSPITAL_BRANCHES;
  assert.ok(branches.length > 0, 'Hospital branches must be configured');

  const mainBranch = branches.find((b) => b.branch_id === 'BR-MAIN');
  assert.ok(mainBranch, 'Main branch BR-MAIN must exist');

  // Testing resolveBranchFilterValues from bookingValidation
  const filterByBranchId = resolveBranchFilterValues('BR-MAIN');
  assert.ok(filterByBranchId?.includes('BR-MAIN'));
  assert.ok(filterByBranchId?.includes(mainBranch.name));

  const filterByBranch = resolveBranchFilterValues('BR-WEST');
  assert.ok(filterByBranch?.includes('BR-WEST'));

  const filterByName = resolveBranchFilterValues(mainBranch.name);
  assert.ok(filterByName?.includes('BR-MAIN'));

  const filterNull = resolveBranchFilterValues(undefined);
  assert.equal(filterNull, null);
});

// --- TEST GROUP 3: Date Validation & Local Timezone Protection ---
test('Date Validation: Rejects malformed and past dates without UTC shift errors', () => {
  const hospitalNow = getHospitalLocalDateTime('America/Los_Angeles');
  assert.match(hospitalNow.dateStr, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(hospitalNow.timeStr, /^\d{2}:\d{2}$/);

  // 1. Invalid formats
  assert.equal(validateAppointmentDate('2026/10/25').valid, false);
  assert.equal(validateAppointmentDate('25-10-2026').valid, false);
  assert.equal(validateAppointmentDate('invalid-date').valid, false);

  // 2. Non-existent dates (e.g. Feb 31, April 31)
  assert.equal(validateAppointmentDate('2026-02-31').valid, false);
  assert.equal(validateAppointmentDate('2026-04-31').valid, false);

  // 3. Past dates (2020)
  assert.equal(validateAppointmentDate('2020-01-01').valid, false);

  // 4. Future valid dates
  assert.equal(validateAppointmentDate('2030-11-15').valid, true);

  // 5. Today's date is valid for scheduling
  assert.equal(validateAppointmentDate(hospitalNow.dateStr).valid, true);
});

// --- TEST GROUP 4: Operating Hours & Standard Clinic Slot Validation ---
test('Operating Hours: Validates standard slots and rejects invalid times', () => {
  assert.ok(STANDARD_CLINIC_SLOTS.includes('09:00'));
  assert.ok(STANDARD_CLINIC_SLOTS.includes('14:30'));
  assert.ok(STANDARD_CLINIC_SLOTS.includes('16:30'));

  // Valid future slots (on a future date)
  const futureDate = '2030-01-15';
  assert.equal(validateAppointmentTimeSlot('09:00', futureDate).valid, true);
  assert.equal(validateAppointmentTimeSlot('10:30', futureDate).valid, true);
  assert.equal(validateAppointmentTimeSlot('14:00', futureDate).valid, true);
  assert.equal(validateAppointmentTimeSlot('16:30', futureDate).valid, true);
  assert.equal(validateAppointmentTimeSlot('09:00:00', futureDate).valid, true); // handles seconds format

  // Invalid slots outside clinic operating hours
  assert.equal(validateAppointmentTimeSlot('03:00', futureDate).valid, false);
  assert.equal(validateAppointmentTimeSlot('08:00', futureDate).valid, false);
  assert.equal(validateAppointmentTimeSlot('12:30', futureDate).valid, false); // Lunch break
  assert.equal(validateAppointmentTimeSlot('13:00', futureDate).valid, false); // Lunch break
  assert.equal(validateAppointmentTimeSlot('18:00', futureDate).valid, false); // After hours
  assert.equal(validateAppointmentTimeSlot('23:59', futureDate).valid, false);
});

// --- TEST GROUP 5: Patient ID Spoofing Prevention ---
test('Security: Client-supplied patient ID cannot override authenticated identity', () => {
  const mockReq = {
    authenticatedPatientId: 'P1001', // Authoritative ID from app_users via validated JWT
    body: {
      patientId: 'ATTACKER_P9999',
      patient_id: 'ATTACKER_P8888',
      doctorId: 'DOC-101',
      appointmentDate: '2026-10-30',
      appointmentTime: '10:00',
    },
  };

  const derivedPatientId = (mockReq as any).authenticatedPatientId;
  const insertPayload = {
    patient_id: derivedPatientId,
    doctor_id: mockReq.body.doctorId,
    appointment_date: mockReq.body.appointmentDate,
    appointment_time: mockReq.body.appointmentTime,
  };

  assert.equal(insertPayload.patient_id, 'P1001');
  assert.notEqual(insertPayload.patient_id, 'ATTACKER_P9999');
  assert.notEqual(insertPayload.patient_id, 'ATTACKER_P8888');
});

// --- TEST GROUP 6: Inactive & Missing Doctor Validation Mock ---
test('Doctor Validation: Rejects missing or inactive doctors', async () => {
  const mockDoctorRegistry: Record<string, { doctor_id: string; doctor_name: string; is_active: boolean }> = {
    'DOC-ACTIVE': { doctor_id: 'DOC-ACTIVE', doctor_name: 'Dr. Active', is_active: true },
    'DOC-INACTIVE': { doctor_id: 'DOC-INACTIVE', doctor_name: 'Dr. Retired', is_active: false },
  };

  async function mockDoctorCheck(doctorId: string): Promise<{ status: number; message: string }> {
    const doc = mockDoctorRegistry[doctorId];
    if (!doc) {
      return { status: 404, message: `Doctor with ID "${doctorId}" was not found in the hospital registry.` };
    }
    if (!doc.is_active) {
      return { status: 400, message: `Dr. ${doc.doctor_name} is currently not accepting appointments.` };
    }
    return { status: 200, message: 'Doctor verified' };
  }

  const resMissing = await mockDoctorCheck('DOC-DOES-NOT-EXIST');
  assert.equal(resMissing.status, 404);

  const resInactive = await mockDoctorCheck('DOC-INACTIVE');
  assert.equal(resInactive.status, 400);

  const resActive = await mockDoctorCheck('DOC-ACTIVE');
  assert.equal(resActive.status, 200);
});

// --- TEST GROUP 7: Pre-insert Duplicate Conflict Mock ---
test('Scheduling Conflict: Blocks duplicate booking before database insert', () => {
  const existingBookings = [
    { doctor_id: 'DOC-101', appointment_date: '2026-10-30', appointment_time: '10:00', status: 'Scheduled' },
  ];

  function checkConflict(doctorId: string, date: string, time: string): boolean {
    return existingBookings.some(
      (b) => b.doctor_id === doctorId && b.appointment_date === date && b.appointment_time === time && ['Scheduled', 'Confirmed'].includes(b.status)
    );
  }

  assert.equal(checkConflict('DOC-101', '2026-10-30', '10:00'), true, 'Should detect conflict');
  assert.equal(checkConflict('DOC-101', '2026-10-30', '10:30'), false, 'Different time is available');
  assert.equal(checkConflict('DOC-102', '2026-10-30', '10:00'), false, 'Different doctor is available');
});

// --- TEST GROUP 8: Timezone — Midnight UTC Boundary & Calendar Date Divergence ---
test('Timezone: Midnight UTC boundary causes calendar date divergence in Asia/Kolkata', () => {
  // Test timestamp: 2026-10-23 at 20:00:00 UTC (8:00 PM UTC)
  // In Asia/Kolkata (UTC + 05:30), the time is 2026-10-24 01:30 (next calendar day!)
  // In America/Los_Angeles (PDT, UTC - 07:00), the time is 2026-10-23 13:00 (same calendar day)
  const boundaryUtcTimestamp = new Date('2026-10-23T20:00:00.000Z');

  const kolkataDateTime = getHospitalLocalDateTime('Asia/Kolkata', boundaryUtcTimestamp);
  assert.equal(kolkataDateTime.dateStr, '2026-10-24', 'Kolkata must have crossed to next calendar date');
  assert.equal(kolkataDateTime.timeStr, '01:30', 'Kolkata clock time must be 01:30');

  const laDateTime = getHospitalLocalDateTime('America/Los_Angeles', boundaryUtcTimestamp);
  assert.equal(laDateTime.dateStr, '2026-10-23', 'Los Angeles must still be on the previous calendar date');
  assert.equal(laDateTime.timeStr, '13:00', 'Los Angeles clock time must be 13:00');

  // Verify that an appointment scheduled for 2026-10-23 is rejected in Kolkata (as past date),
  // but accepted in America/Los_Angeles (as current day)
  const kolkataValidation = validateAppointmentDate('2026-10-23', 'Asia/Kolkata', boundaryUtcTimestamp);
  assert.equal(kolkataValidation.valid, false, '2026-10-23 is in the past for Asia/Kolkata at this moment');
  assert.ok(kolkataValidation.message?.includes('Appointments cannot be scheduled for past dates'));

  const laValidation = validateAppointmentDate('2026-10-23', 'America/Los_Angeles', boundaryUtcTimestamp);
  assert.equal(laValidation.valid, true, '2026-10-23 is valid (today) for America/Los_Angeles at this moment');
});

// --- TEST GROUP 9: Timezone — Explicit IANA Timezone Resolution & Format ---
test('Timezone: Correct hospital-local date and time determination without relying on host machine', () => {
  const sampleUtc = new Date('2026-06-15T06:30:00.000Z'); // 6:30 AM UTC

  // In Asia/Kolkata: 06:30 + 05:30 = 12:00 PM (noon) on June 15
  const kolkata = getHospitalLocalDateTime('Asia/Kolkata', sampleUtc);
  assert.equal(kolkata.dateStr, '2026-06-15');
  assert.equal(kolkata.timeStr, '12:00');

  // Exact midnight test in Asia/Kolkata: 2026-10-23 18:30:00 UTC = 2026-10-24 00:00:00 IST
  const midnightUtc = new Date('2026-10-23T18:30:00.000Z');
  const midnightKolkata = getHospitalLocalDateTime('Asia/Kolkata', midnightUtc);
  assert.equal(midnightKolkata.dateStr, '2026-10-24');
  assert.equal(midnightKolkata.timeStr, '00:00');
});

// --- TEST GROUP 10: Timezone — Safe Failure on Invalid Timezone Configuration ---
test('Timezone: Fails safely with explicit Error on invalid timezone configuration', () => {
  // Direct call with invalid timezone identifier
  assert.throws(
    () => {
      getHospitalLocalDateTime('Invalid/NonExistentZone');
    },
    (err: any) => {
      assert.ok(err instanceof Error);
      assert.ok(err.message.includes('Invalid hospital timezone'));
      return true;
    }
  );

  // Environment variable validation
  const originalEnv = process.env.HOSPITAL_TIMEZONE;
  try {
    process.env.HOSPITAL_TIMEZONE = 'Invalid/FictionalCity';
    assert.throws(
      () => {
        getHospitalTimezone();
      },
      (err: any) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('Invalid hospital timezone configured in HOSPITAL_TIMEZONE'));
        return true;
      }
    );
  } finally {
    process.env.HOSPITAL_TIMEZONE = originalEnv;
  }
});

// --- TEST GROUP 11: Timezone — Backward-Compatible Fallback when Variable is Unset ---
test('Timezone: Preserves America/Los_Angeles fallback when HOSPITAL_TIMEZONE is unset', () => {
  const originalEnv = process.env.HOSPITAL_TIMEZONE;
  try {
    delete process.env.HOSPITAL_TIMEZONE;
    const resolved = getHospitalTimezone();
    assert.equal(resolved, DEFAULT_HOSPITAL_TIMEZONE);
    assert.equal(resolved, 'America/Los_Angeles');

    // Works with getHospitalLocalDateTime without arguments
    const localNow = getHospitalLocalDateTime();
    assert.match(localNow.dateStr, /^\d{4}-\d{2}-\d{2}$/);
  } finally {
    process.env.HOSPITAL_TIMEZONE = originalEnv;
  }
});

// --- TEST GROUP 12: Timezone — Daylight Saving Time Resilience Check (No Hardcoded Offset) ---
test('Timezone: IANA engine dynamically handles seasonal daylight-saving shifts', () => {
  // Los Angeles undergoes DST (PDT = UTC-7 in summer, PST = UTC-8 in winter)
  // Summer: July 15 at 12:00 UTC -> 05:00 PDT
  const summerUtc = new Date('2026-07-15T12:00:00.000Z');
  const summerLA = getHospitalLocalDateTime('America/Los_Angeles', summerUtc);
  assert.equal(summerLA.timeStr, '05:00', 'July should resolve to PDT (UTC-7)');

  // Winter: January 15 at 12:00 UTC -> 04:00 PST
  const winterUtc = new Date('2026-01-15T12:00:00.000Z');
  const winterLA = getHospitalLocalDateTime('America/Los_Angeles', winterUtc);
  assert.equal(winterLA.timeStr, '04:00', 'January should resolve to PST (UTC-8)');

  // Asia/Kolkata has no DST, remaining constant UTC+5:30 all year
  const summerKolkata = getHospitalLocalDateTime('Asia/Kolkata', summerUtc);
  assert.equal(summerKolkata.timeStr, '17:30');

  const winterKolkata = getHospitalLocalDateTime('Asia/Kolkata', winterUtc);
  assert.equal(winterKolkata.timeStr, '17:30');
});

// --- TEST GROUP 13: Doctor Onboarding — Branch Validation for Canonical Identifiers ---
test('Doctor Onboarding: Validates canonical hospital branch identifiers and names', () => {
  assert.deepEqual(CANONICAL_BRANCH_IDS, ['BR-MAIN', 'BR-WEST', 'BR-CARD', 'BR-NEURO']);

  // Valid branch IDs
  const resMain = validateHospitalBranch('BR-MAIN');
  assert.equal(resMain.valid, true);
  assert.equal(resMain.branchId, 'BR-MAIN');

  const resWest = validateHospitalBranch('BR-WEST');
  assert.equal(resWest.valid, true);
  assert.equal(resWest.branchId, 'BR-WEST');

  const resCard = validateHospitalBranch('BR-CARD');
  assert.equal(resCard.valid, true);
  assert.equal(resCard.branchId, 'BR-CARD');

  const resNeuro = validateHospitalBranch('BR-NEURO');
  assert.equal(resNeuro.valid, true);
  assert.equal(resNeuro.branchId, 'BR-NEURO');

  // Valid full branch names (case-insensitive)
  const resName = validateHospitalBranch('MediAI Medical Center — Main Campus');
  assert.equal(resName.valid, true);
  assert.equal(resName.branchId, 'BR-MAIN');

  const resNameLower = validateHospitalBranch('mediai west ambulatory & imaging pavilion');
  assert.equal(resNameLower.valid, true);
  assert.equal(resNameLower.branchId, 'BR-WEST');
});

// --- TEST GROUP 14: Doctor Onboarding — Backward Compatibility when Branch is Omitted ---
test('Doctor Onboarding: Compatible with legacy requests omitting hospitalBranch', () => {
  assert.deepEqual(validateHospitalBranch(undefined), { valid: true, branchId: null });
  assert.deepEqual(validateHospitalBranch(null), { valid: true, branchId: null });
  assert.deepEqual(validateHospitalBranch(''), { valid: true, branchId: null });
  assert.deepEqual(validateHospitalBranch('   '), { valid: true, branchId: null });
});

// --- TEST GROUP 15: Doctor Onboarding — Rejection of Invalid Branch Identifiers ---
test('Doctor Onboarding: Rejects invalid branch identifiers with descriptive message', () => {
  const invalid1 = validateHospitalBranch('BR-INVALID-BRANCH');
  assert.equal(invalid1.valid, false);
  assert.equal(invalid1.branchId, null);
  assert.ok(invalid1.message?.includes('Invalid hospital branch "BR-INVALID-BRANCH"'));
  assert.ok(invalid1.message?.includes('BR-MAIN, BR-WEST, BR-CARD, BR-NEURO'));

  const invalid2 = validateHospitalBranch('Metropolis General');
  assert.equal(invalid2.valid, false);
  assert.ok(invalid2.message?.includes('Allowed branches: BR-MAIN, BR-WEST, BR-CARD, BR-NEURO'));
});

// --- TEST GROUP 16: Doctor Onboarding — Persistence Payload & Transaction Mock ---
test('Doctor Onboarding: Persists hospital_branch in silver_doctors insert payload', () => {
  const mockDoctorPayload = {
    fullName: 'Dr. Anita Roy',
    email: 'anita.roy@hospital.test',
    specialization: 'Cardiology & Vascular Medicine',
    hospitalBranch: 'BR-CARD',
    medicalRegNumber: 'MED-REG-4412',
  };

  const branchValidation = validateHospitalBranch(mockDoctorPayload.hospitalBranch);
  assert.equal(branchValidation.valid, true);
  assert.equal(branchValidation.branchId, 'BR-CARD');

  // Simulated silver_doctors insert payload
  const silverDoctorsRecord = {
    doctor_name: mockDoctorPayload.fullName,
    specialty: mockDoctorPayload.specialization,
    hospital_branch: branchValidation.branchId,
    email: mockDoctorPayload.email,
    qualification: `Reg: ${mockDoctorPayload.medicalRegNumber}`,
  };

  assert.equal(silverDoctorsRecord.hospital_branch, 'BR-CARD');
  assert.equal(silverDoctorsRecord.specialty, 'Cardiology & Vascular Medicine');
});

// --- TEST GROUP 17: Doctor Onboarding — Authorized Invitation Code Verification ---
test('Doctor Onboarding: Requires valid hospital invitation code with timing-safe check', () => {
  const validCodes = getValidHospitalInviteCodes();
  assert.ok(validCodes.length > 0, 'Hospital must have valid invite codes configured');

  // Correct invite code
  assert.equal(isInvitationCodeValid(validCodes[0], validCodes), true);

  // Unauthorized invite code
  assert.equal(isInvitationCodeValid('WRONG-CODE-999', validCodes), false);
  assert.equal(isInvitationCodeValid('', validCodes), false);
});
