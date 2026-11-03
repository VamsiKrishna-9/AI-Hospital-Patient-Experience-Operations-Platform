/**
 * Comprehensive Patient Dashboard Authentication & Token Refresh Test Suite
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function runPatientAuthTests() {
  console.log('======================================================================');
  console.log('   MediAI Hospital - Patient Auth & Session Lifecycle Test Suite');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, title: string, details?: any) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test ${total}: ${title}`);
      if (details) console.log(`         -> ${details}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test ${total}: ${title}`);
      if (details) console.error(`         -> Details:`, details);
      process.exitCode = 1;
    }
  }

  // 1. Register a Patient in live Supabase Auth and public.app_users
  console.log('--- Phase 1: Patient Registration in Supabase ---');
  const timestamp = Date.now();
  const testPatientEmail = `patient.session.test.${timestamp}@patient.mediai.health`;
  const testPassword = 'SecurePassword@2026';
  let patientId = '';

  try {
    const regRes = await fetch(`${BASE_URL}/api/auth/common-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Jane Session Test',
        email: testPatientEmail,
        phone: '+1 (555) 789-0123',
        dateOfBirth: '1992-04-12',
        password: testPassword,
        confirmPassword: testPassword,
        role: 'patient',
      }),
    });
    const regData: any = await regRes.json();
    assert(regRes.status === 200 && regData.success === true, 'Patient registers successfully in Supabase');
    assert(regData.role === 'patient', `Registered role is 'patient'`);
    assert(typeof regData.patientId === 'string' && regData.patientId.startsWith('P'), `Allocated Patient ID: ${regData.patientId}`);
    patientId = regData.patientId;
  } catch (err: any) {
    assert(false, `Phase 1 threw error: ${err.message}`);
  }

  // 2. Test Patient Login via /api/auth/common-login
  console.log('\n--- Phase 2: Patient Login via Common Login ---');
  let commonToken = '';
  let commonRefreshToken = '';
  let commonExpiresAt = 0;

  try {
    const res = await fetch(`${BASE_URL}/api/auth/common-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: patientId,
        password: testPassword,
      }),
    });
    const data: any = await res.json();
    assert(res.status === 200 && data.success === true, 'Patient common login succeeds with HTTP 200');
    assert(Boolean(data.token), 'Valid Supabase access token returned');
    assert(Boolean(data.refreshToken), 'Valid Supabase refresh token returned');
    assert(typeof data.expiresAt === 'number' && data.expiresAt > Date.now() / 1000, `Valid expiresAt returned: ${data.expiresAt}`);
    assert(data.role === 'patient', `Role is strictly 'patient' (got '${data.role}')`);
    assert(data.patientId === patientId, `Resolved patient ID matches: ${data.patientId}`);
    assert(Boolean(data.user && data.user.id), 'Resolved server-side auth identity in user object');

    commonToken = data.token;
    commonRefreshToken = data.refreshToken;
    commonExpiresAt = data.expiresAt;
  } catch (err: any) {
    assert(false, `Phase 2 threw error: ${err.message}`);
  }

  // 3. Test Patient Login via /api/auth/patient/login
  console.log('\n--- Phase 3: Patient Login via /api/auth/patient/login ---');
  let patientLoginToken = '';
  let patientLoginRefreshToken = '';

  try {
    const res = await fetch(`${BASE_URL}/api/auth/patient/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        password: testPassword,
      }),
    });
    const data: any = await res.json();
    assert(res.status === 200 && data.success === true, '/api/auth/patient/login succeeds with HTTP 200');
    assert(Boolean(data.token), 'Returns genuine Supabase access token');
    assert(Boolean(data.refreshToken), 'Returns genuine Supabase refresh token');
    assert(typeof data.expiresAt === 'number' && data.expiresAt > 0, `Returns valid expiresAt: ${data.expiresAt}`);
    assert(data.role === 'patient', `Role is 'patient' (got '${data.role}')`);
    assert(Boolean(data.user && data.user.patient_id === patientId), `User object includes patient_id ${patientId}`);
    assert(Boolean(data.patient && data.patient.patient_id === patientId), `Returns formatted patient profile`);

    patientLoginToken = data.token;
    patientLoginRefreshToken = data.refreshToken;
  } catch (err: any) {
    assert(false, `Phase 3 threw error: ${err.message}`);
  }

  // 4. Test Token Refresh via /api/auth/refresh
  console.log('\n--- Phase 4: Token Refresh Mechanism ---');
  let refreshedAccessToken = '';
  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: commonRefreshToken }),
    });
    const data: any = await res.json();
    assert(res.status === 200 && data.success === true, 'Token refresh succeeds with HTTP 200');
    assert(Boolean(data.token), 'Refreshed access token issued');
    assert(Boolean(data.refreshToken), 'New refresh token issued');
    assert(typeof data.expiresAt === 'number', `Refreshed expiresAt: ${data.expiresAt}`);
    refreshedAccessToken = data.token;
  } catch (err: any) {
    assert(false, `Phase 4 threw error: ${err.message}`);
  }

  // 5. Test GET /api/patient/dashboard with Original Token
  console.log('\n--- Phase 5: Patient Dashboard Loading with Original Token ---');
  try {
    const res = await fetch(`${BASE_URL}/api/patient/dashboard`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${commonToken}`,
        'Content-Type': 'application/json',
      },
    });
    const data: any = await res.json();
    assert(res.status === 200 && data.success === true, 'GET /api/patient/dashboard returns HTTP 200');
    assert(Boolean(data.data?.patient), `Patient profile loaded: ${data.data?.patient?.name}`);
    assert(data.data?.patient?.patient_id === patientId, `Profile patient_id matches verified identity: ${data.data?.patient?.patient_id}`);
    assert(Array.isArray(data.data?.upcomingAppointments), `Upcoming appointments array returned`);
    assert(Array.isArray(data.data?.completedEncounters), `Completed encounters array returned`);
    assert(Array.isArray(data.data?.labReports), `Lab reports array returned`);
    assert(Array.isArray(data.data?.prescriptions), `Prescriptions array returned`);
    assert(Array.isArray(data.data?.feedbackList), `Feedback list array returned`);
  } catch (err: any) {
    assert(false, `Phase 5 threw error: ${err.message}`);
  }

  // 6. Test GET /api/patient/dashboard with Refreshed Token
  console.log('\n--- Phase 6: Patient Dashboard Loading with Refreshed Token ---');
  try {
    const res = await fetch(`${BASE_URL}/api/patient/dashboard`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${refreshedAccessToken}`,
        'Content-Type': 'application/json',
      },
    });
    const data: any = await res.json();
    assert(res.status === 200 && data.success === true, 'Refreshed access token successfully loads patient dashboard');
    assert(data.data?.patient?.patient_id === patientId, 'Patient ID matches after token renewal');
  } catch (err: any) {
    assert(false, `Phase 6 threw error: ${err.message}`);
  }

  // 7. Test Authentication & Authorization Edge Cases (401 vs 403)
  console.log('\n--- Phase 7: Authentication (401) vs Authorization (403) Handling ---');
  // 7a. Invalid/expired token returns 401
  try {
    const res = await fetch(`${BASE_URL}/api/patient/dashboard`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer invalid.expired.token',
        'Content-Type': 'application/json',
      },
    });
    const data: any = await res.json();
    assert(res.status === 401, `Invalid token returns HTTP 401 (got ${res.status})`);
    assert(data.message.includes('Session expired') || data.message.includes('invalid'), `401 message: ${data.message}`);
  } catch (err: any) {
    assert(false, `Phase 7a threw error: ${err.message}`);
  }

  // 7b. Admin token attempting to access patient dashboard returns 403 Forbidden
  try {
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/common-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'test.user.1793095634883@patient.mediai.health',
        password: 'SecurePassword@2026',
      }),
    });
    const adminData: any = await adminLoginRes.json();
    if (adminData.token) {
      const res = await fetch(`${BASE_URL}/api/patient/dashboard`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminData.token}`,
          'Content-Type': 'application/json',
        },
      });
      assert(res.status === 403, `Admin role accessing patient dashboard returns HTTP 403 Forbidden (got ${res.status})`);
    } else {
      assert(false, 'Failed to authenticate admin for 403 check');
    }
  } catch (err: any) {
    assert(false, `Phase 7b threw error: ${err.message}`);
  }

  // 8. Booking & Reference Endpoints
  console.log('\n--- Phase 8: Booking & Hospital Auxiliary Endpoints ---');
  try {
    const branchesRes = await fetch(`${BASE_URL}/api/booking/branches`);
    const branchesData: any = await branchesRes.json();
    assert(branchesRes.status === 200 && Array.isArray(branchesData.branches), `Hospital branches return 200 (${branchesData.branches?.length} branches)`);

    const specsRes = await fetch(`${BASE_URL}/api/booking/specialties`);
    const specsData: any = await specsRes.json();
    assert(specsRes.status === 200 && Array.isArray(specsData.specialties), `Specialties return 200 (${specsData.specialties?.length} specialties)`);

    const doctorsRes = await fetch(`${BASE_URL}/api/booking/doctors`);
    const doctorsData: any = await doctorsRes.json();
    assert(doctorsRes.status === 200 && Array.isArray(doctorsData.doctors), `Doctors list returns 200 (${doctorsData.doctors?.length} doctors)`);
  } catch (err: any) {
    assert(false, `Phase 8 threw error: ${err.message}`);
  }

  console.log('\n======================================================================');
  console.log(`RESULTS: ${passed}/${total} tests passed (${Math.round((passed / total) * 100)}% SUCCESS)`);
  console.log('======================================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPatientAuthTests();
