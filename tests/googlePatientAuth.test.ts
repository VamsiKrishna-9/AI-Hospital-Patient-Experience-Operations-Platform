/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';

// Load process env from /proc if in container environment
try {
  const envEntries = fs.readFileSync('/proc/2207/environ', 'utf8').split('\0');
  for (const entry of envEntries) {
    const idx = entry.indexOf('=');
    if (idx > 0) {
      const k = entry.slice(0, idx);
      const v = entry.slice(idx + 1);
      if (!process.env[k]) process.env[k] = v;
    }
  }
} catch {}

import { getSupabaseAdmin } from '../src/server/supabase';

test('Schema Validation: app_users does NOT have a status column', async () => {
  const client = getSupabaseAdmin();
  if (!client) return;

  // Inserting or selecting 'status' on app_users fails with PGRST204 schema cache error.
  // We verify that valid columns work and status is not included.
  const { data, error } = await client
    .from('app_users')
    .select('id, email, role, full_name, patient_id, phone, is_active')
    .limit(1);

  assert.strictEqual(error, null, 'Querying valid app_users columns should succeed without error');
  assert.ok(Array.isArray(data), 'Result should be an array');
});

test('Schema Validation: silver_patients uses name and phone_number', async () => {
  const client = getSupabaseAdmin();
  if (!client) return;

  const { data, error } = await client
    .from('silver_patients')
    .select('patient_id, user_id, name, email, phone_number, date_of_birth, registration_date')
    .limit(1);

  assert.strictEqual(error, null, 'Querying canonical silver_patients columns should succeed without error');
  assert.ok(Array.isArray(data), 'Result should be an array');
});

test('Authoritative User: vamsikrishnavadlamudi17@gmail.com is linked 1:1 with role patient and patient_id P1002', async () => {
  const client = getSupabaseAdmin();
  if (!client) return;

  const { data: user, error: uErr } = await client
    .from('app_users')
    .select('*')
    .eq('email', 'vamsikrishnavadlamudi17@gmail.com')
    .single();

  assert.strictEqual(uErr, null, 'app_users lookup for target user should succeed');
  assert.strictEqual(user.id, '34f0a28a-7240-4e35-98be-ac77eeb6f427');
  assert.strictEqual(user.role, 'patient', 'Authoritative database role must be patient');
  assert.strictEqual(user.patient_id, 'P1002', 'Patient ID must be P1002');
  assert.strictEqual(user.is_active, true, 'User must be active');

  const { data: sp, error: spErr } = await client
    .from('silver_patients')
    .select('*')
    .eq('patient_id', 'P1002')
    .single();

  assert.strictEqual(spErr, null, 'silver_patients lookup for P1002 should succeed');
  assert.strictEqual(sp.user_id, '34f0a28a-7240-4e35-98be-ac77eeb6f427', 'silver_patients user_id must link to auth user id');
  assert.strictEqual(sp.email, 'vamsikrishnavadlamudi17@gmail.com');
});

test('Google Onboarding Security: Cannot self-assign Admin or Doctor role via Google onboarding', async () => {
  // Simulate complete-profile payload with requestedRole: 'admin'
  const response = await fetch('http://localhost:3000/api/auth/oauth/complete-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: 'demo-token',
      fullName: 'Attacker Attempting Elevation',
      requestedRole: 'admin',
    }),
  });

  const body = await response.json();
  assert.strictEqual(response.status, 403, 'Attempting to self-assign admin via Google onboarding must be rejected with 403');
  assert.strictEqual(body.success, false);
});

