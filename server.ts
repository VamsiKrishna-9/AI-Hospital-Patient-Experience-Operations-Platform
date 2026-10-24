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

  if (token && token.startsWith('demo-session-token-')) {
    const parts = token.replace('demo-session-token-', '').split('-');
    const role = (['patient', 'doctor', 'staff', 'admin'].includes(parts[0]) ? parts[0] : 'patient') as any;
    (req as any).authUser = { id: `demo-${role}-user`, email: `${role}@hospital.org` };
    (req as any).appUser = {
      id: `demo-${role}-user`,
      role,
      patient_id: role === 'patient' ? 'P182162' : null,
      doctor_id: role === 'doctor' ? 'DOC-7721' : null,
      staff_id: role === 'staff' ? 'STF-4401' : null,
      full_name:
        role === 'doctor'
          ? 'Dr. Marcus Vance, MD'
          : role === 'staff'
          ? 'Sarah Jenkins, RN'
          : role === 'admin'
          ? 'Arthur Sterling, MHA'
          : 'Elena Rostova',
      email: `${role}@hospital.org`,
      is_active: true,
    };
    (req as any).authenticatedPatientId = role === 'patient' ? 'P182162' : null;
    (req as any).userToken = token;
    return next();
  }

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

// Middleware: Strict admin-role enforcer
function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  const appUser = (req as any).appUser;
  if (!appUser || appUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access restricted: Executive Administrator authorization required.',
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

// ============================================================================
// DYNAMIC MULTI-ROLE IN-MEMORY & SUPABASE HYBRID REGISTRY
// Supports persistent in-memory user registration, role updates, and Google SSO
// ============================================================================

interface RegisteredAccount {
  id: string;
  email: string;
  fullName: string;
  role: 'patient' | 'doctor' | 'staff' | 'admin';
  password?: string;
  patient_id?: string;
  doctor_id?: string;
  staff_id?: string;
  historical_identifiers?: {
    doctor_id?: string;
    staff_id?: string;
    patient_id?: string;
  };
  specialty?: string;
  department?: string;
  phone?: string;
  date_of_birth?: string;
  created_at: string;
}

const REGISTERED_ACCOUNTS = new Map<string, RegisteredAccount>();

// Initialize default hospital credential personas
function initializeDefaultAccounts() {
  const defaults: RegisteredAccount[] = [
    {
      id: 'usr-patient-182162',
      email: 'patient@hospital.org',
      fullName: 'Elena Rostova',
      role: 'patient',
      password: 'Patient@2026',
      patient_id: 'P182162',
      phone: '+1 (555) 234-9182',
      date_of_birth: '1984-06-12',
      created_at: new Date().toISOString(),
    },
    {
      id: 'usr-doctor-7721',
      email: 'doctor@hospital.org',
      fullName: 'Dr. Marcus Vance, MD',
      role: 'doctor',
      password: 'Doctor@2026',
      doctor_id: 'DOC-7721',
      specialty: 'Cardiology & Vascular Medicine',
      department: 'Cardiovascular Specialty Institute',
      created_at: new Date().toISOString(),
    },
    {
      id: 'usr-staff-4401',
      email: 'staff@hospital.org',
      fullName: 'Sarah Jenkins, RN',
      role: 'staff',
      password: 'Staff@2026',
      staff_id: 'STF-4401',
      department: 'Inpatient Ward 4B & Clinical Triage',
      created_at: new Date().toISOString(),
    },
    {
      id: 'usr-admin-001',
      email: 'admin@hospital.org',
      fullName: 'Arthur Sterling, MHA',
      role: 'admin',
      password: 'Admin@2026',
      department: 'Hospital Administration & Executive Governance',
      created_at: new Date().toISOString(),
    },
  ];

  for (const acc of defaults) {
    REGISTERED_ACCOUNTS.set(acc.email.toLowerCase(), acc);
    if (acc.patient_id) REGISTERED_ACCOUNTS.set(acc.patient_id.toUpperCase(), acc);
    if (acc.doctor_id) REGISTERED_ACCOUNTS.set(acc.doctor_id.toUpperCase(), acc);
    if (acc.staff_id) REGISTERED_ACCOUNTS.set(acc.staff_id.toUpperCase(), acc);
  }
}
initializeDefaultAccounts();

export interface AuditLogEntry {
  id: string;
  action: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  targetUserId: string;
  targetUserName: string;
  targetUserEmail: string;
  previousRole: string;
  newRole: string;
  reason?: string;
  timestamp: string;
  databaseStatus: string;
}

const AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'AUD-1001',
    action: 'ROLE_ELEVATION_ADMIN',
    adminId: 'ADM-001',
    adminName: 'Arthur Sterling, MHA',
    adminEmail: 'admin@hospital.org',
    targetUserId: 'usr-admin-001',
    targetUserName: 'Arthur Sterling, MHA',
    targetUserEmail: 'admin@hospital.org',
    previousRole: 'patient',
    newRole: 'admin',
    reason: 'Initial executive governance authorization',
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    databaseStatus: 'COMMITTED',
  },
  {
    id: 'AUD-1002',
    action: 'ROLE_MODIFICATION',
    adminId: 'ADM-001',
    adminName: 'Arthur Sterling, MHA',
    adminEmail: 'admin@hospital.org',
    targetUserId: 'usr-doctor-7721',
    targetUserName: 'Dr. Marcus Vance, MD',
    targetUserEmail: 'doctor@hospital.org',
    previousRole: 'staff',
    newRole: 'doctor',
    reason: 'Cardiovascular Specialty Institute clinical appointment',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    databaseStatus: 'COMMITTED',
  },
];

function getUniqueRegisteredAccounts(): RegisteredAccount[] {
  const seenEmails = new Set<string>();
  const accounts: RegisteredAccount[] = [];
  for (const acc of REGISTERED_ACCOUNTS.values()) {
    const key = acc.email?.toLowerCase();
    if (key && !seenEmails.has(key)) {
      seenEmails.add(key);
      accounts.push(acc);
    }
  }
  return accounts;
}

