/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import {
  PatientProfile,
  DoctorInfo,
  HospitalBranch,
  AppointmentRecord,
  FeedbackRecord,
} from './src/types/patient';
import {
  getValidHospitalInviteCodes,
  getValidAdminInvitationCodes,
  isInvitationCodeValid,
  checkRegistrationRateLimit,
} from './src/server/authSecurity';
import {
  getSupabaseConfig,
  getSupabaseAdmin,
  getSupabaseAnon,
  getSupabaseUserClient,
  testSupabaseConnection,
  sanitizeError,
} from './src/server/supabase';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// --- Database Connection State Management ---
let isDatabaseConnected = false;
let dbConnectionError: string | null = null;

export async function refreshDatabaseConnection(): Promise<boolean> {
  const result = await testSupabaseConnection();
  isDatabaseConnected = result.connected;
  dbConnectionError = result.connected ? null : (result.error || result.message);
  return isDatabaseConnected;
}

// Authoritative Supabase / PostgreSQL Tables Schema (10 Approved Entities)
export const REQUIRED_TABLES = [
  'users',
  'patients',
  'doctors',
  'appointments',
  'encounters',
  'lab_results',
  'prescriptions',
  'feedback',
  'app_users',
  'silver_patients',
  'silver_doctors',
  'silver_staff',
  'silver_appointments',
  'silver_encounters',
  'silver_prescriptions',
  'silver_lab_results',
  'silver_feedback',
  'silver_staff_assignment',
];

// --- Hospital Branches Reference Data ---
export const HOSPITAL_BRANCHES: HospitalBranch[] = [
  {
    branch_id: 'BR-MAIN',
    name: 'MediAI Medical Center — Main Campus',
    address: '400 Medical Center Way, Suite 100',
    city: 'Metro Medical District',
    phone: '+1 (555) 234-8000',
    working_hours: 'Mon-Sun: 24/7 Emergency & Inpatient | Outpatient: 8:00 AM - 8:00 PM',
  },
  {
    branch_id: 'BR-WEST',
    name: 'MediAI West Ambulatory & Imaging Pavilion',
    address: '1850 Valley View Boulevard',
    city: 'Westwood Heights',
    phone: '+1 (555) 234-8100',
    working_hours: 'Mon-Fri: 7:30 AM - 6:30 PM | Sat: 8:00 AM - 2:00 PM',
  },
  {
    branch_id: 'BR-CARD',
    name: 'MediAI Heart & Vascular Specialty Institute',
    address: '920 Cardio Boulevard, Building B',
    city: 'Central Health District',
    phone: '+1 (555) 234-8200',
    working_hours: 'Mon-Fri: 8:00 AM - 6:00 PM | Urgent Cardiology On-Call',
  },
  {
    branch_id: 'BR-NEURO',
    name: 'MediAI Neurosciences & Pediatric Specialty Care',
    address: '310 Pediatric Way',
    city: 'North Hills Campus',
    phone: '+1 (555) 234-8300',
    working_hours: 'Mon-Fri: 8:00 AM - 5:30 PM | Sat: 9:00 AM - 1:00 PM',
  },
];

export const MEDICAL_SPECIALTIES = [
  'Cardiology & Vascular Medicine',
  'Neurology & Neurosciences',
  'General Internal Medicine',
  'Emergency Medicine & Trauma',
  'Pediatrics & Neonatology',
  'Oncology & Hematology',
  'Orthopedic Surgery',
  'Obstetrics & Gynecology',
  'Radiology & Diagnostic Imaging',
  'Pulmonology & Critical Care',
];

// --- Format raw database rows to PatientProfile ---
function formatPatientProfile(raw: any): PatientProfile {
  const fullName = raw.name || raw.full_name || `${raw.first_name || ''} ${raw.last_name || ''}`.trim() || 'Patient';
  const nameParts = fullName.split(' ');
  const firstName = raw.first_name || nameParts[0] || '';
  const lastName = raw.last_name || nameParts.slice(1).join(' ') || '';

  return {
    patient_id: raw.patient_id || '',
    name: fullName,
    first_name: firstName,
    last_name: lastName,
    email: raw.email || '',
    phone: raw.phone || raw.phone_number || '',
    phone_number: raw.phone_number || raw.phone || '',
    date_of_birth: raw.date_of_birth || '',
    age: raw.age ? Number(raw.age) : undefined,
    gender: raw.gender || 'Not specified',
    city: raw.city || '',
    state: raw.state || '',
    socioeconomic_status: raw.socioeconomic_status || '',
    occupation: raw.occupation || '',
    registration_date: raw.registration_date || new Date().toISOString().split('T')[0],
    blood_group: raw.blood_group || '',
    emergency_contact: raw.emergency_contact || '',
    address: raw.address || '',
    primary_doctor_id: raw.primary_doctor_id || '',
    primary_doctor_name: raw.primary_doctor_name || '',
  };
}

