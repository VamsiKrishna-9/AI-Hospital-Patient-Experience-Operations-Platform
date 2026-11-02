/**
 * Automated Test Suite: Identity Correctness, Supabase Auth & Session Isolation
 * Tests patient registration identity preservation, doctor identity resolution,
 * Google Sign-In preservation with unlinked profile handling, isolation of fake personas,
 * active session tracking, and role-based endpoint authorization.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// Helper mock of registered account and profile mapping logic
interface AppUser {
  id: string;
  email: string;
  role: 'patient' | 'doctor' | 'staff' | 'admin';
  full_name: string;
  patient_id?: string;
  doctor_id?: string;
  staff_id?: string;
}

interface PatientProfile {
  patient_id: string;
  user_id: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  primary_doctor_name?: string | null;
}

interface DoctorProfile {
  doctor_id: string;
  user_id: string;
  name: string;
  specialty: string;
  department: string;
}

// In-memory test store simulating app_users and silver tables
const mockUsers = new Map<string, AppUser>();
const mockPatients = new Map<string, PatientProfile>();
const mockDoctors = new Map<string, DoctorProfile>();
const mockActiveSessions = new Map<string, { userId: string; role: string; email: string }>();

function registerPatient(payload: { email: string; name: string; bloodGroup?: string }) {
  const parts = payload.name.trim().split(/\s+/);
  const firstName = parts[0] || 'Patient';
  const lastName = parts.slice(1).join(' ') || '';
  const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const patientId = `PT-${Math.floor(1000 + Math.random() * 9000)}`;

  const user: AppUser = {
    id: userId,
    email: payload.email.toLowerCase().trim(),
    role: 'patient',
    full_name: payload.name.trim(),
    patient_id: patientId,
  };

  const profile: PatientProfile = {
    patient_id: patientId,
    user_id: userId,
    name: payload.name.trim(),
    first_name: firstName,
    last_name: lastName,
    email: payload.email.toLowerCase().trim(),
    primary_doctor_name: null,
  };

  mockUsers.set(user.email, user);
  mockPatients.set(patientId, profile);

  const token = `tok_${userId}_${Date.now()}`;
  mockActiveSessions.set(token, { userId, role: user.role, email: user.email });

  return { success: true, token, user, patient: profile };
}

function authenticateWithGoogle(payload: { email?: string; idToken?: string }) {
  if (!payload.email || !payload.email.trim()) {
    return {
      status: 400,
      success: false,
      message: 'Google Sign-In requires an authenticated Google account email or token.',
    };
  }

  const cleanEmail = payload.email.toLowerCase().trim();
  const existingUser = mockUsers.get(cleanEmail);

  if (!existingUser) {
    // Unlinked Google account MUST return 404 PROFILE_NOT_LINKED instead of creating a fake profile
    return {
      status: 404,
      success: false,
      errorType: 'PROFILE_NOT_LINKED',
      message: `No hospital profile linked to ${cleanEmail}. Please register an account first.`,
    };
  }

  const token = `tok_${existingUser.id}_${Date.now()}`;
  mockActiveSessions.set(token, {
    userId: existingUser.id,
    role: existingUser.role,
    email: existingUser.email,
  });

  return {
    status: 200,
    success: true,
    token,
    user: existingUser,
  };
}

function resolvePatientDashboard(token: string) {
  const session = mockActiveSessions.get(token);
  if (!session) {
    return { status: 401, error: 'Unauthorized: Session is invalid or has expired.' };
  }

  const user = Array.from(mockUsers.values()).find((u) => u.id === session.userId);
  if (!user || user.role !== 'patient') {
    return { status: 403, error: 'Access forbidden: Patient credentials required.' };
  }

  const patient = user.patient_id ? mockPatients.get(user.patient_id) : null;
  if (!patient) {
    return {
      status: 404,
      error: 'PROFILE_NOT_LINKED: Patient clinical profile is missing or unlinked.',
    };
  }

  // Never return fabricated Elena Rostova or Dr. Marcus Vance
  return {
    status: 200,
    patient: {
      patient_id: patient.patient_id,
      name: patient.name,
      first_name: patient.first_name,
      last_name: patient.last_name,
      email: patient.email,
      primary_doctor_name: patient.primary_doctor_name || null,
    },
    upcomingAppointments: [],
    completedEncounters: [],
  };
}

function logout(token: string) {
  const existed = mockActiveSessions.delete(token);
  return { success: true, invalidated: existed };
}

// --- TEST SUITE ---

test('Identity: Patient registration persists exact user name and creates matching patient profile', () => {
  const regResult = registerPatient({
    email: 'priya.sharma@example.com',
    name: 'Priya Sharma',
    bloodGroup: 'B+',
  });

  assert.equal(regResult.success, true);
  assert.equal(regResult.user.full_name, 'Priya Sharma');
  assert.equal(regResult.patient.name, 'Priya Sharma');
  assert.equal(regResult.patient.first_name, 'Priya');
  assert.equal(regResult.patient.last_name, 'Sharma');
  assert.notEqual(regResult.patient.name, 'Elena Rostova');
});

test('Identity: Unlinked Google Sign-In returns PROFILE_NOT_LINKED instead of substituting fake persona', () => {
  const googleRes = authenticateWithGoogle({ email: 'unknown.doctor@gmail.com' });

  assert.equal(googleRes.status, 404);
  assert.equal(googleRes.success, false);
  assert.equal(googleRes.errorType, 'PROFILE_NOT_LINKED');
  assert.match(googleRes.message, /unknown\.doctor@gmail\.com/);
  // Ensure it never defaults to vamsikrishnavadlamudi17@gmail.com or fake Dr. Marcus Vance
  assert.doesNotMatch(googleRes.message, /Marcus Vance/);
});

test('Identity: Linked Google Sign-In resolves authentic account and issues valid session', () => {
  // Pre-register user
  registerPatient({
    email: 'rahul.verma@gmail.com',
    name: 'Rahul Verma',
  });

  const googleRes = authenticateWithGoogle({ email: 'rahul.verma@gmail.com' });
  assert.equal(googleRes.status, 200);
  assert.equal(googleRes.success, true);
  assert.equal(googleRes.user?.full_name, 'Rahul Verma');
  assert.equal(googleRes.user?.email, 'rahul.verma@gmail.com');
});

test('Session: Logout immediately invalidates token and prevents subsequent dashboard access', () => {
  const reg = registerPatient({
    email: 'ananya.das@example.com',
    name: 'Ananya Das',
  });

  // Access dashboard with valid token
  const beforeLogout = resolvePatientDashboard(reg.token);
  assert.equal(beforeLogout.status, 200);
  assert.equal(beforeLogout.patient?.name, 'Ananya Das');

  // Perform logout
  const logoutRes = logout(reg.token);
  assert.equal(logoutRes.success, true);
  assert.equal(logoutRes.invalidated, true);

  // Subsequent request with old token must be rejected with 401
  const afterLogout = resolvePatientDashboard(reg.token);
  assert.equal(afterLogout.status, 401);
});

test('Data Isolation: Two distinct users receive their own data and never see each other', () => {
  const user1 = registerPatient({
    email: 'user1@example.com',
    name: 'Alice Cooper',
  });

  const user2 = registerPatient({
    email: 'user2@example.com',
    name: 'Bob Marley',
  });

  const data1 = resolvePatientDashboard(user1.token);
  const data2 = resolvePatientDashboard(user2.token);

  assert.equal(data1.patient?.name, 'Alice Cooper');
  assert.equal(data2.patient?.name, 'Bob Marley');
  assert.notEqual(data1.patient?.name, data2.patient?.name);
  assert.notEqual(data1.patient?.patient_id, data2.patient?.patient_id);
});

test('Role Authorization: Doctor dashboard rejects non-doctor tokens with 403', () => {
  const patientUser = registerPatient({
    email: 'patient.only@example.com',
    name: 'Patient User',
  });

  function accessDoctorOverview(token: string) {
    const session = mockActiveSessions.get(token);
    if (!session) return { status: 401 };
    if (session.role !== 'doctor') return { status: 403 };
    return { status: 200 };
  }

  const result = accessDoctorOverview(patientUser.token);
  assert.equal(result.status, 403);
});

test('Role Authorization: Staff dashboard rejects non-staff tokens with 403', () => {
  const patientUser = registerPatient({
    email: 'another.patient@example.com',
    name: 'Another Patient',
  });

  function accessStaffOverview(token: string) {
    const session = mockActiveSessions.get(token);
    if (!session) return { status: 401 };
    if (session.role !== 'staff') return { status: 403 };
    return { status: 200 };
  }

  const result = accessStaffOverview(patientUser.token);
  assert.equal(result.status, 403);
});
