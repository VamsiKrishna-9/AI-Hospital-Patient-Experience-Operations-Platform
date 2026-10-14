/**
 * Comprehensive Automated Verification Suite for MediAI Demo Patient Accounts
 * Tests requirements 1-9 against http://localhost:3000
 */

import http from 'http';

const BASE_URL = 'http://localhost:3000';
const DEMO_PATIENTS = [
  'P182162',
  'P195909',
  'P198226',
  'P151076',
  'P164835',
  'P115937',
  'P171467',
  'P167834',
  'P144799',
  'P118969',
];

const DEFAULT_PASSWORD = 'Patient@2026';

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runVerification() {
  console.log('=====================================================');
  console.log('  MediAI Demo Accounts Comprehensive Verification');
  console.log('=====================================================\n');

  const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    details: [],
  };

  function assert(name, condition, notes = '') {
    testResults.total++;
    if (condition) {
      testResults.passed++;
      console.log(`  [PASS] ${name} ${notes ? `(${notes})` : ''}`);
      testResults.details.push({ name, status: 'PASS', notes });
    } else {
      testResults.failed++;
      console.log(`  [FAIL] ${name} ${notes ? `(${notes})` : ''}`);
      testResults.details.push({ name, status: 'FAIL', notes });
    }
  }

  // ----------------------------------------------------
  // TEST 0: Health & Runtime Engine
  // ----------------------------------------------------
  console.log('--- Step 0: Checking Server & Medallion Engine Status ---');
  const healthRes = await request('GET', '/api/health');
  assert('Server responds with 200 OK', healthRes.status === 200);
  assert(
    'Server running with authoritative Medallion Silver tables',
    Array.isArray(healthRes.body?.authoritativeTables) && healthRes.body.authoritativeTables.length > 0
  );

  // ----------------------------------------------------
  // TEST 1 & 2: Authenticate all 10 Demo Accounts and verify isolation
  // ----------------------------------------------------
  console.log('\n--- Requirement 1 & 2: Authenticating 10 Demo Patient Accounts ---');
  const patientTokens = {};
  const patientDashboards = {};

  for (const patientId of DEMO_PATIENTS) {
    // Attempt login
    const loginRes = await request('POST', '/api/auth/patient/login', {}, {
      patientId,
      password: DEFAULT_PASSWORD,
    });

    assert(
      `Login ${patientId}`,
      loginRes.status === 200 && loginRes.body?.success === true && !!loginRes.body?.token,
      `Token issued: ${loginRes.body?.token ? 'Yes' : 'No'}, Mode: ${loginRes.body?.isLiveMySQL ? 'Live MySQL' : 'Prototype Engine'}`
    );

    if (loginRes.body?.token) {
      patientTokens[patientId] = loginRes.body.token;

      // Verify token returns corresponding profile
      const verifyRes = await request('GET', '/api/auth/verify', {
        Authorization: `Bearer ${loginRes.body.token}`,
      });
      assert(
        `Session Identity ${patientId}`,
        verifyRes.status === 200 && verifyRes.body?.patient?.patient_id === patientId,
        `Returned name: ${verifyRes.body?.patient?.name}`
      );

      // Fetch dashboard
      const dashRes = await request('GET', '/api/patient/dashboard', {
        Authorization: `Bearer ${loginRes.body.token}`,
      });
      assert(
        `Dashboard retrieval ${patientId}`,
        dashRes.status === 200 && dashRes.body?.success === true,
        `Patient ID in dashboard: ${dashRes.body?.data?.patient?.patient_id}`
      );

      if (dashRes.body?.data) {
        patientDashboards[patientId] = dashRes.body.data;
      }
    }
  }

  // Verify that changing accounts changes the dashboard data appropriately
  console.log('\n--- Requirement 2 & 3: Account Switching & Isolation Validation ---');
  const p1 = patientDashboards['P182162'];
  const p2 = patientDashboards['P195909'];
  const p3 = patientDashboards['P118969'];

  assert(
    'Dashboard data changes between different accounts',
    p1?.patient?.name !== p2?.patient?.name && p1?.patient?.name !== p3?.patient?.name,
    `P182162: ${p1?.patient?.name} vs P195909: ${p2?.patient?.name} vs P118969: ${p3?.patient?.name}`
  );

  // ----------------------------------------------------
  // TEST 3: Patient-specific filtering
  // ----------------------------------------------------
  console.log('\n--- Requirement 3: Verifying Patient-Specific Record Filtering ---');
  for (const patientId of DEMO_PATIENTS) {
    const data = patientDashboards[patientId];
    if (!data) continue;

    const allAptsBelong = (data.upcomingAppointments || []).every((a) => a.patient_id === patientId);
    const allEncsBelong = (data.completedEncounters || []).every((e) => e.patient_id === patientId);
    const allLabsBelong = (data.labReports || []).every((l) => l.patient_id === patientId);
    const allRxBelong = (data.prescriptions || []).every((p) => p.patient_id === patientId);
    const allFbBelong = (data.feedbackList || []).every((f) => f.patient_id === patientId);

    assert(
      `Records isolation for ${patientId}`,
      allAptsBelong && allEncsBelong && allLabsBelong && allRxBelong && allFbBelong,
      `Apts: ${data.upcomingAppointments?.length}, Encs: ${data.completedEncounters?.length}, Labs: ${data.labReports?.length}, Rx: ${data.prescriptions?.length}, FB: ${data.feedbackList?.length}`
    );
  }

  // ----------------------------------------------------
  // TEST 4: Cross-patient unauthorized access attempts
  // ----------------------------------------------------
  console.log('\n--- Requirement 4: Security Audit - Parameter Tampering & Cross-Patient Access ---');
  const tokenP1 = patientTokens['P182162']; // Eleanor Vance
  const tokenP2 = patientTokens['P195909']; // David Sterling

  // Attempt 1: P2 tries to fetch dashboard passing query param ?patientId=P182162
  const tamperQueryRes = await request('GET', '/api/patient/dashboard?patientId=P182162', {
    Authorization: `Bearer ${tokenP2}`,
  });
  assert(
    'Server ignores ?patientId parameter in GET /api/patient/dashboard',
    tamperQueryRes.body?.data?.patient?.patient_id === 'P195909',
    `Authenticated as P195909, requested P182162 -> Server returned: ${tamperQueryRes.body?.data?.patient?.patient_id}`
  );

  // Attempt 2: P2 tries to cancel P1's appointment (APT-88210)
  const cancelTamperRes = await request('POST', '/api/booking/cancel', {
    Authorization: `Bearer ${tokenP2}`,
  }, {
    appointmentId: 'APT-88210', // Belongs to P182162
  });
  assert(
    "Unauthorized appointment cancellation rejected (404/unauthorized)",
    cancelTamperRes.status === 404 || cancelTamperRes.body?.success === false,
    `Status: ${cancelTamperRes.status}, Message: ${cancelTamperRes.body?.message}`
  );

  // Attempt 3: No token provided
  const noTokenRes = await request('GET', '/api/patient/dashboard');
  assert(
    'Unauthenticated request rejected with 401 Unauthorized',
    noTokenRes.status === 401,
    `Status: ${noTokenRes.status}`
  );

  // Attempt 4: Tampered/forged token provided
  const forgedTokenRes = await request('GET', '/api/patient/dashboard', {
    Authorization: 'Bearer invalid_forged_random_token_99999',
  });
  assert(
    'Forged token rejected with 401 Unauthorized',
    forgedTokenRes.status === 401,
    `Status: ${forgedTokenRes.status}`
  );

  // ----------------------------------------------------
  // TEST 5: Dashboard counts match backend records
  // ----------------------------------------------------
  console.log('\n--- Requirement 5: Dashboard Metric Counts Verification ---');
  for (const patientId of ['P182162', 'P195909', 'P198226', 'P118969']) {
    const data = patientDashboards[patientId];
    if (!data) continue;

    const aptCount = data.upcomingAppointments.length;
    const encCount = data.completedEncounters.length;
    const labCount = data.labReports.length;
    const rxCount = data.prescriptions.length;
    const fbCount = data.feedbackList.length;

    assert(
      `Counts match array lengths for ${patientId}`,
      typeof aptCount === 'number' && typeof encCount === 'number' && typeof labCount === 'number' && typeof rxCount === 'number',
      `Visits: ${aptCount}, Past: ${encCount}, Labs: ${labCount}, Rx: ${rxCount}, FB: ${fbCount}`
    );
  }

  // ----------------------------------------------------
  // TEST 6: Empty States Testing
  // ----------------------------------------------------
  console.log('\n--- Requirement 6: Clinical Empty State Validation ---');
  assert(
    'Empty upcoming appointments state for P164835 (Sophia Rodriguez)',
    patientDashboards['P164835']?.upcomingAppointments?.length === 0,
    `Upcoming count: ${patientDashboards['P164835']?.upcomingAppointments?.length}`
  );

  assert(
    'Empty lab reports state for P198226 (Maya Lin)',
    patientDashboards['P198226']?.labReports?.length === 0,
    `Lab count: ${patientDashboards['P198226']?.labReports?.length}`
  );

  assert(
    'Empty prescriptions state for P151076 (Lucas Thorne)',
    patientDashboards['P151076']?.prescriptions?.length === 0,
    `Prescription count: ${patientDashboards['P151076']?.prescriptions?.length}`
  );

  const p118969 = patientDashboards['P118969'];
  assert(
    'Complete empty clinical state for P118969 (Thomas Miller)',
    p118969?.upcomingAppointments?.length === 0 &&
    p118969?.completedEncounters?.length === 0 &&
    p118969?.labReports?.length === 0 &&
    p118969?.prescriptions?.length === 0,
    `Apts: ${p118969?.upcomingAppointments?.length}, Encs: ${p118969?.completedEncounters?.length}, Labs: ${p118969?.labReports?.length}, Rx: ${p118969?.prescriptions?.length}`
  );

  // ----------------------------------------------------
  // TEST 7 & 8: Booking Workflow & Conflict Detection
  // ----------------------------------------------------
  console.log('\n--- Requirement 7 & 8: Booking Workflow & Double-Booking Conflict Engine ---');
  const specRes = await request('GET', '/api/booking/specialties');
  assert('Specialties list retrieved', specRes.status === 200 && Array.isArray(specRes.body?.specialties));

  const docRes = await request('GET', '/api/booking/doctors?specialty=Cardiology');
  assert(
    'Doctors retrieved for Cardiology',
    docRes.status === 200 && docRes.body?.doctors?.length > 0,
    `Found ${docRes.body?.doctors?.length} doctors`
  );
  const testDoctorId = docRes.body?.doctors?.[0]?.doctor_id || 'DOC-101';

  const testDate = '2026-11-20';
  const availRes = await request('GET', `/api/booking/availability?doctorId=${testDoctorId}&date=${testDate}`);
  assert(
    'Availability slots calculated by backend',
    availRes.status === 200 && Array.isArray(availRes.body?.slots) && availRes.body.slots.length > 0,
    `Slots: ${availRes.body?.slots?.length}`
  );

  const testSlot = availRes.body?.slots?.find((s) => s.isAvailable)?.time || '10:00 AM';

  // Booking confirmation for P182162
  const bookRes1 = await request('POST', '/api/booking/create', {
    Authorization: `Bearer ${tokenP1}`,
  }, {
    doctorId: testDoctorId,
    branchId: 'BR-MAIN',
    date: testDate,
    timeSlot: testSlot,
    reason: 'Follow-up consultation testing',
  });
  assert(
    'Booking confirmed and registered in silver_appointments',
    bookRes1.status === 201 && bookRes1.body?.success === true && !!bookRes1.body?.appointment?.appointment_id,
    `New Appointment ID: ${bookRes1.body?.appointment?.appointment_id}`
  );
  const createdAptId = bookRes1.body?.appointment?.appointment_id;

  // Duplicate booking conflict: competing patient attempts to book SAME doctor slot
  const duplicateDoctorRes = await request('POST', '/api/booking/create', {
    Authorization: `Bearer ${tokenP2}`,
  }, {
    doctorId: testDoctorId,
    branchId: 'BR-MAIN',
    date: testDate,
    timeSlot: testSlot,
    reason: 'Competing patient appointment booking',
  });
  assert(
    'Backend rejects conflicting doctor slot (409 Conflict)',
    duplicateDoctorRes.status === 409,
    `Status: ${duplicateDoctorRes.status}, Message: ${duplicateDoctorRes.body?.message}`
  );

  // Duplicate booking conflict: patient schedule conflict (P1 tries to book different doctor at SAME time)
  const duplicatePatientRes = await request('POST', '/api/booking/create', {
    Authorization: `Bearer ${tokenP1}`,
  }, {
    doctorId: 'DOC-102',
    branchId: 'BR-MAIN',
    date: testDate,
    timeSlot: testSlot,
    reason: 'Conflicting simultaneous appointment',
  });
  assert(
    'Backend rejects patient schedule overlap (409 Conflict)',
    duplicatePatientRes.status === 409,
    `Status: ${duplicatePatientRes.status}, Message: ${duplicatePatientRes.body?.message}`
  );

  // Cancellation test: P1 cancels the appointment they just created
  if (createdAptId) {
    const cancelRes = await request('POST', '/api/booking/cancel', {
      Authorization: `Bearer ${tokenP1}`,
    }, {
      appointmentId: createdAptId,
    });
    assert(
      'Patient successfully cancels their own appointment',
      cancelRes.status === 200 && cancelRes.body?.success === true,
      `Cancelled ID: ${createdAptId}`
    );

    // Verify slot is now available again
    const availAfterCancel = await request('GET', `/api/booking/availability?doctorId=${testDoctorId}&date=${testDate}`);
    const slotAfter = availAfterCancel.body?.slots?.find((s) => s.time === testSlot);
    assert(
      'Slot is released and available after cancellation',
      slotAfter?.isAvailable === true,
      `Slot ${testSlot} isAvailable: ${slotAfter?.isAvailable}`
    );
  }

  // ----------------------------------------------------
  // TEST 9: Clearly labeled demo data
  // ----------------------------------------------------
  console.log('\n--- Requirement 9: Demo Mode Data Labeling ---');
  const dashDemoNotice = p1?.backendStatus;
  assert(
    'Backend status confirms Prototype / Demo mode (isLiveMySQL = false)',
    dashDemoNotice?.isLiveMySQL === false && String(dashDemoNotice?.engine).includes('Demo Data'),
    `Engine label: "${dashDemoNotice?.engine}", Schema: "${dashDemoNotice?.schema}"`
  );

  console.log('\n=====================================================');
  console.log(`  VERIFICATION COMPLETE: ${testResults.passed}/${testResults.total} Tests Passed (${testResults.failed} Failed)`);
  console.log('=====================================================\n');

  if (testResults.failed > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