// ============================================================================
// AUTHENTICATION & AUTHORIZATION MIDDLEWARE
// Validates Supabase JWT access tokens server-side for protected API requests.
// Resolves identity through auth.users(id) and public.app_users(id).
// ============================================================================
async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token missing or invalid. Please sign in.',
    });
  }

  const token = authHeader.split(' ')[1];
  const client = getSupabaseAdmin();

  if (!isDatabaseConnected || !client) {
    return res.status(401).json({
      success: false,
      message: 'Authentication service unavailable. Connect Supabase to validate sessions.',
    });
  }

  try {
    const { data: { user }, error: authError } = await client.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({
        success: false,
        message: 'Session expired or invalid. Please sign in again.',
      });
    }

    // Resolve app_users identity mapped 1:1 with auth.users(id)
    const { data: appUser, error: appUserError } = await client
      .from('app_users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (appUserError || !appUser) {
      return res.status(401).json({
        success: false,
        message: 'User profile not found in application registry.',
      });
    }

    if (!appUser.is_active) {
      return res.status(403).json({
        success: false,
        message: 'This user account has been deactivated. Please contact administration.',
      });
    }

    (req as any).authUser = user;
    (req as any).appUser = appUser;
    (req as any).authenticatedPatientId = appUser.patient_id;
    (req as any).userToken = token;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Error verifying session credentials.',
    });
  }
}

// Middleware: Strict patient-role enforcer
function requirePatientRole(req: Request, res: Response, next: NextFunction) {
  const appUser = (req as any).appUser;
  if (!appUser || appUser.role !== 'patient' || !appUser.patient_id) {
    return res.status(403).json({
      success: false,
      message: 'Access restricted: Patient role authorization required.',
    });
  }
  next();
}

// ============================================================================
// API ROUTES
// ============================================================================

// Server Health
app.get('/api/health', (_req: Request, res: Response) => {
  return res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    platform: 'MediAI Hospital Patient Experience & Operations Platform',
    databaseTarget: 'Supabase PostgreSQL',
  });
});

// Database Health & Status Endpoint
app.get(['/api/db/health', '/api/db/status'], async (_req: Request, res: Response) => {
  const config = getSupabaseConfig();
  return res.json({
    status: isDatabaseConnected ? 'connected' : 'pending_configuration',
    target: 'Supabase PostgreSQL',
    configured: config.configured,
    connected: isDatabaseConnected,
    mode: isDatabaseConnected ? 'LIVE_DATABASE' : 'PENDING_CONFIGURATION',
    message: isDatabaseConnected
      ? 'Connected to Supabase PostgreSQL database.'
      : config.configured
      ? `Database configured but unreachable: ${sanitizeError(dbConnectionError)}`
      : 'Database not configured. Supabase PostgreSQL connection pending setup.',
    requiredTables: REQUIRED_TABLES,
    cleanState: true,
  });
});

// Database Diagnostic Endpoint
app.get('/api/db/diagnostics', async (_req: Request, res: Response) => {
  const config = getSupabaseConfig();
  return res.json({
    target: 'Supabase PostgreSQL',
    configured: config.configured,
    connected: isDatabaseConnected,
    status: isDatabaseConnected ? 'CONNECTED' : 'WAITING_FOR_CREDENTIALS',
    remediation: config.configured
      ? 'Check network reachability to the Supabase host.'
      : 'Provide SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment variables.',
    requiredTables: REQUIRED_TABLES,
  });
});

// Database Test Connection Endpoint (Performs real connectivity check)
app.post('/api/db/test-connection', async (_req: Request, res: Response) => {
  const connected = await refreshDatabaseConnection();
  const config = getSupabaseConfig();

  if (connected) {
    return res.json({
      ok: true,
      status: 'connected',
      message: 'Connected to Supabase PostgreSQL database.',
    });
  }

  return res.json({
    ok: false,
    status: 'pending_configuration',
    message: config.configured
      ? `Connection attempt failed: ${sanitizeError(dbConnectionError)}`
      : 'Supabase PostgreSQL connection pending configuration. Provide SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to establish live connection.',
  });
});

