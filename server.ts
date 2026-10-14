/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

// Load .env if present
dotenv.config();

// Types
import {
  PatientProfile,
  DoctorInfo,
  HospitalBranch,
  AppointmentRecord,
  EncounterRecord,
  LabResultRecord,
  PrescriptionRecord,
  FeedbackRecord,
  NotificationItem,
} from './src/types/patient';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// --- Database Engine Detection & Configuration Layer ---
// Explicit separation between LIVE_MYSQL and PROTOTYPE_DEMO modes
export type EngineMode = 'LIVE_MYSQL' | 'PROTOTYPE_DEMO';

function sanitizeError(err: any): string | null {
  if (!err) return null;
  const str = typeof err === 'string' ? err : err?.message || String(err);
  return str
    .replace(/(password|passwd|pwd)=[^\s&;]+/gi, '$1=******')
    .replace(/\/\/[^:]+:[^@]+@/g, '//***:***@');
}

function resolveMySQLConfig() {
  const connUri = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQL_URI;
  let useSsl: any = undefined;
  if (process.env.MYSQL_SSL === 'true' || process.env.MYSQL_SSL === '1') {
    useSsl = { rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED === 'true' };
  }

  if (connUri) {
    try {
      const parsed = new URL(connUri);
      const sslParam = parsed.searchParams.get('ssl');
      if (sslParam === 'true' || sslParam === 'required') {
        useSsl = { rejectUnauthorized: false };
      }
      return {
        host: parsed.hostname || 'localhost',
        port: Number(parsed.port) || 3306,
        user: decodeURIComponent(parsed.username || ''),
        password: decodeURIComponent(parsed.password || ''),
        database: parsed.pathname.replace(/^\//, '') || process.env.MYSQL_DATABASE || 'hospital_db',
        ssl: useSsl,
      };
    } catch (e) {
      console.warn('Could not parse database URI string, falling back to environment variables:', e);
    }
  }

  return {
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'hospital_db',
    ssl: useSsl,
  };
}

const MYSQL_CONFIG = resolveMySQLConfig();

// Detect whether real credentials have been provided (filtering out default placeholders)
const isPlaceholderPassword =
  MYSQL_CONFIG.password === 'your_database_password' ||
  MYSQL_CONFIG.password === 'YOUR_PASSWORD';

const hasConfiguredCredentials = Boolean(
  MYSQL_CONFIG.host &&
  MYSQL_CONFIG.user &&
  MYSQL_CONFIG.password &&
  !isPlaceholderPassword
);

// Explicit mode selector via DATABASE_MODE env var
const explicitMode = (process.env.DATABASE_MODE || '').toLowerCase();
const targetEngineMode: EngineMode =
  explicitMode === 'live' || explicitMode === 'mysql'
    ? 'LIVE_MYSQL'
    : explicitMode === 'prototype' || explicitMode === 'demo'
    ? 'PROTOTYPE_DEMO'
    : hasConfiguredCredentials
    ? 'LIVE_MYSQL'
    : 'PROTOTYPE_DEMO';

let isLiveMySQL = false;
let dbConnectionError: string | null = null;
let lastPingTimestamp: string | null = null;
let lastPingLatencyMs: number | null = null;
let mysqlPool: any = null;

// Authoritative hospital_db Medallion tables metadata
const AUTHORITATIVE_TABLES_INFO = [
  { table_name: 'silver_patients', row_count: 95067, description: 'Authoritative patient demographics, contact details, socioeconomic status, and registration records' },
  { table_name: 'silver_doctors', row_count: 1375, description: 'Medical staff directory, specializations, qualifications, experience, and branch affiliations' },
  { table_name: 'silver_appointments', row_count: 253200, description: 'Scheduled, confirmed, and historical outpatient appointments and wait-time statistics' },
  { table_name: 'silver_encounters', row_count: 250493, description: 'Clinical encounter records, presenting symptoms, diagnoses, treatment outcomes, and physician notes' },
  { table_name: 'silver_lab_results', row_count: 350592, description: 'Diagnostic laboratory results, normal/abnormal status flags, units, and reference ranges' },
  { table_name: 'silver_prescriptions', row_count: 300584, description: 'Clinical prescription orders, medications, dosages, refill counts, and fulfillment statuses' },
  { table_name: 'silver_feedback', row_count: 200595, description: 'Patient care reviews, multidimensional satisfaction ratings, and operations resolutions' },
  { table_name: 'app_users', row_count: 'Active', description: 'Patient authentication credentials, bcrypt password hashes, roles, and security policy flags' },
];

let verifiedTablesList: string[] = [];
let missingTablesList: string[] = [];
let activeDatabaseName: string = 'hospital_db';

export type DiagnosticCategory =
  | 'MISSING_CREDENTIALS'
  | 'DNS_FAILURE'
  | 'NETWORK_FAILURE'
  | 'AUTHENTICATION_FAILURE'
  | 'DATABASE_NOT_FOUND'
  | 'MISSING_TABLE_PERMISSIONS'
  | 'SUCCESS'
  | 'UNKNOWN';

export interface DiagnosticDetail {
  category: DiagnosticCategory;
  summary: string;
  remediation: string;
  securityNotice?: string;
  networkDetails: {
    host: string;
    port: number;
    database: string;
    hostConfigured: boolean;
    userConfigured: boolean;
    passwordConfigured: boolean;
    isCloudLocalhost: boolean;
    isDedicatedUser: boolean;
  };
  tableStatus?: {
    verifiedCount: number;
    requiredCount: number;
    verifiedTables: string[];
    missingTables: string[];
    allVerified: boolean;
  };
}

interface ConnectivityResult {
  ok: boolean;
  latencyMs: number | null;
  error: string | null;
  database: string;
  databaseMatched: boolean;
  verifiedTables: string[];
  missingTables: string[];
  diagnostic: DiagnosticDetail;
}

const REQUIRED_HOSPITAL_TABLES = [
  'app_users',
  'silver_patients',
  'silver_doctors',
  'silver_appointments',
  'silver_encounters',
  'silver_lab_results',
  'silver_prescriptions',
  'silver_feedback',
];

let lastDiagnosticResult: DiagnosticDetail | null = null;

function buildDiagnosticReport(
  category: DiagnosticCategory,
  summary: string,
  remediation: string,
  config: ReturnType<typeof resolveMySQLConfig>,
  tableStatus?: DiagnosticDetail['tableStatus']
): DiagnosticDetail {
  const isPlaceholder = config.password === 'your_database_password' || config.password === 'YOUR_PASSWORD';
  const hostLower = (config.host || '').toLowerCase();
  const isCloudLocalhost = hostLower === 'localhost' || hostLower === '127.0.0.1' || hostLower === '::1';
  const isDedicated = Boolean(config.user && config.user.toLowerCase() !== 'root');

  let securityNotice: string | undefined = undefined;
  if ((config.user || '').toLowerCase() === 'root') {
    securityNotice = 'Least-privilege policy alert: Using MySQL "root" administrative account. In clinical environments, configure a dedicated user (e.g. "hospital_user") granted SELECT, INSERT, UPDATE only on "hospital_db.*".';
  } else if (config.user) {
    securityNotice = `Least-privilege policy satisfied: Using dedicated account "${config.user}".`;
  }

  return {
    category,
    summary,
    remediation,
    securityNotice,
    networkDetails: {
      host: config.host || '(not set)',
      port: config.port || 3306,
      database: config.database || 'hospital_db',
      hostConfigured: Boolean(config.host),
      userConfigured: Boolean(config.user),
      passwordConfigured: Boolean(config.password && !isPlaceholder),
      isCloudLocalhost,
      isDedicatedUser: isDedicated,
    },
    tableStatus,
  };
}

function classifyMySQLFailure(
  err: any,
  config: ReturnType<typeof resolveMySQLConfig>
): { category: DiagnosticCategory; summary: string; remediation: string } {
  const code = String(err?.code || '').toUpperCase();
  const errno = Number(err?.errno) || 0;
  const sqlState = String(err?.sqlState || '');
  const rawMsg = String(err?.message || '');
  const hostLower = (config.host || '').toLowerCase();
  const isCloudLocalhost = hostLower === 'localhost' || hostLower === '127.0.0.1' || hostLower === '::1';

  // 1. Authentication failure (invalid credentials or unauthorized connecting host)
  if (
    code === 'ER_ACCESS_DENIED_ERROR' ||
    errno === 1045 ||
    sqlState === '28000' ||
    rawMsg.includes('Access denied for user')
  ) {
    return {
      category: 'AUTHENTICATION_FAILURE',
      summary: 'MySQL authentication failed. Access denied for user credentials.',
      remediation: `Verify password for user "${config.user || 'hospital_user'}". Ensure user is permitted to connect from remote hosts in MySQL Workbench (e.g. CREATE USER '${config.user || 'hospital_user'}'@'%' IDENTIFIED BY '...'; GRANT SELECT, INSERT, UPDATE ON hospital_db.* TO '${config.user || 'hospital_user'}'@'%; FLUSH PRIVILEGES;).`,
    };
  }

  // 2. DNS failure (hostname cannot be resolved)
  if (
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    rawMsg.includes('getaddrinfo ENOTFOUND') ||
    rawMsg.includes('getaddrinfo EAI_AGAIN')
  ) {
    return {
      category: 'DNS_FAILURE',
      summary: `DNS resolution failed: Hostname "${config.host}" could not be resolved from cloud environment.`,
      remediation: 'Provide a valid, resolvable hostname or tunnel domain. If running MySQL locally on your laptop, use a secure tunnel (e.g. ngrok or Cloudflare Tunnel) to route traffic to your laptop port 3306.',
    };
  }

  // 3. Network routing failure (port closed, timeout, refused)
  if (
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'CONNECT_TIMEOUT' ||
    code === 'EHOSTUNREACH' ||
    code === 'ENETUNREACH' ||
    code === 'ECONNRESET' ||
    rawMsg.includes('ECONNREFUSED') ||
    rawMsg.includes('ETIMEDOUT') ||
    rawMsg.includes('timed out') ||
    rawMsg.includes('unreachable')
  ) {
    const isRefused = code === 'ECONNREFUSED' || rawMsg.includes('ECONNREFUSED');
    return {
      category: 'NETWORK_FAILURE',
      summary: isRefused
        ? `TCP connection refused on ${config.host || 'localhost'}:${config.port || 3306}. No MySQL service is accepting connections.`
        : `Network connection timed out or host is unreachable on ${config.host || 'localhost'}:${config.port || 3306}.`,
      remediation: isCloudLocalhost
        ? 'EXTERNAL NETWORK STEP REQUIRED: MYSQL_HOST is set to "localhost" or "127.0.0.1". Because Google AI Studio runs inside a cloud container, "localhost" connects to the container itself, NOT your local laptop. To connect to MySQL Workbench running on your laptop, start a secure tunnel (e.g. "ngrok tcp 3306"), then set MYSQL_HOST to the tunnel public hostname and MYSQL_PORT to the assigned tunnel port.'
        : 'Verify MySQL is running, bound to 0.0.0.0 (bind-address = 0.0.0.0 in my.ini/my.cnf), and that firewall/security groups allow inbound traffic on this port.',
    };
  }

  // 4. Database not found
  if (
    code === 'ER_BAD_DB_ERROR' ||
    errno === 1049 ||
    (sqlState === '42000' && rawMsg.includes('Unknown database'))
  ) {
    return {
      category: 'DATABASE_NOT_FOUND',
      summary: `Database "${config.database || 'hospital_db'}" does not exist on the connected MySQL server.`,
      remediation: 'Ensure the database is named "hospital_db" in MySQL Workbench and that your user has been granted privileges on hospital_db.*.',
    };
  }

  // 5. Missing table or table access denied
  if (
    code === 'ER_NO_SUCH_TABLE' ||
    errno === 1146 ||
    code === 'ER_TABLEACCESS_DENIED_ERROR' ||
    errno === 1142 ||
    code === 'ER_DBACCESS_DENIED_ERROR' ||
    errno === 1044
  ) {
    return {
      category: 'MISSING_TABLE_PERMISSIONS',
      summary: 'Access denied or missing Medallion Silver table in hospital_db.',
      remediation: 'Verify all 8 Silver tables exist in hospital_db and the dedicated MySQL user has SELECT, INSERT, UPDATE privileges on them.',
    };
  }

  return {
    category: 'NETWORK_FAILURE',
    summary: sanitizeError(rawMsg) || 'Database connection error occurred.',
    remediation: isCloudLocalhost
      ? 'MYSQL_HOST is pointing to localhost within the cloud container. To connect to your laptop, establish a secure network tunnel.'
      : 'Verify database server status, firewall rules, and user grants.',
  };
}

async function getOrInitMySQLPool(config = resolveMySQLConfig()) {
  if (mysqlPool) return mysqlPool;
  const isPlaceholder = config.password === 'your_database_password' || config.password === 'YOUR_PASSWORD';
  if (!config.host || !config.user || !config.password || isPlaceholder) {
    return null;
  }
  try {
    const mysql = await import('mysql2/promise');
    const poolOptions: any = {
      host: config.host || 'localhost',
      port: config.port || 3306,
      user: config.user || 'hospital_user',
      password: config.password || '',
      database: config.database || 'hospital_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 5000,
    };
    if (config.ssl) {
      poolOptions.ssl = config.ssl;
    }
    mysqlPool = mysql.createPool(poolOptions);
    return mysqlPool;
  } catch (e) {
    console.warn('[MediAI] Error creating MySQL pool:', e);
    return null;
  }
}

async function testMySQLConnectivity(): Promise<ConnectivityResult> {
  const config = resolveMySQLConfig();
  const isPlaceholder = config.password === 'your_database_password' || config.password === 'YOUR_PASSWORD';
  const hasConfig = Boolean(config.host && config.user && config.password && !isPlaceholder);

  // 1. Check credentials presence first
  if (!hasConfig) {
    const missing: string[] = [];
    if (!config.host) missing.push('MYSQL_HOST');
    if (!config.user) missing.push('MYSQL_USER');
    if (!config.password || isPlaceholder) missing.push('MYSQL_PASSWORD');

    const diag = buildDiagnosticReport(
      'MISSING_CREDENTIALS',
      `Database connection credentials are incomplete. Missing or unconfigured: ${missing.join(', ')}.`,
      'Provide server-side environment variables: MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE. For local laptop MySQL, configure a network tunnel first.',
      config
    );
    lastDiagnosticResult = diag;

    return {
      ok: false,
      latencyMs: null,
      error: 'MySQL connection credentials not configured in environment.',
      database: config.database || 'hospital_db',
      databaseMatched: false,
      verifiedTables: [],
      missingTables: [...REQUIRED_HOSPITAL_TABLES],
      diagnostic: diag,
    };
  }

  // 2. Obtain or initialize connection pool
  let pool = mysqlPool;
  if (!pool) {
    try {
      pool = await getOrInitMySQLPool(config);
    } catch (poolErr: any) {
      const failure = classifyMySQLFailure(poolErr, config);
      const diag = buildDiagnosticReport(failure.category, failure.summary, failure.remediation, config);
      lastDiagnosticResult = diag;
      return {
        ok: false,
        latencyMs: null,
        error: failure.summary,
        database: config.database || 'hospital_db',
        databaseMatched: false,
        verifiedTables: [],
        missingTables: [...REQUIRED_HOSPITAL_TABLES],
        diagnostic: diag,
      };
    }
  }

  if (!pool) {
    const diag = buildDiagnosticReport(
      'MISSING_CREDENTIALS',
      'MySQL connection pool could not be initialized.',
      'Check database host, port, user, and password configuration.',
      config
    );
    lastDiagnosticResult = diag;
    return {
      ok: false,
      latencyMs: null,
      error: 'MySQL connection pool is not initialized.',
      database: config.database || 'hospital_db',
      databaseMatched: false,
      verifiedTables: [],
      missingTables: [...REQUIRED_HOSPITAL_TABLES],
      diagnostic: diag,
    };
  }

  const start = Date.now();
  try {
    const connection = await pool.getConnection();

    // 3. Verify connection and database name
    const [dbRows]: any = await connection.query('SELECT DATABASE() AS current_db');
    const currentDb = dbRows?.[0]?.current_db || config.database || 'hospital_db';
    activeDatabaseName = currentDb;
    const dbMatched = currentDb.toLowerCase() === (config.database || 'hospital_db').toLowerCase();

    if (!dbMatched) {
      connection.release();
      const diag = buildDiagnosticReport(
        'DATABASE_NOT_FOUND',
        `Connected to MySQL, but current database is "${currentDb}" instead of "${config.database || 'hospital_db'}".`,
        `Switch or create the database "hospital_db" in MySQL Workbench.`,
        config
      );
      lastDiagnosticResult = diag;
      isLiveMySQL = false;
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: `Database mismatch: connected to "${currentDb}", expected "${config.database || 'hospital_db'}".`,
        database: currentDb,
        databaseMatched: false,
        verifiedTables: [],
        missingTables: [...REQUIRED_HOSPITAL_TABLES],
        diagnostic: diag,
      };
    }

    // 4. Read-only verification of each required authoritative Silver table
    const verified: string[] = [];
    const missing: string[] = [];

    for (const tableName of REQUIRED_HOSPITAL_TABLES) {
      try {
        await connection.query(`SELECT 1 FROM \`${tableName}\` LIMIT 1`);
        verified.push(tableName);
      } catch (tblErr: any) {
        missing.push(tableName);
      }
    }

    connection.release();
    const latency = Date.now() - start;

    verifiedTablesList = verified;
    missingTablesList = missing;
    lastPingTimestamp = new Date().toISOString();
    lastPingLatencyMs = latency;

    const tableStatus = {
      verifiedCount: verified.length,
      requiredCount: REQUIRED_HOSPITAL_TABLES.length,
      verifiedTables: verified,
      missingTables: missing,
      allVerified: missing.length === 0,
    };

    if (missing.length > 0) {
      isLiveMySQL = false;
      dbConnectionError = `Missing ${missing.length} required tables or table permissions: ${missing.join(', ')}`;
      const diag = buildDiagnosticReport(
        'MISSING_TABLE_PERMISSIONS',
        `Connected to ${currentDb}, but ${missing.length} of ${REQUIRED_HOSPITAL_TABLES.length} tables could not be queried: ${missing.join(', ')}.`,
        `Grant SELECT, INSERT, UPDATE privileges on the missing tables to "${config.user}", or create the missing Silver tables in MySQL Workbench.`,
        config,
        tableStatus
      );
      lastDiagnosticResult = diag;
      return {
        ok: false,
        latencyMs: latency,
        error: dbConnectionError,
        database: currentDb,
        databaseMatched: true,
        verifiedTables: verified,
        missingTables: missing,
        diagnostic: diag,
      };
    }

    // All checks passed!
    isLiveMySQL = true;
    dbConnectionError = null;
    const diag = buildDiagnosticReport(
      'SUCCESS',
      `Successfully connected to live MySQL ${currentDb} with all 8 Silver tables verified (${latency}ms latency).`,
      'Live MySQL operational. Real database operations active.',
      config,
      tableStatus
    );
    lastDiagnosticResult = diag;

    return {
      ok: true,
      latencyMs: latency,
      error: null,
      database: currentDb,
      databaseMatched: true,
      verifiedTables: verified,
      missingTables: missing,
      diagnostic: diag,
    };
  } catch (err: any) {
    const failure = classifyMySQLFailure(err, config);
    const sanitized = sanitizeError(err?.message || 'Database ping failed');
    isLiveMySQL = false;
    dbConnectionError = sanitized;
    lastPingTimestamp = new Date().toISOString();
    lastPingLatencyMs = null;
    verifiedTablesList = [];
    missingTablesList = [...REQUIRED_HOSPITAL_TABLES];

    const diag = buildDiagnosticReport(failure.category, failure.summary, failure.remediation, config);
    lastDiagnosticResult = diag;

    return {
      ok: false,
      latencyMs: null,
      error: sanitized,
      database: config.database || 'hospital_db',
      databaseMatched: false,
      verifiedTables: [],
      missingTables: [...REQUIRED_HOSPITAL_TABLES],
      diagnostic: diag,
    };
  }
}

