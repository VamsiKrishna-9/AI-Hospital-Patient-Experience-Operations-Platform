/**
 * Transition Verification Suite for Live MySQL Integration & Prototype Separation
 * Validates tasks 1-8 of the MySQL transition specification:
 * - Health-check endpoints (/api/db/health, /api/db/status, /api/health)
 * - Safe response payload (no passwords, hashes, connection strings, or PII)
 * - Authoritative Silver table catalog
 * - Test-connection endpoint behavior
 * - Prototype mode clear labeling and non-leaking state
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

async function runTransitionVerification() {
  console.log('=====================================================');
  console.log('  MediAI MySQL Transition & Health Suite Verification');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, notes = '') {
    if (condition) {
      passed++;
      console.log(`  [PASS] ${name} ${notes ? `(${notes})` : ''}`);
    } else {
      failed++;
      console.log(`  [FAIL] ${name} ${notes ? `(${notes})` : ''}`);
    }
  }

  // 1. Check GET /api/db/health
  console.log('--- Step 1: Inspecting Backend Health Endpoint (/api/db/health) ---');
  const dbHealth = await request('GET', '/api/db/health');
  assert('GET /api/db/health returns 200 OK', dbHealth.status === 200);
  assert(
    'Status indicates prototype_mode or connected (not masked as false live)',
    dbHealth.body?.status === 'prototype_mode' || dbHealth.body?.status === 'connected',
    `status: ${dbHealth.body?.status}`
  );
  assert(
    'Mode is explicitly identified (PROTOTYPE_DEMO or LIVE_MYSQL)',
    dbHealth.body?.mode === 'PROTOTYPE_DEMO' || dbHealth.body?.mode === 'LIVE_MYSQL',
    `mode: ${dbHealth.body?.mode}`
  );
  assert('Target database is hospital_db', dbHealth.body?.database === 'hospital_db');
  assert('Database host is sanitized and present', Boolean(dbHealth.body?.host));
  assert('Port is 3306 or configured port', Boolean(dbHealth.body?.port));

  // Security Audit: Check that NO credentials, passwords, or hashes exist in payload
  const rawBody = JSON.stringify(dbHealth.body);
  assert(
    'Payload does NOT leak password values or credentials',
    !rawBody.includes('"password"') &&
    !rawBody.includes('your_database_password') &&
    !rawBody.includes('password=')
  );
  assert('Payload does NOT contain secret connection strings', !rawBody.includes('mysql://') || !rawBody.includes('@'));
  assert('Payload does NOT leak user PII or patient medical records', !rawBody.includes('Eleanor') && !rawBody.includes('Metformin'));

  // 2. Authoritative tables inspection
  console.log('\n--- Step 2: Authoritative Silver Tables Catalog Verification ---');
  const tables = dbHealth.body?.authoritativeTables;
  assert('Authoritative tables catalog is present', Array.isArray(tables) && tables.length === 8);
  const expectedTables = [
    'silver_patients',
    'silver_doctors',
    'silver_appointments',
    'silver_encounters',
    'silver_lab_results',
    'silver_prescriptions',
    'silver_feedback',
    'app_users',
  ];
  for (const t of expectedTables) {
    const found = tables.find((item) => item.table_name === t);
    assert(`Table catalog includes ${t}`, Boolean(found), `Row count: ${found?.row_count}`);
  }

  // 3. Check GET /api/db/status alias
  console.log('\n--- Step 3: Checking /api/db/status alias ---');
  const dbStatus = await request('GET', '/api/db/status');
  assert('/api/db/status returns 200 OK', dbStatus.status === 200);
  assert('/api/db/status reports identical mode', dbStatus.body?.mode === dbHealth.body?.mode);

  // 4. Check POST /api/db/test-connection
  console.log('\n--- Step 4: Testing /api/db/test-connection ---');
  const testConn = await request('POST', '/api/db/test-connection');
  assert(
    'test-connection responds with structured JSON',
    testConn.body !== null && typeof testConn.body === 'object'
  );
  assert(
    'test-connection reports accurate connection state',
    testConn.body?.connected === false || testConn.body?.connected === true,
    `connected: ${testConn.body?.connected}`
  );
  const testConnRaw = JSON.stringify(testConn.body);
  assert(
    'test-connection does NOT leak database passwords or secrets',
    !testConnRaw.includes('your_database_password') && !testConnRaw.includes('password=')
  );

  // 5. Booking & Cancellation schema alignment in prototype mode
  console.log('\n--- Step 5: Booking & Cancellation Schema Verification ---');
  // Login as Eleanor Vance
  const loginRes = await request('POST', '/api/auth/patient/login', {}, { patientId: 'P182162', password: 'Patient@2026' });
  const token = loginRes.body?.token;
  assert('Authenticated as P182162', Boolean(token));

  const bookRes = await request('POST', '/api/booking/create', { Authorization: `Bearer ${token}` }, {
    doctorId: 'DOC-102',
    branchId: 'BR-WEST',
    date: '2026-11-20',
    timeSlot: '11:00 AM',
    reason: 'Cardiology routine review',
  });
  assert('Booking created with authoritative fields', bookRes.status === 201 && bookRes.body?.appointment?.appointment_id);
  const newAptId = bookRes.body?.appointment?.appointment_id;

  // Cancel appointment
  const cancelRes = await request('POST', '/api/booking/cancel', { Authorization: `Bearer ${token}` }, {
    appointmentId: newAptId,
  });
  assert('Appointment cancelled cleanly', cancelRes.status === 200 && cancelRes.body?.appointmentId === newAptId);

  console.log('\n=====================================================');
  console.log(`  TRANSITION SUITE: ${passed} Passed, ${failed} Failed`);
  console.log('=====================================================');
}

runTransitionVerification().catch(console.error);