// 1. Patient Login Endpoint
app.post('/api/auth/patient/login', async (req: Request, res: Response) => {
  const { patientId, username, password } = req.body;

  const rawInput = String(patientId || username || '').trim();
  if (!rawInput) {
    return res.status(400).json({
      success: false,
      message: 'Patient ID is required.',
    });
  }

  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'Password is required.',
    });
  }

  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      errorType: 'DATABASE_NOT_CONFIGURED',
      message: 'Database not configured. Connect Supabase to authenticate accounts.',
    });
  }

  const adminClient = getSupabaseAdmin();
  const anonClient = getSupabaseAnon() || adminClient;

  if (!adminClient || !anonClient) {
    return res.status(503).json({
      success: false,
      errorType: 'DATABASE_NOT_CONFIGURED',
      message: 'Database client not initialized.',
    });
  }

  try {
    // 1. Resolve email associated with Patient ID or email from public.app_users
    let query = adminClient.from('app_users').select('*').eq('role', 'patient');
    if (rawInput.includes('@')) {
      query = query.eq('email', rawInput.toLowerCase());
    } else {
      query = query.eq('patient_id', rawInput.toUpperCase());
    }

    const { data: userRecord, error: userError } = await query.single();

    if (userError || !userRecord) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Patient ID or password.',
      });
    }

    // 2. Authenticate through Supabase Auth
    const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
      email: userRecord.email,
      password,
    });

    if (authError || !authData.session) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Patient ID or password.',
      });
    }

    // 3. Fetch patient profile from silver_patients
    const { data: patientRecord } = await adminClient
      .from('silver_patients')
      .select('*')
      .eq('patient_id', userRecord.patient_id)
      .single();

    const formattedProfile = formatPatientProfile(patientRecord || userRecord);

    // 4. Check must_change_password security policy
    if (userRecord.must_change_password) {
      return res.json({
        success: true,
        mustChangePassword: true,
        tempToken: authData.session.access_token,
        patientId: userRecord.patient_id,
        patient: formattedProfile,
        message: 'Password change required on initial access.',
      });
    }

    return res.json({
      success: true,
      message: 'Authenticated successfully.',
      token: authData.session.access_token,
      patient: formattedProfile,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Authentication processing error.',
    });
  }
});

// 2. Generic Role Login (Doctor, Staff, Admin)
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { role, email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required.',
    });
  }

  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      errorType: 'DATABASE_NOT_CONFIGURED',
      message: 'Database not configured. Connect Supabase to authenticate accounts.',
    });
  }

  const adminClient = getSupabaseAdmin();
  const anonClient = getSupabaseAnon() || adminClient;

  if (!adminClient || !anonClient) {
    return res.status(503).json({
      success: false,
      errorType: 'DATABASE_NOT_CONFIGURED',
      message: 'Database client not initialized.',
    });
  }

  try {
    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError || !authData.user || !authData.session) {
      return res.status(401).json({
        success: false,
        message: `Invalid credentials for ${role || 'user'}.`,
      });
    }

    // 2. Validate role boundary from public.app_users
    const { data: appUser, error: appUserError } = await adminClient
      .from('app_users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (appUserError || !appUser) {
      return res.status(401).json({
        success: false,
        message: 'Account profile not found in hospital directory.',
      });
    }

    if (role && appUser.role !== role) {
      return res.status(403).json({
        success: false,
        message: `Access denied: Account is registered with role '${appUser.role}', not '${role}'.`,
      });
    }

    return res.json({
      success: true,
      message: 'Authenticated successfully.',
      token: authData.session.access_token,
      user: {
        id: appUser.id,
        email: appUser.email,
        role: appUser.role,
        name: appUser.full_name,
        patient_id: appUser.patient_id,
        doctor_id: appUser.doctor_id,
        staff_id: appUser.staff_id,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Authentication processing error.',
    });
  }
});