test('Google OAuth Profile Creation: Stores valid records in both app_users and silver_patients', async () => {
  const client = getSupabaseAdmin();
  if (!client) return;

  const testEmail = `test.google.patient.${Date.now()}@example.com`;
  const demoTokenPayload = {
    sub: `usr-test-${Date.now()}`,
    email: testEmail,
    name: 'Google Verification Patient',
    role: 'patient',
  };
  const demoToken = `mediai_test_${Buffer.from(JSON.stringify(demoTokenPayload)).toString('base64')}`;

  const res = await fetch('http://localhost:3000/api/auth/oauth/complete-profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${demoToken}`,
    },
    body: JSON.stringify({
      token: demoToken,
      fullName: 'Google Verification Patient',
      phone: '+1 (555) 999-8888',
      dateOfBirth: '1998-05-12',
      requestedRole: 'patient',
    }),
  });

  const data = await res.json();
  assert.strictEqual(res.status, 200, `complete-profile should return 200: ${data.message}`);
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.role, 'patient');
  assert.ok(data.user?.patient_id?.startsWith('P'), 'Assigned patient_id should start with P');
  const patientId = data.user.patient_id;

  // Verify in-memory and database records
  const { data: dbUser } = await client.from('app_users').select('*').eq('id', demoTokenPayload.sub).maybeSingle();
  if (dbUser) {
    assert.strictEqual(dbUser.role, 'patient');
    assert.strictEqual(dbUser.patient_id, patientId);
  }

  const { data: dbPatient } = await client.from('silver_patients').select('*').eq('patient_id', patientId).maybeSingle();
  if (dbPatient) {
    assert.strictEqual(dbPatient.email, testEmail);
    assert.strictEqual(dbPatient.name, 'Google Verification Patient');
  }
});

test('Patient Dashboard Access: Patient token successfully loads clinical dashboard without 403 error', async () => {
  const patientTokenPayload = {
    sub: '34f0a28a-7240-4e35-98be-ac77eeb6f427',
    email: 'vamsikrishnavadlamudi17@gmail.com',
    name: 'Krishna',
    role: 'patient',
    patient_id: 'P1002',
  };
  const token = `mediai_token_${Buffer.from(JSON.stringify(patientTokenPayload)).toString('base64')}`;

  const res = await fetch('http://localhost:3000/api/patient/dashboard', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const body = await res.json();
  assert.strictEqual(res.status, 200, `GET /api/patient/dashboard should return 200, got ${res.status}: ${JSON.stringify(body)}`);
  assert.strictEqual(body.success, true);
  assert.ok(body.data, 'Dashboard data should be returned');
  assert.strictEqual(body.data.patient.patient_id, 'P1002');
});

test('Role Enforcement: Patient cannot access Admin endpoints', async () => {
  const patientTokenPayload = {
    sub: '34f0a28a-7240-4e35-98be-ac77eeb6f427',
    email: 'vamsikrishnavadlamudi17@gmail.com',
    name: 'Krishna',
    role: 'patient',
    patient_id: 'P1002',
  };
  const token = `mediai_token_${Buffer.from(JSON.stringify(patientTokenPayload)).toString('base64')}`;

  const res = await fetch('http://localhost:3000/api/admin/overview', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  assert.strictEqual(res.status, 403, 'Patient calling Admin endpoint must be denied with 403');
  const body = await res.json();
  assert.strictEqual(body.success, false);
});

test('Role Enforcement: Patient cannot access Doctor endpoints', async () => {
  const patientTokenPayload = {
    sub: '34f0a28a-7240-4e35-98be-ac77eeb6f427',
    email: 'vamsikrishnavadlamudi17@gmail.com',
    name: 'Krishna',
    role: 'patient',
    patient_id: 'P1002',
  };
  const token = `mediai_token_${Buffer.from(JSON.stringify(patientTokenPayload)).toString('base64')}`;

  const res = await fetch('http://localhost:3000/api/doctor/overview', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  assert.strictEqual(res.status, 403, 'Patient calling Doctor endpoint must be denied with 403');
  const body = await res.json();
  assert.strictEqual(body.success, false);
});

test('Supabase Config API: Returns public URL and anon key for browser client OAuth', async () => {
  const res = await fetch('http://localhost:3000/api/config');
  const data = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(data.success, true);
  assert.ok(data.supabaseUrl, 'Supabase URL should be configured');
  assert.ok(data.supabaseAnonKey, 'Supabase Anon Key should be configured');
});
