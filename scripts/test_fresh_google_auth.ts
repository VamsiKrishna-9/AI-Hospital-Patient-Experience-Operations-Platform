/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getSupabaseBrowserClient } from '../src/services/supabaseClient';
import { getSupabaseAdmin } from '../src/server/supabase';

async function runTests() {
  console.log('=== MediAI Fresh Google OAuth Verification Suite ===\n');
  const baseUrl = 'http://localhost:3000';
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc}`);
    }
  }

  // TEST 1: Check Client-side OAuth URL generation
  console.log('--- Test 1: signInWithOAuth URL and Parameters ---');
  try {
    const client = await getSupabaseBrowserClient();
    assert(!!client, 'Supabase browser client initialized');

    if (client) {
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://ais-dev-3mit3ofxc4v3mkup6fnuq4-979695568263.asia-southeast1.run.app/auth/callback',
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      assert(!error, 'signInWithOAuth executed without error');
      assert(!!data?.url, 'Generated OAuth authorization URL exists');

      if (data?.url) {
        const generatedUrl = new URL(data.url);
        assert(generatedUrl.searchParams.get('provider') === 'google', 'Query param provider is "google"');
        assert(generatedUrl.searchParams.get('prompt') === 'select_account', 'Query param prompt is "select_account"');
        assert(
          generatedUrl.searchParams.get('redirect_to')?.includes('/auth/callback') === true,
          'Redirect URL points to /auth/callback'
        );
      }
    }
  } catch (err: any) {
    console.error('Test 1 error:', err);
    assert(false, `Test 1 failed with exception: ${err.message}`);
  }

  // TEST 2: POST /api/auth/oauth/resolve without token
  console.log('\n--- Test 2: /api/auth/oauth/resolve Authentication Validation ---');
  try {
    const resNoToken = await fetch(`${baseUrl}/api/auth/oauth/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert(resNoToken.status === 401, 'POST /api/auth/oauth/resolve without token returns HTTP 401');
  } catch (err: any) {
    assert(false, `Test 2 error: ${err.message}`);
  }

  // TEST 3: POST /api/auth/oauth/resolve for existing user
  console.log('\n--- Test 3: /api/auth/oauth/resolve for Existing User ---');
  try {
    // Generate test user token (using mediai mock token representation supported by dev server)
    const existingEmail = 'patient@hospital.org';
    const mockPayload = Buffer.from(JSON.stringify({
      email: existingEmail,
      sub: 'usr-patient-default',
      role: 'patient',
      patient_id: 'P1001',
      name: 'Vamsi Krishna Vadlamudi',
    })).toString('base64');
    const existingToken = `mediai_access_token_${mockPayload}`;

    const resExisting = await fetch(`${baseUrl}/api/auth/oauth/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${existingToken}`,
      },
      body: JSON.stringify({ token: existingToken }),
    });

    assert(resExisting.status === 200, 'Existing user resolve returns HTTP 200');
    const existingData = await resExisting.json();
    console.log('Test 3 user received:', existingData.user);
    assert(existingData.success === true, 'Response success is true');
    assert(existingData.status === 'authenticated', 'Status is "authenticated"');
    assert(existingData.role === 'patient', 'Role is "patient"');
    assert(typeof existingData.user?.patient_id === 'string' && existingData.user.patient_id.startsWith('P'), `Patient ID is valid authoritative ID (${existingData.user?.patient_id})`);
  } catch (err: any) {
    assert(false, `Test 3 error: ${err.message}`);
  }

  // TEST 4: POST /api/auth/oauth/resolve for NEW Google user
  console.log('\n--- Test 4: /api/auth/oauth/resolve for New Google User (Needs Profile) ---');
  let newGoogleToken = '';
  const newGoogleEmail = `test.newuser.${Date.now()}@gmail.com`;
  try {
    const newPayload = Buffer.from(JSON.stringify({
      email: newGoogleEmail,
      sub: `usr-google-${Date.now()}`,
      name: 'New Google User',
    })).toString('base64');
    newGoogleToken = `mediai_access_token_${newPayload}`;

    const resNew = await fetch(`${baseUrl}/api/auth/oauth/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newGoogleToken}`,
      },
      body: JSON.stringify({ token: newGoogleToken }),
    });

    assert(resNew.status === 200, 'New user resolve returns HTTP 200');
    const newData = await resNew.json();
    assert(newData.success === true, 'Response success is true');
    assert(newData.status === 'needs_profile', 'Status is "needs_profile"');
    assert(newData.authUser?.email === newGoogleEmail, 'AuthUser email matches new Google user');
  } catch (err: any) {
    assert(false, `Test 4 error: ${err.message}`);
  }

  // TEST 5: POST /api/auth/oauth/complete-profile rejects Admin / Doctor privilege self-assignment
  console.log('\n--- Test 5: Prevent Privilege Escalation on Onboarding ---');
  try {
    const resEscalateAdmin = await fetch(`${baseUrl}/api/auth/oauth/complete-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newGoogleToken}`,
      },
      body: JSON.stringify({
        token: newGoogleToken,
        fullName: 'Attacker Admin',
        phone: '+1 555-234-5678',
        dateOfBirth: '1990-01-01',
        requestedRole: 'admin',
      }),
    });
    assert(resEscalateAdmin.status === 403, 'Self-assigning Admin role returns HTTP 403');

    const resEscalateDoctor = await fetch(`${baseUrl}/api/auth/oauth/complete-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newGoogleToken}`,
      },
      body: JSON.stringify({
        token: newGoogleToken,
        fullName: 'Attacker Doctor',
        phone: '+1 555-234-5678',
        dateOfBirth: '1990-01-01',
        requestedRole: 'doctor',
      }),
    });
    assert(resEscalateDoctor.status === 403, 'Self-assigning Doctor role returns HTTP 403');
  } catch (err: any) {
    assert(false, `Test 5 error: ${err.message}`);
  }

  // TEST 6: POST /api/auth/oauth/complete-profile successfully creates Patient profile
  console.log('\n--- Test 6: Complete Patient Onboarding Profile ---');
  try {
    const resComplete = await fetch(`${baseUrl}/api/auth/oauth/complete-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newGoogleToken}`,
      },
      body: JSON.stringify({
        token: newGoogleToken,
        fullName: 'Verified Patient',
        phone: '+1 (555) 345-6789',
        dateOfBirth: '1992-04-15',
        requestedRole: 'patient',
      }),
    });

    assert(resComplete.status === 200, 'Complete profile returns HTTP 200');
    const completeData = await resComplete.json();
    assert(completeData.success === true, 'Response success is true');
    assert(completeData.role === 'patient', 'Assigned role is strictly "patient"');
    assert(typeof completeData.user?.patient_id === 'string' && completeData.user.patient_id.startsWith('P'), 'Allocated Patient ID starts with P');

    // Verify resolve now recognizes user as authenticated
    const resResolvedAgain = await fetch(`${baseUrl}/api/auth/oauth/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newGoogleToken}`,
      },
      body: JSON.stringify({ token: newGoogleToken }),
    });
    const reData = await resResolvedAgain.json();
    assert(reData.status === 'authenticated', 'Subsequent resolve now returns "authenticated"');
    assert(reData.role === 'patient', 'Subsequent resolve role is "patient"');

    // Verify duplicate profile prevention: calling complete-profile again preserves existing profile
    const resDup = await fetch(`${baseUrl}/api/auth/oauth/complete-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newGoogleToken}`,
      },
      body: JSON.stringify({
        token: newGoogleToken,
        fullName: 'Duplicate Attempter',
        phone: '+1 (555) 000-0000',
        dateOfBirth: '1990-01-01',
      }),
    });
    assert(resDup.status === 200, 'Duplicate complete-profile request returns HTTP 200');
    const dupData = await resDup.json();
    assert(dupData.user?.patient_id === completeData.user?.patient_id, 'Duplicate profile creation prevented, preserving original patient ID');
  } catch (err: any) {
    assert(false, `Test 6 error: ${err.message}`);
  }

  // TEST 7: Patient Token is blocked from Admin Dashboard API
  console.log('\n--- Test 7: Verify RBAC - Patient Cannot Access Admin Overview ---');
  try {
    const resAdmin = await fetch(`${baseUrl}/api/admin/overview`, {
      headers: {
        Authorization: `Bearer ${newGoogleToken}`,
      },
    });
    assert(resAdmin.status === 403, 'Patient token cannot access /api/admin/overview (HTTP 403)');
  } catch (err: any) {
    assert(false, `Test 7 error: ${err.message}`);
  }

  // TEST 8: Verify Email/Password Login Still Works
  console.log('\n--- Test 8: Verify Email/Password Login Intact ---');
  try {
    const resLogin = await fetch(`${baseUrl}/api/auth/common-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'patient@hospital.org',
        password: 'Patient@2026',
      }),
    });
    assert(resLogin.status === 200, 'Standard patient password login returns HTTP 200');
    const loginData = await resLogin.json();
    assert(loginData.success === true, 'Login response success is true');
    assert(loginData.user?.role === 'patient', 'User role is patient');
  } catch (err: any) {
    assert(false, `Test 8 error: ${err.message}`);
  }

  console.log(`\n========================================`);
  console.log(`Results: ${passed} / ${total} tests passed.`);
  if (passed === total) {
    console.log('🎉 ALL GOOGLE OAUTH AND SECURITY TESTS PASSED!');
  } else {
    console.error('⚠️ Some tests failed.');
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