// 3. User Registration (Public Patient signup & Trusted Privileged Provisioning)
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const {
    role = 'patient',
    fullName,
    email: rawEmail,
    officialEmail,
    password,
    phone,
    dateOfBirth,
    specialization,
    medicalRegNumber,
    hospitalInviteCode,
    staffId,
    department,
    adminInviteCode,
  } = req.body;

  const email = String(rawEmail || officialEmail || '').trim().toLowerCase();

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'A valid email address is required for registration.',
    });
  }

  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'Password is required.',
    });
  }

  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      errorType: 'DATABASE_NOT_CONFIGURED',
      message: 'Database not configured. Connect Supabase to register accounts.',
    });
  }

  const adminClient = getSupabaseAdmin();
  const anonClient = getSupabaseAnon() || adminClient;

  if (!adminClient || !anonClient) {
    return res.status(503).json({
      success: false,
      errorType: 'DATABASE_NOT_CONFIGURED',
      message: 'Database client not initialized.',
    });
  }

  try {
    // A. Public Patient Registration
    if (role === 'patient') {
      const productionAppUrl = 'https://ais-dev-3mit3ofxc4v3mkup6fnuq4-979695568263.asia-southeast1.run.app';
      const emailRedirectTo = process.env.APP_URL || productionAppUrl;

      const { data: authData, error: authError } = await anonClient.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo,
          data: {
            full_name: fullName,
            phone,
            date_of_birth: dateOfBirth,
          },
        },
      });

      if (authError || !authData.user) {
        return res.status(400).json({
          success: false,
          message: authError?.message || 'Patient registration failed.',
        });
      }

      // Wait briefly for trigger handle_new_auth_user to finalize app_users record
      let appUser: any = null;
      for (let i = 0; i < 5; i++) {
        const { data } = await adminClient
          .from('app_users')
          .select('*')
          .eq('id', authData.user.id)
          .single();
        if (data) {
          appUser = data;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const requiresEmailConfirmation = !authData.session && !authData.user.confirmed_at;
      const patientId = appUser?.patient_id;

      const message = requiresEmailConfirmation
        ? `Registration successful! Your official Patient ID is ${patientId || 'assigned'}. A confirmation email has been sent. Please confirm your email address before signing in.`
        : `Registration successful! Your official Patient ID is ${patientId || 'assigned'}. You can now sign in using your Patient ID or email.`;

      return res.json({
        success: true,
        message,
        requiresEmailConfirmation,
        patientId,
        user: {
          id: authData.user.id,
          name: fullName,
          email: authData.user.email || email,
          role: 'patient',
          patient_id: patientId,
        },
      });
    }

    // B. Trusted Server-Side Privileged Provisioning (Doctor, Staff, Admin)
    if (['doctor', 'staff', 'admin'].includes(role)) {
      // 1. Rate Limiting Protection
      const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-client');
      const rateLimit = checkRegistrationRateLimit(clientIp);
      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Too many registration attempts. Please try again after 15 minutes.',
        });
      }
    }

    if (role === 'doctor') {
      if (!isInvitationCodeValid(hospitalInviteCode, getValidHospitalInviteCodes())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid registration credentials or authorization key.',
        });
      }

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { server_provisioned: true },
        user_metadata: { full_name: fullName, role: 'doctor' },
      });

      if (createError || !newUser.user) {
        return res.status(400).json({
          success: false,
          message: 'Registration request could not be processed.',
        });
      }

      let docRecord: any = null;
      try {
        const { data, error: docError } = await adminClient
          .from('silver_doctors')
          .insert({
            user_id: newUser.user.id,
            doctor_name: fullName,
            specialty: specialization || 'General Internal Medicine',
            email,
            phone_number: phone,
            qualification: medicalRegNumber ? `Reg: ${medicalRegNumber}` : 'MD',
          })
          .select()
          .single();

        if (docError) throw docError;
        docRecord = data;

        const { error: appUserError } = await adminClient.from('app_users').insert({
          id: newUser.user.id,
          doctor_id: docRecord.doctor_id,
          email,
          role: 'doctor',
          full_name: fullName,
          phone,
          is_active: true,
        });

        if (appUserError) throw appUserError;
      } catch (err: any) {
        // Compensating transaction: roll back created auth user and silver record to prevent orphan
        await adminClient.auth.admin.deleteUser(newUser.user.id);
        if (docRecord?.doctor_id) {
          await adminClient.from('silver_doctors').delete().eq('doctor_id', docRecord.doctor_id);
        }
        return res.status(500).json({
          success: false,
          message: `Doctor account provisioning failed. State rolled back: ${sanitizeError(err)}`,
        });
      }

      return res.json({
        success: true,
        message: 'Doctor account provisioned successfully.',
        user: { id: newUser.user.id, name: fullName, email, role: 'doctor', doctor_id: docRecord.doctor_id },
      });
    }

    if (role === 'staff') {
      if (!isInvitationCodeValid(hospitalInviteCode, getValidHospitalInviteCodes())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid registration credentials or authorization key.',
        });
      }

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { server_provisioned: true },
        user_metadata: { full_name: fullName, role: 'staff' },
      });

      if (createError || !newUser.user) {
        return res.status(400).json({
          success: false,
          message: 'Registration request could not be processed.',
        });
      }

      let stfRecord: any = null;
      try {
        const { data, error: stfError } = await adminClient
          .from('silver_staff')
          .insert({
            user_id: newUser.user.id,
            staff_name: fullName,
            role: 'Clinical Support',
            department: department || 'General Ward',
            email,
            contact_number: phone,
          })
          .select()
          .single();

        if (stfError) throw stfError;
        stfRecord = data;

        const { error: appUserError } = await adminClient.from('app_users').insert({
          id: newUser.user.id,
          staff_id: stfRecord.staff_id,
          email,
          role: 'staff',
          full_name: fullName,
          phone,
          is_active: true,
        });

        if (appUserError) throw appUserError;
      } catch (err: any) {
        await adminClient.auth.admin.deleteUser(newUser.user.id);
        if (stfRecord?.staff_id) {
          await adminClient.from('silver_staff').delete().eq('staff_id', stfRecord.staff_id);
        }
        return res.status(500).json({
          success: false,
          message: `Staff account provisioning failed. State rolled back: ${sanitizeError(err)}`,
        });
      }

      return res.json({
        success: true,
        message: 'Staff account provisioned successfully.',
        user: { id: newUser.user.id, name: fullName, email, role: 'staff', staff_id: stfRecord.staff_id },
      });
    }

    if (role === 'admin') {
      if (!isInvitationCodeValid(adminInviteCode, getValidAdminInvitationCodes())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid registration credentials or authorization key.',
        });
      }

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { server_provisioned: true },
        user_metadata: { full_name: fullName, role: 'admin' },
      });

      if (createError || !newUser.user) {
        return res.status(400).json({
          success: false,
          message: 'Registration request could not be processed.',
        });
      }

      try {
        const { error: appUserError } = await adminClient.from('app_users').insert({
          id: newUser.user.id,
          email,
          role: 'admin',
          full_name: fullName,
          phone,
          is_active: true,
        });

        if (appUserError) throw appUserError;
      } catch (err: any) {
        await adminClient.auth.admin.deleteUser(newUser.user.id);
        return res.status(500).json({
          success: false,
          message: `Admin account provisioning failed. State rolled back: ${sanitizeError(err)}`,
        });
      }

      return res.json({
        success: true,
        message: 'Administrative account provisioned successfully.',
        user: { id: newUser.user.id, name: fullName, email, role: 'admin' },
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid role requested.' });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `Registration processing error: ${sanitizeError(err)}`,
    });
  }
});