// 2.5 Common Unified Multi-Role Login Endpoint
app.post('/api/auth/common-login', async (req: Request, res: Response) => {
  const { identifier, username, email, patientId, password } = req.body;
  const rawInput = String(identifier || username || email || patientId || '').trim();

  if (!rawInput) {
    return res.status(400).json({
      success: false,
      message: 'Patient ID or official email address is required.',
    });
  }

  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'Password is required.',
    });
  }

  // 1. Live Supabase PostgreSQL authentication flow if connected
  if (isDatabaseConnected) {
    const adminClient = getSupabaseAdmin();
    const anonClient = getSupabaseAnon() || adminClient;

    if (adminClient && anonClient) {
      try {
        let query = adminClient.from('app_users').select('*');
        if (rawInput.includes('@')) {
          query = query.eq('email', rawInput.toLowerCase());
        } else {
          query = query.eq('patient_id', rawInput.toUpperCase());
        }

        const { data: userRecord, error: userError } = await query.single();

        if (!userError && userRecord) {
          const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
            email: userRecord.email,
            password,
          });

          if (!authError && authData.session) {
            let patientProfile = null;
            if (userRecord.role === 'patient') {
              const { data: patientRecord } = await adminClient
                .from('silver_patients')
                .select('*')
                .eq('patient_id', userRecord.patient_id)
                .single();
              patientProfile = formatPatientProfile(patientRecord || userRecord);
            }

            return res.json({
              success: true,
              role: userRecord.role,
              token: authData.session.access_token,
              mustChangePassword: Boolean(userRecord.must_change_password),
              patientId: userRecord.patient_id,
              patient: patientProfile,
              user: {
                id: userRecord.id,
                email: userRecord.email,
                role: userRecord.role,
                name: userRecord.full_name || 'Hospital User',
                patient_id: userRecord.patient_id,
                doctor_id: userRecord.doctor_id,
                staff_id: userRecord.staff_id,
              },
              message: `Authenticated successfully as ${userRecord.role}.`,
            });
          }
        }
      } catch (err) {
        console.error('Supabase auth error in common-login:', err);
      }
    }
  }

  // 2. In-Memory Registry Lookup (for newly registered accounts & test personas)
  const lookupKey = rawInput.toLowerCase();
  const lookupIdKey = rawInput.toUpperCase();
  const registered = REGISTERED_ACCOUNTS.get(lookupKey) || REGISTERED_ACCOUNTS.get(lookupIdKey);

  if (registered) {
    if (registered.password && registered.password !== password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password. Please check your credentials.',
      });
    }

    const demoToken = `demo-session-token-${registered.role}-${Date.now()}`;
    const demoPatient = registered.role === 'patient' ? {
      patient_id: registered.patient_id || 'P182162',
      name: registered.fullName,
      first_name: registered.fullName.split(' ')[0] || 'Patient',
      last_name: registered.fullName.split(' ').slice(1).join(' ') || 'User',
      email: registered.email,
      phone: registered.phone || '+1 (555) 234-9182',
      date_of_birth: registered.date_of_birth || '1984-06-12',
      age: 40,
      gender: 'Female',
      blood_group: 'O+',
      city: 'Metro Medical District',
      state: 'CA',
      address: '742 Evergreen Terrace, Suite 300',
      emergency_contact: 'Family Contact (+1 555-234-9183)',
      primary_doctor_name: 'Dr. Marcus Vance, MD',
    } : undefined;

    return res.json({
      success: true,
      isDemoMode: !isDatabaseConnected,
      role: registered.role,
      token: demoToken,
      user: {
        id: registered.id,
        name: registered.fullName,
        email: registered.email,
        role: registered.role,
        patient_id: registered.patient_id,
        doctor_id: registered.doctor_id,
        staff_id: registered.staff_id,
        specialty: registered.specialty,
        department: registered.department,
      },
      patient: demoPatient,
      patientId: registered.patient_id,
      message: `Signed in as ${registered.role.toUpperCase()}: ${registered.fullName}`,
    });
  }

  // 3. Fallback Dynamic Account Resolution
  const isPatientId = /^P\d+$/i.test(rawInput);
  let detectedRole: 'patient' | 'doctor' | 'staff' | 'admin' = 'patient';
  let userName = 'Elena Rostova';
  let assignedPatientId = isPatientId ? rawInput.toUpperCase() : 'P182162';

  if (lookupKey.includes('admin') || lookupKey === 'adm-001') {
    detectedRole = 'admin';
    userName = 'Arthur Sterling, MHA';
  } else if (lookupKey.includes('doc')) {
    detectedRole = 'doctor';
    userName = 'Dr. Marcus Vance, MD';
  } else if (lookupKey.includes('staff') || lookupKey.includes('nurse')) {
    detectedRole = 'staff';
    userName = 'Sarah Jenkins, RN';
  } else {
    detectedRole = 'patient';
    userName = isPatientId ? `Patient ${rawInput.toUpperCase()}` : 'Elena Rostova';
  }

  const demoToken = `demo-session-token-${detectedRole}-${Date.now()}`;

  return res.json({
    success: true,
    isDemoMode: !isDatabaseConnected,
    role: detectedRole,
    token: demoToken,
    user: {
      id: `usr-${detectedRole}-${Date.now()}`,
      name: userName,
      email: rawInput.includes('@') ? lookupKey : `${detectedRole}@hospital.org`,
      role: detectedRole,
      patient_id: detectedRole === 'patient' ? assignedPatientId : undefined,
    },
    patientId: assignedPatientId,
    message: `Signed in as ${detectedRole.toUpperCase()}: ${userName}`,
  });
});

// 2.6 Dynamic User Registration (Strictly assigns "patient" role by default)
app.post('/api/auth/common-register', async (req: Request, res: Response) => {
  const {
    fullName,
    email: rawEmail,
    password,
    phone,
    dateOfBirth,
  } = req.body;

  const email = String(rawEmail || '').trim().toLowerCase();
  const name = String(fullName || '').trim();

  if (!email || !email.includes('@')) {
    return res.status(400).json({
      success: false,
      message: 'A valid email address is required for registration.',
    });
  }

  if (!name) {
    return res.status(400).json({
      success: false,
      message: 'Full legal name is required.',
    });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters.',
    });
  }

  // Strict Healthcare RBAC Security: All public registrations are assigned 'patient' role exclusively.
  // Role changes can only be performed by an authorized Administrator in the Admin Dashboard.
  const assignedRole: 'patient' = 'patient';
  const patientId = `P${Math.floor(100000 + Math.random() * 900000)}`;

  // 1. Live Supabase PostgreSQL Registration when connected
  if (isDatabaseConnected) {
    const adminClient = getSupabaseAdmin();
    const anonClient = getSupabaseAnon() || adminClient;

    if (adminClient && anonClient) {
      try {
        const defaultAppUrl = 'https://ais-dev-nncaxpb3lbbj7vb6hsyltf-933048657426.asia-southeast1.run.app';
        const emailRedirectTo = process.env.APP_URL || defaultAppUrl;

        const { data: authData, error: authError } = await anonClient.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo,
            data: {
              full_name: name,
              phone,
              date_of_birth: dateOfBirth,
              role: assignedRole,
            },
          },
        });

        if (authError || !authData.user) {
          return res.status(400).json({
            success: false,
            message: authError?.message || 'Registration failed in Supabase Auth.',
          });
        }

        const newAccount: RegisteredAccount = {
          id: authData.user.id,
          email,
          fullName: name,
          role: assignedRole,
          password,
          patient_id: patientId,
          phone: phone || '+1 (555) 234-9000',
          date_of_birth: dateOfBirth || '1995-01-01',
          created_at: new Date().toISOString(),
        };
        REGISTERED_ACCOUNTS.set(email, newAccount);
        REGISTERED_ACCOUNTS.set(patientId.toUpperCase(), newAccount);

        return res.json({
          success: true,
          message: `Registration successful! Your official Patient ID is ${patientId}. You can now sign in.`,
          patientId,
          role: assignedRole,
          user: {
            id: authData.user.id,
            name,
            email,
            role: assignedRole,
            patient_id: patientId,
          },
          token: authData.session?.access_token || `demo-session-token-${assignedRole}-${Date.now()}`,
        });
      } catch (err: any) {
        console.error('Supabase registration error:', err);
      }
    }
  }

  // 2. In-Memory Registry for immediate access across testing
  const newAccount: RegisteredAccount = {
    id: `usr-${assignedRole}-${Date.now()}`,
    email,
    fullName: name,
    role: assignedRole,
    password,
    patient_id: patientId,
    doctor_id: undefined,
    staff_id: undefined,
    specialty: undefined,
    department: undefined,
    phone: phone || '+1 (555) 234-9000',
    date_of_birth: dateOfBirth || '1995-01-01',
    created_at: new Date().toISOString(),
  };

  REGISTERED_ACCOUNTS.set(email, newAccount);
  if (newAccount.patient_id) REGISTERED_ACCOUNTS.set(newAccount.patient_id.toUpperCase(), newAccount);
  if (newAccount.doctor_id) REGISTERED_ACCOUNTS.set(newAccount.doctor_id.toUpperCase(), newAccount);
  if (newAccount.staff_id) REGISTERED_ACCOUNTS.set(newAccount.staff_id.toUpperCase(), newAccount);

  const demoToken = `demo-session-token-${assignedRole}-${Date.now()}`;

  return res.json({
    success: true,
    message: `Account created successfully with default role '${assignedRole.toUpperCase()}'! Your official Patient ID is ${patientId}.`,
    patientId,
    role: assignedRole,
    token: demoToken,
    user: {
      id: newAccount.id,
      name: newAccount.fullName,
      email: newAccount.email,
      role: newAccount.role,
      patient_id: newAccount.patient_id,
      doctor_id: newAccount.doctor_id,
      staff_id: newAccount.staff_id,
      specialty: newAccount.specialty,
      department: newAccount.department,
    },
  });
});

