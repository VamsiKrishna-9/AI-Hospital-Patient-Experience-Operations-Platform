/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import {
  PatientProfile,
  DoctorInfo,
  HospitalBranch,
  AppointmentRecord,
  FeedbackRecord,
} from './src/types/patient';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// --- Database Configuration & Security Sanitization Layer ---
export type EngineMode = 'LIVE_DATABASE' | 'PENDING_CONFIGURATION';

function sanitizeError(err: any): string | null {
  if (!err) return null;
  const str = typeof err === 'string' ? err : err?.message || String(err);
  return str
    .replace(/(password|passwd|pwd)=[^\s&;]+/gi, '$1=******')
    .replace(/\/\/[^:]+:[^@]+@/g, '//***:***@');
}

// Supabase / PostgreSQL / Relational Database Configuration
function resolveDatabaseConfig() {
  const connUri = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.POSTGRES_URL;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (connUri) {
    try {
      const parsed = new URL(connUri);
      return {
        configured: Boolean(parsed.hostname && parsed.hostname !== 'localhost'),
        type: 'connection_uri' as const,
        host: parsed.hostname,
        port: Number(parsed.port) || 5432,
        database: parsed.pathname.replace(/^\//, '') || 'postgres',
        supabaseUrl: supabaseUrl || null,
        hasAnonKey: Boolean(supabaseAnonKey),
      };
    } catch {
      // invalid URL
    }
  }

  const host = process.env.PGHOST || process.env.DB_HOST || process.env.MYSQL_HOST;
  const user = process.env.PGUSER || process.env.DB_USER || process.env.MYSQL_USER;
  const password = process.env.PGPASSWORD || process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD;
  const isPlaceholderPassword =
    password === 'your_database_password' ||
    password === 'YOUR_PASSWORD' ||
    password === 'password';

  const hasCredentials = Boolean(host && user && password && !isPlaceholderPassword);

  return {
    configured: Boolean(hasCredentials || (supabaseUrl && supabaseAnonKey)),
    type: 'env_vars' as const,
    host: host || null,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    supabaseUrl: supabaseUrl || null,
    hasAnonKey: Boolean(supabaseAnonKey),
  };
}

const DB_CONFIG = resolveDatabaseConfig();
const isDatabaseConfigured = DB_CONFIG.configured;
const isDatabaseConnected = false; // Supabase PostgreSQL will be connected next
const dbConnectionError: string | null = isDatabaseConfigured
  ? 'Database client connection pending setup.'
  : 'No Supabase credentials configured.';

// Authoritative Supabase / PostgreSQL Tables Schema
export const REQUIRED_TABLES = [
  'users',
  'patients',
  'doctors',
  'appointments',
  'encounters',
  'lab_results',
  'prescriptions',
  'feedback',
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

// --- Cryptographic Password Verifier ---
function verifyPassword(submittedPassword: string, storedHash: string): boolean {
  if (!submittedPassword || !storedHash) return false;

  try {
    // 1. Standard bcrypt hash check
    if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
      return bcrypt.compareSync(submittedPassword, storedHash);
    }

    // 2. PBKDF2 hash check
    if (storedHash.startsWith('pbkdf2:')) {
      const parts = storedHash.split(':');
      if (parts.length >= 4) {
        const salt = parts[1];
        const iterations = parseInt(parts[2], 10) || 10000;
        const hash = parts[3];
        const computed = crypto.pbkdf2Sync(submittedPassword, salt, iterations, 64, 'sha512').toString('hex');
        return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
      }
    }

    // 3. Salted SHA-256 check
    if (storedHash.includes(':')) {
      const [salt, hash] = storedHash.split(':');
      if (salt && hash) {
        const computed = crypto.createHmac('sha256', salt).update(submittedPassword).digest('hex');
        return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
      }
    }

    // 4. Fallback SHA-256 check
    const computedSha = crypto.createHash('sha256').update(submittedPassword).digest('hex');
    if (computedSha === storedHash) {
      return true;
    }
  } catch (err) {
    console.error('Password verification error:', err);
  }

  return false;
}

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

// --- Active Cryptographic Session Store ---
interface SessionData {
  token: string;
  patient_id: string;
  role: string;
  email?: string;
  created_at: number;
  expires_at: number;
}
const ACTIVE_SESSIONS = new Map<string, SessionData>();

// Temporary tokens for must_change_password flow (15-min expiry)
interface TempPasswordToken {
  token: string;
  patient_id: string;
  expires_at: number;
}
const TEMP_PASSWORD_TOKENS = new Map<string, TempPasswordToken>();

// Session cleanup interval (every 15 min)
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of ACTIVE_SESSIONS.entries()) {
    if (session.expires_at < now) {
      ACTIVE_SESSIONS.delete(token);
    }
  }
  for (const [token, temp] of TEMP_PASSWORD_TOKENS.entries()) {
    if (temp.expires_at < now) {
      TEMP_PASSWORD_TOKENS.delete(token);
    }
  }
}, 15 * 60 * 1000);

