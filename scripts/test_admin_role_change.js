/**
 * Verification Test Suite: Admin User Role Governance & Database Synchronization
 */

import http from 'node:http';

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, data: parsed });
          } catch {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Admin User Role Governance & Database Synchronization Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`   ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`   ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Register a test participant with default role "patient"
    const testEmail = `test_caregiver_${Date.now()}@hospital.org`;
    console.log(`1. Registering new participant: ${testEmail}...`);
    const regRes = await makeRequest('POST', '/api/auth/common-register', {
      fullName: 'Samantha Sterling',
      email: testEmail,
      password: 'Password@2026',
      phone: '+1 (555) 234-9988',
      dateOfBirth: '1992-04-18',
    });

    assert(regRes.data?.success === true, 'Registered successfully');
    assert(regRes.data?.role === 'patient', 'Initial role is default "patient"');
    const initialPatientId = regRes.data?.patientId;
    assert(Boolean(initialPatientId), `Assigned Patient ID: ${initialPatientId}`);

    // 2. Admin signs in to get administrative executive token
    console.log('\n2. Authenticating as Platform Administrator (Arthur Sterling, MHA)...');
    const adminLoginRes = await makeRequest('POST', '/api/auth/common-login', {
      identifier: 'admin@hospital.org',
      password: 'Admin@2026',
    });

    assert(adminLoginRes.data?.success === true, 'Admin logged in successfully');
    assert(adminLoginRes.data?.role === 'admin', 'Admin role verified');
    const adminToken = adminLoginRes.data?.token;
    assert(Boolean(adminToken), 'Admin session token retrieved');

    // 3. Admin queries user directory
    console.log('\n3. Admin querying /api/admin/users directory...');
    const usersRes = await makeRequest('GET', '/api/admin/users', null, adminToken);
    assert(usersRes.status === 200, 'GET /api/admin/users returned 200 OK');
    assert(usersRes.data?.success === true, 'Users directory query succeeded');
    const usersList = usersRes.data?.users || [];
    const foundUser = usersList.find((u) => u.email === testEmail);
    assert(Boolean(foundUser), 'Newly registered participant found in Admin user directory');
    assert(foundUser?.role === 'patient', 'User listed with current role "patient"');

    // 4. Non-admin access restriction check
    console.log('\n4. Verifying non-admin role mutation restriction (RBAC security)...');
    const patientLoginRes = await makeRequest('POST', '/api/auth/common-login', {
      identifier: testEmail,
      password: 'Password@2026',
    });
    const patientToken = patientLoginRes.data?.token;

    const unauthorizedRes = await makeRequest(
      'POST',
      '/api/admin/users/update-role',
      {
        email: testEmail,
        newRole: 'doctor',
      },
      patientToken
    );
    assert(
      unauthorizedRes.status === 403 || unauthorizedRes.status === 401,
      `Non-admin role change blocked (HTTP ${unauthorizedRes.status})`
    );

    // 5. Admin updates participant role to Doctor
    console.log('\n5. Administrator updating participant role to "doctor"...');
    const updateRes = await makeRequest(
      'POST',
      '/api/admin/users/update-role',
      {
        email: testEmail,
        newRole: 'doctor',
        reason: 'Board Certified Physician credential approval',
      },
      adminToken
    );

    assert(updateRes.status === 200, 'POST /api/admin/users/update-role returned 200 OK');
    assert(updateRes.data?.success === true, 'Role update acknowledged as successful');
    assert(updateRes.data?.user?.role === 'doctor', 'Updated account role is now "doctor"');
    assert(Boolean(updateRes.data?.user?.doctor_id), `Assigned Doctor ID: ${updateRes.data?.user?.doctor_id}`);

    // 6. Verify role persistence on re-login
    console.log('\n6. Verifying participant login now routes to Doctor workspace...');
    const reLoginRes = await makeRequest('POST', '/api/auth/common-login', {
      identifier: testEmail,
      password: 'Password@2026',
    });

    assert(reLoginRes.data?.success === true, 'Participant logged in with existing password');
    assert(reLoginRes.data?.role === 'doctor', 'Resolved session role is dynamically "doctor"');
    assert(reLoginRes.data?.user?.role === 'doctor', 'User profile role is "doctor"');

    // 7. Verify Executive Audit Log
    console.log('\n7. Verifying Executive Role Audit Log records...');
    const auditRes = await makeRequest('GET', '/api/admin/audit-logs', null, adminToken);
    assert(auditRes.status === 200, 'GET /api/admin/audit-logs returned 200 OK');
    assert(auditRes.data?.success === true, 'Audit log query succeeded');
    const logs = auditRes.data?.auditLogs || [];
    const event = logs.find((l) => l.targetUserEmail === testEmail && l.newRole === 'doctor');
    assert(Boolean(event), 'Role change event recorded in authoritative audit ledger');
    assert(event?.previousRole === 'patient', 'Previous role "patient" captured in audit record');
    assert(event?.newRole === 'doctor', 'New role "doctor" captured in audit record');
    assert(Boolean(event?.adminName), `Signed by Administrator: ${event?.adminName}`);

    console.log(`\n====================================================`);
    console.log(`Results: ${passed} Passed, ${failed} Failed`);
    console.log(`====================================================`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