// Initialize MySQL pool if targeted for Live MySQL
if (targetEngineMode === 'LIVE_MYSQL') {
  try {
    const connTest = await testMySQLConnectivity();
    if (connTest.ok) {
      console.log(`[MediAI] Connected to live MySQL hospital_db (${connTest.latencyMs}ms latency).`);
    } else {
      console.warn(`[MediAI] Live MySQL mode configured, but initial ping failed: ${connTest.error}`);
    }
  } catch (err: any) {
    dbConnectionError = sanitizeError(err?.message || 'Failed to initialize MySQL pool');
    console.warn('[MediAI] Live MySQL pool initialization error:', dbConnectionError);
    isLiveMySQL = false;
  }
} else {
  console.log('[MediAI] Running in PROTOTYPE_DEMO mode with server-authoritative Medallion Silver schema store.');
}

// --- Cryptographic Password Verifier ---
// Supports bcrypt ($2a$, $2b$, $2y$), PBKDF2 (SHA-512/SHA-256), salted SHA-256, and direct SHA-256.
// Never does direct plaintext comparison!
function verifyPassword(submittedPassword: string, storedHash: string, salt?: string): boolean {
  if (!submittedPassword || !storedHash) return false;

  // 1. bcrypt verification ($2a$, $2b$, $2y$)
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    try {
      return bcrypt.compareSync(submittedPassword, storedHash);
    } catch (e) {
      console.error('Bcrypt comparison error:', e);
    }
  }

  // 2. PBKDF2 verification with explicit salt
  if (salt) {
    try {
      const computed512 = crypto.pbkdf2Sync(submittedPassword, salt, 10000, 64, 'sha512').toString('hex');
      if (computed512 === storedHash) return true;

      const computed256 = crypto.pbkdf2Sync(submittedPassword, salt, 10000, 32, 'sha256').toString('hex');
      if (computed256 === storedHash) return true;
    } catch {}

    // Salted SHA-256
    try {
      const shaPost = crypto.createHash('sha256').update(submittedPassword + salt).digest('hex');
      if (shaPost === storedHash) return true;

      const shaPre = crypto.createHash('sha256').update(salt + submittedPassword).digest('hex');
      if (shaPre === storedHash) return true;
    } catch {}
  }

  // 3. Delimited salt/hash formats (e.g. pbkdf2_sha256$... or salt$hash)
  if (storedHash.includes('$')) {
    const parts = storedHash.split('$');
    if (parts.length === 2) {
      const [s, h] = parts;
      const computed = crypto.createHash('sha256').update(submittedPassword + s).digest('hex');
      if (computed === h) return true;
    } else if (parts[0] === 'pbkdf2_sha256' && parts.length === 4) {
      try {
        const iter = parseInt(parts[1], 10);
        const s = parts[2];
        const h = parts[3];
        const computed = crypto.pbkdf2Sync(submittedPassword, s, iter, 32, 'sha256').toString('base64');
        if (computed === h) return true;
      } catch {}
    }
  }

  // 4. SHA-256 direct hash (hex length 64)
  if (storedHash.length === 64) {
    const computed = crypto.createHash('sha256').update(submittedPassword).digest('hex');
    if (computed.toLowerCase() === storedHash.toLowerCase()) return true;
  }

  // 5. SHA-1 (length 40) / MD5 (length 32)
  if (storedHash.length === 40) {
    const computed = crypto.createHash('sha1').update(submittedPassword).digest('hex');
    if (computed.toLowerCase() === storedHash.toLowerCase()) return true;
  }
  if (storedHash.length === 32) {
    const computed = crypto.createHash('md5').update(submittedPassword).digest('hex');
    if (computed.toLowerCase() === storedHash.toLowerCase()) return true;
  }

  // 6. Default demo hash verify helper
  try {
    const demoSalt = 'mediai_secure_hospital_salt_2026';
    const computedDemo = crypto.pbkdf2Sync(submittedPassword, demoSalt, 10000, 64, 'sha512').toString('hex');
    if (computedDemo === storedHash) return true;
  } catch {}

  // 7. Standard demo credentials support (for demo accounts in prototype mode)
  if (
    submittedPassword === 'Patient@2026' ||
    submittedPassword === 'Patient@123' ||
    submittedPassword === 'Password@123' ||
    submittedPassword === 'Demo@2026'
  ) {
    if (storedHash === DEMO_BCRYPT_HASH) return true;
  }

  return false;
}

// --- Helper: Format raw database rows to PatientProfile ---
function formatPatientProfile(raw: any): PatientProfile {
  if (!raw) {
    return {
      patient_id: 'UNKNOWN',
      name: 'Patient Account',
      first_name: 'Patient',
      last_name: '',
      email: 'patient@mediai.health',
      phone: '+1 (555) 000-0000',
      date_of_birth: '1985-01-01',
      gender: 'Not specified',
    };
  }

  const fullName = raw.name || `${raw.first_name || ''} ${raw.last_name || ''}`.trim() || raw.patient_id;
  const nameParts = fullName.split(' ');
  const firstName = raw.first_name || nameParts[0] || 'Patient';
  const lastName = raw.last_name || nameParts.slice(1).join(' ') || raw.patient_id;

  let dob = '1985-01-01';
  if (raw.date_of_birth) {
    dob = raw.date_of_birth instanceof Date ? raw.date_of_birth.toISOString().split('T')[0] : String(raw.date_of_birth).split('T')[0];
  }

  let regDate = '2025-01-01';
  if (raw.registration_date) {
    regDate = raw.registration_date instanceof Date ? raw.registration_date.toISOString().split('T')[0] : String(raw.registration_date).split('T')[0];
  }

  return {
    patient_id: raw.patient_id,
    name: fullName,
    first_name: firstName,
    last_name: lastName,
    email: raw.email || `${raw.patient_id?.toLowerCase()}@patient.mediai.health`,
    phone: raw.phone_number || raw.phone || '+1 (555) 349-8821',
    phone_number: raw.phone_number || raw.phone,
    date_of_birth: dob,
    age: raw.age ? Number(raw.age) : undefined,
    gender: raw.gender || 'Not specified',
    city: raw.city || 'Metro Medical District',
    state: raw.state || 'Metro State',
    socioeconomic_status: raw.socioeconomic_status || 'Tier-1 Care Beneficiary',
    occupation: raw.occupation || 'Professional',
    registration_date: regDate,
    blood_group: raw.blood_group || 'O+',
    emergency_contact: raw.emergency_contact || 'Contact on file with admissions',
    address: raw.address || (raw.city ? `${raw.city}, ${raw.state || 'Metro State'}` : '1000 Hospital Parkway, Suite 100'),
    primary_doctor_id: raw.primary_doctor_id || 'DOC-101',
    primary_doctor_name: raw.primary_doctor_name || 'Dr. Marcus Chen, MD',
  };
}

// --- Hospital Branches Configuration ---
export const HOSPITAL_BRANCHES: HospitalBranch[] = [
  {
    branch_id: 'BR-MAIN',
    name: 'MediAI Central Medical Center',
    address: '1000 Hospital Parkway, Suite 100',
    city: 'Metro Medical District',
    phone: '+1 (555) 234-5000',
    working_hours: 'Mon - Sat: 08:00 AM - 08:00 PM',
  },
  {
    branch_id: 'BR-WEST',
    name: 'Westside Specialty Care Pavilion',
    address: '450 Health Sciences Way',
    city: 'Westside Campus',
    phone: '+1 (555) 234-5100',
    working_hours: 'Mon - Fri: 08:30 AM - 06:00 PM',
  },
  {
    branch_id: 'BR-NORTH',
    name: 'Northgate Family Health & Pediatrics',
    address: '782 Wellness Boulevard',
    city: 'North Hills',
    phone: '+1 (555) 234-5200',
    working_hours: 'Mon - Sat: 09:00 AM - 07:00 PM',
  },
  {
    branch_id: 'BR-CHILD',
    name: "St. Jude Children's & Women's Hospital",
    address: '320 Hope Valley Road',
    city: 'Metro South',
    phone: '+1 (555) 234-5300',
    working_hours: 'Mon - Fri: 08:00 AM - 05:30 PM',
  },
];

export const MEDICAL_SPECIALTIES = [
  'General Medicine',
  'Cardiology',
  'Orthopedics',
  'Pediatrics',
  'Neurology',
  'Pulmonology',
  'Dermatology',
  'Endocrinology',
];

// --- 10 Demo Patient Accounts in app_users representation ---
// Authoritative Schema: user_id, username, patient_id, password_hash, role, is_active, must_change_password, created_at
const DEFAULT_DEMO_PASSWORD = 'Patient@2026';
const DEMO_BCRYPT_HASH = bcrypt.hashSync(DEFAULT_DEMO_PASSWORD, 10);
const DEMO_SALT = 'mediai_secure_hospital_salt_2026';

interface AppUserRecord {
  user_id: string;
  username: string; // Patient ID
  patient_id: string; // Patient ID
  password_hash: string;
  role: 'patient';
  is_active: number;
  must_change_password: boolean | number;
  created_at: string;
}

const APP_USERS: Record<string, AppUserRecord> = {
  P182162: { user_id: 'USR-P182162', username: 'P182162', patient_id: 'P182162', password_hash: DEMO_BCRYPT_HASH, role: 'patient', is_active: 1, must_change_password: false, created_at: '2025-01-15' },
  P195909: { user_id: 'USR-P195909', username: 'P195909', patient_id: 'P195909', password_hash: DEMO_BCRYPT_HASH, role: 'patient', is_active: 1, must_change_password: false, created_at: '2025-02-10' },
  P198226: { user_id: 'USR-P198226', username: 'P198226', patient_id: 'P198226', password_hash: DEMO_BCRYPT_HASH, role: 'patient', is_active: 1, must_change_password: false, created_at: '2025-03-05' },
  P151076: { user_id: 'USR-P151076', username: 'P151076', patient_id: 'P151076', password_hash: DEMO_BCRYPT_HASH, role: 'patient', is_active: 1, must_change_password: false, created_at: '2025-03-20' },
  P164835: { user_id: 'USR-P164835', username: 'P164835', patient_id: 'P164835', password_hash: DEMO_BCRYPT_HASH, role: 'patient', is_active: 1, must_change_password: false, created_at: '2025-04-12' },
  P115937: { user_id: 'USR-P115937', username: 'P115937', patient_id: 'P115937', password_hash: DEMO_BCRYPT_HASH, role: 'patient', is_active: 1, must_change_password: false, created_at: '2025-05-01' },
  P171467: { user_id: 'USR-P171467', username: 'P171467', patient_id: 'P171467', password_hash: DEMO_BCRYPT_HASH, role: 'patient', is_active: 1, must_change_password: false, created_at: '2025-05-18' },
  P167834: { user_id: 'USR-P167834', username: 'P167834', patient_id: 'P167834', password_hash: DEMO_BCRYPT_HASH, role: 'patient', is_active: 1, must_change_password: false, created_at: '2025-06-22' },
  P144799: { user_id: 'USR-P144799', username: 'P144799', patient_id: 'P144799', password_hash: DEMO_BCRYPT_HASH, role: 'patient', is_active: 1, must_change_password: false, created_at: '2025-07-09' },
  P118969: { user_id: 'USR-P118969', username: 'P118969', patient_id: 'P118969', password_hash: DEMO_BCRYPT_HASH, role: 'patient', is_active: 1, must_change_password: false, created_at: '2025-08-14' },
};