// 4. Password Recovery & Verification Endpoints
app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email address is required.' });
  }

  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      errorType: 'DATABASE_NOT_CONFIGURED',
      message: 'Database not configured. Connect Supabase to manage passwords.',
    });
  }

  const anonClient = getSupabaseAnon() || getSupabaseAdmin();
  if (anonClient) {
    await anonClient.auth.resetPasswordForEmail(email.trim().toLowerCase());
  }

  return res.json({
    success: true,
    message: 'If an account matches that address, password reset instructions have been sent.',
  });
});

app.post('/api/auth/verify-code', async (req: Request, res: Response) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ success: false, message: 'Email and verification code are required.' });
  }

  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      errorType: 'DATABASE_NOT_CONFIGURED',
      message: 'Database not configured. Connect Supabase to verify codes.',
    });
  }

  const anonClient = getSupabaseAnon() || getSupabaseAdmin();
  if (!anonClient) {
    return res.status(503).json({ success: false, message: 'Database client unavailable.' });
  }

  const { error } = await anonClient.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'recovery',
  });

  if (error) {
    return res.status(400).json({ success: false, message: error.message });
  }

  return res.json({ success: true, message: 'Verification code confirmed.' });
});

app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ success: false, message: 'Email and new password are required.' });
  }

  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      errorType: 'DATABASE_NOT_CONFIGURED',
      message: 'Database not configured. Connect Supabase to reset passwords.',
    });
  }

  return res.status(400).json({
    success: false,
    message: 'Please complete password reset via the secure email verification link.',
  });
});

