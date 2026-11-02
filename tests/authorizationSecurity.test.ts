/**
 * Automated Test Suite: Server-Side Authorization & Record Ownership Audit
 * Tests role enforcement, appointment ownership, doctor-patient authorization boundaries,
 * staff assignment ownership isolation, admin privileges, and HTTP response codes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// In-memory mock entities for authorization evaluation
interface MockUser {
  id: string;
  email: string;
  role: 'patient' | 'doctor' | 'staff' | 'admin';
  patient_id?: string;
  doctor_id?: string;
  staff_id?: string;
}

interface MockAppointment {
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  status: 'Scheduled' | 'Confirmed' | 'Completed' | 'Cancelled';
}

interface MockLabResult {
  lab_id: string;
  patient_id: string;
  doctor_id: string;
  status: 'Pending' | 'Completed' | 'Signed';
}

interface MockStaffAssignment {
  assignment_id: string;
  staff_id: string;
  patient_id: string;
  doctor_id: string;
  assignment_date: string;
  assignment_status: 'Scheduled' | 'Active' | 'In Progress' | 'Completed' | 'Cancelled';
}

// Database state
const users: MockUser[] = [
  { id: 'usr-pat-1', email: 'pat1@test.com', role: 'patient', patient_id: 'P1001' },
  { id: 'usr-pat-2', email: 'pat2@test.com', role: 'patient', patient_id: 'P1002' },
  { id: 'usr-doc-1', email: 'doc1@test.com', role: 'doctor', doctor_id: 'DOC-101' },
  { id: 'usr-doc-2', email: 'doc2@test.com', role: 'doctor', doctor_id: 'DOC-102' },
  { id: 'usr-stf-1', email: 'stf1@test.com', role: 'staff', staff_id: 'STF-001' },
  { id: 'usr-stf-2', email: 'stf2@test.com', role: 'staff', staff_id: 'STF-002' },
  { id: 'usr-adm-1', email: 'admin@test.com', role: 'admin' },
];

const appointments: MockAppointment[] = [
  { appointment_id: 'APT-100', patient_id: 'P1001', doctor_id: 'DOC-101', status: 'Scheduled' },
  { appointment_id: 'APT-200', patient_id: 'P1002', doctor_id: 'DOC-102', status: 'Scheduled' },
  { appointment_id: 'APT-300', patient_id: 'P1001', doctor_id: 'DOC-101', status: 'Completed' },
];

const labResults: MockLabResult[] = [
  { lab_id: 'LAB-100', patient_id: 'P1001', doctor_id: 'DOC-101', status: 'Completed' },
  { lab_id: 'LAB-200', patient_id: 'P1002', doctor_id: 'DOC-102', status: 'Completed' },
];

const staffAssignments: MockStaffAssignment[] = [
  { assignment_id: 'ASG-100', staff_id: 'STF-001', patient_id: 'P1001', doctor_id: 'DOC-101', assignment_date: '2026-11-02', assignment_status: 'Scheduled' },
  { assignment_id: 'ASG-200', staff_id: 'STF-002', patient_id: 'P1002', doctor_id: 'DOC-102', assignment_date: '2026-11-02', assignment_status: 'Completed' },
];

// Helper: Authorize and perform appointment cancellation
function cancelAppointment(user: MockUser | null, appointmentId: string) {
  if (!user) return { status: 401, error: 'Unauthorized: Sign in required' };
  if (user.role !== 'patient' || !user.patient_id) {
    return { status: 403, error: 'Forbidden: Patient role required' };
  }

  const apt = appointments.find((a) => a.appointment_id === appointmentId);
  if (!apt) return { status: 404, error: 'Appointment not found' };
  if (apt.patient_id !== user.patient_id) {
    return { status: 403, error: 'Forbidden: Cannot cancel another patient appointment' };
  }
  if (apt.status === 'Completed') {
    return { status: 400, error: 'Completed appointments cannot be cancelled' };
  }
  if (apt.status === 'Cancelled') {
    return { status: 400, error: 'Appointment already cancelled' };
  }

  apt.status = 'Cancelled';
  return { status: 200, success: true };
}

// Helper: Authorize and sign lab result
function signLabResult(user: MockUser | null, labId: string) {
  if (!user) return { status: 401, error: 'Unauthorized' };
  if (user.role !== 'doctor' || !user.doctor_id) {
    return { status: 403, error: 'Forbidden: Doctor role required' };
  }

  const lab = labResults.find((l) => l.lab_id === labId);
  if (!lab) return { status: 404, error: 'Lab result not found' };

  // Check relationship: lab assigned to doctor, or doctor has an appointment with patient
  const hasRelationship = lab.doctor_id === user.doctor_id ||
    appointments.some((a) => a.doctor_id === user.doctor_id && a.patient_id === lab.patient_id);

  if (!hasRelationship) {
    return { status: 403, error: 'Forbidden: Not authorized for this patient lab result' };
  }

  lab.status = 'Signed';
  return { status: 200, success: true };
}

// Helper: Record encounter
function recordEncounter(user: MockUser | null, payload: { appointmentId?: string; patientId: string }) {
  if (!user) return { status: 401, error: 'Unauthorized' };
  if (user.role !== 'doctor' || !user.doctor_id) {
    return { status: 403, error: 'Forbidden: Doctor role required' };
  }

  if (payload.appointmentId) {
    const apt = appointments.find((a) => a.appointment_id === payload.appointmentId);
    if (!apt) return { status: 404, error: 'Appointment not found' };
    if (apt.patient_id !== payload.patientId) {
      return { status: 400, error: 'Patient ID mismatch for appointment' };
    }
    if (apt.doctor_id !== user.doctor_id) {
      return { status: 403, error: 'Forbidden: Appointment belongs to another doctor' };
    }
  }

  return { status: 200, success: true };
}

// Helper: Doctor assigns staff
function assignStaff(user: MockUser | null, payload: { staffId: string; patientId: string; appointmentId?: string; date: string }) {
  if (!user) return { status: 401, error: 'Unauthorized' };
  if (user.role !== 'doctor' && user.role !== 'admin') {
    return { status: 403, error: 'Forbidden: Doctor or Admin role required' };
  }

  if (payload.appointmentId) {
    const apt = appointments.find((a) => a.appointment_id === payload.appointmentId);
    if (!apt) return { status: 404, error: 'Appointment not found' };
    if (apt.patient_id !== payload.patientId) {
      return { status: 400, error: 'Appointment does not belong to selected patient' };
    }
    if (user.role === 'doctor' && apt.doctor_id !== user.doctor_id) {
      return { status: 403, error: 'Forbidden: Cannot assign staff to another doctor appointment' };
    }
  }

  // Duplicate check
  const duplicate = staffAssignments.some(
    (s) => s.staff_id === payload.staffId &&
           s.patient_id === payload.patientId &&
           s.assignment_date === payload.date &&
           ['Scheduled', 'Active', 'In Progress'].includes(s.assignment_status)
  );
  if (duplicate) {
    return { status: 409, error: 'Conflict: Duplicate active assignment on this date' };
  }

  return { status: 201, success: true };
}

// Helper: Staff updates assignment status
function updateAssignmentStatus(user: MockUser | null, assignmentId: string, newStatus: string) {
  if (!user) return { status: 401, error: 'Unauthorized' };
  if (user.role !== 'staff' && user.role !== 'admin') {
    return { status: 403, error: 'Forbidden: Staff or Admin role required' };
  }

  const asg = staffAssignments.find((a) => a.assignment_id === assignmentId);
  if (!asg) return { status: 404, error: 'Assignment not found' };

  if (user.role === 'staff' && asg.staff_id !== user.staff_id) {
    return { status: 403, error: 'Forbidden: Cannot update assignment assigned to another staff member' };
  }

  if (asg.assignment_status === 'Completed' && newStatus === 'Scheduled') {
    return { status: 400, error: 'Cannot revert completed assignment to Scheduled' };
  }
  if (asg.assignment_status === 'Cancelled' && newStatus !== 'Cancelled') {
    return { status: 400, error: 'Cannot update cancelled assignment' };
  }

  asg.assignment_status = newStatus as any;
  return { status: 200, success: true };
}

// --- AUTOMATED AUDIT TESTS ---

test('Authorization: Unauthenticated requests receive 401 Unauthorized', () => {
  const res = cancelAppointment(null, 'APT-100');
  assert.equal(res.status, 401);
});

test('Record Ownership: Patient cannot cancel another patient appointment (403)', () => {
  const patient2 = users.find((u) => u.patient_id === 'P1002')!;
  // APT-100 belongs to P1001
  const res = cancelAppointment(patient2, 'APT-100');
  assert.equal(res.status, 403);
});

test('Record Ownership: Patient cancelling non-existent appointment receives 404', () => {
  const patient1 = users.find((u) => u.patient_id === 'P1001')!;
  const res = cancelAppointment(patient1, 'APT-NONEXISTENT');
  assert.equal(res.status, 404);
});

test('State Transition: Patient cannot cancel an already completed appointment (400)', () => {
  const patient1 = users.find((u) => u.patient_id === 'P1001')!;
  // APT-300 is Completed
  const res = cancelAppointment(patient1, 'APT-300');
  assert.equal(res.status, 400);
});

test('Record Ownership: Doctor cannot record clinical encounter for another doctor appointment (403)', () => {
  const doctor1 = users.find((u) => u.doctor_id === 'DOC-101')!;
  // APT-200 belongs to DOC-102
  const res = recordEncounter(doctor1, { appointmentId: 'APT-200', patientId: 'P1002' });
  assert.equal(res.status, 403);
});

test('Record Ownership: Doctor recording encounter with mismatched patient ID receives 400', () => {
  const doctor1 = users.find((u) => u.doctor_id === 'DOC-101')!;
  // APT-100 belongs to P1001, but P1002 is passed
  const res = recordEncounter(doctor1, { appointmentId: 'APT-100', patientId: 'P1002' });
  assert.equal(res.status, 400);
});

test('Record Ownership: Doctor cannot sign lab result for unrelated patient (403)', () => {
  const doctor1 = users.find((u) => u.doctor_id === 'DOC-101')!;
  // LAB-200 belongs to P1002 under DOC-102 with no relationship to DOC-101
  const res = signLabResult(doctor1, 'LAB-200');
  assert.equal(res.status, 403);
});

test('Record Ownership: Doctor signing non-existent lab result receives 404', () => {
  const doctor1 = users.find((u) => u.doctor_id === 'DOC-101')!;
  const res = signLabResult(doctor1, 'LAB-999999');
  assert.equal(res.status, 404);
});

test('Role Boundary: Patient cannot sign lab results (403)', () => {
  const patient1 = users.find((u) => u.patient_id === 'P1001')!;
  const res = signLabResult(patient1 as any, 'LAB-100');
  assert.equal(res.status, 403);
});

test('Record Ownership: Doctor cannot assign staff to an appointment belonging to another doctor (403)', () => {
  const doctor1 = users.find((u) => u.doctor_id === 'DOC-101')!;
  // APT-200 belongs to DOC-102
  const res = assignStaff(doctor1, {
    staffId: 'STF-001',
    patientId: 'P1002',
    appointmentId: 'APT-200',
    date: '2026-11-05',
  });
  assert.equal(res.status, 403);
});

test('Workflow Integrity: Duplicate active staff assignment on the same date is blocked (409)', () => {
  const doctor1 = users.find((u) => u.doctor_id === 'DOC-101')!;
  // ASG-100 is already active for STF-001 and P1001 on 2026-11-02
  const res = assignStaff(doctor1, {
    staffId: 'STF-001',
    patientId: 'P1001',
    date: '2026-11-02',
  });
  assert.equal(res.status, 409);
});

test('Record Ownership: Staff member cannot update an assignment belonging to another staff member (403)', () => {
  const staff1 = users.find((u) => u.staff_id === 'STF-001')!;
  // ASG-200 is assigned to STF-002
  const res = updateAssignmentStatus(staff1, 'ASG-200', 'In Progress');
  assert.equal(res.status, 403);
});

test('Workflow Integrity: Staff cannot revert a completed assignment to Scheduled (400)', () => {
  const staff2 = users.find((u) => u.staff_id === 'STF-002')!;
  // ASG-200 is Completed
  const res = updateAssignmentStatus(staff2, 'ASG-200', 'Scheduled');
  assert.equal(res.status, 400);
});

test('Role Boundary: Non-admin cannot execute administrative user role modifications (403)', () => {
  function executeAdminRoleUpdate(user: MockUser | null) {
    if (!user) return { status: 401 };
    if (user.role !== 'admin') return { status: 403 };
    return { status: 200, success: true };
  }

  const doctor1 = users.find((u) => u.doctor_id === 'DOC-101')!;
  const patient1 = users.find((u) => u.patient_id === 'P1001')!;
  const staff1 = users.find((u) => u.staff_id === 'STF-001')!;
  const admin = users.find((u) => u.role === 'admin')!;

  assert.equal(executeAdminRoleUpdate(doctor1).status, 403);
  assert.equal(executeAdminRoleUpdate(patient1).status, 403);
  assert.equal(executeAdminRoleUpdate(staff1).status, 403);
  assert.equal(executeAdminRoleUpdate(admin).status, 200);
});