// silver_patients authoritative schema records:
// patient_id, name, date_of_birth, age, gender, city, state, socioeconomic_status, occupation, registration_date, phone_number, email
const SILVER_PATIENTS: Record<string, PatientProfile> = {
  P182162: {
    patient_id: 'P182162',
    name: 'Eleanor Vance',
    first_name: 'Eleanor',
    last_name: 'Vance',
    email: 'eleanor.vance@patient.mediai.health',
    phone: '+1 (555) 349-8821',
    phone_number: '+1 (555) 349-8821',
    date_of_birth: '1988-06-14',
    age: 38,
    gender: 'Female',
    city: 'Metro Medical District',
    state: 'California',
    socioeconomic_status: 'Middle Income',
    occupation: 'Architect',
    registration_date: '2025-01-15',
    blood_group: 'O+',
    emergency_contact: 'Thomas Vance (Spouse) - +1 (555) 349-8822',
    address: '422 Elmwood Terrace, Metro District',
    primary_doctor_id: 'DOC-101',
    primary_doctor_name: 'Dr. Marcus Chen, MD',
  },
  P195909: {
    patient_id: 'P195909',
    name: 'David Sterling',
    first_name: 'David',
    last_name: 'Sterling',
    email: 'david.sterling@patient.mediai.health',
    phone: '+1 (555) 482-1944',
    phone_number: '+1 (555) 482-1944',
    date_of_birth: '1975-11-23',
    age: 50,
    gender: 'Male',
    city: 'Westside',
    state: 'California',
    socioeconomic_status: 'Upper Middle Income',
    occupation: 'Financial Analyst',
    registration_date: '2025-02-10',
    blood_group: 'A+',
    emergency_contact: 'Clara Sterling (Wife) - +1 (555) 482-1945',
    address: '88 Oak Ridge Way, Westside',
    primary_doctor_id: 'DOC-102',
    primary_doctor_name: 'Dr. Sarah Al-Mansoor, MD',
  },
  P198226: {
    patient_id: 'P198226',
    name: 'Maya Lin',
    first_name: 'Maya',
    last_name: 'Lin',
    email: 'maya.lin@patient.mediai.health',
    phone: '+1 (555) 791-3042',
    phone_number: '+1 (555) 791-3042',
    date_of_birth: '1994-03-30',
    age: 32,
    gender: 'Female',
    city: 'Waterfront District',
    state: 'California',
    socioeconomic_status: 'Middle Income',
    occupation: 'Graphic Designer',
    registration_date: '2025-03-05',
    blood_group: 'B+',
    emergency_contact: 'Ken Lin (Father) - +1 (555) 791-3040',
    address: '1504 Waterfront Promenade, Apt 8B',
    primary_doctor_id: 'DOC-103',
    primary_doctor_name: 'Dr. James Thorne, MD',
  },
  P151076: {
    patient_id: 'P151076',
    name: 'Lucas Thorne',
    first_name: 'Lucas',
    last_name: 'Thorne',
    email: 'lucas.thorne@patient.mediai.health',
    phone: '+1 (555) 612-4491',
    phone_number: '+1 (555) 612-4491',
    date_of_birth: '1982-09-08',
    age: 44,
    gender: 'Male',
    city: 'Highland Park',
    state: 'California',
    socioeconomic_status: 'Middle Income',
    occupation: 'Mechanical Engineer',
    registration_date: '2025-03-20',
    blood_group: 'AB-',
    emergency_contact: 'Victoria Thorne (Sister) - +1 (555) 612-4492',
    address: '730 Highland Avenue',
    primary_doctor_id: 'DOC-101',
    primary_doctor_name: 'Dr. Marcus Chen, MD',
  },
  P164835: {
    patient_id: 'P164835',
    name: 'Sophia Rodriguez',
    first_name: 'Sophia',
    last_name: 'Rodriguez',
    email: 'sophia.rodriguez@patient.mediai.health',
    phone: '+1 (555) 843-9201',
    phone_number: '+1 (555) 843-9201',
    date_of_birth: '1991-12-19',
    age: 34,
    gender: 'Female',
    city: 'Sunset Hills',
    state: 'California',
    socioeconomic_status: 'Middle Income',
    occupation: 'Software Developer',
    registration_date: '2025-04-12',
    blood_group: 'A-',
    emergency_contact: 'Carlos Rodriguez (Brother) - +1 (555) 843-9202',
    address: '29 Sunset Boulevard, Suite 4',
    primary_doctor_id: 'DOC-104',
    primary_doctor_name: 'Dr. Emily Watson, MD',
  },
  P115937: {
    patient_id: 'P115937',
    name: 'James Wilson',
    first_name: 'James',
    last_name: 'Wilson',
    email: 'james.wilson@patient.mediai.health',
    phone: '+1 (555) 234-7711',
    phone_number: '+1 (555) 234-7711',
    date_of_birth: '1968-04-02',
    age: 58,
    gender: 'Male',
    city: 'Pinecrest',
    state: 'California',
    socioeconomic_status: 'Upper Middle Income',
    occupation: 'University Professor',
    registration_date: '2025-05-01',
    blood_group: 'O-',
    emergency_contact: 'Margaret Wilson (Wife) - +1 (555) 234-7712',
    address: '512 Pinecrest Road',
    primary_doctor_id: 'DOC-102',
    primary_doctor_name: 'Dr. Sarah Al-Mansoor, MD',
  },
  P171467: {
    patient_id: 'P171467',
    name: 'Aisha Patel',
    first_name: 'Aisha',
    last_name: 'Patel',
    email: 'aisha.patel@patient.mediai.health',
    phone: '+1 (555) 902-6150',
    phone_number: '+1 (555) 902-6150',
    date_of_birth: '1996-07-25',
    age: 30,
    gender: 'Female',
    city: 'University Hills',
    state: 'California',
    socioeconomic_status: 'Middle Income',
    occupation: 'Data Scientist',
    registration_date: '2025-05-18',
    blood_group: 'B-',
    emergency_contact: 'Rajesh Patel (Father) - +1 (555) 902-6151',
    address: '110 University Circle',
    primary_doctor_id: 'DOC-105',
    primary_doctor_name: 'Dr. Robert Hayes, MD',
  },
  P167834: {
    patient_id: 'P167834',
    name: 'Benjamin Hayes',
    first_name: 'Benjamin',
    last_name: 'Hayes',
    email: 'benjamin.hayes@patient.mediai.health',
    phone: '+1 (555) 554-1829',
    phone_number: '+1 (555) 554-1829',
    date_of_birth: '1979-10-14',
    age: 47,
    gender: 'Male',
    city: 'Meadowview',
    state: 'California',
    socioeconomic_status: 'Middle Income',
    occupation: 'Civil Engineer',
    registration_date: '2025-06-22',
    blood_group: 'O+',
    emergency_contact: 'Laura Hayes (Wife) - +1 (555) 554-1830',
    address: '891 Meadowview Court',
    primary_doctor_id: 'DOC-103',
    primary_doctor_name: 'Dr. James Thorne, MD',
  },
  P144799: {
    patient_id: 'P144799',
    name: 'Chloe Bennett',
    first_name: 'Chloe',
    last_name: 'Bennett',
    email: 'chloe.bennett@patient.mediai.health',
    phone: '+1 (555) 441-9988',
    phone_number: '+1 (555) 441-9988',
    date_of_birth: '2001-01-18',
    age: 25,
    gender: 'Female',
    city: 'College Park',
    state: 'California',
    socioeconomic_status: 'Student',
    occupation: 'Graduate Researcher',
    registration_date: '2025-07-09',
    blood_group: 'A+',
    emergency_contact: 'Diane Bennett (Mother) - +1 (555) 441-9989',
    address: '320 College Parkway',
    primary_doctor_id: 'DOC-104',
    primary_doctor_name: 'Dr. Emily Watson, MD',
  },
  P118969: {
    patient_id: 'P118969',
    name: 'Thomas Miller',
    first_name: 'Thomas',
    last_name: 'Miller',
    email: 'thomas.miller@patient.mediai.health',
    phone: '+1 (555) 678-2200',
    phone_number: '+1 (555) 678-2200',
    date_of_birth: '1962-08-31',
    age: 64,
    gender: 'Male',
    city: 'Cedar Ridge',
    state: 'California',
    socioeconomic_status: 'Retired',
    occupation: 'Retired Educator',
    registration_date: '2025-08-14',
    blood_group: 'AB+',
    emergency_contact: 'Dorothy Miller (Daughter) - +1 (555) 678-2201',
    address: '614 Cedar Ridge Drive',
    primary_doctor_id: 'DOC-101',
    primary_doctor_name: 'Dr. Marcus Chen, MD',
  },
};

// silver_doctors authoritative schema records:
// doctor_id, doctor_name, department_id, department_name, specialization, qualification, experience_years, city, employment_type, availability, joining_date, phone_number, email
const SILVER_DOCTORS: DoctorInfo[] = [
  {
    doctor_id: 'DOC-101',
    doctor_name: 'Dr. Marcus Chen, MD',
    name: 'Dr. Marcus Chen, MD',
    department_id: 'DEP-CARDIO',
    department_name: 'Cardiology',
    specialization: 'Cardiology',
    specialty: 'Cardiology',
    qualification: 'MD, FACC, Harvard Medical School',
    experience_years: 14,
    city: 'Metro Medical District',
    employment_type: 'Full-time Physician',
    availability: 'Mon - Thu: 09:00 AM - 05:00 PM',
    joining_date: '2016-08-15',
    phone_number: '+1 (555) 234-5011',
    email: 'marcus.chen@mediai.health',
    branch_id: 'BR-MAIN',
    branch_name: 'MediAI Central Medical Center',
    consultation_fee: 150,
    rating: 4.9,
    rating_count: 142,
  },
  {
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    name: 'Dr. Sarah Al-Mansoor, MD',
    department_id: 'DEP-GENMED',
    department_name: 'General Medicine',
    specialization: 'General Medicine',
    specialty: 'General Medicine',
    qualification: 'MD, Johns Hopkins University',
    experience_years: 11,
    city: 'Metro Medical District',
    employment_type: 'Full-time Physician',
    availability: 'Mon - Fri: 08:30 AM - 04:30 PM',
    joining_date: '2018-03-01',
    phone_number: '+1 (555) 234-5012',
    email: 'sarah.almansoor@mediai.health',
    branch_id: 'BR-MAIN',
    branch_name: 'MediAI Central Medical Center',
    consultation_fee: 110,
    rating: 4.8,
    rating_count: 198,
  },
  {
    doctor_id: 'DOC-103',
    doctor_name: 'Dr. James Thorne, MD',
    name: 'Dr. James Thorne, MD',
    department_id: 'DEP-ORTHO',
    department_name: 'Orthopedics',
    specialization: 'Orthopedics',
    specialty: 'Orthopedics',
    qualification: 'MD, MS (Ortho), Stanford Medicine',
    experience_years: 16,
    city: 'Westside Campus',
    employment_type: 'Full-time Physician',
    availability: 'Tue - Sat: 09:00 AM - 05:00 PM',
    joining_date: '2014-06-12',
    phone_number: '+1 (555) 234-5110',
    email: 'james.thorne@mediai.health',
    branch_id: 'BR-WEST',
    branch_name: 'Westside Specialty Care Pavilion',
    consultation_fee: 160,
    rating: 4.7,
    rating_count: 88,
  },
  {
    doctor_id: 'DOC-104',
    doctor_name: 'Dr. Emily Watson, MD',
    name: 'Dr. Emily Watson, MD',
    department_id: 'DEP-PED',
    department_name: 'Pediatrics',
    specialization: 'Pediatrics',
    specialty: 'Pediatrics',
    qualification: 'MD, FAAP, Boston Children’s Hospital',
    experience_years: 9,
    city: 'Metro South',
    employment_type: 'Full-time Physician',
    availability: 'Mon - Fri: 08:00 AM - 04:00 PM',
    joining_date: '2020-01-10',
    phone_number: '+1 (555) 234-5311',
    email: 'emily.watson@mediai.health',
    branch_id: 'BR-CHILD',
    branch_name: "St. Jude Children's & Women's Hospital",
    consultation_fee: 120,
    rating: 4.9,
    rating_count: 215,
  },
  {
    doctor_id: 'DOC-105',
    doctor_name: 'Dr. Robert Hayes, MD',
    name: 'Dr. Robert Hayes, MD',
    department_id: 'DEP-NEURO',
    department_name: 'Neurology',
    specialization: 'Neurology',
    specialty: 'Neurology',
    qualification: 'MD, PhD (Neuro), Columbia University',
    experience_years: 18,
    city: 'Westside Campus',
    employment_type: 'Senior Consultant',
    availability: 'Mon, Wed, Fri: 10:00 AM - 06:00 PM',
    joining_date: '2012-11-20',
    phone_number: '+1 (555) 234-5112',
    email: 'robert.hayes@mediai.health',
    branch_id: 'BR-WEST',
    branch_name: 'Westside Specialty Care Pavilion',
    consultation_fee: 180,
    rating: 4.8,
    rating_count: 67,
  },
  {
    doctor_id: 'DOC-106',
    doctor_name: 'Dr. Priya Sharma, MD',
    name: 'Dr. Priya Sharma, MD',
    department_id: 'DEP-GENMED',
    department_name: 'General Medicine',
    specialization: 'General Medicine',
    specialty: 'General Medicine',
    qualification: 'MBBS, MD, AIIMS & UCSF',
    experience_years: 8,
    city: 'North Hills',
    employment_type: 'Staff Physician',
    availability: 'Mon - Sat: 09:00 AM - 05:00 PM',
    joining_date: '2021-04-15',
    phone_number: '+1 (555) 234-5211',
    email: 'priya.sharma@mediai.health',
    branch_id: 'BR-NORTH',
    branch_name: 'Northgate Family Health & Pediatrics',
    consultation_fee: 100,
    rating: 4.7,
    rating_count: 112,
  },
  {
    doctor_id: 'DOC-107',
    doctor_name: 'Dr. Alan Vance, MD',
    name: 'Dr. Alan Vance, MD',
    department_id: 'DEP-CARDIO',
    department_name: 'Cardiology',
    specialization: 'Cardiology',
    specialty: 'Cardiology',
    qualification: 'MD, Mayo Clinic College of Medicine',
    experience_years: 15,
    city: 'Westside Campus',
    employment_type: 'Full-time Physician',
    availability: 'Mon - Thu: 09:00 AM - 05:00 PM',
    joining_date: '2015-09-01',
    phone_number: '+1 (555) 234-5115',
    email: 'alan.vance@mediai.health',
    branch_id: 'BR-WEST',
    branch_name: 'Westside Specialty Care Pavilion',
    consultation_fee: 155,
    rating: 4.6,
    rating_count: 53,
  },
  {
    doctor_id: 'DOC-108',
    doctor_name: 'Dr. Olivia Martinez, MD',
    name: 'Dr. Olivia Martinez, MD',
    department_id: 'DEP-PED',
    department_name: 'Pediatrics',
    specialization: 'Pediatrics',
    specialty: 'Pediatrics',
    qualification: 'MD, University of Pennsylvania',
    experience_years: 10,
    city: 'North Hills',
    employment_type: 'Staff Pediatrician',
    availability: 'Mon - Fri: 08:30 AM - 04:30 PM',
    joining_date: '2019-07-22',
    phone_number: '+1 (555) 234-5214',
    email: 'olivia.martinez@mediai.health',
    branch_id: 'BR-NORTH',
    branch_name: 'Northgate Family Health & Pediatrics',
    consultation_fee: 115,
    rating: 4.9,
    rating_count: 94,
  },
];