// 5. Change Password Endpoint
app.post('/api/auth/patient/change-password', async (req: Request, res: Response) => {
  const { patientId, newPassword, tempToken } = req.body;

  if (!newPassword) {
    return res.status(400).json({ success: false, message: 'New password is required.' });
  }

  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      errorType: 'DATABASE_NOT_CONFIGURED',
      message: 'Database not configured. Connect Supabase to change passwords.',
    });
  }

  const adminClient = getSupabaseAdmin();
  if (!adminClient) {
    return res.status(503).json({ success: false, message: 'Database client unavailable.' });
  }

  try {
    // If tempToken is provided from initial login
    let userId: string | null = null;
    if (tempToken) {
      const { data: { user } } = await adminClient.auth.getUser(tempToken);
      if (user) userId = user.id;
    }

    if (!userId && patientId) {
      const { data: appUser } = await adminClient
        .from('app_users')
        .select('id')
        .eq('patient_id', patientId)
        .single();
      if (appUser) userId = appUser.id;
    }

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User verification failed.' });
    }

    // Update password via Supabase Auth Admin
    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (updateError) {
      return res.status(400).json({ success: false, message: updateError.message });
    }

    // Clear must_change_password flag in public.app_users
    await adminClient
      .from('app_users')
      .update({ must_change_password: false })
      .eq('id', userId);

    return res.json({
      success: true,
      message: 'Password updated successfully.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Password update processing error.' });
  }
});

// 6. Token Verification Endpoint
app.get('/api/auth/verify', authenticateToken, (req: Request, res: Response) => {
  const appUser = (req as any).appUser;
  return res.json({
    success: true,
    patientId: appUser.patient_id,
    user: {
      id: appUser.id,
      email: appUser.email,
      role: appUser.role,
      name: appUser.full_name,
    },
  });
});

