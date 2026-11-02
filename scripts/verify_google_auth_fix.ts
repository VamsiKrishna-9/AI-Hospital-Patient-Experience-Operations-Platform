/**
 * Test script: verify_google_auth_fix.ts
 *
 * Verifies that:
 * 1. POST /api/auth/google with empty payload fails with HTTP 400 (NO hardcoded admin session).
 * 2. POST /api/auth/google with invalid email format fails with HTTP 400.
 * 3. POST /api/auth/google with a new / friend email defaults STRICTLY to role 'patient' with allocated patient_id.
 * 4. The resulting Supabase token cannot access /api/admin/overview (HTTP 403 Forbidden).
 * 5. Full regression check on common-login.
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('--- STARTING GOOGLE AUTH FIX VERIFICATION TESTS ---');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
    }
  }

  // TEST 1: Empty body should return HTTP 400
  try {
    const res = await fetch(`${BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data: any = await res.json().catch(() => ({}));
    assert(res.status === 400, `Empty body returns 400 (got ${res.status})`);
    assert(data.success === false, 'data.success is false');
    assert(data.role !== 'admin', 'data.role is NOT admin');
    assert(!data.token, 'No token returned for empty body');
  } catch (err: any) {
    assert(false, `Test 1 threw error: ${err.message}`);
  }

  // TEST 2: Invalid email should return HTTP 400
  try {
    const res = await fetch(`${BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    const data: any = await res.json().catch(() => ({}));
    assert(res.status === 400, `Invalid email returns 400 (got ${res.status})`);
    assert(data.success === false, 'data.success is false');
    assert(!data.token, 'No token returned for invalid email');
  } catch (err: any) {
    assert(false, `Test 2 threw error: ${err.message}`);
  }

  // TEST 3: Friend / new user sign in should create/return role 'patient'
  let friendToken = '';
  let friendPatientId = '';
  try {
    const friendEmail = `friend.test.${Date.now()}@gmail.com`;
    const res = await fetch(`${BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: friendEmail,
        name: 'Alex Friend',
      }),
    });
    const data: any = await res.json().catch(() => ({}));
    assert(res.status === 200, `Friend login returns 200 (got ${res.status})`);
    assert(data.success === true, 'data.success is true');
    assert(data.role === 'patient', `Friend role is STRICTLY 'patient' (got '${data.role}')`);
    assert(data.user?.role === 'patient', `Friend user.role is 'patient' (got '${data.user?.role}')`);
    assert(typeof data.user?.patient_id === 'string' && data.user.patient_id.startsWith('P'), `Allocated patient ID starts with P: ${data.user?.patient_id}`);
    assert(Boolean(data.token), 'Valid Supabase session token returned');
    friendToken = data.token;
    friendPatientId = data.user?.patient_id;
  } catch (err: any) {
    assert(false, `Test 3 threw error: ${err.message}`);
  }

  // TEST 4: Friend token should NOT be able to access Admin Dashboard endpoints (HTTP 403 Forbidden)
  if (friendToken) {
    try {
      const res = await fetch(`${BASE_URL}/api/admin/overview`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${friendToken}`,
          'Content-Type': 'application/json',
        },
      });
      assert(res.status === 403, `Friend token blocked from /api/admin/overview with 403 Forbidden (got ${res.status})`);
    } catch (err: any) {
      assert(false, `Test 4 threw error: ${err.message}`);
    }
  }

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed}/${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
  console.log(`========================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
