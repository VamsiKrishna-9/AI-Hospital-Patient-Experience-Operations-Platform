// scripts/verify_diagnostics.js
// Verification suite for MediAI MySQL Connection Diagnostics and Error Classification

import http from 'http';

function apiCall(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runVerification() {
  console.log('=====================================================');
  console.log('  MediAI MySQL Connection Diagnostic Suite');
  console.log('=====================================================\n');

  console.log('--- Step 1: Validating /api/db/health Diagnostic Payload ---');
  const health = await apiCall('/api/db/health');
  assert(health.status === 200, 'GET /api/db/health returns 200 OK');
  assert(health.body.diagnostic !== undefined, 'Diagnostic block is present in /api/db/health');
  assert(health.body.diagnostic.category === 'MISSING_CREDENTIALS', 'Unconfigured environment classified as MISSING_CREDENTIALS');
  assert(typeof health.body.diagnostic.summary === 'string', 'Diagnostic includes human-readable summary');
  assert(typeof health.body.diagnostic.remediation === 'string', 'Diagnostic includes remediation advice');
  assert(health.body.diagnostic.networkDetails !== undefined, 'Network details block is present');
  assert(health.body.diagnostic.networkDetails.passwordConfigured === false, 'Password configured flag accurately reports false');
  assert(!JSON.stringify(health.body).includes('password='), 'No secret passwords in response');

  console.log('\n--- Step 2: Validating Dedicated /api/db/diagnostics Endpoint ---');
  const diag = await apiCall('/api/db/diagnostics');
  assert(diag.status === 200, 'GET /api/db/diagnostics returns 200 OK');
  assert(diag.body.mode === 'PROTOTYPE_DEMO', 'Mode is PROTOTYPE_DEMO');
  assert(diag.body.connected === false, 'Connected is false (safe demo state)');
  assert(diag.body.diagnostic.category === 'MISSING_CREDENTIALS', 'Category is MISSING_CREDENTIALS');
  assert(Array.isArray(diag.body.requiredTables), 'Required tables list is array');
  assert(diag.body.requiredTables.length === 8, 'All 8 authoritative Silver tables enumerated');
  assert(diag.body.requiredTables.includes('app_users'), 'Enumerates app_users');
  assert(diag.body.requiredTables.includes('silver_patients'), 'Enumerates silver_patients');
  assert(diag.body.requiredTables.includes('silver_doctors'), 'Enumerates silver_doctors');
  assert(diag.body.requiredTables.includes('silver_appointments'), 'Enumerates silver_appointments');
  assert(diag.body.requiredTables.includes('silver_encounters'), 'Enumerates silver_encounters');
  assert(diag.body.requiredTables.includes('silver_lab_results'), 'Enumerates silver_lab_results');
  assert(diag.body.requiredTables.includes('silver_prescriptions'), 'Enumerates silver_prescriptions');
  assert(diag.body.requiredTables.includes('silver_feedback'), 'Enumerates silver_feedback');
  assert(typeof diag.body.nextAction === 'string', 'Next action guidance is present');

  console.log('\n--- Step 3: Validating /api/db/test-connection ---');
  const testConn = await apiCall('/api/db/test-connection', 'POST');
  assert(testConn.status === 503, 'POST /api/db/test-connection returns 503 when disconnected');
  assert(testConn.body.success === false, 'Success is false');
  assert(testConn.body.connected === false, 'Connected is false');
  assert(testConn.body.diagnostic.category === 'MISSING_CREDENTIALS', 'Test connection reports MISSING_CREDENTIALS');
  assert(!JSON.stringify(testConn.body).includes('password='), 'No passwords exposed in test connection response');

  console.log('\n--- Step 4: Verification Summary ---');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