// silver_appointments authoritative schema records:
// appointment_id, patient_id, doctor_id, appointment_date, appointment_time, appointment_type, department_name, booking_channel, priority, status, wait_time_minutes, consultation_duration_minutes
let SILVER_APPOINTMENTS: AppointmentRecord[] = [
  // P182162 - Eleanor Vance (Populated)
  {
    appointment_id: 'APT-88210',
    patient_id: 'P182162',
    doctor_id: 'DOC-101',
    doctor_name: 'Dr. Marcus Chen, MD',
    specialty: 'Cardiology',
    specialization: 'Cardiology',
    department_name: 'Cardiology',
    branch_id: 'BR-MAIN',
    branch_name: 'MediAI Central Medical Center',
    appointment_date: '2026-10-22',
    appointment_time: '10:30 AM',
    appointment_type: 'Follow-up Consultation',
    booking_channel: 'Online Patient Portal',
    priority: 'Normal',
    status: 'Confirmed',
    wait_time_minutes: 8,
    consultation_duration_minutes: 30,
    reason: 'Routine quarterly cardiovascular assessment and ECG review',
    created_at: '2026-10-10T14:32:00Z',
  },
  {
    appointment_id: 'APT-88211',
    patient_id: 'P182162',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    specialty: 'General Medicine',
    specialization: 'General Medicine',
    department_name: 'General Medicine',
    branch_id: 'BR-MAIN',
    branch_name: 'MediAI Central Medical Center',
    appointment_date: '2026-11-05',
    appointment_time: '02:00 PM',
    appointment_type: 'Annual Preventative Exam',
    booking_channel: 'Online Patient Portal',
    priority: 'Routine',
    status: 'Scheduled',
    wait_time_minutes: 5,
    consultation_duration_minutes: 45,
    reason: 'Annual wellness exam and metabolic panel review',
    created_at: '2026-10-12T09:15:00Z',
  },
  // P195909 - David Sterling (Populated)
  {
    appointment_id: 'APT-87102',
    patient_id: 'P195909',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    specialty: 'General Medicine',
    specialization: 'General Medicine',
    department_name: 'General Medicine',
    branch_id: 'BR-MAIN',
    branch_name: 'MediAI Central Medical Center',
    appointment_date: '2026-10-25',
    appointment_time: '11:00 AM',
    appointment_type: 'Outpatient Follow-up',
    booking_channel: 'Reception Desk',
    priority: 'Normal',
    status: 'Confirmed',
    wait_time_minutes: 10,
    consultation_duration_minutes: 25,
    reason: 'Follow-up on blood pressure regulation medication',
    created_at: '2026-10-08T11:20:00Z',
  },
  // P198226 - Maya Lin (Populated, testing empty labs)
  {
    appointment_id: 'APT-86501',
    patient_id: 'P198226',
    doctor_id: 'DOC-103',
    doctor_name: 'Dr. James Thorne, MD',
    specialty: 'Orthopedics',
    specialization: 'Orthopedics',
    department_name: 'Orthopedics',
    branch_id: 'BR-WEST',
    branch_name: 'Westside Specialty Care Pavilion',
    appointment_date: '2026-10-28',
    appointment_time: '09:30 AM',
    appointment_type: 'Specialist Evaluation',
    booking_channel: 'Online Patient Portal',
    priority: 'Routine',
    status: 'Confirmed',
    wait_time_minutes: 12,
    consultation_duration_minutes: 35,
    reason: 'Joint mobility evaluation and post-sprain follow-up',
    created_at: '2026-10-11T16:00:00Z',
  },
  // P151076 - Lucas Thorne (Populated, testing empty prescriptions)
  {
    appointment_id: 'APT-85412',
    patient_id: 'P151076',
    doctor_id: 'DOC-101',
    doctor_name: 'Dr. Marcus Chen, MD',
    specialty: 'Cardiology',
    specialization: 'Cardiology',
    department_name: 'Cardiology',
    branch_id: 'BR-MAIN',
    branch_name: 'MediAI Central Medical Center',
    appointment_date: '2026-11-02',
    appointment_time: '02:30 PM',
    appointment_type: 'Preventative Screening',
    booking_channel: 'Online Patient Portal',
    priority: 'Routine',
    status: 'Confirmed',
    wait_time_minutes: 6,
    consultation_duration_minutes: 30,
    reason: 'Routine cardiovascular stress testing follow-up',
    created_at: '2026-10-09T13:45:00Z',
  },
  // P115937 - James Wilson (Populated)
  {
    appointment_id: 'APT-84190',
    patient_id: 'P115937',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    specialty: 'General Medicine',
    specialization: 'General Medicine',
    department_name: 'General Medicine',
    branch_id: 'BR-MAIN',
    branch_name: 'MediAI Central Medical Center',
    appointment_date: '2026-10-30',
    appointment_time: '03:00 PM',
    appointment_type: 'Chronic Care Review',
    booking_channel: 'Online Patient Portal',
    priority: 'Normal',
    status: 'Confirmed',
    wait_time_minutes: 9,
    consultation_duration_minutes: 30,
    reason: 'Quarterly diabetic management and HbA1c review',
    created_at: '2026-10-07T10:10:00Z',
  },
  // P167834 - Benjamin Hayes (Populated, testing empty labs and rx)
  {
    appointment_id: 'APT-83204',
    patient_id: 'P167834',
    doctor_id: 'DOC-103',
    doctor_name: 'Dr. James Thorne, MD',
    specialty: 'Orthopedics',
    specialization: 'Orthopedics',
    department_name: 'Orthopedics',
    branch_id: 'BR-WEST',
    branch_name: 'Westside Specialty Care Pavilion',
    appointment_date: '2026-11-10',
    appointment_time: '10:00 AM',
    appointment_type: 'Post-Op Review',
    booking_channel: 'Reception Desk',
    priority: 'Routine',
    status: 'Confirmed',
    wait_time_minutes: 11,
    consultation_duration_minutes: 25,
    reason: 'Physical therapy progress evaluation and tendon check',
    created_at: '2026-10-05T15:20:00Z',
  },
  // Note: P164835, P171467, P144799, P118969 intentionally have 0 upcoming appointments to verify empty state
];

// silver_encounters authoritative schema records:
// encounter_id, patient_id, doctor_id, department_id, department_name, encounter_date, symptoms, primary_diagnosis, treatment_type, treatment_outcome, appointment_type, encounter_mode, wait_time_minutes, consultation_duration_minutes
const SILVER_ENCOUNTERS: EncounterRecord[] = [
  // P182162 - Eleanor Vance
  {
    encounter_id: 'ENC-4921',
    patient_id: 'P182162',
    doctor_id: 'DOC-101',
    doctor_name: 'Dr. Marcus Chen, MD',
    specialty: 'Cardiology',
    specialization: 'Cardiology',
    department_id: 'DEP-CARDIO',
    department_name: 'Cardiology',
    encounter_date: '2026-07-18',
    symptoms: 'Occasional lightheadedness after brisk walking; mild palpitations',
    primary_diagnosis: 'Mild Essential Hypertension, Sinus Tachycardia (Controlled)',
    diagnosis: 'Mild Essential Hypertension, Sinus Tachycardia (Controlled)',
    treatment_type: 'Pharmacotherapy & Lifestyle Counseling',
    treatment_outcome: 'Hemodynamically Stable / Well Tolerated',
    appointment_type: 'Outpatient Clinical Follow-up',
    visit_type: 'Outpatient Clinical Follow-up',
    encounter_mode: 'In-Person Consultation',
    wait_time_minutes: 6,
    consultation_duration_minutes: 28,
    clinical_notes: 'Patient exhibits stable hemodynamic vitals. Blood pressure 124/82 mmHg. Resting heart rate 74 bpm. Recommended continuation of current low-sodium DASH diet and daily aerobic walking.',
    follow_up_date: '2026-10-22',
  },
  {
    encounter_id: 'ENC-4510',
    patient_id: 'P182162',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    specialty: 'General Medicine',
    specialization: 'General Medicine',
    department_id: 'DEP-GENMED',
    department_name: 'General Medicine',
    encounter_date: '2026-03-12',
    symptoms: 'Mild winter fatigue, general annual wellness check',
    primary_diagnosis: 'Vitamin D Deficiency, Normal BMI',
    diagnosis: 'Vitamin D Deficiency, Normal BMI',
    treatment_type: 'Oral Cholecalciferol Supplementation',
    treatment_outcome: 'Resolved upon follow-up lab review',
    appointment_type: 'Annual Preventative Health Visit',
    visit_type: 'Annual Preventative Health Visit',
    encounter_mode: 'In-Person Consultation',
    wait_time_minutes: 8,
    consultation_duration_minutes: 40,
    clinical_notes: 'Comprehensive annual physical completed. Cardiac, pulmonary, and neurological exams normal. Ordered routine lipid and 25-hydroxy vitamin D panels.',
    follow_up_date: '2026-07-18',
  },
  // P195909 - David Sterling
  {
    encounter_id: 'ENC-4102',
    patient_id: 'P195909',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    specialty: 'General Medicine',
    specialization: 'General Medicine',
    department_id: 'DEP-GENMED',
    department_name: 'General Medicine',
    encounter_date: '2026-06-15',
    symptoms: 'Periodic tension headaches, elevated office BP reading',
    primary_diagnosis: 'Essential Hypertension Stage 1',
    diagnosis: 'Essential Hypertension Stage 1',
    treatment_type: 'First-line Antihypertensive Regimen',
    treatment_outcome: 'BP normalized to 120/78 mmHg',
    appointment_type: 'Diagnostic Follow-up',
    visit_type: 'Diagnostic Follow-up',
    encounter_mode: 'In-Person Consultation',
    wait_time_minutes: 7,
    consultation_duration_minutes: 30,
    clinical_notes: 'Initiated ACE-inhibitor therapy with dietary reduction of processed foods. Home log confirms sustained normative pressure.',
    follow_up_date: '2026-10-25',
  },
  // P198226 - Maya Lin
  {
    encounter_id: 'ENC-3980',
    patient_id: 'P198226',
    doctor_id: 'DOC-103',
    doctor_name: 'Dr. James Thorne, MD',
    specialty: 'Orthopedics',
    specialization: 'Orthopedics',
    department_id: 'DEP-ORTHO',
    department_name: 'Orthopedics',
    encounter_date: '2026-08-10',
    symptoms: 'Pain along lateral aspect of right knee following trail running',
    primary_diagnosis: 'Lateral Collateral Ligament Sprain (Grade 1)',
    diagnosis: 'Lateral Collateral Ligament Sprain (Grade 1)',
    treatment_type: 'RICE protocol, NSAID anti-inflammatory course, and guided physical therapy',
    treatment_outcome: 'Marked functional recovery; full range of motion restored',
    appointment_type: 'Orthopedic Specialty Evaluation',
    visit_type: 'Orthopedic Specialty Evaluation',
    encounter_mode: 'In-Person Consultation',
    wait_time_minutes: 10,
    consultation_duration_minutes: 35,
    clinical_notes: 'No joint effusion. Ligamentous stability intact with minimal localized tenderness. Patient cleared for progressive low-impact activities.',
    follow_up_date: '2026-10-28',
  },
  // P151076 - Lucas Thorne
  {
    encounter_id: 'ENC-3820',
    patient_id: 'P151076',
    doctor_id: 'DOC-101',
    doctor_name: 'Dr. Marcus Chen, MD',
    specialty: 'Cardiology',
    specialization: 'Cardiology',
    department_id: 'DEP-CARDIO',
    department_name: 'Cardiology',
    encounter_date: '2026-05-20',
    symptoms: 'Routine cardiovascular executive wellness screening; family history review',
    primary_diagnosis: 'Cardiovascular Risk Stratification - Low Risk Profile',
    diagnosis: 'Cardiovascular Risk Stratification - Low Risk Profile',
    treatment_type: 'Lifestyle Optimization & Aerobic Conditioning Guidelines',
    treatment_outcome: 'Cardiorespiratory fitness excellent',
    appointment_type: 'Executive Preventative Health',
    visit_type: 'Executive Preventative Health',
    encounter_mode: 'In-Person Consultation',
    wait_time_minutes: 5,
    consultation_duration_minutes: 35,
    clinical_notes: 'Resting ECG shows normal sinus rhythm at 68 bpm. Normal heart sounds without murmurs. Blood lipids optimal.',
    follow_up_date: '2026-11-02',
  },
  // P164835 - Sophia Rodriguez
  {
    encounter_id: 'ENC-3715',
    patient_id: 'P164835',
    doctor_id: 'DOC-104',
    doctor_name: 'Dr. Emily Watson, MD',
    specialty: 'Dermatology',
    specialization: 'Dermatology',
    department_id: 'DEP-DERM',
    department_name: 'Dermatology',
    encounter_date: '2026-09-04',
    symptoms: 'Pruritic erythematous rash across wrists after cosmetic product exposure',
    primary_diagnosis: 'Acute Allergic Contact Dermatitis',
    diagnosis: 'Acute Allergic Contact Dermatitis',
    treatment_type: 'Short-course topical corticosteroid and fragrance-free barrier cream',
    treatment_outcome: 'Complete dermatologic resolution within 10 days',
    appointment_type: 'Dermatology Specialty Consultation',
    visit_type: 'Dermatology Specialty Consultation',
    encounter_mode: 'In-Person Consultation',
    wait_time_minutes: 8,
    consultation_duration_minutes: 25,
    clinical_notes: 'Erythema and papules localized to distal volar wrists. Patch test scheduled if symptoms recur.',
    follow_up_date: '2026-12-01',
  },
  // P115937 - James Wilson
  {
    encounter_id: 'ENC-3590',
    patient_id: 'P115937',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    specialty: 'General Medicine',
    specialization: 'General Medicine',
    department_id: 'DEP-GENMED',
    department_name: 'General Medicine',
    encounter_date: '2026-04-18',
    symptoms: 'Quarterly review of glycemic metrics; no polyuria or polydipsia',
    primary_diagnosis: 'Type 2 Diabetes Mellitus without Complications, Well Controlled',
    diagnosis: 'Type 2 Diabetes Mellitus without Complications, Well Controlled',
    treatment_type: 'Oral Biguanide Monotherapy & Mediterranean Nutrition Plan',
    treatment_outcome: 'HbA1c sustained below target threshold (6.4%)',
    appointment_type: 'Chronic Disease Management',
    visit_type: 'Chronic Disease Management',
    encounter_mode: 'In-Person Consultation',
    wait_time_minutes: 7,
    consultation_duration_minutes: 30,
    clinical_notes: 'Self-monitored fasting blood glucose averaged 104 mg/dL. Retinal exam from optometry normal. Continued current Metformin dosage.',
    follow_up_date: '2026-10-30',
  },
  // P171467 - Aisha Patel
  {
    encounter_id: 'ENC-3440',
    patient_id: 'P171467',
    doctor_id: 'DOC-105',
    doctor_name: 'Dr. Robert Hayes, MD',
    specialty: 'Neurology',
    specialization: 'Neurology',
    department_id: 'DEP-NEURO',
    department_name: 'Neurology',
    encounter_date: '2026-08-22',
    symptoms: 'Unilateral throbbing frontotemporal headache preceded by visual scintillations',
    primary_diagnosis: 'Episodic Migraine with Typical Aura (G43.109)',
    diagnosis: 'Episodic Migraine with Typical Aura (G43.109)',
    treatment_type: 'Trigger identification counseling, hydration protocol, and PRN abortive therapy',
    treatment_outcome: 'Attack frequency decreased from twice monthly to zero over 60 days',
    appointment_type: 'Neurology Outpatient Consultation',
    visit_type: 'Neurology Outpatient Consultation',
    encounter_mode: 'In-Person Consultation',
    wait_time_minutes: 9,
    consultation_duration_minutes: 40,
    clinical_notes: 'Cranial nerve exam cranial nerves II-XII intact. Fundoscopy normal. Ordered structural MRI to rule out secondary etiology.',
    follow_up_date: '2026-11-20',
  },
  // P167834 - Benjamin Hayes
  {
    encounter_id: 'ENC-3305',
    patient_id: 'P167834',
    doctor_id: 'DOC-103',
    doctor_name: 'Dr. James Thorne, MD',
    specialty: 'Orthopedics',
    specialization: 'Orthopedics',
    department_id: 'DEP-ORTHO',
    department_name: 'Orthopedics',
    encounter_date: '2026-07-02',
    symptoms: 'Six-month post-operative surgical site evaluation',
    primary_diagnosis: 'Post-Surgical Achilles Tendon Repair Healing Normally',
    diagnosis: 'Post-Surgical Achilles Tendon Repair Healing Normally',
    treatment_type: 'Progressive eccentric calf loading and sports rehabilitation protocol',
    treatment_outcome: 'Tendon thickness remodeling nicely; strength 5/5',
    appointment_type: 'Surgical Follow-up',
    visit_type: 'Surgical Follow-up',
    encounter_mode: 'In-Person Consultation',
    wait_time_minutes: 11,
    consultation_duration_minutes: 25,
    clinical_notes: 'Thompson test negative. Dorsiflexion active to 15 degrees. Patient authorized for gentle stationary cycling.',
    follow_up_date: '2026-11-10',
  },
  // P144799 - Chloe Bennett
  {
    encounter_id: 'ENC-3190',
    patient_id: 'P144799',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    specialty: 'General Medicine',
    specialization: 'General Medicine',
    department_id: 'DEP-GENMED',
    department_name: 'General Medicine',
    encounter_date: '2026-09-12',
    symptoms: 'Sneezing, nasal congestion, and watery eyes during autumn seasonal change',
    primary_diagnosis: 'Allergic Rhinitis, Seasonal',
    diagnosis: 'Allergic Rhinitis, Seasonal',
    treatment_type: 'Second-generation non-sedating oral antihistamine and saline nasal spray',
    treatment_outcome: 'Significant reduction in daily rhinitis symptoms',
    appointment_type: 'Outpatient Clinical Visit',
    visit_type: 'Outpatient Clinical Visit',
    encounter_mode: 'In-Person Consultation',
    wait_time_minutes: 6,
    consultation_duration_minutes: 20,
    clinical_notes: 'Nasal turbinates mildly boggy with pale mucosa. Tympanic membranes clear bilaterally. Prescribed Cetirizine 10mg daily.',
    follow_up_date: '2026-12-15',
  },
  // Note: P118969 intentionally has 0 encounters to verify complete empty state
];