// 7. Logout Endpoint
app.post('/api/auth/logout', async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const userClient = getSupabaseUserClient(token);
    if (userClient) {
      try {
        await userClient.auth.signOut();
      } catch {
        // ignore signout errors
      }
    }
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// 8. Patient Dashboard Endpoint
app.get('/api/patient/dashboard', authenticateToken, requirePatientRole, async (req: Request, res: Response) => {
  const patientId = (req as any).authenticatedPatientId;
  const adminClient = getSupabaseAdmin();

  if (!adminClient) {
    return res.status(503).json({
      success: false,
      message: 'Database connection unavailable.',
    });
  }

  try {
    // 1. Fetch Patient Demographics
    const { data: patientRecord } = await adminClient
      .from('silver_patients')
      .select('*')
      .eq('patient_id', patientId)
      .single();

    const patient = formatPatientProfile(patientRecord || { patient_id: patientId });

    // 2. Fetch Appointments
    const { data: appointmentsRaw } = await adminClient
      .from('silver_appointments')
      .select('*')
      .eq('patient_id', patientId)
      .order('appointment_date', { ascending: true });

    // Fetch doctors referenced in appointments to enrich display
    const doctorIds = Array.from(new Set((appointmentsRaw || []).map((a) => a.doctor_id)));
    let doctorMap: Record<string, any> = {};
    if (doctorIds.length > 0) {
      const { data: doctors } = await adminClient
        .from('silver_doctors')
        .select('*')
        .in('doctor_id', doctorIds);
      (doctors || []).forEach((d) => {
        doctorMap[d.doctor_id] = d;
      });
    }

    const upcomingAppointments: AppointmentRecord[] = (appointmentsRaw || []).map((a) => {
      const doc = doctorMap[a.doctor_id];
      return {
        appointment_id: a.appointment_id,
        patient_id: a.patient_id,
        doctor_id: a.doctor_id,
        doctor_name: doc?.doctor_name || 'Assigned Physician',
        specialty: doc?.specialty || 'General Practice',
        hospital_branch: doc?.hospital_branch || 'Main Campus',
        appointment_date: a.appointment_date,
        appointment_time: a.appointment_time,
        status: a.status,
        consultation_type: a.consultation_type || 'In-Person',
        consultation_duration_minutes: a.consultation_duration_minutes || 30,
        consultation_fee: Number(a.consultation_fee) || 0,
        payment_status: a.payment_status || 'Pending',
        reason: a.reason || '',
        symptoms: a.symptoms || '',
        notes: a.notes || '',
      };
    });

    // 3. Fetch Encounters
    const { data: encountersRaw } = await adminClient
      .from('silver_encounters')
      .select('*')
      .eq('patient_id', patientId)
      .order('encounter_date', { ascending: false });

    // 4. Fetch Prescriptions
    const { data: prescriptionsRaw } = await adminClient
      .from('silver_prescriptions')
      .select('*')
      .eq('patient_id', patientId)
      .order('prescribed_date', { ascending: false });

    // 5. Fetch Lab Results
    const { data: labsRaw } = await adminClient
      .from('silver_lab_results')
      .select('*')
      .eq('patient_id', patientId)
      .order('test_date', { ascending: false });

    // 6. Fetch Feedback
    const { data: feedbackRaw } = await adminClient
      .from('silver_feedback')
      .select('*')
      .eq('patient_id', patientId)
      .order('feedback_date', { ascending: false });

    return res.json({
      success: true,
      data: {
        patient,
        upcomingAppointments,
        completedEncounters: encountersRaw || [],
        labReports: labsRaw || [],
        prescriptions: prescriptionsRaw || [],
        feedbackList: feedbackRaw || [],
        notifications: [],
        backendStatus: {
          connected: true,
          engine: 'Supabase PostgreSQL',
          schema: 'Canonical Silver Schema',
          notice: 'Live Database',
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `Failed to load patient dashboard: ${sanitizeError(err)}`,
    });
  }
});

// 9. Submit Patient Feedback
app.post('/api/patient/feedback', authenticateToken, requirePatientRole, async (req: Request, res: Response) => {
  const patientId = (req as any).authenticatedPatientId;
  const { doctorId, encounterId, rating, waitRating, cleanlinessRating, staffRating, comments } = req.body;

  if (!doctorId || !rating) {
    return res.status(400).json({
      success: false,
      message: 'Doctor selection and overall rating are required.',
    });
  }

  const client = getSupabaseAdmin();
  if (!client) {
    return res.status(503).json({
      success: false,
      message: 'Database unavailable.',
    });
  }

  try {
    const { data, error } = await client
      .from('silver_feedback')
      .insert({
        patient_id: patientId,
        doctor_id: doctorId,
        encounter_id: encounterId || null,
        rating: Math.min(5, Math.max(1, Number(rating))),
        wait_time_rating: waitRating ? Math.min(5, Math.max(1, Number(waitRating))) : null,
        cleanliness_rating: cleanlinessRating ? Math.min(5, Math.max(1, Number(cleanlinessRating))) : null,
        staff_behavior_rating: staffRating ? Math.min(5, Math.max(1, Number(staffRating))) : null,
        comments: comments || null,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.json({
      success: true,
      message: 'Patient feedback registered successfully.',
      feedback: data,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `Failed to submit feedback: ${sanitizeError(err)}`,
    });
  }
});

// 10. Booking Wizard: Branches
app.get('/api/booking/branches', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    branches: HOSPITAL_BRANCHES,
  });
});

// 11. Booking Wizard: Specialties
app.get('/api/booking/specialties', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    specialties: MEDICAL_SPECIALTIES,
  });
});

// 12. Booking Wizard: Doctors (Filtered by branch and specialty)
app.get('/api/booking/doctors', async (req: Request, res: Response) => {
  if (!isDatabaseConnected) {
    return res.json({
      success: true,
      doctors: [],
      message: 'Database not connected. No doctors configured.',
    });
  }

  const client = getSupabaseAdmin();
  if (!client) {
    return res.json({ success: true, doctors: [] });
  }

  try {
    let query = client.from('silver_doctors').select('*').eq('is_active', true);

    const { branch, specialty } = req.query;
    if (branch) query = query.eq('hospital_branch', String(branch));
    if (specialty) query = query.eq('specialty', String(specialty));

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    const doctors: DoctorInfo[] = (data || []).map((d) => ({
      doctor_id: d.doctor_id,
      doctor_name: d.doctor_name,
      name: d.doctor_name || 'Dr. Physician',
      specialty: d.specialty,
      qualification: d.qualification || 'MD',
      experience_years: Number(d.experience_years) || 0,
      hospital_branch: d.hospital_branch || 'Main Campus',
      consultation_fee: Number(d.consultation_fee) || 0,
      availability_schedule: d.availability_schedule || '',
      rating: Number(d.rating) || 5.0,
      is_active: d.is_active,
    }));

    return res.json({
      success: true,
      doctors,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: sanitizeError(err) });
  }
});

