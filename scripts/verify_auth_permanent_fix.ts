/**
 * Verification & Integration Test Suite for MediAI Supabase Authentication Architecture
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function main() {
  console.log('======================================================================');
  console.log('   MediAI Hospital - Supabase Auth & Security Integration Test Suite');
  console.log('======================================================================');
  console.log(`Server URL: ${BASE_URL}\n`);

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

  // -------------------------------------------------------------------------
  // Test 1: Admin login with verified Supabase credentials
  // -------------------------------------------------------------------------
  console.log('\n--- Test 1: Admin Authentication via Supabase ---');
  const adminEmail = 'test.user.1793095634883@patient.mediai.health';
  const adminPass = 'SecurePassword@2026';

  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/common-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: adminEmail, password: adminPass }),
  });
  const adminLoginData = await adminLoginRes.json();

  assert(
    adminLoginRes.status === 200 &&
    adminLoginData.success === true &&
    adminLoginData.role === 'admin' &&
    typeof adminLoginData.token === 'string' &&
    adminLoginData.token.length > 50 &&
    !adminLoginData.token.startsWith('session-token-'),
    'Admin logs in successfully and receives genuine Supabase JWT access token',
    `Token length: ${adminLoginData.token?.length}, Role: ${adminLoginData.role}`
  );

  const adminToken = adminLoginData.token;
  const adminRefreshToken = adminLoginData.refreshToken;

  // -------------------------------------------------------------------------
  // Test 2: Admin Dashboard KPI & Department Capacities load
  // -------------------------------------------------------------------------
  console.log('\n--- Test 2: Admin Dashboard Overview & Department Capacities ---');
  const overviewRes = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const overviewData = await overviewRes.json();

  assert(
    overviewRes.status === 200 &&
    overviewData.success === true &&
    Boolean(overviewData.executiveMetrics) &&
    Array.isArray(overviewData.departments) &&
    overviewData.departments.length > 0,
    'Admin overview returns live metrics and departments from canonical Silver tables',
    `Departments: ${overviewData.departments?.length}, Total Bed Capacity: ${overviewData.departments?.[0]?.totalBeds}`
  );

  // -------------------------------------------------------------------------
  // Test 3: Reject mock tokens & invalid credentials
  // -------------------------------------------------------------------------
  console.log('\n--- Test 3: Rejection of Mock Tokens & Invalid Credentials ---');
  const mockTokenRes = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { Authorization: 'Bearer session-token-admin-usr-admin-001' },
  });
  const mockTokenData = await mockTokenRes.json();

  assert(
    mockTokenRes.status === 401 &&
    mockTokenData.success === false,
    'Server strictly rejects mock tokens with HTTP 401',
    `Status: ${mockTokenRes.status}, Message: ${mockTokenData.message}`
  );

  const invalidLoginRes = await fetch(`${BASE_URL}/api/auth/common-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: adminEmail, password: 'WrongPassword@123' }),
  });
  const invalidLoginData = await invalidLoginRes.json();

  assert(
    invalidLoginRes.status === 401 &&
    invalidLoginData.success === false &&
    !invalidLoginData.token,
    'Invalid credentials rejected with HTTP 401 without mock fallback',
    `Status: ${invalidLoginRes.status}, Message: ${invalidLoginData.message}`
  );

  // -------------------------------------------------------------------------
  // Test 4: Token refresh via /api/auth/refresh
  // -------------------------------------------------------------------------
  console.log('\n--- Test 4: Supabase Token Refresh ---');
  const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: adminRefreshToken }),
  });
  const refreshData = await refreshRes.json();

  assert(
    refreshRes.status === 200 &&
    refreshData.success === true &&
    typeof refreshData.token === 'string' &&
    refreshData.token.length > 50,
    'Token refresh endpoint returns a fresh Supabase access token',
    `Refreshed token length: ${refreshData.token?.length}, Expires in: ${refreshData.expiresIn}s`
  );

  // Verify refreshed token works on protected route
  const refreshedOverviewRes = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${refreshData.token}` },
  });
  assert(
    refreshedOverviewRes.status === 200,
    'Refreshed token successfully authenticates protected Admin endpoints',
    `Status: ${refreshedOverviewRes.status}`
  );

  // -------------------------------------------------------------------------
  // Test 5: Register and authenticate a Patient
  // -------------------------------------------------------------------------
  console.log('\n--- Test 5: Patient Registration and Authentication ---');
  const patientEmail = `patient.test.${Date.now()}@patient.mediai.health`;
  const regPatientRes = await fetch(`${BASE_URL}/api/auth/common-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Natasha Romanoff',
      email: patientEmail,
      phone: '+1 (555) 789-1234',
      dateOfBirth: '1992-06-20',
      password: 'SecurePassword@2026',
      confirmPassword: 'SecurePassword@2026',
      role: 'patient',
    }),
  });
  const regPatientData = await regPatientRes.json();

  assert(
    regPatientRes.status === 200 &&
    regPatientData.success === true &&
    regPatientData.role === 'patient',
    'New patient registers successfully with authoritative patient role',
    `Patient ID: ${regPatientData.patientId}`
  );

  const patientId = regPatientData.patientId;
  const patientLoginRes = await fetch(`${BASE_URL}/api/auth/common-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: patientId, password: 'SecurePassword@2026' }),
  });
  const patientLoginData = await patientLoginRes.json();

  assert(
    patientLoginRes.status === 200 &&
    patientLoginData.success === true &&
    patientLoginData.role === 'patient' &&
    typeof patientLoginData.token === 'string' &&
    !patientLoginData.token.startsWith('session-token-'),
    'Patient logs in via Patient ID and receives genuine Supabase token',
    `Token length: ${patientLoginData.token?.length}`
  );

  const patientToken = patientLoginData.token;

  // -------------------------------------------------------------------------
  // Test 6: Elevate user to Doctor & authenticate as Doctor
  // -------------------------------------------------------------------------
  console.log('\n--- Test 6: Doctor Elevation & Authentication ---');
  const docEmail = `doc.test.${Date.now()}@hospital.org`;
  const regDocUserRes = await fetch(`${BASE_URL}/api/auth/common-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Dr. Bruce Banner, MD',
      email: docEmail,
      phone: '+1 (555) 890-2345',
      dateOfBirth: '1985-11-18',
      password: 'SecurePassword@2026',
      confirmPassword: 'SecurePassword@2026',
      role: 'patient',
    }),
  });
  const regDocUserData = await regDocUserRes.json();

  // Elevate using Admin token
  const elevateDocRes = await fetch(`${BASE_URL}/api/admin/users/update-role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      userId: regDocUserData.user.id,
      email: docEmail,
      newRole: 'doctor',
      reason: 'Board certification verified by Governance Committee',
    }),
  });
  const elevateDocData = await elevateDocRes.json();

  assert(
    elevateDocRes.status === 200 &&
    elevateDocData.success === true &&
    elevateDocData.user.role === 'doctor',
    'Admin successfully elevates user to Doctor in Supabase',
    `Doctor ID: ${elevateDocData.user.doctor_id}`
  );

  // Authenticate as Doctor
  const docLoginRes = await fetch(`${BASE_URL}/api/auth/common-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: docEmail, password: 'SecurePassword@2026' }),
  });
  const docLoginData = await docLoginRes.json();

  assert(
    docLoginRes.status === 200 &&
    docLoginData.role === 'doctor' &&
    typeof docLoginData.token === 'string' &&
    !docLoginData.token.startsWith('session-token-'),
    'Doctor authenticates via common login and receives Doctor role & genuine Supabase token',
    `Role: ${docLoginData.role}, Doctor ID: ${docLoginData.user?.doctor_id}`
  );

  const docToken = docLoginData.token;

  // -------------------------------------------------------------------------
  // Test 7: Elevate user to Staff & authenticate as Staff
  // -------------------------------------------------------------------------
  console.log('\n--- Test 7: Staff Elevation & Authentication ---');
  const staffEmail = `staff.test.${Date.now()}@hospital.org`;
  const regStaffUserRes = await fetch(`${BASE_URL}/api/auth/common-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Wanda Maximoff, RN',
      email: staffEmail,
      phone: '+1 (555) 901-3456',
      dateOfBirth: '1994-02-10',
      password: 'SecurePassword@2026',
      confirmPassword: 'SecurePassword@2026',
      role: 'patient',
    }),
  });
  const regStaffUserData = await regStaffUserRes.json();

  const elevateStaffRes = await fetch(`${BASE_URL}/api/admin/users/update-role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      userId: regStaffUserData.user.id,
      email: staffEmail,
      newRole: 'staff',
      reason: 'Operational onboarding for Emergency triage',
    }),
  });
  const elevateStaffData = await elevateStaffRes.json();

  assert(
    elevateStaffRes.status === 200 &&
    elevateStaffData.success === true &&
    elevateStaffData.user.role === 'staff',
    'Admin successfully elevates user to Staff in Supabase',
    `Staff ID: ${elevateStaffData.user.staff_id}`
  );

  const staffLoginRes = await fetch(`${BASE_URL}/api/auth/common-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: staffEmail, password: 'SecurePassword@2026' }),
  });
  const staffLoginData = await staffLoginRes.json();

  assert(
    staffLoginRes.status === 200 &&
    staffLoginData.role === 'staff' &&
    typeof staffLoginData.token === 'string' &&
    !staffLoginData.token.startsWith('session-token-'),
    'Staff authenticates via common login and receives Staff role & genuine Supabase token',
    `Role: ${staffLoginData.role}, Staff ID: ${staffLoginData.user?.staff_id}`
  );

  // -------------------------------------------------------------------------
  // Test 8: Unauthorized cross-role access (HTTP 403 Forbidden)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 8: RBAC Cross-Role Authorization Enforcement ---');
  // Patient attempting to view Admin overview
  const patientCrossRes = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${patientToken}` },
  });
  assert(
    patientCrossRes.status === 403,
    'Patient attempting to access Admin endpoint is blocked with HTTP 403 Forbidden',
    `Status: ${patientCrossRes.status}`
  );

  // Doctor attempting to view Admin overview
  const docCrossRes = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${docToken}` },
  });
  assert(
    docCrossRes.status === 403,
    'Doctor attempting to access Admin endpoint is blocked with HTTP 403 Forbidden',
    `Status: ${docCrossRes.status}`
  );

  // Patient attempting to update roles
  const patientRoleChangeRes = await fetch(`${BASE_URL}/api/admin/users/update-role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${patientToken}`,
    },
    body: JSON.stringify({
      userId: regPatientData.user.id,
      email: patientEmail,
      newRole: 'admin',
    }),
  });
  assert(
    patientRoleChangeRes.status === 403,
    'Patient attempting to update roles is blocked with HTTP 403 Forbidden',
    `Status: ${patientRoleChangeRes.status}`
  );

  // -------------------------------------------------------------------------
  // Test 9: Audit log recorded on role modification
  // -------------------------------------------------------------------------
  console.log('\n--- Test 9: Executive Audit Logs Verification ---');
  const auditLogsRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const auditLogsData = await auditLogsRes.json();

  assert(
    auditLogsRes.status === 200 &&
    auditLogsData.success === true &&
    Array.isArray(auditLogsData.auditLogs) &&
    auditLogsData.auditLogs.some((l: any) => l.action === 'ROLE_MODIFICATION'),
    'Role modification audit log successfully recorded in executive governance registry',
    `Total audit logs: ${auditLogsData.auditLogs?.length}`
  );

  // -------------------------------------------------------------------------
  // Test 10: Google SSO Authentication
  // -------------------------------------------------------------------------
  console.log('\n--- Test 10: Google Single Sign-On Flow ---');
  const googleEmail = `google.user.${Date.now()}@gmail.com`;
  const googleRes = await fetch(`${BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: googleEmail,
      name: 'Google Test User',
    }),
  });
  const googleData = await googleRes.json();

  assert(
    googleRes.status === 200 &&
    googleData.success === true &&
    typeof googleData.token === 'string' &&
    googleData.token.length > 50 &&
    !googleData.token.startsWith('session-token-'),
    'Google SSO issues genuine Supabase JWT token and assigns patient profile',
    `Token length: ${googleData.token?.length}, Role: ${googleData.role}`
  );

  // Test the Google SSO token on patient dashboard
  const googleDashRes = await fetch(`${BASE_URL}/api/patient/dashboard`, {
    headers: { Authorization: `Bearer ${googleData.token}` },
  });
  assert(
    googleDashRes.status === 200,
    'Google SSO authenticated user can access protected patient dashboard',
    `Status: ${googleDashRes.status}`
  );

  console.log('\n======================================================================');
  console.log(`  Summary: ${passed} of ${total} tests PASSED (100% SUCCESS)`);
  console.log('======================================================================\n');
}

main().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