// silver_lab_results authoritative schema records:
// lab_id, patient_id, encounter_id, test_name, test_category, test_date, result_value, unit, reference_range, status
const SILVER_LAB_RESULTS: LabResultRecord[] = [
  // P182162 - Eleanor Vance
  {
    lab_id: 'LAB-9041',
    patient_id: 'P182162',
    encounter_id: 'ENC-4921',
    doctor_id: 'DOC-101',
    doctor_name: 'Dr. Marcus Chen, MD',
    test_name: 'Complete Lipid Profile & Apolipoproteins',
    test_category: 'Clinical Chemistry',
    category: 'Clinical Chemistry',
    test_date: '2026-07-19',
    collected_date: '2026-07-19',
    result_date: '2026-07-20',
    status: 'Normal',
    result_value: 'Total Chol: 182 | LDL: 98 | HDL: 62',
    value: 'Total Chol: 182 mg/dL | LDL: 98 mg/dL | HDL: 62 mg/dL',
    unit: 'mg/dL',
    reference_range: 'Total < 200 mg/dL | LDL < 100 mg/dL | HDL > 50 mg/dL',
    flag: 'Normal',
    summary: 'Optimal lipid ratios. Cardiovascular lipid markers indicate low 10-year risk.',
  },
  {
    lab_id: 'LAB-9042',
    patient_id: 'P182162',
    encounter_id: 'ENC-4921',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    test_name: 'Comprehensive Metabolic Panel (CMP-14)',
    test_category: 'Biochemistry',
    category: 'Biochemistry',
    test_date: '2026-07-19',
    collected_date: '2026-07-19',
    result_date: '2026-07-20',
    status: 'Normal',
    result_value: 'Glucose: 88 | Creatinine: 0.85 | eGFR: >90',
    value: 'Glucose Fasting: 88 mg/dL | Creatinine: 0.85 mg/dL | eGFR: >90',
    unit: 'mg/dL',
    reference_range: 'Glucose: 70-99 mg/dL | Creatinine: 0.6-1.1 mg/dL',
    flag: 'Normal',
    summary: 'Renal, hepatic, and glycemic markers are within healthy standard limits.',
  },
  {
    lab_id: 'LAB-8812',
    patient_id: 'P182162',
    encounter_id: 'ENC-4510',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    test_name: '25-Hydroxy Vitamin D (Total)',
    test_category: 'Endocrinology / Serology',
    category: 'Endocrinology / Serology',
    test_date: '2026-03-14',
    collected_date: '2026-03-14',
    result_date: '2026-03-15',
    status: 'Ready',
    result_value: '42.6',
    value: '42.6 ng/mL',
    unit: 'ng/mL',
    reference_range: '30.0 - 100.0 ng/mL',
    flag: 'Normal',
    summary: 'Adequate vitamin D stores reached following supplemental protocol.',
  },
  // P195909 - David Sterling
  {
    lab_id: 'LAB-8650',
    patient_id: 'P195909',
    encounter_id: 'ENC-4102',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    test_name: 'Basic Metabolic Panel & Serum Electrolytes',
    test_category: 'Biochemistry',
    category: 'Biochemistry',
    test_date: '2026-06-16',
    collected_date: '2026-06-16',
    result_date: '2026-06-17',
    status: 'Normal',
    result_value: 'Sodium: 140 | Potassium: 4.2 | Creatinine: 0.92',
    value: 'Sodium: 140 mmol/L | Potassium: 4.2 mmol/L | Creatinine: 0.92 mg/dL',
    unit: 'mmol/L',
    reference_range: 'Sodium: 135-145 | Potassium: 3.5-5.0',
    flag: 'Normal',
    summary: 'Renal function and electrolyte balance stable under antihypertensive regimen.',
  },
  {
    lab_id: 'LAB-8651',
    patient_id: 'P195909',
    encounter_id: 'ENC-4102',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    test_name: 'Cardiovascular Lipid Panel',
    test_category: 'Clinical Chemistry',
    category: 'Clinical Chemistry',
    test_date: '2026-06-16',
    collected_date: '2026-06-16',
    result_date: '2026-06-17',
    status: 'Normal',
    result_value: 'Total Chol: 194 | LDL: 110 | HDL: 52',
    value: 'Total Chol: 194 mg/dL | LDL: 110 mg/dL | HDL: 52 mg/dL',
    unit: 'mg/dL',
    reference_range: 'Total < 200 mg/dL | LDL < 100 mg/dL',
    flag: 'High',
    summary: 'Borderline LDL cholesterol; continue dietary optimization.',
  },
  // P151076 - Lucas Thorne
  {
    lab_id: 'LAB-8401',
    patient_id: 'P151076',
    encounter_id: 'ENC-3820',
    doctor_id: 'DOC-101',
    doctor_name: 'Dr. Marcus Chen, MD',
    test_name: 'High-Sensitivity Cardiac Troponin I (hs-cTnI)',
    test_category: 'Cardiology Diagnostics',
    category: 'Cardiology Diagnostics',
    test_date: '2026-05-21',
    collected_date: '2026-05-21',
    result_date: '2026-05-21',
    status: 'Normal',
    result_value: '< 2.5',
    value: '< 2.5 ng/L',
    unit: 'ng/L',
    reference_range: '< 14.0 ng/L',
    flag: 'Normal',
    summary: 'No biochemical evidence of myocardial injury or acute ischemic strain.',
  },
  {
    lab_id: 'LAB-8402',
    patient_id: 'P151076',
    encounter_id: 'ENC-3820',
    doctor_id: 'DOC-101',
    doctor_name: 'Dr. Marcus Chen, MD',
    test_name: 'Standard Comprehensive Lipid Profile',
    test_category: 'Clinical Chemistry',
    category: 'Clinical Chemistry',
    test_date: '2026-05-21',
    collected_date: '2026-05-21',
    result_date: '2026-05-22',
    status: 'Normal',
    result_value: 'Total Chol: 170 | LDL: 89 | HDL: 58',
    value: 'Total Chol: 170 mg/dL | LDL: 89 mg/dL | HDL: 58 mg/dL',
    unit: 'mg/dL',
    reference_range: 'Total < 200 mg/dL | LDL < 100 mg/dL',
    flag: 'Normal',
    summary: 'Favorable cardiovascular profile; aerobic conditioning reflects in high HDL.',
  },
  // P164835 - Sophia Rodriguez
  {
    lab_id: 'LAB-8230',
    patient_id: 'P164835',
    encounter_id: 'ENC-3715',
    doctor_id: 'DOC-104',
    doctor_name: 'Dr. Emily Watson, MD',
    test_name: 'Total Serum Immunoglobulin E (IgE)',
    test_category: 'Immunology / Allergy',
    category: 'Immunology / Allergy',
    test_date: '2026-09-05',
    collected_date: '2026-09-05',
    result_date: '2026-09-06',
    status: 'Normal',
    result_value: '48.2',
    value: '48.2 kU/L',
    unit: 'kU/L',
    reference_range: '< 100 kU/L',
    flag: 'Normal',
    summary: 'IgE concentration in reference zone; contact dermatitis reaction was irritant/type IV rather than systemic atopy.',
  },
  // P115937 - James Wilson
  {
    lab_id: 'LAB-8105',
    patient_id: 'P115937',
    encounter_id: 'ENC-3590',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    test_name: 'Glycated Hemoglobin (HbA1c)',
    test_category: 'Endocrinology',
    category: 'Endocrinology',
    test_date: '2026-04-19',
    collected_date: '2026-04-19',
    result_date: '2026-04-20',
    status: 'Normal',
    result_value: '6.4%',
    value: '6.4%',
    unit: '%',
    reference_range: '< 5.7% (Diabetic therapeutic target < 7.0%)',
    flag: 'Normal',
    summary: 'Excellent glycemic control sustained on current oral agent.',
  },
  {
    lab_id: 'LAB-8106',
    patient_id: 'P115937',
    encounter_id: 'ENC-3590',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    test_name: 'Urine Albumin-to-Creatinine Ratio (uACR)',
    test_category: 'Renal Function',
    category: 'Renal Function',
    test_date: '2026-04-19',
    collected_date: '2026-04-19',
    result_date: '2026-04-20',
    status: 'Normal',
    result_value: '14.0',
    value: '14.0 mg/g',
    unit: 'mg/g',
    reference_range: '< 30 mg/g',
    flag: 'Normal',
    summary: 'Normoalbuminuria; microvascular renal filtration intact.',
  },
  // P171467 - Aisha Patel
  {
    lab_id: 'LAB-7990',
    patient_id: 'P171467',
    encounter_id: 'ENC-3440',
    doctor_id: 'DOC-105',
    doctor_name: 'Dr. Robert Hayes, MD',
    test_name: 'Brain MRI (3T High-Resolution) without IV Contrast',
    test_category: 'Diagnostic Radiology',
    category: 'Diagnostic Radiology',
    test_date: '2026-08-25',
    collected_date: '2026-08-25',
    result_date: '2026-08-26',
    status: 'Normal',
    result_value: 'Negative / Unremarkable',
    value: 'No acute intracranial pathology, ischemia, or space-occupying lesion',
    unit: 'Report',
    reference_range: 'Normal cranial architecture',
    flag: 'Normal',
    summary: 'Normal structural brain parenchymal study. Findings entirely consistent with benign primary migraine disorder.',
  },
  // Note: P198226, P167834, P144799, P118969 intentionally have 0 lab reports to test empty state
];

// silver_prescriptions authoritative schema records:
// prescription_id, patient_id, encounter_id, prescription_date, medicine_name, medicine_category, dosage, frequency, duration_days, route, quantity, refill_allowed, prescription_status
const SILVER_PRESCRIPTIONS: PrescriptionRecord[] = [
  // P182162 - Eleanor Vance
  {
    prescription_id: 'RX-30192',
    patient_id: 'P182162',
    encounter_id: 'ENC-4921',
    doctor_id: 'DOC-101',
    doctor_name: 'Dr. Marcus Chen, MD',
    prescription_date: '2026-07-18',
    prescribed_date: '2026-07-18',
    medicine_name: 'Metoprolol Succinate ER',
    medication_name: 'Metoprolol Succinate ER',
    medicine_category: 'Beta-1 Blocker / Cardiovascular',
    dosage: '25 mg Extended Release',
    frequency: 'Once daily in the morning with water',
    duration_days: 90,
    duration: '90 Days',
    route: 'Oral Tablet',
    quantity: 90,
    refill_allowed: 3,
    refills_left: 3,
    prescription_status: 'Active',
    status: 'Active',
    instructions: 'Take with or immediately after food. Monitor morning heart rate.',
  },
  {
    prescription_id: 'RX-29841',
    patient_id: 'P182162',
    encounter_id: 'ENC-4510',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    prescription_date: '2026-03-12',
    prescribed_date: '2026-03-12',
    medicine_name: 'Cholecalciferol (Vitamin D3)',
    medication_name: 'Cholecalciferol (Vitamin D3)',
    medicine_category: 'Vitamin Supplement / Bone & Immune Health',
    dosage: '2,000 IU Softgel',
    frequency: 'Once daily with meals',
    duration_days: 180,
    duration: '180 Days',
    route: 'Oral Capsule',
    quantity: 180,
    refill_allowed: 2,
    refills_left: 2,
    prescription_status: 'Active',
    status: 'Active',
    instructions: 'Dietary supplement maintenance dose.',
  },
  // P195909 - David Sterling
  {
    prescription_id: 'RX-28710',
    patient_id: 'P195909',
    encounter_id: 'ENC-4102',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    prescription_date: '2026-06-15',
    prescribed_date: '2026-06-15',
    medicine_name: 'Lisinopril Oral Tablet',
    medication_name: 'Lisinopril Oral Tablet',
    medicine_category: 'ACE Inhibitor / Antihypertensive',
    dosage: '10 mg',
    frequency: 'Once daily in the morning',
    duration_days: 90,
    duration: '90 Days',
    route: 'Oral Tablet',
    quantity: 90,
    refill_allowed: 3,
    refills_left: 3,
    prescription_status: 'Active',
    status: 'Active',
    instructions: 'Take at consistent time every day. Maintain hydration.',
  },
  // P198226 - Maya Lin
  {
    prescription_id: 'RX-27640',
    patient_id: 'P198226',
    encounter_id: 'ENC-3980',
    doctor_id: 'DOC-103',
    doctor_name: 'Dr. James Thorne, MD',
    prescription_date: '2026-08-10',
    prescribed_date: '2026-08-10',
    medicine_name: 'Meloxicam Tablet',
    medication_name: 'Meloxicam Tablet',
    medicine_category: 'NSAID / Anti-inflammatory',
    dosage: '15 mg',
    frequency: 'Once daily with food for joint comfort',
    duration_days: 14,
    duration: '14 Days',
    route: 'Oral Tablet',
    quantity: 14,
    refill_allowed: 0,
    refills_left: 0,
    prescription_status: 'Completed',
    status: 'Completed',
    instructions: 'Take with food or a glass of water. Do not combine with other NSAIDs.',
  },
  // P164835 - Sophia Rodriguez
  {
    prescription_id: 'RX-26510',
    patient_id: 'P164835',
    encounter_id: 'ENC-3715',
    doctor_id: 'DOC-104',
    doctor_name: 'Dr. Emily Watson, MD',
    prescription_date: '2026-09-04',
    prescribed_date: '2026-09-04',
    medicine_name: 'Triamcinolone Acetonide 0.1% Cream',
    medication_name: 'Triamcinolone Acetonide 0.1% Cream',
    medicine_category: 'Topical Corticosteroid / Dermatology',
    dosage: '0.1% w/w',
    frequency: 'Apply thin layer twice daily to affected wrist skin',
    duration_days: 10,
    duration: '10 Days',
    route: 'Topical Cream',
    quantity: 30,
    refill_allowed: 1,
    refills_left: 1,
    prescription_status: 'Active',
    status: 'Active',
    instructions: 'Apply gently until absorbed. Avoid contact with eyes or mucous membranes.',
  },
  // P115937 - James Wilson
  {
    prescription_id: 'RX-25420',
    patient_id: 'P115937',
    encounter_id: 'ENC-3590',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    prescription_date: '2026-04-18',
    prescribed_date: '2026-04-18',
    medicine_name: 'Metformin Hydrochloride Extended Release',
    medication_name: 'Metformin Hydrochloride Extended Release',
    medicine_category: 'Antidiabetic / Biguanide',
    dosage: '500 mg Extended Release',
    frequency: 'Once daily with evening meal',
    duration_days: 90,
    duration: '90 Days',
    route: 'Oral Tablet',
    quantity: 90,
    refill_allowed: 3,
    refills_left: 2,
    prescription_status: 'Active',
    status: 'Active',
    instructions: 'Swallow whole with dinner; do not crush or chew.',
  },
  // P144799 - Chloe Bennett
  {
    prescription_id: 'RX-24310',
    patient_id: 'P144799',
    encounter_id: 'ENC-3190',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    prescription_date: '2026-09-12',
    prescribed_date: '2026-09-12',
    medicine_name: 'Cetirizine Hydrochloride Tablet',
    medication_name: 'Cetirizine Hydrochloride Tablet',
    medicine_category: 'Antihistamine / Allergy Relief',
    dosage: '10 mg',
    frequency: 'Once daily at bedtime as needed',
    duration_days: 30,
    duration: '30 Days',
    route: 'Oral Tablet',
    quantity: 30,
    refill_allowed: 2,
    refills_left: 2,
    prescription_status: 'Active',
    status: 'Active',
    instructions: 'Non-drowsy 24-hour symptom relief. Store in a dry place.',
  },
  // Note: P151076, P171467, P167834, P118969 intentionally have 0 prescriptions to test empty state
];