// 13. Booking Wizard: Doctor Availability Slots
app.get('/api/booking/availability', async (req: Request, res: Response) => {
  const { doctorId, date } = req.query;

  if (!doctorId || !date) {
    return res.status(400).json({
      success: false,
      message: 'Both doctorId and date parameters are required.',
    });
  }

  if (!isDatabaseConnected) {
    return res.json({
      success: true,
      date: String(date),
      doctorId: String(doctorId),
      slots: [],
    });
  }

  const client = getSupabaseAdmin();
  if (!client) {
    return res.json({ success: true, date: String(date), doctorId: String(doctorId), slots: [] });
  }

  try {
    const { data: booked } = await client
      .from('silver_appointments')
      .select('appointment_time')
      .eq('doctor_id', String(doctorId))
      .eq('appointment_date', String(date))
      .in('status', ['Scheduled', 'Confirmed']);

    const bookedTimes = new Set((booked || []).map((b) => b.appointment_time?.slice(0, 5)));

    // Standard clinic schedule: 09:00 to 17:00 at 30-min increments
    const standardSlots = [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
    ];

    const slots = standardSlots.map((time) => ({
      time,
      available: !bookedTimes.has(time),
    }));

    return res.json({
      success: true,
      date: String(date),
      doctorId: String(doctorId),
      slots,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: sanitizeError(err) });
  }
});

// 14. Booking Wizard: Create Appointment
app.post('/api/booking/create', authenticateToken, requirePatientRole, async (req: Request, res: Response) => {
  const patientId = (req as any).authenticatedPatientId;
  const { doctorId, appointmentDate, appointmentTime, consultationType, reason, symptoms, notes } = req.body;

  if (!doctorId || !appointmentDate || !appointmentTime) {
    return res.status(400).json({
      success: false,
      message: 'Doctor ID, appointment date, and appointment time are required.',
    });
  }

  const client = getSupabaseAdmin();
  if (!client) {
    return res.status(503).json({
      success: false,
      message: 'Database unavailable.',
    });
  }

  try {
    const { data, error } = await client
      .from('silver_appointments')
      .insert({
        patient_id: patientId,
        doctor_id: doctorId,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        consultation_type: consultationType || 'In-Person',
        reason: reason || null,
        symptoms: symptoms || null,
        notes: notes || null,
        status: 'Scheduled',
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.json({
      success: true,
      message: 'Appointment scheduled successfully.',
      appointment: data,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `Appointment creation error: ${sanitizeError(err)}`,
    });
  }
});

// 15. Cancel Appointment
app.post('/api/booking/cancel', authenticateToken, requirePatientRole, async (req: Request, res: Response) => {
  const patientId = (req as any).authenticatedPatientId;
  const { appointmentId, reason } = req.body;

  if (!appointmentId) {
    return res.status(400).json({
      success: false,
      message: 'Appointment ID is required.',
    });
  }

  const client = getSupabaseAdmin();
  if (!client) {
    return res.status(503).json({
      success: false,
      message: 'Database unavailable.',
    });
  }

  try {
    const { data, error } = await client
      .from('silver_appointments')
      .update({
        status: 'Cancelled',
        cancellation_reason: reason || 'Cancelled by patient',
      })
      .eq('appointment_id', appointmentId)
      .eq('patient_id', patientId)
      .in('status', ['Scheduled', 'Confirmed'])
      .select()
      .single();

    if (error || !data) {
      return res.status(400).json({
        success: false,
        message: error?.message || 'Appointment not found or not in cancellable state.',
      });
    }

    return res.json({
      success: true,
      message: 'Appointment cancelled successfully.',
      appointment: data,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `Cancellation error: ${sanitizeError(err)}`,
    });
  }
});

// ============================================================================
// STATIC ASSETS & VITE INTEGRATION
// ============================================================================

async function startServer() {
  // Probe initial Supabase connection at server startup
  await refreshDatabaseConnection();

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[MediAI] Clean hospital application server running on port ${PORT}`);
    if (isDatabaseConnected) {
      console.log(`[MediAI] Status: Live Supabase PostgreSQL connection established.`);
    } else {
      console.log(`[MediAI] Status: Ready for Supabase PostgreSQL database integration.`);
    }
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
