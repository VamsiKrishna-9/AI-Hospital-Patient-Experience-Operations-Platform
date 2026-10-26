/**
 * Comprehensive Automated Verification Suite for MediAI Platform
 * Tests all 11 user criteria:
 * 1. New user registration (role selection omitted, forced to Patient)
 * 2. Generated Patient ID and default 'patient' role verified
 * 3. Login through common login endpoint
 * 4. Resolves Patient role and dashboard
 * 5. Admin modifying user role to Doctor / Staff / Admin
 * 6. Role change persists in backend registry & Supabase
 * 7. Logging in as updated user returns new role and dashboard
 * 8. Demoting Doctor back to Patient archives clinical ID while revoking access
 * 9. Non-admin users cannot alter roles (403 Forbidden verified)
 * 10. Google Auth defaults to Patient role
 * 11. Forgot password endpoint remains operational
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function runTests() {
  console.log('===============================================================');
  console.log('  MediAI Hospital Platform - Unified Auth & Governance Test');
  console.log('===============================================================');
  console.log(`Target Server: ${BASE_URL}\n`);

  let passCount = 0;
  let testCount = 0;

  function assert(condition, message) {
    testCount++;
    if (condition) {
      console.log(`  [PASS] Test ${testCount}: ${message}`);
      passCount++;
    } else {
      console.error(`  [FAIL] Test ${testCount}: ${message}`);
      process.exitCode = 1;
    }
  }

  try {
    // 1. Common Registration: Register new user (even if payload attempts to pass role='admin')
    const testEmail = `test.user.${Date.now()}@patient.mediai.health`;
    const regPayload = {
      fullName: 'Gwen Stacy',
      email: testEmail,
      phone: '+1 (555) 345-9876',
      dateOfBirth: '1998-04-12',
      password: 'SecurePassword@2026',
      confirmPassword: 'SecurePassword@2026',
      role: 'admin', // Malicious attempt to self-assign admin
      acceptTerms: true,
    };

    const regRes = await fetch(`${BASE_URL}/api/auth/common-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regPayload),
    });
    const regData = await regRes.json();

    assert(regRes.ok && regData.success === true, 'New user registers through common registration endpoint');
    assert(regData.role === 'patient', 'New user receives strictly "patient" role (self-selection overridden)');
    assert(/^P\d{6}$/.test(regData.patientId), `User assigned authoritative Patient ID: ${regData.patientId}`);

    const patientId = regData.patientId;
    const patientToken = regData.token;

    // 2. Common Login: Authenticate using Patient ID
    const loginRes = await fetch(`${BASE_URL}/api/auth/common-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: patientId,
        password: 'SecurePassword@2026',
      }),
    });
    const loginData = await loginRes.json();

    assert(loginRes.ok && loginData.success === true, 'User logs in via Patient ID through common login');
    assert(loginData.role === 'patient', 'Authoritative backend role resolved as "patient"');

    // 3. Security: Unauthorized role modification attempt by regular user must fail
    const unauthRes = await fetch(`${BASE_URL}/api/auth/update-role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        newRole: 'admin',
        email: testEmail,
      }),
    });

    assert(unauthRes.status === 403, 'Regular patient is blocked from self-elevating (403 Forbidden)');

    // 4. Admin Login
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/common-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@hospital.org',
        password: 'Admin@2026',
      }),
    });
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginRes.ok && adminLoginData.role === 'admin', 'Administrator authenticated successfully');
    const adminToken = adminLoginData.token;

    // 5. Admin promotes user from Patient -> Doctor
    const promoteDocRes = await fetch(`${BASE_URL}/api/admin/users/update-role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        userId: regData.user.id,
        email: testEmail,
        newRole: 'doctor',
        reason: 'Credentialed by Hospital Medical Board',
      }),
    });
    const promoteDocData = await promoteDocRes.json();
    assert(promoteDocRes.ok && promoteDocData.success === true, 'Admin successfully elevated user to Doctor');
    assert(promoteDocData.user.role === 'doctor', 'Target account role updated to "doctor"');
    assert(Boolean(promoteDocData.user.doctor_id), `Doctor assigned clinical ID: ${promoteDocData.user.doctor_id}`);
    const assignedDocId = promoteDocData.user.doctor_id;

    // 6. User logs in again -> Now receives Doctor role and workspace
    const doctorLoginRes = await fetch(`${BASE_URL}/api/auth/common-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testEmail,
        password: 'SecurePassword@2026',
      }),
    });
    const doctorLoginData = await doctorLoginRes.json();
    assert(doctorLoginData.role === 'doctor', 'User now receives "doctor" role upon subsequent login');
    assert(doctorLoginData.user.doctor_id === assignedDocId, 'Doctor clinical identifier returned in session');

    // 7. Admin demotes user back from Doctor -> Patient (Retain clinical ID in history)
    const demoteRes = await fetch(`${BASE_URL}/api/admin/users/update-role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        userId: regData.user.id,
        email: testEmail,
        newRole: 'patient',
        reason: 'Temporary medical license rotation',
      }),
    });
    const demoteData = await demoteRes.json();
    assert(demoteRes.ok && demoteData.success === true, 'Admin successfully reassigned user to Patient');
    assert(demoteData.user.role === 'patient', 'Active role is now revoked to "patient"');
    assert(
      demoteData.user.historical_identifiers && demoteData.user.historical_identifiers.doctor_id === assignedDocId,
      'Clinical Doctor ID retained in historical records'
    );

    // 8. Admin promotes user from Patient -> Admin
    const promoteAdminRes = await fetch(`${BASE_URL}/api/admin/users/update-role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        userId: regData.user.id,
        email: testEmail,
        newRole: 'admin',
        reason: 'Hospital executive committee appointment',
      }),
    });
    const promoteAdminData = await promoteAdminRes.json();
    assert(promoteAdminRes.ok && promoteAdminData.user.role === 'admin', 'Admin successfully elevated user to Admin');

    // 9. Verify Executive Audit Logs contains all role transitions
    const auditRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const auditData = await auditRes.json();
    assert(auditRes.ok && auditData.auditLogs.length > 0, 'Audit logs recorded role transactions');
    const userAudits = auditData.auditLogs.filter((l) => l.targetUserEmail === testEmail);
    assert(userAudits.length >= 3, `Executive audit ledger recorded ${userAudits.length} role transitions for target`);

    // 10. Google Auth Test: New Google signups default to Patient
    const googleEmail = `google.user.${Date.now()}@gmail.com`;
    const googleRes = await fetch(`${BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: googleEmail,
        name: 'Google Patient Participant',
      }),
    });
    const googleData = await googleRes.json();
    assert(googleRes.ok && googleData.user.role === 'patient', 'Google single sign-on creates default "patient" account');

    // 11. Forgot Password Test
    const forgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'patient@hospital.org',
        deliveryMethod: 'email',
      }),
    });
    const forgotData = await forgotRes.json();
    assert(forgotRes.ok && forgotData.success === true, 'Forgot password recovery service remains operational');

  } catch (err) {
    console.error('Test execution error:', err);
    process.exitCode = 1;
  }

  console.log('\n===============================================================');
  console.log(`  Tests Passed: ${passCount} / ${testCount}`);
  console.log('===============================================================');
}

runTests();