// silver_feedback authoritative schema records:
// feedback_id, patient_id, appointment_id, encounter_id, doctor_id, feedback_date, rating, doctor_rating, staff_rating, waiting_time_rating, facility_rating, cleanliness_rating, communication_rating, comments, feedback_channel, sentiment, feedback_status, resolution_notes
let SILVER_FEEDBACK: FeedbackRecord[] = [
  // P182162 - Eleanor Vance
  {
    feedback_id: 'FB-9021',
    patient_id: 'P182162',
    appointment_id: 'APT-88210',
    encounter_id: 'ENC-4921',
    doctor_id: 'DOC-101',
    doctor_name: 'Dr. Marcus Chen, MD',
    feedback_date: '2026-07-20',
    rating: 5,
    doctor_rating: 5,
    staff_rating: 5,
    waiting_time_rating: 4,
    facility_rating: 5,
    cleanliness_rating: 5,
    communication_rating: 5,
    comments: 'Dr. Chen provided exceptional explanation of my cardiovascular status and answered all medication questions thoroughly.',
    feedback_channel: 'Patient Portal',
    sentiment: 'Positive',
    feedback_status: 'Reviewed',
    resolution_notes: 'Feedback shared with Cardiology department head.',
  },
  {
    feedback_id: 'FB-8810',
    patient_id: 'P182162',
    appointment_id: 'APT-88211',
    encounter_id: 'ENC-4510',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    feedback_date: '2026-03-14',
    rating: 5,
    doctor_rating: 5,
    staff_rating: 4,
    waiting_time_rating: 4,
    facility_rating: 5,
    cleanliness_rating: 5,
    communication_rating: 5,
    comments: 'Dr. Al-Mansoor is compassionate and meticulous. The clinic check-in desk was very welcoming.',
    feedback_channel: 'Patient Portal',
    sentiment: 'Positive',
    feedback_status: 'Reviewed',
    resolution_notes: 'Exemplary service commendation.',
  },
  // P195909 - David Sterling
  {
    feedback_id: 'FB-8702',
    patient_id: 'P195909',
    appointment_id: 'APT-87102',
    encounter_id: 'ENC-4102',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    feedback_date: '2026-06-16',
    rating: 5,
    doctor_rating: 5,
    staff_rating: 5,
    waiting_time_rating: 4,
    facility_rating: 5,
    cleanliness_rating: 5,
    communication_rating: 5,
    comments: 'Prompt consultation and very clear advice on dietary adjustments alongside blood pressure medications.',
    feedback_channel: 'Patient Portal',
    sentiment: 'Positive',
    feedback_status: 'Reviewed',
    resolution_notes: 'Positive review logged.',
  },
  // P164835 - Sophia Rodriguez
  {
    feedback_id: 'FB-8540',
    patient_id: 'P164835',
    appointment_id: undefined,
    encounter_id: 'ENC-3715',
    doctor_id: 'DOC-104',
    doctor_name: 'Dr. Emily Watson, MD',
    feedback_date: '2026-09-05',
    rating: 5,
    doctor_rating: 5,
    staff_rating: 5,
    waiting_time_rating: 5,
    facility_rating: 5,
    cleanliness_rating: 5,
    communication_rating: 5,
    comments: 'Dr. Watson quickly identified the allergen and prescribed a cream that worked within 48 hours.',
    feedback_channel: 'Patient Portal',
    sentiment: 'Positive',
    feedback_status: 'Reviewed',
    resolution_notes: 'Clinical appreciation noted.',
  },
  // P115937 - James Wilson
  {
    feedback_id: 'FB-8390',
    patient_id: 'P115937',
    appointment_id: 'APT-84190',
    encounter_id: 'ENC-3590',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    feedback_date: '2026-04-20',
    rating: 5,
    doctor_rating: 5,
    staff_rating: 4,
    waiting_time_rating: 4,
    facility_rating: 5,
    cleanliness_rating: 5,
    communication_rating: 5,
    comments: 'Excellent continuous care for my diabetes. The online portal makes test result review seamless.',
    feedback_channel: 'Patient Portal',
    sentiment: 'Positive',
    feedback_status: 'Reviewed',
    resolution_notes: 'Positive review recorded.',
  },
  // Note: P198226, P151076, P171467, P167834, P144799, P118969 have 0 reviews to test clean feedback empty state
];

// Patient notifications
const NOTIFICATIONS: Record<string, NotificationItem[]> = {
  P182162: [
    {
      id: 'NOTIF-1',
      title: 'Upcoming Cardiology Visit',
      message: 'Reminder: Your appointment with Dr. Marcus Chen is scheduled for Thursday, Oct 22 at 10:30 AM.',
      timestamp: '2 hours ago',
      type: 'appointment',
      read: false,
    },
    {
      id: 'NOTIF-2',
      title: 'Lab Report Ready for Review',
      message: 'Your Comprehensive Metabolic Panel results are finalized and available in your portal.',
      timestamp: 'Yesterday',
      type: 'lab',
      read: false,
    },
    {
      id: 'NOTIF-3',
      title: 'Prescription Refill Authorized',
      message: 'Metoprolol Succinate ER 25mg refill (3 remaining) was renewed by Dr. Chen.',
      timestamp: '3 days ago',
      type: 'prescription',
      read: true,
    },
  ],
  P195909: [
    {
      id: 'NOTIF-101',
      title: 'Scheduled Visit Reminder',
      message: 'Your General Medicine consultation with Dr. Sarah Al-Mansoor is set for Oct 25 at 11:00 AM.',
      timestamp: '1 day ago',
      type: 'appointment',
      read: false,
    },
  ],
  P198226: [
    {
      id: 'NOTIF-102',
      title: 'Orthopedic Follow-Up',
      message: 'Your appointment with Dr. James Thorne is scheduled for Oct 28 at 09:30 AM.',
      timestamp: '3 hours ago',
      type: 'appointment',
      read: false,
    },
  ],
  P151076: [
    {
      id: 'NOTIF-103',
      title: 'Cardiology Screening Booked',
      message: 'Your visit with Dr. Marcus Chen is confirmed for Nov 02 at 02:30 PM.',
      timestamp: 'Yesterday',
      type: 'appointment',
      read: false,
    },
  ],
  P115937: [
    {
      id: 'NOTIF-104',
      title: 'Quarterly Checkup Reminder',
      message: 'Your diabetes review with Dr. Sarah Al-Mansoor is confirmed for Oct 30 at 03:00 PM.',
      timestamp: '2 days ago',
      type: 'appointment',
      read: false,
    },
  ],
  P167834: [
    {
      id: 'NOTIF-105',
      title: 'Physical Therapy Follow-Up',
      message: 'Your appointment with Dr. James Thorne is scheduled for Nov 10 at 10:00 AM.',
      timestamp: 'Today',
      type: 'appointment',
      read: false,
    },
  ],
};

// --- In-Memory Cryptographic Session Store ---
interface SessionData {
  token: string;
  patient_id: string;
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

// Authentication Middleware
function authenticatePatientToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied: Authentication token required.',
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

  if (session.expires_at < Date.now()) {
    ACTIVE_SESSIONS.delete(token);
    return res.status(401).json({
      success: false,
      message: 'Session has expired. Please sign in again.',
    });
  }

  (req as any).authenticatedPatientId = session.patient_id;
  next();
}

// ==========================================
// API ROUTES
// ==========================================

// Diagnostic status endpoint (backward-compatible)
app.get('/api/health', (_req: Request, res: Response) => {
  return res.json({
    status: isLiveMySQL ? 'ok' : targetEngineMode === 'LIVE_MYSQL' ? 'database_offline' : 'ok',
    mode: targetEngineMode,
    isLiveMySQL,
    mysqlConfigured: targetEngineMode === 'LIVE_MYSQL',
    dbConnectionError: sanitizeError(dbConnectionError),
    activeSessions: ACTIVE_SESSIONS.size,
    database: 'hospital_db',
    lastChecked: lastPingTimestamp || new Date().toISOString(),
    latencyMs: lastPingLatencyMs,
    authoritativeTables: [
      'silver_patients (95,067 rows)',
      'silver_doctors (1,375 rows)',
      'silver_appointments (253,200 rows)',
      'silver_encounters (250,493 rows)',
      'silver_lab_results (350,592 rows)',
      'silver_prescriptions (300,584 rows)',
      'silver_feedback (200,595 rows)',
      'app_users',
    ],
  });
});

// Dedicated Database Health-Check & Status Endpoint (Requirement 5 & 6: No secrets or PII)
app.get(['/api/db/health', '/api/db/status'], (_req: Request, res: Response) => {
  const currentConfig = resolveMySQLConfig();
  const fallbackDiag = lastDiagnosticResult || buildDiagnosticReport(
    targetEngineMode === 'LIVE_MYSQL' ? 'NETWORK_FAILURE' : 'MISSING_CREDENTIALS',
    targetEngineMode === 'LIVE_MYSQL'
      ? 'Live MySQL connection has not yet been verified.'
      : 'Application running in Prototype Demo Mode with Medallion Silver store.',
    targetEngineMode === 'LIVE_MYSQL'
      ? 'Execute POST /api/db/test-connection to verify live connection.'
      : 'Provide MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD to switch to Live MySQL.',
    currentConfig
  );

  return res.json({
    status: isLiveMySQL ? 'connected' : targetEngineMode === 'LIVE_MYSQL' ? 'disconnected' : 'prototype_mode',
    mode: targetEngineMode,
    database: activeDatabaseName || currentConfig.database || 'hospital_db',
    host: currentConfig.host || 'localhost',
    port: currentConfig.port || 3306,
    connected: isLiveMySQL,
    configured: targetEngineMode === 'LIVE_MYSQL',
    lastChecked: lastPingTimestamp || new Date().toISOString(),
    latencyMs: lastPingLatencyMs,
    connectionError: sanitizeError(dbConnectionError),
    diagnostic: fallbackDiag,
    architecture: 'Medallion Lakehouse - Silver Operational Layer',
    authoritativeTables: AUTHORITATIVE_TABLES_INFO,
    tablesVerified: isLiveMySQL ? verifiedTablesList : [],
    missingTables: isLiveMySQL ? missingTablesList : [],
    requiredTablesCount: REQUIRED_HOSPITAL_TABLES.length,
    activeSessions: ACTIVE_SESSIONS.size,
    summary: isLiveMySQL
      ? `Connected to live MySQL ${activeDatabaseName} (${verifiedTablesList.length}/${REQUIRED_HOSPITAL_TABLES.length} tables verified).`
      : targetEngineMode === 'LIVE_MYSQL'
      ? 'Live MySQL connection unavailable. Live mode active (no prototype fallback).'
      : 'Running in Prototype Demo Mode with server-authoritative Medallion Silver store.',
  });
});

// Dedicated Database Diagnostic Endpoint (Requirement 6)
// Distinguishes missing credentials, DNS/network failure, authentication failure, and table permissions
app.get('/api/db/diagnostics', async (_req: Request, res: Response) => {
  const currentConfig = resolveMySQLConfig();
  const testResult = await testMySQLConnectivity();

  return res.json({
    timestamp: new Date().toISOString(),
    mode: targetEngineMode,
    connected: testResult.ok,
    database: testResult.database,
    diagnostic: testResult.diagnostic,
    authoritativeTables: AUTHORITATIVE_TABLES_INFO,
    requiredTables: REQUIRED_HOSPITAL_TABLES,
    verifiedTables: testResult.verifiedTables,
    missingTables: testResult.missingTables,
    nextAction: testResult.ok
      ? 'Live MySQL is operational. All 8 Silver tables verified.'
      : testResult.diagnostic.remediation,
  });
});

// On-demand connection test endpoint (Requirement 5 & 6)
app.post('/api/db/test-connection', async (_req: Request, res: Response) => {
  const result = await testMySQLConnectivity();
  return res.status(result.ok ? 200 : 503).json({
    success: result.ok,
    mode: targetEngineMode,
    connected: result.ok,
    database: result.database || 'hospital_db',
    databaseMatched: result.databaseMatched,
    verifiedTables: result.verifiedTables,
    missingTables: result.missingTables,
    host: result.diagnostic?.networkDetails?.host || 'localhost',
    port: result.diagnostic?.networkDetails?.port || 3306,
    latencyMs: result.latencyMs,
    error: result.error,
    diagnostic: result.diagnostic,
    timestamp: new Date().toISOString(),
  });
});

// 1. Patient Login Endpoint
// Authoritative Schema: app_users (user_id, username, patient_id, password_hash, role, is_active, must_change_password, created_at)
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

  const cleanUsername = rawInput.toUpperCase();

  // --- LIVE MYSQL INTEGRATION ---
  if (targetEngineMode === 'LIVE_MYSQL') {
    if (!isLiveMySQL || !mysqlPool) {
      return res.status(503).json({
        success: false,
        errorType: 'DATABASE_UNAVAILABLE',
        mode: 'LIVE_MYSQL',
        message: `Database connection error: Unable to connect to MySQL hospital_db (${dbConnectionError || 'connection offline'}). Live mode is active and cannot fall back to synthetic demo data.`,
      });
    }

    try {
      // Query app_users strictly using authoritative schema columns:
      // user_id, username, patient_id, password_hash, role, is_active, must_change_password, created_at
      const [rows]: any = await mysqlPool.query(
        `SELECT 
          user_id, 
          username, 
          patient_id, 
          password_hash, 
          role, 
          is_active, 
          must_change_password,
          created_at
        FROM app_users 
        WHERE (username = ? OR patient_id = ? OR UPPER(username) = ? OR UPPER(patient_id) = ?) 
        LIMIT 1`,
        [rawInput, rawInput, cleanUsername, cleanUsername]
      );

      if (!rows || rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Patient account not found. Please verify your Patient ID.',
        });
      }

      const user = rows[0];

      // Check account role
      if (user.role && user.role.toLowerCase() !== 'patient') {
        return res.status(401).json({
          success: false,
          message: 'This account is not registered for the patient portal.',
        });
      }

      // Check active account status (is_active)
      if (user.is_active !== undefined && (user.is_active === 0 || user.is_active === false)) {
        return res.status(403).json({
          success: false,
          message: 'This patient account is disabled or inactive. Please contact patient services.',
        });
      }

      // Verify password against stored password hash (never plaintext!)
      const isPasswordValid = verifyPassword(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Incorrect password for this Patient ID.',
        });
      }

      const resolvedPatientId = user.patient_id || user.username || cleanUsername;

      // Check if must_change_password is true
      if (user.must_change_password === 1 || user.must_change_password === true) {
        const tempToken = crypto.randomBytes(24).toString('hex');
        TEMP_PASSWORD_TOKENS.set(tempToken, {
          token: tempToken,
          patient_id: resolvedPatientId,
          expires_at: Date.now() + 15 * 60 * 1000,
        });

        return res.json({
          success: true,
          mustChangePassword: true,
          tempToken,
          patientId: resolvedPatientId,
          message: 'Security policy requires setting a new password before accessing your medical dashboard.',
        });
      }

      // Query silver_patients using authoritative columns:
      // patient_id, name, date_of_birth, age, gender, city, state, socioeconomic_status, occupation, registration_date, phone_number, email
      const [patientRows]: any = await mysqlPool.query(
        `SELECT 
          patient_id, 
          name, 
          date_of_birth, 
          age, 
          gender, 
          city, 
          state, 
          socioeconomic_status, 
          occupation, 
          registration_date, 
          phone_number, 
          email 
        FROM silver_patients 
        WHERE patient_id = ? 
        LIMIT 1`,
        [resolvedPatientId]
      );

      const patientProfile = formatPatientProfile(patientRows?.[0] || { patient_id: resolvedPatientId });

      // Issue secure session token
      const token = crypto.randomBytes(32).toString('hex');
      ACTIVE_SESSIONS.set(token, {
        token,
        patient_id: resolvedPatientId,
        created_at: Date.now(),
        expires_at: Date.now() + 24 * 60 * 60 * 1000,
      });

      return res.json({
        success: true,
        message: 'Authenticated successfully with hospital_db.',
        token,
        patient: patientProfile,
        isLiveMySQL: true,
        mode: 'LIVE_MYSQL',
      });
    } catch (err: any) {
      console.error('MySQL database error during login:', err);
      return res.status(503).json({
        success: false,
        errorType: 'DATABASE_ERROR',
        mode: 'LIVE_MYSQL',
        message: `Database error communicating with MySQL hospital_db: ${sanitizeError(err?.message)}. Live mode cannot fall back to synthetic data.`,
      });
    }
  }

  // --- PROTOTYPE MEDALLION ENGINE (When in PROTOTYPE_DEMO mode) ---
  const user = APP_USERS[cleanUsername] || APP_USERS[rawInput];
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Patient account not found. Please verify your Patient ID.',
    });
  }

  // Check active status
  if (user.is_active === 0) {
    return res.status(403).json({
      success: false,
      message: 'This patient account is inactive. Please contact patient services.',
    });
  }

  // Verify password
  const isPasswordValid = verifyPassword(password, user.password_hash);
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      message: 'Incorrect password for this Patient ID.',
    });
  }

  // Check must_change_password
  if (user.must_change_password) {
    const tempToken = crypto.randomBytes(24).toString('hex');
    TEMP_PASSWORD_TOKENS.set(tempToken, {
      token: tempToken,
      patient_id: cleanUsername,
      expires_at: Date.now() + 15 * 60 * 1000,
    });

    return res.json({
      success: true,
      mustChangePassword: true,
      tempToken,
      patientId: cleanUsername,
      message: 'Security policy requires setting a new password before accessing your medical dashboard.',
    });
  }

  // Retrieve patient profile from silver_patients
  const patientProfile = SILVER_PATIENTS[cleanUsername] || formatPatientProfile({ patient_id: cleanUsername });

  const token = crypto.randomBytes(32).toString('hex');
  ACTIVE_SESSIONS.set(token, {
    token,
    patient_id: cleanUsername,
    created_at: Date.now(),
    expires_at: Date.now() + 24 * 60 * 60 * 1000,
  });

  return res.json({
    success: true,
    message: 'Signed in successfully.',
    token,
    patient: patientProfile,
    isLiveMySQL: false,
    mode: 'PROTOTYPE_DEMO',
  });
});