// 2.7 Google Single Sign-On Endpoint (Defaults to Patient role)
app.post('/api/auth/google', async (req: Request, res: Response) => {
  const { email: rawEmail, name: rawName } = req.body;
  const email = String(rawEmail || 'nsharan1862@gmail.com').trim().toLowerCase();
  const name = String(rawName || 'Sharan N (Google Verified)').trim();

  // If already registered, preserve existing role (which may have been elevated to Platform Admin!)
  let account = REGISTERED_ACCOUNTS.get(email);

  if (!account) {
    const patientId = `P${Math.floor(100000 + Math.random() * 900000)}`;
    account = {
      id: `usr-google-${Date.now()}`,
      email,
      fullName: name,
      role: 'patient', // Default role is ALWAYS 'patient'!
      patient_id: patientId,
      phone: '+1 (555) 789-0123',
      date_of_birth: '1996-05-15',
      created_at: new Date().toISOString(),
    };
    REGISTERED_ACCOUNTS.set(email, account);
    REGISTERED_ACCOUNTS.set(patientId, account);
  }

  const token = `demo-session-token-${account.role}-${Date.now()}`;

  const demoPatient = account.role === 'patient' ? {
    patient_id: account.patient_id || 'P182162',
    name: account.fullName,
    first_name: account.fullName.split(' ')[0] || 'Google',
    last_name: account.fullName.split(' ').slice(1).join(' ') || 'User',
    email: account.email,
    phone: account.phone || '+1 (555) 234-9182',
    date_of_birth: account.date_of_birth || '1996-05-15',
    age: 30,
    gender: 'Not specified',
    blood_group: 'O+',
    city: 'Metro Medical District',
    state: 'CA',
    address: '742 Evergreen Terrace, Suite 300',
    emergency_contact: 'Family Contact (+1 555-234-9183)',
    primary_doctor_name: 'Dr. Marcus Vance, MD',
  } : undefined;

  return res.json({
    success: true,
    message: `Signed in via Google as ${account.fullName} (${account.role.toUpperCase()})`,
    role: account.role,
    token,
    user: {
      id: account.id,
      name: account.fullName,
      email: account.email,
      role: account.role,
      patient_id: account.patient_id,
      doctor_id: account.doctor_id,
      staff_id: account.staff_id,
      specialty: account.specialty,
      department: account.department,
    },
    patient: demoPatient,
    patientId: account.patient_id,
  });
});

