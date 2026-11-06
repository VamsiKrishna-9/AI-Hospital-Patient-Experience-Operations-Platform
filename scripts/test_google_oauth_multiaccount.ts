/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = 'http://localhost:3000';
const SUPABASE_URL = 'https://niglcjtthyktyorbuhkg.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pZ2xjanR0aHlrdHlvcmJ1aGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNTE0MjQsImV4cCI6MjEwNzYyNzQyNH0.7WZDIeVKxi0NT754sNqkNjJff7OT0a_GOO7ngkBDJZU';

async function runTests() {
  console.log('--- STARTING GOOGLE OAUTH & MULTI-ACCOUNT SIGNUP TESTS ---');
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

  // 1. Verify Supabase OAuth signInWithOAuth generates URL with prompt=select_account
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
    const { data: oauthData, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://ais-dev-3mit3ofxc4v3mkup6fnuq4-979695568263.asia-southeast1.run.app/auth/callback',
        queryParams: {
          prompt: 'select_account',
        },
        skipBrowserRedirect: true,
      },
    });

    assert(!oauthError, 'Supabase signInWithOAuth succeeded without error');
    assert(Boolean(oauthData?.url), 'OAuth URL generated');
    assert(Boolean(oauthData?.url?.includes('provider=google')), 'OAuth URL includes provider=google');
    assert(Boolean(oauthData?.url?.includes('prompt=select_account')), 'OAuth URL includes prompt=select_account (forces account chooser)');
    assert(decodeURIComponent(oauthData?.url || '').includes('/auth/callback'), 'OAuth URL points to /auth/callback');
  } catch (err: any) {
    assert(false, `OAuth URL test threw: ${err.message}`);
  }

  // 2. Test Google signup with First Google Account (New Patient A)
  const timestamp = Date.now();
  const accountA = {
    email: `google.user.a.${timestamp}@gmail.com`,
    name: 'Alice Johnson',
  };

  let tokenA = '';
  let patientIdA = '';

  try {
    const resA = await fetch(`${BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accountA),
    });
    const dataA: any = await resA.json();

    assert(resA.status === 200, `Account A signup HTTP 200 (got ${resA.status})`);
    assert(dataA.success === true, 'Account A data.success is true');
    assert(dataA.role === 'patient', `Account A role is strictly 'patient' (got '${dataA.role}')`);
    assert(dataA.user?.role === 'patient', `Account A user.role is strictly 'patient' (got '${dataA.user?.role}')`);
    assert(Boolean(dataA.token), 'Account A received valid Supabase JWT token');
    assert(Boolean(dataA.patientId && dataA.patientId.startsWith('P')), `Account A allocated patient ID: ${dataA.patientId}`);
    tokenA = dataA.token;
    patientIdA = dataA.patientId;
  } catch (err: any) {
    assert(false, `Account A signup threw: ${err.message}`);
  }

  // 3. Test Google signup with Second Google Account (New Patient B)
  const accountB = {
    email: `google.user.b.${timestamp}@gmail.com`,
    name: 'Bob Martinez',
  };

  try {
    const resB = await fetch(`${BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accountB),
    });
    const dataB: any = await resB.json();

    assert(resB.status === 200, `Account B signup HTTP 200 (got ${resB.status})`);
    assert(dataB.success === true, 'Account B data.success is true');
    assert(dataB.role === 'patient', `Account B role is strictly 'patient' (got '${dataB.role}')`);
    assert(dataB.user?.role === 'patient', `Account B user.role is strictly 'patient' (got '${dataB.user?.role}')`);
    assert(Boolean(dataB.token), 'Account B received valid Supabase JWT token');
    assert(Boolean(dataB.patientId && dataB.patientId.startsWith('P')), `Account B allocated patient ID: ${dataB.patientId}`);
    assert(dataB.patientId !== patientIdA, 'Account B has distinct patient ID from Account A (no collisions)');
    assert(dataB.token !== tokenA, 'Account B has distinct session token from Account A');
  } catch (err: any) {
    assert(false, `Account B signup threw: ${err.message}`);
  }

  // 4. Test Google sign in with Existing Hospital Doctor Account
  try {
    const resDoc = await fetch(`${BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'doctor@hospital.org', name: 'Dr. Marcus Vance' }),
    });
    const dataDoc: any = await resDoc.json();

    assert(resDoc.status === 200, `Existing Doctor login HTTP 200 (got ${resDoc.status})`);
    assert(dataDoc.success === true, 'Doctor login data.success is true');
    assert(dataDoc.role === 'doctor', `Doctor account preserves 'doctor' role (got '${dataDoc.role}')`);
    assert(dataDoc.user?.role === 'doctor', `Doctor user.role is 'doctor' (got '${dataDoc.user?.role}')`);
  } catch (err: any) {
    assert(false, `Doctor account login threw: ${err.message}`);
  }

  // 5. Test Google sign in with Existing Hospital Admin Account
  try {
    const resAdmin = await fetch(`${BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@hospital.org', name: 'Arthur Sterling' }),
    });
    const dataAdmin: any = await resAdmin.json();

    assert(resAdmin.status === 200, `Existing Admin login HTTP 200 (got ${resAdmin.status})`);
    assert(dataAdmin.success === true, 'Admin login data.success is true');
    assert(dataAdmin.role === 'admin', `Admin account preserves 'admin' role (got '${dataAdmin.role}')`);
  } catch (err: any) {
    assert(false, `Admin account login threw: ${err.message}`);
  }

  // 6. Test that Account A patient token cannot access Admin endpoint (Role confinement)
  if (tokenA) {
    try {
      const resAdminCheck = await fetch(`${BASE_URL}/api/admin/overview`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(resAdminCheck.status === 403, `Patient A token strictly blocked from /api/admin/overview with HTTP 403 (got ${resAdminCheck.status})`);
    } catch (err: any) {
      assert(false, `Admin security check threw: ${err.message}`);
    }
  }

  console.log('========================================');
  console.log(`RESULTS: ${passed}/${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