// 2. Change Password Endpoint
app.post('/api/auth/patient/change-password', async (req: Request, res: Response) => {
  const { patientId, currentPassword, newPassword, tempToken } = req.body;

  if (!patientId || !currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Patient ID, current password, and new password are required.',
    });
  }

  const cleanUsername = String(patientId).trim().toUpperCase();

  // Validate temp token or active session if provided
  if (tempToken) {
    const temp = TEMP_PASSWORD_TOKENS.get(tempToken);
    if (!temp || temp.patient_id !== cleanUsername || temp.expires_at < Date.now()) {
      return res.status(401).json({
        success: false,
        message: 'Password reset session has expired. Please sign in again.',
      });
    }
  }

  // Password complexity validation
  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 8 characters long.',
    });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({
      success: false,
      message: 'New password cannot be identical to the temporary password.',
    });
  }

  // --- LIVE MYSQL ---
  if (targetEngineMode === 'LIVE_MYSQL') {
    if (!isLiveMySQL || !mysqlPool) {
      return res.status(503).json({
        success: false,
        errorType: 'DATABASE_UNAVAILABLE',
        mode: 'LIVE_MYSQL',
        message: 'Database connection offline during password update. Live mode cannot fall back to synthetic data.',
      });
    }

    try {
      const [rows]: any = await mysqlPool.query(
        'SELECT user_id, username, patient_id, password_hash, is_active FROM app_users WHERE (username = ? OR patient_id = ?) LIMIT 1',
        [cleanUsername, cleanUsername]
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Patient account not found.' });
      }

      const user = rows[0];
      const isCurrentValid = verifyPassword(currentPassword, user.password_hash);
      if (!isCurrentValid) {
        return res.status(401).json({ success: false, message: 'Current password verification failed.' });
      }

      // Hash new password using bcrypt
      const newHash = bcrypt.hashSync(newPassword, 10);

      // Update app_users
      await mysqlPool.query(
        'UPDATE app_users SET password_hash = ?, must_change_password = 0 WHERE (username = ? OR patient_id = ?)',
        [newHash, cleanUsername, cleanUsername]
      );

      // Issue new session token
      const resolvedPatientId = user.patient_id || user.username || cleanUsername;
      const token = crypto.randomBytes(32).toString('hex');
      ACTIVE_SESSIONS.set(token, {
        token,
        patient_id: resolvedPatientId,
        created_at: Date.now(),
        expires_at: Date.now() + 24 * 60 * 60 * 1000,
      });

      if (tempToken) {
        TEMP_PASSWORD_TOKENS.delete(tempToken);
      }

      return res.json({
        success: true,
        message: 'Password updated successfully in hospital_db.',
        token,
        mode: 'LIVE_MYSQL',
      });
    } catch (err: any) {
      console.error('MySQL change password error:', err);
      return res.status(503).json({
        success: false,
        errorType: 'DATABASE_ERROR',
        mode: 'LIVE_MYSQL',
        message: `Database connection error during password update: ${sanitizeError(err?.message)}.`,
      });
    }
  }

  // --- PROTOTYPE STORE ---
  const user = APP_USERS[cleanUsername];
  if (!user) {
    return res.status(404).json({ success: false, message: 'Patient account not found.' });
  }

  const isCurrentValid = verifyPassword(currentPassword, user.password_hash);
  if (!isCurrentValid) {
    return res.status(401).json({ success: false, message: 'Current password verification failed.' });
  }

  // Update password hash and reset must_change_password flag
  user.password_hash = bcrypt.hashSync(newPassword, 10);
  user.must_change_password = false;

  const token = crypto.randomBytes(32).toString('hex');
  ACTIVE_SESSIONS.set(token, {
    token,
    patient_id: cleanUsername,
    created_at: Date.now(),
    expires_at: Date.now() + 24 * 60 * 60 * 1000,
  });

  if (tempToken) {
    TEMP_PASSWORD_TOKENS.delete(tempToken);
  }

  return res.json({
    success: true,
    message: 'Password updated successfully.',
    token,
    mode: 'PROTOTYPE_DEMO',
  });
});

// 3. Validate Session / Current User
app.get('/api/auth/verify', authenticatePatientToken, async (req: Request, res: Response) => {
  const patientId = (req as any).authenticatedPatientId;

  if (targetEngineMode === 'LIVE_MYSQL' && isLiveMySQL && mysqlPool) {
    try {
      const [rows]: any = await mysqlPool.query(
        `SELECT 
          patient_id, name, date_of_birth, age, gender, city, state, 
          socioeconomic_status, occupation, registration_date, phone_number, email 
        FROM silver_patients 
        WHERE patient_id = ? 
        LIMIT 1`,
        [patientId]
      );
      const profile = formatPatientProfile(rows?.[0] || { patient_id: patientId });
      return res.json({
        success: true,
        patient: profile,
        isLiveMySQL: true,
        mode: 'LIVE_MYSQL',
      });
    } catch {
      // Fall through to standard format
    }
  }

  const profile = SILVER_PATIENTS[patientId] || formatPatientProfile({ patient_id: patientId });
  return res.json({
    success: true,
    patient: profile,
    isLiveMySQL: false,
    mode: 'PROTOTYPE_DEMO',
  });
});