// Middleware: Authenticate patient token
function authenticatePatientToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token missing or invalid. Please sign in.',
    });
  }

  const token = authHeader.split(' ')[1];
  const session = ACTIVE_SESSIONS.get(token);

  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Session expired or invalid. Please sign in again.',
    });
  }

  if (Date.now() > session.expires_at) {
    ACTIVE_SESSIONS.delete(token);
    return res.status(401).json({
      success: false,
      message: 'Session has expired. Please sign in again.',
    });
  }

  (req as any).authenticatedPatientId = session.patient_id;
  (req as any).authenticatedSession = session;
  next();
}

// ==========================================
// API ROUTES
// ==========================================

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
app.get(['/api/db/health', '/api/db/status'], (_req: Request, res: Response) => {
  return res.json({
    status: isDatabaseConnected ? 'connected' : 'pending_configuration',
    target: 'Supabase PostgreSQL',
    configured: isDatabaseConfigured,
    connected: isDatabaseConnected,
    mode: isDatabaseConnected ? 'LIVE_DATABASE' : 'PENDING_CONFIGURATION',
    message: isDatabaseConnected
      ? 'Connected to Supabase PostgreSQL database.'
      : isDatabaseConfigured
      ? `Database configured but unreachable: ${sanitizeError(dbConnectionError)}`
      : 'Database not configured. Supabase PostgreSQL connection pending setup.',
    requiredTables: REQUIRED_TABLES,
    cleanState: true,
  });
});

// Database Diagnostic Endpoint
app.get('/api/db/diagnostics', async (_req: Request, res: Response) => {
  return res.json({
    target: 'Supabase PostgreSQL',
    configured: isDatabaseConfigured,
    connected: isDatabaseConnected,
    status: isDatabaseConnected ? 'CONNECTED' : 'WAITING_FOR_CREDENTIALS',
    remediation: isDatabaseConfigured
      ? 'Check network reachability to the Supabase host.'
      : 'Provide SUPABASE_URL and SUPABASE_ANON_KEY (or DATABASE_URL) in environment secrets.',
    requiredTables: REQUIRED_TABLES,
  });
});

// Database Test Connection Endpoint
app.post('/api/db/test-connection', async (_req: Request, res: Response) => {
  return res.json({
    ok: false,
    status: 'pending_configuration',
    message: 'Supabase PostgreSQL connection pending configuration. Provide Supabase credentials to establish live connection.',
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

  // Real Database Check
  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      errorType: 'DATABASE_NOT_CONFIGURED',
      message: 'Database not configured. Connect Supabase to authenticate accounts.',
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Invalid Patient ID or password.',
  });
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

  return res.status(401).json({
    success: false,
    message: `Invalid credentials for ${role || 'user'}.`,
  });
});

// 3. User Registration (All roles)
app.post('/api/auth/register', async (req: Request, res: Response) => {
  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      errorType: 'DATABASE_NOT_CONFIGURED',
      message: 'Database not configured. Connect Supabase to register accounts.',
    });
  }

  return res.status(400).json({
    success: false,
    message: 'Registration service currently unavailable.',
  });
});

// 4. Forgot Password / OTP Flow
app.post('/api/auth/forgot-password', async (_req: Request, res: Response) => {
  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      errorType: 'DATABASE_NOT_CONFIGURED',
      message: 'Database not configured. Connect Supabase to manage passwords.',
    });
  }
  return res.status(400).json({ success: false, message: 'Password recovery unavailable.' });
});

