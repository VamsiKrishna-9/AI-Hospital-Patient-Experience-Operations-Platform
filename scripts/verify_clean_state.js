/**
 * Verification Suite for MediAI Clean State & Supabase Preparation
 * Verifies that all demo accounts, mock records, and prototype fallbacks are removed.
 */

import http from 'http';

const BASE_URL = 'http://localhost:3000';

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
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
          });
        } catch {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runCleanStateTests() {
  console.log('====================================================');
  console.log('MediAI Clean State & Supabase Preparation Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName} - ${details}`);
      failed++;
    }
  }

  // 1. Health & DB Status
  console.log('1. Checking Server & Database Clean Status:');
  const healthRes = await request('GET', '/api/health');
  assert(healthRes.status === 200, 'Server is running', `Status: ${healthRes.status}`);
  assert(healthRes.body?.databaseTarget === 'Supabase PostgreSQL', 'Target database is Supabase PostgreSQL');

  const dbStatusRes = await request('GET', '/api/db/status');
  assert(dbStatusRes.status === 200, 'DB status endpoint responds');
  assert(dbStatusRes.body?.status === 'pending_configuration', 'DB status reports pending_configuration');
  assert(dbStatusRes.body?.connected === false, 'Connected flag is strictly false');
  assert(dbStatusRes.body?.cleanState === true, 'Clean state flag is confirmed');
  assert(Array.isArray(dbStatusRes.body?.requiredTables), 'Required relational tables listed');
  assert(dbStatusRes.body?.requiredTables.includes('users') && dbStatusRes.body?.requiredTables.includes('patients'), 'Authoritative tables include users and patients');

  // 2. Demo Credentials Must NOT Authenticate
  console.log('\n2. Verifying Demo Accounts Cannot Authenticate:');
  const demoAccounts = ['P182162', 'P195909', 'P198226', 'P151076', 'P164835', 'P115937', 'P171467', 'P167834', 'P144799', 'P118969'];
  for (const patientId of demoAccounts) {
    const loginRes = await request('POST', '/api/auth/patient/login', {}, { patientId, password: 'Patient@2026' });
    assert(loginRes.status === 503 || loginRes.status === 401, `Demo account ${patientId} is blocked from authenticating`, `Status: ${loginRes.status}`);
    assert(loginRes.body?.success === false, `Demo account ${patientId} returns success=false`);
  }

  // 3. Clinical & Operations Auth Must Require Real Credentials
  console.log('\n3. Verifying Staff/Doctor/Admin Cannot Authenticate With Dummy Data:');
  const docLogin = await request('POST', '/api/auth/login', {}, { role: 'doctor', email: 'doctor@hospital.org', password: 'password123' });
  assert(docLogin.status === 503 || docLogin.status === 401, 'Doctor dummy login blocked', `Status: ${docLogin.status}`);
  assert(docLogin.body?.success === false, 'Doctor login returns success=false');

  const adminLogin = await request('POST', '/api/auth/login', {}, { role: 'admin', email: 'admin@hospital.org', password: 'password123' });
  assert(adminLogin.status === 503 || adminLogin.status === 401, 'Admin dummy login blocked', `Status: ${adminLogin.status}`);

  // 4. Registration Without Database Must Fail With Clean Error
  console.log('\n4. Verifying Registration Rejects Without Database:');
  const regRes = await request('POST', '/api/auth/register', {}, { role: 'patient', fullName: 'Test User', email: 'test@example.com' });
  assert(regRes.status === 503, 'Registration returns 503 when DB not connected');
  assert(regRes.body?.errorType === 'DATABASE_NOT_CONFIGURED', 'Reports DATABASE_NOT_CONFIGURED errorType');

  // 5. Booking Endpoints Clean State
  console.log('\n5. Verifying Booking Services in Clean State:');
  const branchRes = await request('GET', '/api/booking/branches');
  assert(branchRes.status === 200, 'Branch list returns 200');
  assert(Array.isArray(branchRes.body?.branches), 'Branches is array');

  const specRes = await request('GET', '/api/booking/specialties');
  assert(specRes.status === 200, 'Specialties list returns 200');
  assert(Array.isArray(specRes.body?.specialties), 'Specialties is array');

  const docRes = await request('GET', '/api/booking/doctors');
  assert(docRes.status === 200, 'Doctor list returns 200');
  assert(Array.isArray(docRes.body?.doctors) && docRes.body?.doctors.length === 0, 'No mock doctors returned when DB is clean');

  // 6. Mutation Operations Without Database Must Reject With Clean Error
  console.log('\n6. Verifying Mutations Do Not Fake Success:');
  const bookRes = await request('POST', '/api/booking/create', { Authorization: 'Bearer invalid-token' }, { doctorId: 'DOC-1', date: '2026-11-01' });
  assert(bookRes.status === 401 || bookRes.status === 503, 'Unauthorized booking rejected', `Status: ${bookRes.status}`);

  console.log('\n====================================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runCleanStateTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