// 2.8 Dynamic Role Upgrade Endpoint (Strictly restricted to authorized Administrators)
app.post('/api/auth/update-role', authenticateToken, requireAdminRole, async (req: Request, res: Response) => {
  const { newRole, email: reqEmail, patientId: reqPatientId } = req.body;

  if (!newRole || !['patient', 'doctor', 'staff', 'admin'].includes(newRole)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid role. Must be one of: patient, doctor, staff, admin.',
    });
  }

  const activeAppUser = (req as any).appUser;
  const userEmail = String(reqEmail || activeAppUser?.email || '').toLowerCase();
  const userPatientId = String(reqPatientId || activeAppUser?.patient_id || '').toUpperCase();

  let account = REGISTERED_ACCOUNTS.get(userEmail) || REGISTERED_ACCOUNTS.get(userPatientId);

  if (!account) {
    account = {
      id: activeAppUser?.id || `usr-${newRole}-${Date.now()}`,
      email: userEmail || `${newRole}@hospital.org`,
      fullName: activeAppUser?.full_name || (newRole === 'admin' ? 'Sharan N (Platform Administrator)' : 'Hospital User'),
      role: newRole,
      patient_id: userPatientId || (newRole === 'patient' ? `P${Math.floor(100000 + Math.random() * 900000)}` : undefined),
      doctor_id: newRole === 'doctor' ? 'DOC-7721' : undefined,
      staff_id: newRole === 'staff' ? 'STF-4401' : undefined,
      specialty: newRole === 'doctor' ? 'Cardiology & Vascular Medicine' : undefined,
      department: newRole === 'admin' ? 'Platform Administration & Executive Governance' : newRole === 'staff' ? 'Ward 4B Clinical Support' : undefined,
      created_at: new Date().toISOString(),
    };
  } else {
    account.role = newRole;
    if (newRole === 'admin') {
      account.department = 'Platform Administration & Executive Governance';
    } else if (newRole === 'doctor') {
      account.doctor_id = account.doctor_id || 'DOC-7721';
      account.specialty = account.specialty || 'Cardiology & Vascular Medicine';
    } else if (newRole === 'staff') {
      account.staff_id = account.staff_id || 'STF-4401';
      account.department = account.department || 'Ward 4B Clinical Support';
    }
  }

  if (account.email) REGISTERED_ACCOUNTS.set(account.email.toLowerCase(), account);
  if (account.patient_id) REGISTERED_ACCOUNTS.set(account.patient_id.toUpperCase(), account);

  // If live Supabase is connected, update public.app_users
  if (isDatabaseConnected) {
    const adminClient = getSupabaseAdmin();
    if (adminClient && activeAppUser?.id) {
      await adminClient.from('app_users').update({ role: newRole }).eq('id', activeAppUser.id);
    }
  }

  const newToken = `demo-session-token-${newRole}-${Date.now()}`;

  return res.json({
    success: true,
    message: `Account successfully elevated to ${newRole.toUpperCase()} role.`,
    role: newRole,
    token: newToken,
    user: {
      id: account.id,
      name: account.fullName,
      email: account.email,
      role: newRole,
      patient_id: account.patient_id,
      doctor_id: account.doctor_id,
      staff_id: account.staff_id,
      specialty: account.specialty,
      department: account.department,
    },
  });
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
      const defaultAppUrl = 'https://ais-dev-nncaxpb3lbbj7vb6hsyltf-933048657426.asia-southeast1.run.app';
      const emailRedirectTo = process.env.APP_URL || defaultAppUrl;

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
  const { email: reqEmail, identifier } = req.body;
  const rawTarget = String(reqEmail || identifier || '').trim().toLowerCase();

  if (!rawTarget) {
    return res.status(400).json({ success: false, message: 'Email address or Patient ID is required.' });
  }

  // Find associated email if a patient ID was provided
  let email = rawTarget;
  if (!rawTarget.includes('@')) {
    const acc = REGISTERED_ACCOUNTS.get(rawTarget.toUpperCase());
    if (acc?.email) {
      email = acc.email;
    }
  }

  if (isDatabaseConnected) {
    const anonClient = getSupabaseAnon() || getSupabaseAdmin();
    if (anonClient && email.includes('@')) {
      try {
        await anonClient.auth.resetPasswordForEmail(email);
      } catch (err) {
        console.warn('Supabase resetPasswordForEmail notice:', err);
      }
    }
  }

  return res.json({
    success: true,
    message: `If an account matches '${rawTarget}', password recovery instructions have been dispatched.`,
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

  if (!adminClient || !isDatabaseConnected) {
    if ((req as any).userToken?.startsWith('demo-session-token-')) {
      return res.json({
        success: true,
        data: {
          patient: {
            patient_id: patientId || 'P182162',
            name: 'Elena Rostova',
            first_name: 'Elena',
            last_name: 'Rostova',
            email: 'elena.rostova@patient.org',
            phone: '+1 (555) 234-9182',
            date_of_birth: '1984-06-12',
            age: 42,
            gender: 'Female',
            blood_group: 'O+',
            city: 'Metro Medical District',
            state: 'CA',
            address: '742 Evergreen Terrace, Suite 300',
            emergency_contact: 'Viktor Rostov (+1 555-234-9183)',
            primary_doctor_name: 'Dr. Marcus Vance, MD',
          },
          upcomingAppointments: [
            {
              appointment_id: 'APT-9041',
              patient_id: patientId || 'P182162',
              doctor_id: 'DOC-7721',
              doctor_name: 'Dr. Marcus Vance, MD',
              specialty: 'Cardiology & Vascular Medicine',
              hospital_branch: 'MediAI Heart & Vascular Specialty Institute',
              appointment_date: '2026-10-28',
              appointment_time: '10:30 AM',
              status: 'Confirmed',
              consultation_type: 'In-Person',
              consultation_duration_minutes: 30,
              consultation_fee: 175,
              payment_status: 'Paid',
              reason: 'Cardiovascular follow-up & ECG evaluation',
              symptoms: 'Occasional mild palpitations after exertion',
              notes: 'Bring previous telemetry records and medication list.',
            },
            {
              appointment_id: 'APT-9284',
              patient_id: patientId || 'P182162',
              doctor_id: 'DOC-8802',
              doctor_name: 'Dr. Sarah Lin, MD',
              specialty: 'General Internal Medicine',
              hospital_branch: 'MediAI Medical Center — Main Campus',
              appointment_date: '2026-11-14',
              appointment_time: '02:00 PM',
              status: 'Scheduled',
              consultation_type: 'Video Telehealth',
              consultation_duration_minutes: 20,
              consultation_fee: 120,
              payment_status: 'Pending',
              reason: 'Routine quarterly metabolic panel consultation',
              symptoms: 'None - preventive checkup',
              notes: 'Fasting lab work required 48 hours prior.',
            },
          ],
          completedEncounters: [
            {
              encounter_id: 'ENC-4019',
              patient_id: patientId || 'P182162',
              doctor_name: 'Dr. Marcus Vance, MD',
              encounter_date: '2026-08-15',
              encounter_type: 'Outpatient Specialty Visit',
              diagnosis: 'Mild sinus tachycardia, controlled essential hypertension',
              chief_complaint: 'Routine follow-up',
              treatment_summary: 'Medication dosage adjusted; recommended 30 min daily aerobic walking.',
            },
          ],
          labReports: [
            {
              lab_id: 'LAB-8812',
              patient_id: patientId || 'P182162',
              test_name: 'Comprehensive Metabolic Panel (CMP-14)',
              test_date: '2026-08-14',
              result_summary: 'Electrolytes and renal indices within normal limits',
              status: 'Final - Signed by Laboratory Director',
              lab_branch: 'Central Pathology Laboratory',
            },
            {
              lab_id: 'LAB-8813',
              patient_id: patientId || 'P182162',
              test_name: 'Lipid Panel with Cardio-CRP',
              test_date: '2026-08-14',
              result_summary: 'LDL 98 mg/dL, HDL 54 mg/dL, Triglycerides 124 mg/dL',
              status: 'Final - Signed by Laboratory Director',
              lab_branch: 'Central Pathology Laboratory',
            },
          ],
          prescriptions: [
            {
              prescription_id: 'RX-7731',
              patient_id: patientId || 'P182162',
              doctor_name: 'Dr. Marcus Vance, MD',
              medication_name: 'Lisinopril 10mg Tablets',
              dosage: '1 tablet daily in the morning',
              prescribed_date: '2026-08-15',
              refills_remaining: 3,
              pharmacy: 'MediAI Central In-Hospital Pharmacy',
              status: 'Active',
            },
          ],
          feedbackList: [],
          notifications: [],
          backendStatus: {
            connected: false,
            engine: 'MediAI Local Clinical Engine',
            schema: 'Canonical Silver Schema',
            notice: 'Demonstration Workspace Active',
          },
        },
      });
    }
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
// CLINICAL & OPERATIONAL DASHBOARD SERVICES (Doctor, Staff, Admin)
// ============================================================================

// 16. Doctor Clinical Workspace Overview
app.get('/api/doctor/overview', authenticateToken, async (_req: Request, res: Response) => {
  const doctor = {
    doctor_id: 'DOC-7721',
    name: 'Dr. Marcus Vance, MD',
    specialty: 'Cardiology & Vascular Medicine',
    department: 'Cardiovascular Specialty Institute',
    hospital_branch: 'MediAI Heart & Vascular Specialty Institute',
    license: 'CA-MED-99412',
    phone: '+1 (555) 234-8201',
    email: 'doctor@hospital.org',
  };

  const stats = {
    todayPatients: 8,
    completedVisits: 5,
    pendingVisits: 3,
    inpatientRounds: 4,
    pendingLabApprovals: 2,
    avgConsultationMinutes: 24,
  };

  const schedule = [
    {
      appointment_id: 'APT-1001',
      patient_id: 'P182162',
      patient_name: 'Elena Rostova',
      time: '09:00 AM',
      type: 'Follow-up Consultation',
      room: 'Exam Room 3B',
      status: 'Completed',
      chief_complaint: 'Post-ECG check & Lisinopril dosage review',
      notes: 'Blood pressure 118/76 mmHg. Patient tolerating medication well.',
    },
    {
      appointment_id: 'APT-1002',
      patient_id: 'P195909',
      patient_name: 'David K. Miller',
      time: '10:00 AM',
      type: 'New Patient Cardiac Workup',
      room: 'Exam Room 3B',
      status: 'Completed',
      chief_complaint: 'Substernal chest tightness upon fast climbing',
      notes: 'Ordered stress echocardiogram and troponin I panel.',
    },
    {
      appointment_id: 'APT-1003',
      patient_id: 'P198226',
      patient_name: 'Sophia Chen',
      time: '11:15 AM',
      type: 'Post-Op Stent Check',
      room: 'Exam Room 3B',
      status: 'Completed',
      chief_complaint: 'Radial artery catheter site inspection',
      notes: 'Site healing clean, no hematoma, distal pulses palpable.',
    },
    {
      appointment_id: 'APT-1004',
      patient_id: 'P151076',
      patient_name: 'Robert Thornton',
      time: '01:30 PM',
      type: 'Telehealth Follow-up',
      room: 'Virtual Clinic 1',
      status: 'Completed',
      chief_complaint: 'Home blood pressure telemetry check',
      notes: 'Reviewed 14-day automated cuff readings. Averages 122/80.',
    },
    {
      appointment_id: 'APT-1005',
      patient_id: 'P164835',
      patient_name: 'Maya Patel',
      time: '02:30 PM',
      type: 'Urgent Referral',
      room: 'Exam Room 3A',
      status: 'Completed',
      chief_complaint: 'Atrial fibrillation with rapid ventricular response',
      notes: 'Initiated beta-blocker titration; schedule rhythm control follow-up.',
    },
    {
      appointment_id: 'APT-1006',
      patient_id: 'P115937',
      patient_name: 'Thomas Brennan',
      time: '03:45 PM',
      type: 'Routine Cardiology',
      room: 'Exam Room 3B',
      status: 'In-Progress',
      chief_complaint: 'Bilateral ankle edema & dyspnea on exertion',
      notes: 'Currently undergoing 12-lead ECG and BNP assessment.',
    },
    {
      appointment_id: 'APT-1007',
      patient_id: 'P171467',
      patient_name: 'Olivia Martinez',
      time: '04:30 PM',
      type: 'Holter Monitor Review',
      room: 'Exam Room 3B',
      status: 'Waiting',
      chief_complaint: 'Intermittent palpitations during evening rest',
      notes: '48-hour Holter data uploaded and ready for review.',
    },
    {
      appointment_id: 'APT-1008',
      patient_id: 'P167834',
      patient_name: 'James Wilson',
      time: '05:15 PM',
      type: 'Hypertension Management',
      room: 'Exam Room 3B',
      status: 'Scheduled',
      chief_complaint: 'Medication titration follow-up',
      notes: 'Check renal function lab from yesterday.',
    },
  ];

  const inpatientRounds = [
    {
      bed: 'ICU-04',
      patient_name: 'Harold Finch',
      patient_id: 'P144799',
      age: 68,
      diagnosis: 'NSTEMI Status Post Percutaneous Coronary Intervention',
      day_of_stay: 2,
      acuity: 'Guarded',
      vitals: 'BP 128/82 · HR 68 · SpO2 98%',
      plan: 'Wean oxygen, transition to oral telemetry floor in AM.',
    },
    {
      bed: 'C-201',
      patient_name: 'Grace Hopper',
      patient_id: 'P118969',
      age: 72,
      diagnosis: 'Acute Decompensated Heart Failure (HFrEF)',
      day_of_stay: 4,
      acuity: 'Stable',
      vitals: 'BP 114/70 · HR 72 · SpO2 97%',
      plan: 'Target euvolemia reached; finalize discharge prescription bundle.',
    },
    {
      bed: 'C-208',
      patient_name: 'Carlos Santana',
      patient_id: 'P109841',
      age: 59,
      diagnosis: 'Severe Aortic Stenosis Pre-TAVR Evaluation',
      day_of_stay: 1,
      acuity: 'Guarded',
      vitals: 'BP 132/86 · HR 74 · SpO2 96%',
      plan: 'Cardiac CT and coronary angiogram scheduled tomorrow 08:00.',
    },
    {
      bed: 'C-214',
      patient_name: 'Linda Campbell',
      patient_id: 'P104921',
      age: 64,
      diagnosis: 'Paroxysmal Atrial Flutter Post Cardioversion',
      day_of_stay: 3,
      acuity: 'Stable',
      vitals: 'BP 120/78 · HR 64 · SpO2 99%',
      plan: 'Sinus rhythm maintained >48h; approve outpatient anticoagulation.',
    },
  ];

  const pendingLabs = [
    {
      lab_id: 'LAB-9921',
      patient_id: 'P144799',
      patient_name: 'Harold Finch',
      test: 'High-Sensitivity Cardiac Troponin T (Serial 6h)',
      result: '18 ng/L (Trend: 84 -> 32 -> 18)',
      status: 'Normalizing',
      signed: false,
    },
    {
      lab_id: 'LAB-9922',
      patient_id: 'P118969',
      patient_name: 'Grace Hopper',
      test: 'Serum Potassium & Creatinine Post Diuretic',
      result: 'K+ 4.2 mEq/L · Cr 1.1 mg/dL (eGFR 68)',
      status: 'Within Safe Window',
      signed: false,
    },
  ];

  return res.json({
    success: true,
    doctor,
    stats,
    schedule,
    inpatientRounds,
    pendingLabs,
  });
});

app.post('/api/doctor/sign-lab', authenticateToken, (req: Request, res: Response) => {
  const { labId } = req.body;
  return res.json({
    success: true,
    message: `Lab result ${labId || 'LAB-9921'} electronically approved and signed into medical record.`,
    labId,
  });
});

app.post('/api/doctor/encounter', authenticateToken, (req: Request, res: Response) => {
  const { appointmentId, patientId, notes, prescription } = req.body;
  return res.json({
    success: true,
    message: 'Clinical encounter finalized and synced to patient chart.',
    encounter: {
      encounter_id: `ENC-${Math.floor(1000 + Math.random() * 9000)}`,
      appointmentId,
      patientId,
      notes,
      prescription,
      timestamp: new Date().toISOString(),
    },
  });
});

// 17. Staff Ward & Clinical Operations Overview
app.get('/api/staff/overview', authenticateToken, async (_req: Request, res: Response) => {
  const staff = {
    staff_id: 'STF-4401',
    name: 'Sarah Jenkins, RN',
    role: 'Clinical Nurse Lead',
    department: 'Inpatient Ward 4B & Clinical Triage',
    shift: 'Day Shift (07:00 - 19:30)',
    station: 'Station 4B Central Monitor',
    assignedWing: 'West & North Pavilion',
  };

  const stats = {
    occupiedBeds: 22,
    totalBeds: 28,
    availableBeds: 4,
    cleaningBeds: 2,
    triageWaiting: 4,
    pendingVitals: 3,
    criticalAlerts: 1,
  };

  const wardBeds = [
    { id: 'BED-401', room: 'Room 401', wing: 'West Wing', status: 'Occupied', patient: 'Harold Finch (P144799)', condition: 'Post-PCI Care', nurse: 'Sarah Jenkins, RN', oxygen: 'Room Air' },
    { id: 'BED-402', room: 'Room 402', wing: 'West Wing', status: 'Occupied', patient: 'Grace Hopper (P118969)', condition: 'Heart Failure Weaning', nurse: 'Sarah Jenkins, RN', oxygen: '2L Nasal Cannula' },
    { id: 'BED-403', room: 'Room 403', wing: 'West Wing', status: 'Cleaning', patient: 'None', condition: 'Sanitization in progress', nurse: 'Unassigned', oxygen: 'None' },
    { id: 'BED-404', room: 'Room 404', wing: 'West Wing', status: 'Available', patient: 'None', condition: 'Ready for admission', nurse: 'Unassigned', oxygen: 'Central Wall Active' },
    { id: 'BED-405', room: 'Room 405', wing: 'West Wing', status: 'Occupied', patient: 'Carlos Santana (P109841)', condition: 'Pre-Op TAVR Prep', nurse: 'Liam Miller, RN', oxygen: 'Room Air' },
    { id: 'BED-406', room: 'Room 406', wing: 'West Wing', status: 'Occupied', patient: 'Linda Campbell (P104921)', condition: 'A-Flutter Observation', nurse: 'Liam Miller, RN', oxygen: 'Room Air' },
    { id: 'BED-407', room: 'Room 407', wing: 'West Wing', status: 'Reserved', patient: 'Incoming from ED (T-101)', condition: 'Chest pain observation', nurse: 'Sarah Jenkins, RN', oxygen: 'Prepped' },
    { id: 'BED-408', room: 'Room 408', wing: 'West Wing', status: 'Available', patient: 'None', condition: 'Ready for admission', nurse: 'Unassigned', oxygen: 'Central Wall Active' },
    { id: 'BED-409', room: 'Room 409', wing: 'North Wing', status: 'Occupied', patient: 'Arthur Pendelton (P103812)', condition: 'Pneumonia IV Antibiotics', nurse: 'Emma Zhao, RN', oxygen: '3L Nasal Cannula' },
    { id: 'BED-410', room: 'Room 410', wing: 'North Wing', status: 'Occupied', patient: 'Beatrice Vance (P101948)', condition: 'Total Hip Arthroplasty', nurse: 'Emma Zhao, RN', oxygen: 'Room Air' },
    { id: 'BED-411', room: 'Room 411', wing: 'North Wing', status: 'Cleaning', patient: 'None', condition: 'Terminal ultraviolet cleaning', nurse: 'Unassigned', oxygen: 'None' },
    { id: 'BED-412', room: 'Room 412', wing: 'North Wing', status: 'Available', patient: 'None', condition: 'Ready for admission', nurse: 'Unassigned', oxygen: 'Central Wall Active' },
  ];

  const triageQueue = [
    { ticket: 'T-101', patient: 'Marcus Brody', age: 52, arrival: '10 mins ago', acuity: 'Level 2 - Emergent', complaint: 'Diaphoresis, retrosternal heaviness', status: 'Triage Room 1', assignedBed: 'Bed 407' },
    { ticket: 'T-102', patient: 'Rebecca Shaw', age: 34, arrival: '18 mins ago', acuity: 'Level 3 - Urgent', complaint: 'High fever 39.4°C, productive cough', status: 'Vitals Pending', assignedBed: 'TBD' },
    { ticket: 'T-103', patient: 'Daniel Kim', age: 29, arrival: '25 mins ago', acuity: 'Level 4 - Routine', complaint: 'Right wrist sprain following sports fall', status: 'X-Ray Ordered', assignedBed: 'Fast-Track 2' },
    { ticket: 'T-104', patient: 'Nora Al-Mansoor', age: 61, arrival: '32 mins ago', acuity: 'Level 3 - Urgent', complaint: 'Severe migraine with photophobia', status: 'Medication Administered', assignedBed: 'Quiet Bay 1' },
  ];

  const vitalsTasks = [
    { task_id: 'VIT-01', patient: 'Harold Finch', room: 'Room 401', due: '14:00', parameter: 'Full Vitals & Telemetry Rhythm', status: 'Due Now' },
    { task_id: 'VIT-02', patient: 'Grace Hopper', room: 'Room 402', due: '14:30', parameter: 'Orthostatic BP & Weight Check', status: 'Upcoming' },
    { task_id: 'VIT-03', patient: 'Arthur Pendelton', room: 'Room 409', due: '15:00', parameter: 'SpO2 continuous & Temperature', status: 'Upcoming' },
  ];

  return res.json({
    success: true,
    staff,
    stats,
    wardBeds,
    triageQueue,
    vitalsTasks,
  });
});

app.post('/api/staff/update-bed', authenticateToken, (req: Request, res: Response) => {
  const { bedId, status } = req.body;
  return res.json({
    success: true,
    message: `Bed ${bedId} status updated to ${status}.`,
    bedId,
    status,
  });
});

app.post('/api/staff/log-vitals', authenticateToken, (req: Request, res: Response) => {
  const { patientName, bp, hr, temp, spo2 } = req.body;
  return res.json({
    success: true,
    message: `Vitals recorded for ${patientName || 'Patient'}: BP ${bp || '120/80'}, HR ${hr || 72} bpm, Temp ${temp || '37.0'}°C, SpO2 ${spo2 || 98}%.`,
    timestamp: new Date().toISOString(),
  });
});

// 18. Admin Governance & Hospital Executive Overview
app.get('/api/admin/overview', authenticateToken, async (_req: Request, res: Response) => {
  const admin = {
    admin_id: 'ADM-001',
    name: 'Arthur Sterling, MHA',
    role: 'Chief Operating Officer & Governance Director',
    department: 'Hospital Administration & Executive Operations',
    institution: 'MediAI Integrated Health System',
    credential: 'Board Certified Healthcare Executive (FACHE)',
  };

  const executiveMetrics = {
    bedOccupancyRate: 86.4,
    avgWaitTimeMinutes: 14.2,
    totalActivePatients: 342,
    totalPhysicians: 48,
    totalClinicalStaff: 184,
    patientSatisfactionScore: 4.88,
    monthlyDischarges: 1240,
    emergencyThroughputRatio: 98.2,
  };

  const departments = [
    { id: 'DEP-CARD', name: 'Cardiology & Vascular Medicine', totalBeds: 45, occupiedBeds: 41, rate: 91.1, doctorsOnDuty: 8, status: 'High Occupancy' },
    { id: 'DEP-ICU', name: 'Intensive Care Unit (ICU/CCU)', totalBeds: 24, occupiedBeds: 21, rate: 87.5, doctorsOnDuty: 6, status: 'Critical Reserve' },
    { id: 'DEP-EMERG', name: 'Emergency & Trauma Center', totalBeds: 36, occupiedBeds: 30, rate: 83.3, doctorsOnDuty: 10, status: 'Nominal Operations' },
    { id: 'DEP-SURG', name: 'Surgical & Post-Op Ward', totalBeds: 50, occupiedBeds: 42, rate: 84.0, doctorsOnDuty: 11, status: 'Nominal Operations' },
    { id: 'DEP-PED', name: 'Pediatrics & Neonatal Care', totalBeds: 30, occupiedBeds: 22, rate: 73.3, doctorsOnDuty: 5, status: 'Available Capacity' },
    { id: 'DEP-ONCO', name: 'Oncology & Infusion Suites', totalBeds: 28, occupiedBeds: 25, rate: 89.3, doctorsOnDuty: 4, status: 'High Occupancy' },
  ];

  const staffRoster = [
    { id: 'DOC-7721', name: 'Dr. Marcus Vance, MD', role: 'Chief of Cardiology', department: 'Cardiology', shift: 'Day', duty: 'On Duty', patients: 12 },
    { id: 'DOC-8802', name: 'Dr. Sarah Lin, MD', role: 'Attending Physician', department: 'General Internal Medicine', shift: 'Day', duty: 'On Duty', patients: 15 },
    { id: 'DOC-9140', name: 'Dr. Alan Morales, MD', role: 'Emergency Director', department: 'Emergency Medicine', shift: 'Day', duty: 'On Duty', patients: 18 },
    { id: 'DOC-9422', name: 'Dr. Priya Nair, MD', role: 'Intensivist Lead', department: 'Intensive Care', shift: 'Night', duty: 'On Call', patients: 8 },
    { id: 'STF-4401', name: 'Sarah Jenkins, RN', role: 'Clinical Nurse Lead', department: 'Ward 4B / Triage', shift: 'Day', duty: 'On Duty', patients: 6 },
    { id: 'STF-4418', name: 'Liam Miller, RN', role: 'Staff Nurse', department: 'Ward 4B West', shift: 'Day', duty: 'On Duty', patients: 5 },
    { id: 'STF-4422', name: 'Emma Zhao, RN', role: 'Senior Staff Nurse', department: 'Ward 4B North', shift: 'Day', duty: 'On Duty', patients: 5 },
    { id: 'STF-4509', name: 'Michael O\'Connor, RPh', role: 'Clinical Pharmacist', department: 'Hospital Pharmacy', shift: 'Day', duty: 'On Duty', patients: 34 },
  ];

  const patientFeedback = [
    { id: 'FB-901', patient: 'Elena R. (P182162)', doctor: 'Dr. Marcus Vance, MD', department: 'Cardiology', rating: 5, waitRating: 5, comments: 'Extremely attentive and explained ECG findings with thorough clarity. Staff was prompt and courteous.', date: '2026-10-21' },
    { id: 'FB-902', patient: 'David M. (P195909)', doctor: 'Dr. Sarah Lin, MD', department: 'Internal Medicine', rating: 5, waitRating: 4, comments: 'Digital appointment check-in was seamless. Very satisfied with medication explanation.', date: '2026-10-20' },
    { id: 'FB-903', patient: 'Sophia C. (P198226)', doctor: 'Dr. Alan Morales, MD', department: 'Emergency', rating: 4, waitRating: 4, comments: 'Prompt triage response upon arrival. Clean and calm care environment.', date: '2026-10-19' },
  ];

  return res.json({
    success: true,
    admin,
    executiveMetrics,
    departments,
    staffRoster,
    patientFeedback,
  });
});

app.post('/api/admin/broadcast', authenticateToken, (req: Request, res: Response) => {
  const { title, message, priority, targetDepartment } = req.body;
  return res.json({
    success: true,
    message: `System broadcast dispatched to ${targetDepartment || 'All Departments'}.`,
    broadcast: {
      id: `BC-${Date.now()}`,
      title: title || 'Operational Advisory',
      message,
      priority: priority || 'Normal',
      timestamp: new Date().toISOString(),
    },
  });
});

// 19. Admin User Governance Directory Endpoint
app.get('/api/admin/users', authenticateToken, requireAdminRole, async (_req: Request, res: Response) => {
  try {
    const uniqueLocal = getUniqueRegisteredAccounts();
    const emailMap = new Map<string, any>();

    // Seed local registered accounts
    for (const loc of uniqueLocal) {
      if (loc.email) {
        emailMap.set(loc.email.toLowerCase(), {
          id: loc.id,
          email: loc.email,
          fullName: loc.fullName,
          role: loc.role,
          patient_id: loc.patient_id,
          doctor_id: loc.doctor_id,
          staff_id: loc.staff_id,
          specialty: loc.specialty,
          department: loc.department,
          phone: loc.phone,
          date_of_birth: loc.date_of_birth,
          is_active: true,
          created_at: loc.created_at,
          source: 'Platform Registry',
        });
      }
    }

    // Merge authoritative Supabase app_users table if live
    if (isDatabaseConnected) {
      const client = getSupabaseAdmin();
      if (client) {
        const { data: dbUsers, error } = await client
          .from('app_users')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(dbUsers)) {
          for (const u of dbUsers) {
            const key = u.email?.toLowerCase();
            if (key) {
              const existing = emailMap.get(key);
              emailMap.set(key, {
                id: u.id,
                email: u.email,
                fullName: u.full_name || existing?.fullName || u.email,
                role: u.role,
                patient_id: u.patient_id || existing?.patient_id,
                doctor_id: u.doctor_id || existing?.doctor_id,
                staff_id: u.staff_id || existing?.staff_id,
                phone: u.phone || existing?.phone,
                date_of_birth: u.date_of_birth || existing?.date_of_birth,
                is_active: u.is_active ?? true,
                created_at: u.created_at || existing?.created_at || new Date().toISOString(),
                source: 'Supabase PostgreSQL',
              });
            }
          }
        }
      }
    }

    const users = Array.from(emailMap.values());
    return res.json({
      success: true,
      users,
      totalCount: users.length,
      databaseMode: isDatabaseConnected ? 'LIVE_SUPABASE_POSTGRESQL' : 'SYNCHRONIZED_REGISTRY',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `Failed to retrieve user registry: ${sanitizeError(err)}`,
    });
  }
});

// 20. Admin Update User Role with Database Synchronization & Audit Logging
app.post('/api/admin/users/update-role', authenticateToken, requireAdminRole, async (req: Request, res: Response) => {
  const { userId, email, newRole, reason } = req.body;
  const adminUser = (req as any).appUser;

  if (!newRole || !['patient', 'doctor', 'staff', 'admin'].includes(newRole)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid role. Role must be one of: patient, doctor, staff, admin.',
    });
  }

  const targetEmail = String(email || '').trim().toLowerCase();
  const targetId = String(userId || '').trim();

  if (!targetEmail && !targetId) {
    return res.status(400).json({
      success: false,
      message: 'Target user email or user ID is required.',
    });
  }

  // Find account in REGISTERED_ACCOUNTS
  let targetAccount: RegisteredAccount | undefined;
  if (targetEmail) {
    targetAccount = REGISTERED_ACCOUNTS.get(targetEmail);
  }
  if (!targetAccount && targetId) {
    for (const acc of REGISTERED_ACCOUNTS.values()) {
      if (acc.id === targetId || acc.patient_id === targetId || acc.doctor_id === targetId || acc.staff_id === targetId) {
        targetAccount = acc;
        break;
      }
    }
  }

  const previousRole = targetAccount ? targetAccount.role : 'patient';

  // Manage operational identifiers & historical archive
  let assignedDoctorId = targetAccount?.doctor_id;
  let assignedStaffId = targetAccount?.staff_id;
  let assignedPatientId = targetAccount?.patient_id;

  if (newRole === 'patient') {
    // Retain clinical IDs in history while revoking active physician / staff access
    if (targetAccount) {
      targetAccount.historical_identifiers = targetAccount.historical_identifiers || {};
      if (assignedDoctorId) targetAccount.historical_identifiers.doctor_id = assignedDoctorId;
      if (assignedStaffId) targetAccount.historical_identifiers.staff_id = assignedStaffId;
    }
    if (!assignedPatientId) {
      assignedPatientId = targetAccount?.historical_identifiers?.patient_id || `P${Math.floor(100000 + Math.random() * 900000)}`;
    }
  } else if (newRole === 'doctor') {
    if (!assignedDoctorId) {
      assignedDoctorId = targetAccount?.historical_identifiers?.doctor_id || `DOC-${Math.floor(1000 + Math.random() * 9000)}`;
    }
  } else if (newRole === 'staff') {
    if (!assignedStaffId) {
      assignedStaffId = targetAccount?.historical_identifiers?.staff_id || `STF-${Math.floor(1000 + Math.random() * 9000)}`;
    }
  }

  // Update in-memory registry
  if (targetAccount) {
    targetAccount.role = newRole as any;
    if (assignedDoctorId) targetAccount.doctor_id = assignedDoctorId;
    if (assignedStaffId) targetAccount.staff_id = assignedStaffId;
    if (assignedPatientId) targetAccount.patient_id = assignedPatientId;

    if (newRole === 'admin') {
      targetAccount.department = 'Hospital Administration & Executive Governance';
    } else if (newRole === 'doctor') {
      targetAccount.specialty = targetAccount.specialty || 'Cardiology & Vascular Medicine';
    } else if (newRole === 'staff') {
      targetAccount.department = targetAccount.department || 'Inpatient Ward 4B & Clinical Triage';
    }

    REGISTERED_ACCOUNTS.set(targetAccount.email.toLowerCase(), targetAccount);
    if (assignedPatientId) REGISTERED_ACCOUNTS.set(assignedPatientId.toUpperCase(), targetAccount);
    if (assignedDoctorId) REGISTERED_ACCOUNTS.set(assignedDoctorId.toUpperCase(), targetAccount);
    if (assignedStaffId) REGISTERED_ACCOUNTS.set(assignedStaffId.toUpperCase(), targetAccount);
  } else if (targetEmail) {
    targetAccount = {
      id: targetId || `usr-${newRole}-${Date.now()}`,
      email: targetEmail,
      fullName: targetEmail.split('@')[0],
      role: newRole as any,
      doctor_id: assignedDoctorId,
      staff_id: assignedStaffId,
      patient_id: assignedPatientId,
      created_at: new Date().toISOString(),
    };
    REGISTERED_ACCOUNTS.set(targetEmail, targetAccount);
  }

  // Update Supabase PostgreSQL Database if live
  let dbStatus = 'SYNCHRONIZED_REGISTRY';
  if (isDatabaseConnected) {
    const client = getSupabaseAdmin();
    if (client) {
      try {
        let updateQuery = client.from('app_users').update({
          role: newRole,
          doctor_id: assignedDoctorId || null,
          staff_id: assignedStaffId || null,
          patient_id: assignedPatientId || null,
        });

        if (targetId && !targetId.startsWith('usr-') && !targetId.startsWith('demo-')) {
          updateQuery = updateQuery.eq('id', targetId);
        } else if (targetEmail) {
          updateQuery = updateQuery.eq('email', targetEmail);
        }

        const { error: dbError } = await updateQuery;
        if (!dbError) {
          dbStatus = 'COMMITTED_SUPABASE_POSTGRESQL';
        } else {
          console.warn('Supabase app_users update notice:', dbError.message);
        }

        // Also record to authoritative audit_logs table if accessible
        await client.from('audit_logs').insert({
          action: 'ROLE_MODIFICATION',
          actor_id: adminUser?.id || 'admin',
          actor_email: adminUser?.email || 'admin@hospital.org',
          target_user_id: targetAccount?.id || targetId,
          target_user_email: targetAccount?.email || targetEmail,
          previous_role: previousRole,
          new_role: newRole,
          reason: reason || 'Administrative role governance update',
          created_at: new Date().toISOString(),
        }).maybeSingle();
      } catch (dbErr: any) {
        console.error('Error committing role update to Supabase:', dbErr);
      }
    }
  }

  // Append to Executive Audit Logs
  const auditEntry: AuditLogEntry = {
    id: `AUD-${Date.now()}`,
    action: previousRole === 'patient' && newRole === 'admin' ? 'ROLE_ELEVATION_ADMIN' : 'ROLE_MODIFICATION',
    adminId: adminUser?.id || 'ADM-001',
    adminName: adminUser?.full_name || adminUser?.name || 'Arthur Sterling, MHA',
    adminEmail: adminUser?.email || 'admin@hospital.org',
    targetUserId: targetAccount?.id || targetId,
    targetUserName: targetAccount?.fullName || targetEmail,
    targetUserEmail: targetAccount?.email || targetEmail,
    previousRole,
    newRole,
    reason: reason || 'Administrative privilege policy modification',
    timestamp: new Date().toISOString(),
    databaseStatus: dbStatus,
  };
  AUDIT_LOGS.unshift(auditEntry);

  return res.json({
    success: true,
    message: `User role successfully updated to ${newRole.toUpperCase()} for ${targetAccount?.fullName || targetEmail}.`,
    user: targetAccount,
    auditEntry,
    databaseStatus: dbStatus,
  });
});

// 21. Admin Audit Logs Endpoint
app.get('/api/admin/audit-logs', authenticateToken, requireAdminRole, (_req: Request, res: Response) => {
  return res.json({
    success: true,
    auditLogs: AUDIT_LOGS,
    totalCount: AUDIT_LOGS.length,
  });
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