app.post('/api/auth/verify-code', async (_req: Request, res: Response) => {
  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      errorType: 'DATABASE_NOT_CONFIGURED',
      message: 'Database not configured. Connect Supabase to verify codes.',
    });
  }
  return res.status(400).json({ success: false, message: 'Code verification unavailable.' });
});

app.post('/api/auth/reset-password', async (_req: Request, res: Response) => {
  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      errorType: 'DATABASE_NOT_CONFIGURED',
      message: 'Database not configured. Connect Supabase to reset passwords.',
    });
  }
  return res.status(400).json({ success: false, message: 'Password reset unavailable.' });
});

// 5. Change Password Endpoint
app.post('/api/auth/patient/change-password', async (req: Request, res: Response) => {
  const { patientId, currentPassword, newPassword } = req.body;

  if (!patientId || !currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Patient ID, current password, and new password are required.',
    });
  }

  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      errorType: 'DATABASE_NOT_CONFIGURED',
      message: 'Database not configured. Connect Supabase to change passwords.',
    });
  }

  return res.status(400).json({
    success: false,
    message: 'Password change service unavailable.',
  });
});

// 6. Token Verification Endpoint
app.get('/api/auth/verify', authenticatePatientToken, (req: Request, res: Response) => {
  const session = (req as any).authenticatedSession;
  return res.json({
    success: true,
    patientId: session.patient_id,
    expiresAt: session.expires_at,
  });
});

// 7. Logout Endpoint
app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    ACTIVE_SESSIONS.delete(token);
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// 8. Patient Dashboard Endpoint
app.get('/api/patient/dashboard', authenticatePatientToken, async (req: Request, res: Response) => {
  const patientId = (req as any).authenticatedPatientId;

  // Clean empty state when database is not connected or patient has no records
  const patient = formatPatientProfile({ patient_id: patientId });

  return res.json({
    success: true,
    data: {
      patient,
      upcomingAppointments: [],
      completedEncounters: [],
      labReports: [],
      prescriptions: [],
      feedbackList: [],
      notifications: [],
      backendStatus: {
        connected: isDatabaseConnected,
        engine: isDatabaseConnected ? 'Supabase PostgreSQL' : 'Supabase PostgreSQL (Pending Configuration)',
        schema: 'PostgreSQL Schema (Ready for Supabase)',
        notice: isDatabaseConnected ? 'Live Database' : 'Database not connected yet. Showing clean empty state.',
      },
    },
  });
});

// 9. Submit Patient Feedback
app.post('/api/patient/feedback', authenticatePatientToken, async (req: Request, res: Response) => {
  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      errorType: 'DATABASE_NOT_CONFIGURED',
      message: 'Database not configured. Connect Supabase to submit feedback.',
    });
  }

  return res.status(400).json({
    success: false,
    message: 'Feedback service currently unavailable.',
  });
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

// 12. Booking Wizard: Doctors (filtered by branch and specialty)
app.get('/api/booking/doctors', async (req: Request, res: Response) => {
  if (!isDatabaseConnected) {
    return res.json({
      success: true,
      doctors: [],
      message: 'Database not connected. No doctors configured.',
    });
  }

  return res.json({
    success: true,
    doctors: [],
  });
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

  return res.json({
    success: true,
    date: String(date),
    doctorId: String(doctorId),
    slots: [],
  });
});

// 14. Booking Wizard: Create Appointment
app.post('/api/booking/create', authenticatePatientToken, async (req: Request, res: Response) => {
  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      errorType: 'DATABASE_NOT_CONFIGURED',
      message: 'Database not configured. Connect Supabase to schedule appointments.',
    });
  }

  return res.status(400).json({
    success: false,
    message: 'Appointment creation unavailable.',
  });
});

// 15. Cancel Appointment
app.post('/api/booking/cancel', authenticatePatientToken, async (req: Request, res: Response) => {
  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      errorType: 'DATABASE_NOT_CONFIGURED',
      message: 'Database not configured. Connect Supabase to cancel appointments.',
    });
  }

  return res.status(400).json({
    success: false,
    message: 'Appointment cancellation unavailable.',
  });
});

// ==========================================
// STATIC ASSETS & VITE INTEGRATION
// ==========================================

async function startServer() {
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
    console.log(`[MediAI] Status: Ready for Supabase PostgreSQL database integration.`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
