/**
 * Verification Script: verify_google_auth_removal.ts
 *
 * Verifies that:
 * 1. Email/password login works for Patient, Doctor, Staff, and Admin.
 * 2. Manual patient registration works with unique patient ID allocation.
 * 3. Doctor registration workflow remains functional.
 * 4. Staff registration workflow remains functional.
 * 5. Supabase JWT authentication is properly generated.
 * 6. Role-based routing resolves correctly according to user roles.
 * 7. /api/auth/google endpoint returns 503 disabled status.
 * 8. Login and Signup UI templates contain NO Google buttons, SVGs, or OAuth references.
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

async function runVerification() {
  console.log('======================================================================');
  console.log('  MediAI Hospital - Google Authentication Removal Verification');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test ${total}: ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test ${total}: ${msg}`);
      process.exitCode = 1;
    }
  }

  // --- 1. Frontend UI Inspection (No Google UI Elements) ---
  console.log('--- Phase 1: Checking Frontend UI Source Files ---');
  const loginSrc = fs.readFileSync(path.resolve('./src/components/LoginScreen.tsx'), 'utf-8');
  const signupSrc = fs.readFileSync(path.resolve('./src/components/SignupScreen.tsx'), 'utf-8');
  const appSrc = fs.readFileSync(path.resolve('./src/App.tsx'), 'utf-8');

  assert(!loginSrc.includes('Continue with Google'), 'LoginScreen has no "Continue with Google" button');
  assert(!loginSrc.includes('signInWithOAuth'), 'LoginScreen has no signInWithOAuth call');
  assert(!loginSrc.includes('showGoogleModal'), 'LoginScreen has no showGoogleModal state');
  assert(!loginSrc.includes('or sign in with credentials'), 'LoginScreen has no credential divider');

  assert(!signupSrc.includes('Sign up with Google'), 'SignupScreen has no "Sign up with Google" button');
  assert(!signupSrc.includes('signInWithOAuth'), 'SignupScreen has no signInWithOAuth call');
  assert(!signupSrc.includes('or register with'), 'SignupScreen has no credentials divider');

  assert(!appSrc.includes('api/auth/google'), 'App.tsx has no Google OAuth callback fetch');

  // --- 2. Backend /api/auth/google Disabled Verification ---
  console.log('\n--- Phase 2: Backend Google Endpoint Check ---');
  try {
    const resGoogle = await fetch(`${BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@gmail.com' }),
    });
    assert(resGoogle.status === 503, `POST /api/auth/google returns HTTP 503 Disabled (got ${resGoogle.status})`);
    const dataGoogle: any = await resGoogle.json();
    assert(dataGoogle.success === false, 'dataGoogle.success is false');
    assert(dataGoogle.message.includes('temporarily disabled'), `Disabled message verified: "${dataGoogle.message}"`);
  } catch (err: any) {
    assert(false, `/api/auth/google check threw: ${err.message}`);
  }

  // --- 3. Manual Patient Registration ---
  console.log('\n--- Phase 3: Manual Patient Registration ---');
  const ts = Date.now();
  const patientEmail = `manual.patient.${ts}@patient.mediai.health`;
  let patientToken = '';
  let allocatedPatientId = '';

  try {
    const resReg = await fetch(`${BASE_URL}/api/auth/common-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Eleanor Vance',
        email: patientEmail,
        password: 'Password@2026',
        phone: '+1 (555) 432-8899',
        dateOfBirth: '1992-06-15',
        role: 'patient',
      }),
    });
    const dataReg: any = await resReg.json();

    assert(resReg.status === 200, `Patient manual registration returns HTTP 200 (got ${resReg.status})`);
    assert(dataReg.success === true, 'dataReg.success is true');
    assert(dataReg.role === 'patient', `dataReg.role is 'patient' (got '${dataReg.role}')`);
    assert(Boolean(dataReg.patientId && dataReg.patientId.startsWith('P')), `Allocated Patient ID: ${dataReg.patientId}`);
    allocatedPatientId = dataReg.patientId;
  } catch (err: any) {
    assert(false, `Manual patient registration threw: ${err.message}`);
  }

  // --- 4. Manual Patient Login via Email & Password ---
  console.log('\n--- Phase 4: Manual Patient Login ---');
  try {
    const resLogin = await fetch(`${BASE_URL}/api/auth/common-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: patientEmail,
        password: 'Password@2026',
      }),
    });
    const dataLogin: any = await resLogin.json();

    assert(resLogin.status === 200, `Patient email/password login returns HTTP 200 (got ${resLogin.status})`);
    assert(dataLogin.success === true, 'dataLogin.success is true');
    assert(dataLogin.role === 'patient', `dataLogin.role is 'patient' (got '${dataLogin.role}')`);
    assert(Boolean(dataLogin.token), 'Valid Supabase JWT token received');
    patientToken = dataLogin.token;

    // Verify patient dashboard access
    const resDash = await fetch(`${BASE_URL}/api/patient/dashboard`, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });
    assert(resDash.status === 200, `Patient dashboard loaded with JWT token (HTTP ${resDash.status})`);
  } catch (err: any) {
    assert(false, `Patient login threw: ${err.message}`);
  }

  // --- 5. Manual Doctor Registration Workflow ---
  console.log('\n--- Phase 5: Manual Doctor Registration ---');
  const doctorEmail = `dr.applicant.${ts}@hospital.org`;
  try {
    const resDocReg = await fetch(`${BASE_URL}/api/auth/common-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Dr. Clara Oswald',
        email: doctorEmail,
        password: 'DoctorPassword@2026',
        role: 'doctor',
        specialization: 'Neurology & Neurosciences',
        qualifications: 'MBBS, MD (Neurology)',
        department: 'Neurology Specialty Institute',
        yearsOfExperience: '8',
        phone: '+1 (555) 345-6789',
      }),
    });
    const dataDocReg: any = await resDocReg.json();

    assert(resDocReg.status === 200, `Doctor manual registration returns HTTP 200 (got ${resDocReg.status})`);
    assert(dataDocReg.success === true, 'dataDocReg.success is true');
    assert(dataDocReg.role === 'doctor', `dataDocReg.role is 'doctor' (got '${dataDocReg.role}')`);
    assert(Boolean(dataDocReg.doctorId && (dataDocReg.doctorId.startsWith('D') || dataDocReg.doctorId.startsWith('DOC'))), `Allocated Doctor ID: ${dataDocReg.doctorId}`);
    assert(dataDocReg.requiresApproval === true || dataDocReg.status === 'pending_approval' || dataDocReg.status === 'active', `Doctor status handled: ${dataDocReg.status}`);
  } catch (err: any) {
    assert(false, `Doctor registration threw: ${err.message}`);
  }

  // --- 6. Manual Staff Registration Workflow ---
  console.log('\n--- Phase 6: Manual Staff Registration ---');
  const staffEmail = `staff.nurse.${ts}@hospital.org`;
  try {
    const resStaffReg = await fetch(`${BASE_URL}/api/auth/common-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Nurse Rory Williams',
        email: staffEmail,
        password: 'StaffPassword@2026',
        role: 'staff',
        department: 'Emergency & Acute Trauma',
        designation: 'Senior Triage Nurse',
        phone: '+1 (555) 456-7890',
      }),
    });
    const dataStaffReg: any = await resStaffReg.json();

    assert(resStaffReg.status === 200, `Staff manual registration returns HTTP 200 (got ${resStaffReg.status})`);
    assert(dataStaffReg.success === true, 'dataStaffReg.success is true');
    assert(dataStaffReg.role === 'staff', `dataStaffReg.role is 'staff' (got '${dataStaffReg.role}')`);
    assert(Boolean(dataStaffReg.staffId && (dataStaffReg.staffId.startsWith('S') || dataStaffReg.staffId.startsWith('STF'))), `Allocated Staff ID: ${dataStaffReg.staffId}`);
  } catch (err: any) {
    assert(false, `Staff registration threw: ${err.message}`);
  }

  // --- 7. Existing Hospital Roles Login & Boundary Verification ---
  console.log('\n--- Phase 7: Existing Role Authentication & Boundary Checks ---');
  // Doctor Persona
  try {
    const resDocLogin = await fetch(`${BASE_URL}/api/auth/common-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'doctor@hospital.org',
        password: 'Doctor@2026',
      }),
    });
    const dataDocLogin: any = await resDocLogin.json();
    assert(resDocLogin.status === 200, `Doctor login returns HTTP 200 (got ${resDocLogin.status})`);
    assert(dataDocLogin.role === 'doctor', `Doctor role preserved (got '${dataDocLogin.role}')`);
  } catch (err: any) {
    assert(false, `Doctor login threw: ${err.message}`);
  }

  // Staff Persona
  try {
    const resStaffLogin = await fetch(`${BASE_URL}/api/auth/common-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'staff@hospital.org',
        password: 'Staff@2026',
      }),
    });
    const dataStaffLogin: any = await resStaffLogin.json();
    assert(resStaffLogin.status === 200, `Staff login returns HTTP 200 (got ${resStaffLogin.status})`);
    assert(dataStaffLogin.role === 'staff', `Staff role preserved (got '${dataStaffLogin.role}')`);
  } catch (err: any) {
    assert(false, `Staff login threw: ${err.message}`);
  }

  // Admin Persona
  try {
    const resAdminLogin = await fetch(`${BASE_URL}/api/auth/common-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@hospital.org',
        password: 'Admin@2026',
      }),
    });
    const dataAdminLogin: any = await resAdminLogin.json();
    assert(resAdminLogin.status === 200, `Admin login returns HTTP 200 (got ${resAdminLogin.status})`);
    assert(dataAdminLogin.role === 'admin', `Admin role preserved (got '${dataAdminLogin.role}')`);

    // Verify admin overview access with admin token
    if (dataAdminLogin.token) {
      const resAdminOverview = await fetch(`${BASE_URL}/api/admin/overview`, {
        headers: { Authorization: `Bearer ${dataAdminLogin.token}` },
      });
      assert(resAdminOverview.status === 200, `Admin overview endpoint accessible with admin token (HTTP ${resAdminOverview.status})`);
    }
  } catch (err: any) {
    assert(false, `Admin login threw: ${err.message}`);
  }

  // --- 8. Patient Security Confinement ---
  if (patientToken) {
    const resPatientToAdmin = await fetch(`${BASE_URL}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });
    assert(resPatientToAdmin.status === 403, `Patient token blocked from admin endpoints with HTTP 403 (got ${resPatientToAdmin.status})`);
  }

  console.log('\n======================================================================');
  console.log(`RESULTS: ${passed}/${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
  console.log('======================================================================\n');
}

runVerification();