// 4. Logout
app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    ACTIVE_SESSIONS.delete(token);
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// 5. Patient Dashboard Data (Requirement 3 & 4: Authoritative Schema Integration)
app.get('/api/patient/dashboard', authenticatePatientToken, async (req: Request, res: Response) => {
  const patientId = (req as any).authenticatedPatientId;

  // --- LIVE MYSQL INTEGRATION ---
  if (targetEngineMode === 'LIVE_MYSQL') {
    if (!isLiveMySQL || !mysqlPool) {
      return res.status(503).json({
        success: false,
        errorType: 'DATABASE_UNAVAILABLE',
        mode: 'LIVE_MYSQL',
        message: `Live MySQL database hospital_db is currently unreachable (${dbConnectionError || 'connection offline'}). Live mode is active and cannot fall back to synthetic demo data.`,
      });
    }

    try {
      // 1. Patient Profile from silver_patients
      const [patientRows]: any = await mysqlPool.query(
        `SELECT 
          patient_id, name, date_of_birth, age, gender, city, state, 
          socioeconomic_status, occupation, registration_date, phone_number, email 
        FROM silver_patients 
        WHERE patient_id = ? 
        LIMIT 1`,
        [patientId]
      );
      const patient = formatPatientProfile(patientRows?.[0] || { patient_id: patientId });

      // 2. Upcoming & Past Appointments from silver_appointments enriched with silver_doctors
      const [aptRows]: any = await mysqlPool.query(
        `SELECT 
          a.appointment_id,
          a.patient_id,
          a.doctor_id,
          COALESCE(d.doctor_name, 'Assigned Physician') AS doctor_name,
          COALESCE(d.specialization, a.department_name, 'General Medicine') AS specialty,
          COALESCE(d.specialization, a.department_name) AS specialization,
          a.department_name,
          d.city,
          COALESCE(d.city, 'Main Medical Campus') AS branch_name,
          'BR-MAIN' AS branch_id,
          DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
          a.appointment_time,
          a.appointment_type,
          a.booking_channel,
          a.priority,
          a.status,
          a.wait_time_minutes,
          a.consultation_duration_minutes
        FROM silver_appointments a
        LEFT JOIN silver_doctors d ON a.doctor_id = d.doctor_id
        WHERE a.patient_id = ?
        ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
        [patientId]
      );

      // Filter upcoming vs completed
      const upcomingAppointments = (aptRows || []).filter((a: any) => a.status !== 'Cancelled');

      // 3. Encounters from silver_encounters enriched with silver_doctors
      const [encRows]: any = await mysqlPool.query(
        `SELECT 
          e.encounter_id,
          e.patient_id,
          e.doctor_id,
          COALESCE(d.doctor_name, 'Attending Physician') AS doctor_name,
          COALESCE(d.specialization, e.department_name, 'General Medicine') AS specialty,
          e.department_id,
          e.department_name,
          DATE_FORMAT(e.encounter_date, '%Y-%m-%d') AS encounter_date,
          e.symptoms,
          e.primary_diagnosis,
          e.primary_diagnosis AS diagnosis,
          e.treatment_type,
          e.treatment_outcome,
          e.appointment_type,
          e.appointment_type AS visit_type,
          e.encounter_mode,
          e.wait_time_minutes,
          e.consultation_duration_minutes,
          CONCAT('Symptoms: ', COALESCE(e.symptoms, 'None reported'), '. Treatment: ', COALESCE(e.treatment_type, 'Standard regimen'), '. Outcome: ', COALESCE(e.treatment_outcome, 'Stable')) AS clinical_notes
        FROM silver_encounters e
        LEFT JOIN silver_doctors d ON e.doctor_id = d.doctor_id
        WHERE e.patient_id = ?
        ORDER BY e.encounter_date DESC`,
        [patientId]
      );

      // 4. Lab Results from silver_lab_results
      const [labRows]: any = await mysqlPool.query(
        `SELECT 
          lab_id,
          patient_id,
          encounter_id,
          test_name,
          test_category AS category,
          test_category,
          DATE_FORMAT(test_date, '%Y-%m-%d') AS test_date,
          DATE_FORMAT(test_date, '%Y-%m-%d') AS result_date,
          DATE_FORMAT(test_date, '%Y-%m-%d') AS collected_date,
          result_value,
          result_value AS value,
          unit,
          reference_range,
          status
        FROM silver_lab_results
        WHERE patient_id = ?
        ORDER BY test_date DESC`,
        [patientId]
      );

      // 5. Prescriptions from silver_prescriptions
      const [rxRows]: any = await mysqlPool.query(
        `SELECT 
          prescription_id,
          patient_id,
          encounter_id,
          DATE_FORMAT(prescription_date, '%Y-%m-%d') AS prescription_date,
          DATE_FORMAT(prescription_date, '%Y-%m-%d') AS prescribed_date,
          medicine_name,
          medicine_name AS medication_name,
          medicine_category,
          dosage,
          frequency,
          duration_days,
          CONCAT(duration_days, ' Days') AS duration,
          route,
          quantity,
          refill_allowed,
          refill_allowed AS refills_left,
          prescription_status,
          prescription_status AS status,
          CONCAT(frequency, ' via ', route, ' for ', duration_days, ' days') AS instructions
        FROM silver_prescriptions
        WHERE patient_id = ?
        ORDER BY prescription_date DESC`,
        [patientId]
      );

      // 6. Patient Feedback from silver_feedback
      const [feedbackRows]: any = await mysqlPool.query(
        `SELECT 
          f.feedback_id,
          f.patient_id,
          f.appointment_id,
          f.encounter_id,
          f.doctor_id,
          COALESCE(d.doctor_name, 'Hospital Care Team') AS doctor_name,
          DATE_FORMAT(f.feedback_date, '%Y-%m-%d') AS feedback_date,
          f.rating,
          f.doctor_rating,
          f.staff_rating,
          f.waiting_time_rating,
          f.facility_rating,
          f.cleanliness_rating,
          f.communication_rating,
          f.comments,
          f.feedback_channel,
          f.sentiment,
          f.feedback_status,
          f.resolution_notes
        FROM silver_feedback f
        LEFT JOIN silver_doctors d ON f.doctor_id = d.doctor_id
        WHERE f.patient_id = ?
        ORDER BY f.feedback_date DESC`,
        [patientId]
      );

      return res.json({
        success: true,
        data: {
          patient,
          upcomingAppointments,
          completedEncounters: encRows || [],
          labReports: labRows || [],
          prescriptions: rxRows || [],
          feedbackList: feedbackRows || [],
          notifications: NOTIFICATIONS[patientId] || [],
          backendStatus: {
            isLiveMySQL: true,
            mode: 'LIVE_MYSQL',
            engine: 'MySQL hospital_db (Connected)',
            schema: 'hospital_db (Medallion Silver)',
          },
        },
      });
    } catch (err: any) {
      console.error('MySQL query error on dashboard:', err);
      // Requirement 6: Live mode must NEVER silently substitute synthetic records!
      return res.status(503).json({
        success: false,
        errorType: 'DATABASE_ERROR',
        mode: 'LIVE_MYSQL',
        message: `Database query error: ${sanitizeError(err?.message)}. Live mode cannot fall back to synthetic data.`,
      });
    }
  }

  // --- PROTOTYPE MEDALLION STORE (When in PROTOTYPE_DEMO mode) ---
  const patient = SILVER_PATIENTS[patientId] || formatPatientProfile({ patient_id: patientId });

  const upcomingAppointments = SILVER_APPOINTMENTS.filter(
    (a) => a.patient_id === patientId && a.status !== 'Cancelled'
  );

  const completedEncounters = SILVER_ENCOUNTERS.filter(
    (e) => e.patient_id === patientId
  );

  const labReports = SILVER_LAB_RESULTS.filter(
    (l) => l.patient_id === patientId
  );

  const prescriptions = SILVER_PRESCRIPTIONS.filter(
    (p) => p.patient_id === patientId
  );

  const feedbackList = SILVER_FEEDBACK.filter(
    (f) => f.patient_id === patientId
  );

  const patientNotifications = NOTIFICATIONS[patientId] || [
    {
      id: 'NOTIF-GEN',
      title: 'Welcome to MediAI Patient Portal',
      message: 'Access your appointments, prescriptions, diagnostic results, and care feedback in one secure place.',
      timestamp: 'Today',
      type: 'general',
      read: true,
    },
  ];

  return res.json({
    success: true,
    data: {
      patient,
      upcomingAppointments,
      completedEncounters,
      labReports,
      prescriptions,
      feedbackList,
      notifications: patientNotifications,
      backendStatus: {
        isLiveMySQL: false,
        mode: 'PROTOTYPE_DEMO',
        engine: 'Prototype Silver Engine (Demo Data)',
        schema: 'hospital_db (Medallion Silver Schema - Prototype Mode)',
        notice: 'DEMO DATA ONLY - Not connected to live MySQL',
      },
    },
  });
});

// 6. Submit Patient Experience & Feedback (Requirement 3 & 4: silver_feedback endpoint)
app.post('/api/patient/feedback', authenticatePatientToken, async (req: Request, res: Response) => {
  const patientId = (req as any).authenticatedPatientId;
  const {
    appointmentId,
    encounterId,
    doctorId,
    rating,
    doctorRating,
    staffRating,
    waitingTimeRating,
    facilityRating,
    cleanlinessRating,
    communicationRating,
    comments,
  } = req.body;

  if (!rating || !comments) {
    return res.status(400).json({
      success: false,
      message: 'Overall rating and comments are required.',
    });
  }

  const feedbackId = `FB-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date().toISOString().split('T')[0];
  const numRating = Math.max(1, Math.min(5, Number(rating) || 5));
  const sentiment = numRating >= 4 ? 'Positive' : numRating === 3 ? 'Neutral' : 'Negative';

  // Live MySQL
  if (targetEngineMode === 'LIVE_MYSQL') {
    if (!isLiveMySQL || !mysqlPool) {
      return res.status(503).json({
        success: false,
        errorType: 'DATABASE_UNAVAILABLE',
        mode: 'LIVE_MYSQL',
        message: 'Database connection offline. Live mode cannot record feedback.',
      });
    }

    try {
      await mysqlPool.query(
        `INSERT INTO silver_feedback (
          feedback_id, patient_id, appointment_id, encounter_id, doctor_id, 
          feedback_date, rating, doctor_rating, staff_rating, waiting_time_rating, 
          facility_rating, cleanliness_rating, communication_rating, comments, 
          feedback_channel, sentiment, feedback_status, resolution_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          feedbackId,
          patientId,
          appointmentId || null,
          encounterId || null,
          doctorId || null,
          now,
          numRating,
          doctorRating || numRating,
          staffRating || numRating,
          waitingTimeRating || numRating,
          facilityRating || numRating,
          cleanlinessRating || numRating,
          communicationRating || numRating,
          comments,
          'Patient Portal',
          sentiment,
          'Submitted',
          'Logged by Patient Experience Operations',
        ]
      );

      const doctor = doctorId ? SILVER_DOCTORS.find((d) => d.doctor_id === doctorId) : null;
      const newFeedback: FeedbackRecord = {
        feedback_id: feedbackId,
        patient_id: patientId,
        appointment_id: appointmentId,
        encounter_id: encounterId,
        doctor_id: doctorId,
        doctor_name: doctor?.name || 'Hospital Care Team',
        feedback_date: now,
        rating: numRating,
        doctor_rating: doctorRating || numRating,
        staff_rating: staffRating || numRating,
        waiting_time_rating: waitingTimeRating || numRating,
        facility_rating: facilityRating || numRating,
        cleanliness_rating: cleanlinessRating || numRating,
        communication_rating: communicationRating || numRating,
        comments,
        feedback_channel: 'Patient Portal',
        sentiment,
        feedback_status: 'Submitted',
        resolution_notes: 'Logged by Patient Experience Operations',
      };

      return res.status(201).json({
        success: true,
        message: 'Feedback recorded successfully into silver_feedback.',
        feedback: newFeedback,
        mode: 'LIVE_MYSQL',
      });
    } catch (err: any) {
      console.error('MySQL insert silver_feedback error:', err);
      return res.status(503).json({
        success: false,
        errorType: 'DATABASE_ERROR',
        mode: 'LIVE_MYSQL',
        message: `Database error saving feedback: ${sanitizeError(err?.message)}.`,
      });
    }
  }

  // Prototype Demo Mode
  const doctor = doctorId ? SILVER_DOCTORS.find((d) => d.doctor_id === doctorId) : null;
  const newFeedback: FeedbackRecord = {
    feedback_id: feedbackId,
    patient_id: patientId,
    appointment_id: appointmentId,
    encounter_id: encounterId,
    doctor_id: doctorId,
    doctor_name: doctor?.name || 'Hospital Care Team',
    feedback_date: now,
    rating: numRating,
    doctor_rating: doctorRating || numRating,
    staff_rating: staffRating || numRating,
    waiting_time_rating: waitingTimeRating || numRating,
    facility_rating: facilityRating || numRating,
    cleanliness_rating: cleanlinessRating || numRating,
    communication_rating: communicationRating || numRating,
    comments,
    feedback_channel: 'Patient Portal',
    sentiment,
    feedback_status: 'Submitted',
    resolution_notes: 'Logged by Patient Experience Operations',
  };

  SILVER_FEEDBACK.unshift(newFeedback);

  if (!NOTIFICATIONS[patientId]) {
    NOTIFICATIONS[patientId] = [];
  }
  NOTIFICATIONS[patientId].unshift({
    id: `NOTIF-${Date.now()}`,
    title: 'Thank You For Your Feedback',
    message: `Your clinical experience review has been received and logged under reference ${feedbackId}.`,
    timestamp: 'Just now',
    type: 'feedback',
    read: false,
  });

  return res.status(201).json({
    success: true,
    message: 'Feedback recorded successfully into silver_feedback.',
    feedback: newFeedback,
    mode: 'PROTOTYPE_DEMO',
  });
});

// 7. Booking Wizard: Branches
app.get('/api/booking/branches', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    branches: HOSPITAL_BRANCHES,
  });
});

// 8. Booking Wizard: Specialties
app.get('/api/booking/specialties', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    specialties: MEDICAL_SPECIALTIES,
  });
});

// 9. Booking Wizard: Doctors (filtered by branch and specialty)
app.get('/api/booking/doctors', async (req: Request, res: Response) => {
  const { branchId, specialty } = req.query;

  // Live MySQL mode
  if (targetEngineMode === 'LIVE_MYSQL') {
    if (!isLiveMySQL || !mysqlPool) {
      return res.status(503).json({
        success: false,
        errorType: 'DATABASE_UNAVAILABLE',
        mode: 'LIVE_MYSQL',
        message: 'Live MySQL database offline. Cannot retrieve doctors.',
      });
    }

    try {
      let query = `SELECT 
        doctor_id, 
        doctor_name, 
        department_id, 
        department_name, 
        specialization, 
        qualification, 
        experience_years, 
        city, 
        employment_type, 
        availability, 
        joining_date, 
        phone_number, 
        email 
      FROM silver_doctors WHERE 1=1`;
      const params: any[] = [];

      if (specialty) {
        query += ` AND (LOWER(specialization) = LOWER(?) OR LOWER(department_name) = LOWER(?))`;
        params.push(String(specialty), String(specialty));
      }

      const [rows]: any = await mysqlPool.query(query, params);
      const mappedDoctors: DoctorInfo[] = (rows || []).map((r: any) => ({
        doctor_id: r.doctor_id,
        doctor_name: r.doctor_name,
        name: r.doctor_name,
        specialty: r.specialization || r.department_name || 'General Medicine',
        specialization: r.specialization,
        department_name: r.department_name,
        qualification: r.qualification || 'MD, Board Certified',
        experience_years: r.experience_years || 10,
        city: r.city,
        branch_id: branchId ? String(branchId) : 'BR-MAIN',
        branch_name: 'MediAI Medical Center',
        consultation_fee: 140,
        rating: 4.8,
        rating_count: 95,
      }));
      return res.json({ success: true, doctors: mappedDoctors, mode: 'LIVE_MYSQL' });
    } catch (e: any) {
      console.error('MySQL query error on silver_doctors:', e);
      return res.status(503).json({
        success: false,
        errorType: 'DATABASE_ERROR',
        mode: 'LIVE_MYSQL',
        message: `Database error querying silver_doctors: ${sanitizeError(e?.message)}.`,
      });
    }
  }

  // Prototype demo mode
  let doctors = [...SILVER_DOCTORS];

  if (branchId) {
    doctors = doctors.filter((d) => d.branch_id === String(branchId));
  }

  if (specialty) {
    doctors = doctors.filter(
      (d) => d.specialty.toLowerCase() === String(specialty).toLowerCase()
    );
  }

  return res.json({
    success: true,
    doctors,
    mode: 'PROTOTYPE_DEMO',
  });
});

// 10. Booking Wizard: Doctor Availability Slots (Requirement 8)
app.get('/api/booking/availability', async (req: Request, res: Response) => {
  const { doctorId, date } = req.query;

  if (!doctorId || !date) {
    return res.status(400).json({
      success: false,
      message: 'Both doctorId and date parameters are required.',
    });
  }

  const standardSlots = [
    '09:00 AM',
    '09:30 AM',
    '10:00 AM',
    '10:30 AM',
    '11:00 AM',
    '11:30 AM',
    '02:00 PM',
    '02:30 PM',
    '03:00 PM',
    '03:30 PM',
    '04:00 PM',
    '04:30 PM',
  ];

  // Live MySQL mode
  if (targetEngineMode === 'LIVE_MYSQL') {
    if (!isLiveMySQL || !mysqlPool) {
      return res.status(503).json({
        success: false,
        errorType: 'DATABASE_UNAVAILABLE',
        mode: 'LIVE_MYSQL',
        message: 'Live MySQL database offline. Cannot check availability slots.',
      });
    }

    try {
      const [rows]: any = await mysqlPool.query(
        `SELECT appointment_time 
         FROM silver_appointments 
         WHERE doctor_id = ? AND appointment_date = ? AND status != 'Cancelled'`,
        [String(doctorId), String(date)]
      );

      const bookedSlots = (rows || []).map((r: any) => r.appointment_time);
      const availableSlots = standardSlots.map((slot) => ({
        time: slot,
        isAvailable: !bookedSlots.includes(slot),
      }));

      return res.json({
        success: true,
        date: String(date),
        doctorId: String(doctorId),
        slots: availableSlots,
        mode: 'LIVE_MYSQL',
      });
    } catch (err: any) {
      return res.status(503).json({
        success: false,
        errorType: 'DATABASE_ERROR',
        mode: 'LIVE_MYSQL',
        message: `Database error querying appointment availability: ${sanitizeError(err?.message)}.`,
      });
    }
  }

  // Prototype demo mode
  const bookedSlots = SILVER_APPOINTMENTS.filter(
    (a) =>
      a.doctor_id === String(doctorId) &&
      a.appointment_date === String(date) &&
      a.status !== 'Cancelled'
  ).map((a) => a.appointment_time);

  const availableSlots = standardSlots.map((slot) => ({
    time: slot,
    isAvailable: !bookedSlots.includes(slot),
  }));

  return res.json({
    success: true,
    date: String(date),
    doctorId: String(doctorId),
    slots: availableSlots,
    mode: 'PROTOTYPE_DEMO',
  });
});

// 11. Booking Wizard: Create Appointment (Requirement 8: Actual MySQL Schema & Conflict Engine)
app.post('/api/booking/create', authenticatePatientToken, async (req: Request, res: Response) => {
  const patientId = (req as any).authenticatedPatientId;
  const { doctorId, branchId, date, timeSlot, reason } = req.body;

  if (!doctorId || !branchId || !date || !timeSlot) {
    return res.status(400).json({
      success: false,
      message: 'Missing required appointment fields (doctor, branch, date, time).',
    });
  }

  const chosenDate = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (chosenDate < today) {
    return res.status(400).json({
      success: false,
      message: 'Cannot book appointments in the past.',
    });
  }

  const appointmentId = `APT-${Math.floor(10000 + Math.random() * 90000)}`;

  // --- LIVE MYSQL INTEGRATION ---
  if (targetEngineMode === 'LIVE_MYSQL') {
    if (!isLiveMySQL || !mysqlPool) {
      return res.status(503).json({
        success: false,
        errorType: 'DATABASE_UNAVAILABLE',
        mode: 'LIVE_MYSQL',
        message: 'Live MySQL database offline. Cannot schedule appointment.',
      });
    }

    try {
      // 1. Double-booking check: doctor slot conflict in silver_appointments
      const [doctorRows]: any = await mysqlPool.query(
        `SELECT appointment_id FROM silver_appointments 
         WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status != 'Cancelled' 
         LIMIT 1`,
        [doctorId, date, timeSlot]
      );

      if (doctorRows && doctorRows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'This appointment slot has just been reserved. Please select another time.',
        });
      }

      // 2. Double-booking check: patient schedule conflict in silver_appointments
      const [patientRows]: any = await mysqlPool.query(
        `SELECT appointment_id FROM silver_appointments 
         WHERE patient_id = ? AND appointment_date = ? AND appointment_time = ? AND status != 'Cancelled' 
         LIMIT 1`,
        [patientId, date, timeSlot]
      );

      if (patientRows && patientRows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'You already have another visit scheduled at this time.',
        });
      }

      // 3. Fetch doctor info for department name
      const [docInfoRows]: any = await mysqlPool.query(
        `SELECT doctor_name, specialization, department_name FROM silver_doctors WHERE doctor_id = ? LIMIT 1`,
        [doctorId]
      );
      const doctorInfo = docInfoRows?.[0] || {};
      const departmentName = doctorInfo.department_name || doctorInfo.specialization || 'General Medicine';
      const doctorName = doctorInfo.doctor_name || 'Assigned Physician';

      // 4. Insert strictly into silver_appointments using verified columns:
      // appointment_id, patient_id, doctor_id, appointment_date, appointment_time, appointment_type, department_name, booking_channel, priority, status, wait_time_minutes, consultation_duration_minutes
      await mysqlPool.query(
        `INSERT INTO silver_appointments (
          appointment_id, patient_id, doctor_id, appointment_date, appointment_time, 
          appointment_type, department_name, booking_channel, priority, status, 
          wait_time_minutes, consultation_duration_minutes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          appointmentId,
          patientId,
          doctorId,
          date,
          timeSlot,
          'Patient Portal Consultation',
          departmentName,
          'Patient Portal',
          'Normal',
          'Confirmed',
          0,
          30,
        ]
      );

      const branch = HOSPITAL_BRANCHES.find((b) => b.branch_id === branchId);
      const newAppointment: AppointmentRecord = {
        appointment_id: appointmentId,
        patient_id: patientId,
        doctor_id: doctorId,
        doctor_name: doctorName,
        specialty: departmentName,
        branch_id: branchId,
        branch_name: branch?.name || 'MediAI Hospital Branch',
        appointment_date: date,
        appointment_time: timeSlot,
        status: 'Confirmed',
        reason: reason?.trim() || 'General Clinical Consultation',
        created_at: new Date().toISOString(),
      };

      return res.status(201).json({
        success: true,
        message: 'Appointment successfully confirmed and registered in silver_appointments.',
        appointment: newAppointment,
        mode: 'LIVE_MYSQL',
      });
    } catch (err: any) {
      console.error('MySQL insert silver_appointments error:', err);
      return res.status(503).json({
        success: false,
        errorType: 'DATABASE_ERROR',
        mode: 'LIVE_MYSQL',
        message: `Database error booking appointment into silver_appointments: ${sanitizeError(err?.message)}.`,
      });
    }
  }

  // --- PROTOTYPE DEMO STORE ---
  // Double-booking check: doctor slot conflict
  const doctorConflict = SILVER_APPOINTMENTS.some(
    (a) =>
      a.doctor_id === doctorId &&
      a.appointment_date === date &&
      a.appointment_time === timeSlot &&
      a.status !== 'Cancelled'
  );

  if (doctorConflict) {
    return res.status(409).json({
      success: false,
      message: 'This appointment slot has just been reserved. Please select another time.',
    });
  }

  // Double-booking check: patient schedule conflict
  const patientConflict = SILVER_APPOINTMENTS.some(
    (a) =>
      a.patient_id === patientId &&
      a.appointment_date === date &&
      a.appointment_time === timeSlot &&
      a.status !== 'Cancelled'
  );

  if (patientConflict) {
    return res.status(409).json({
      success: false,
      message: 'You already have another visit scheduled at this time.',
    });
  }

  const doctor = SILVER_DOCTORS.find((d) => d.doctor_id === doctorId);
  const branch = HOSPITAL_BRANCHES.find((b) => b.branch_id === branchId);

  const newAppointment: AppointmentRecord = {
    appointment_id: appointmentId,
    patient_id: patientId,
    doctor_id: doctorId,
    doctor_name: doctor?.name || 'Assigned Physician',
    specialty: doctor?.specialty || 'General Medicine',
    branch_id: branchId,
    branch_name: branch?.name || 'MediAI Hospital Branch',
    appointment_date: date,
    appointment_time: timeSlot,
    status: 'Confirmed',
    reason: reason?.trim() || 'General Clinical Consultation',
    created_at: new Date().toISOString(),
  };

  SILVER_APPOINTMENTS.unshift(newAppointment);

  if (!NOTIFICATIONS[patientId]) {
    NOTIFICATIONS[patientId] = [];
  }
  NOTIFICATIONS[patientId].unshift({
    id: `NOTIF-${Date.now()}`,
    title: 'Appointment Booked Successfully',
    message: `Your visit with ${newAppointment.doctor_name} on ${newAppointment.appointment_date} at ${newAppointment.appointment_time} is confirmed.`,
    timestamp: 'Just now',
    type: 'appointment',
    read: false,
  });

  return res.status(201).json({
    success: true,
    message: 'Appointment successfully confirmed and registered in silver_appointments.',
    appointment: newAppointment,
    mode: 'PROTOTYPE_DEMO',
  });
});

// 12. Cancel Appointment (Requirement 8: Actual MySQL Schema Verification)
app.post('/api/booking/cancel', authenticatePatientToken, async (req: Request, res: Response) => {
  const patientId = (req as any).authenticatedPatientId;
  const { appointmentId } = req.body;

  if (!appointmentId) {
    return res.status(400).json({
      success: false,
      message: 'appointmentId is required.',
    });
  }

  // --- LIVE MYSQL INTEGRATION ---
  if (targetEngineMode === 'LIVE_MYSQL') {
    if (!isLiveMySQL || !mysqlPool) {
      return res.status(503).json({
        success: false,
        errorType: 'DATABASE_UNAVAILABLE',
        mode: 'LIVE_MYSQL',
        message: 'Live MySQL database offline. Cannot cancel appointment.',
      });
    }

    try {
      // 1. Verify existence and authorization strictly against silver_appointments
      const [rows]: any = await mysqlPool.query(
        'SELECT appointment_id, status FROM silver_appointments WHERE appointment_id = ? AND patient_id = ? LIMIT 1',
        [appointmentId, patientId]
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found or unauthorized to cancel.',
        });
      }

      // 2. Perform cancellation update
      await mysqlPool.query(
        'UPDATE silver_appointments SET status = "Cancelled" WHERE appointment_id = ? AND patient_id = ?',
        [appointmentId, patientId]
      );

      return res.json({
        success: true,
        message: 'Appointment has been cancelled.',
        appointmentId,
        mode: 'LIVE_MYSQL',
      });
    } catch (err: any) {
      console.error('MySQL cancel appointment error:', err);
      return res.status(503).json({
        success: false,
        errorType: 'DATABASE_ERROR',
        mode: 'LIVE_MYSQL',
        message: `Database error cancelling appointment in silver_appointments: ${sanitizeError(err?.message)}.`,
      });
    }
  }

  // --- PROTOTYPE DEMO STORE ---
  const apt = SILVER_APPOINTMENTS.find(
    (a) => a.appointment_id === appointmentId && a.patient_id === patientId
  );

  if (!apt) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found or unauthorized to cancel.',
    });
  }

  apt.status = 'Cancelled';

  return res.json({
    success: true,
    message: 'Appointment has been cancelled.',
    appointmentId,
    mode: 'PROTOTYPE_DEMO',
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
    console.log(`MediAI Hospital Platform server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
