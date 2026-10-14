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
  NotificationItem,
} from './src/types/patient';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// --- Database Engine Detection & Configuration Layer ---
// In production/staging with MySQL credentials, connects to hospital_db
function resolveMySQLConfig() {
  const connUri = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQL_URI;
  if (connUri) {
    try {
      const parsed = new URL(connUri);
      return {
        host: parsed.hostname || 'localhost',
        port: Number(parsed.port) || 3306,
        user: decodeURIComponent(parsed.username || ''),
        password: decodeURIComponent(parsed.password || ''),
        database: parsed.pathname.replace(/^\//, '') || process.env.MYSQL_DATABASE || 'hospital_db',
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
  };
}

const MYSQL_CONFIG = resolveMySQLConfig();

const hasMySQLCredentials = Boolean(
  MYSQL_CONFIG.host && MYSQL_CONFIG.user && MYSQL_CONFIG.password
);

let isLiveMySQL = false;
let dbConnectionError: string | null = null;
let mysqlPool: any = null;

// Initialize MySQL pool if credentials exist
if (hasMySQLCredentials) {
  try {
    const mysql = await import('mysql2/promise');
    mysqlPool = mysql.createPool({
      ...MYSQL_CONFIG,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 5000,
    });
    // Test connectivity
    const connection = await mysqlPool.getConnection();
    connection.release();
    isLiveMySQL = true;
    dbConnectionError = null;
    console.log('Connected to MySQL hospital_db successfully.');
  } catch (err: any) {
    dbConnectionError = err?.message || 'Failed to connect to MySQL hospital_db';
    console.warn('MySQL configured but connection failed:', dbConnectionError);
    isLiveMySQL = false;
  }
} else {
  console.log('MySQL environment variables not provided. Running with server-authoritative Medallion Silver schema store.');
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

// --- Hospital Branches & Scheduling Configuration Layer ---
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
// Usernames: P182162, P195909, P198226, P151076, P164835, P115937, P171467, P167834, P144799, P118969
const DEFAULT_DEMO_PASSWORD = 'Patient@2026';
const DEMO_BCRYPT_HASH = bcrypt.hashSync(DEFAULT_DEMO_PASSWORD, 10);
const DEMO_SALT = 'mediai_secure_hospital_salt_2026';

interface AppUserRecord {
  id?: number;
  user_id?: string;
  username: string; // Patient ID
  patient_id: string; // Patient ID
  password_hash: string;
  salt: string;
  role: 'patient';
  status: 'active';
  is_active: number;
  must_change_password: boolean;
  created_at: string;
}

const APP_USERS: Record<string, AppUserRecord> = {
  P182162: { username: 'P182162', patient_id: 'P182162', password_hash: DEMO_BCRYPT_HASH, salt: DEMO_SALT, role: 'patient', status: 'active', is_active: 1, must_change_password: false, created_at: '2025-01-15' },
  P195909: { username: 'P195909', patient_id: 'P195909', password_hash: DEMO_BCRYPT_HASH, salt: DEMO_SALT, role: 'patient', status: 'active', is_active: 1, must_change_password: false, created_at: '2025-02-10' },
  P198226: { username: 'P198226', patient_id: 'P198226', password_hash: DEMO_BCRYPT_HASH, salt: DEMO_SALT, role: 'patient', status: 'active', is_active: 1, must_change_password: false, created_at: '2025-03-05' },
  P151076: { username: 'P151076', patient_id: 'P151076', password_hash: DEMO_BCRYPT_HASH, salt: DEMO_SALT, role: 'patient', status: 'active', is_active: 1, must_change_password: false, created_at: '2025-03-20' },
  P164835: { username: 'P164835', patient_id: 'P164835', password_hash: DEMO_BCRYPT_HASH, salt: DEMO_SALT, role: 'patient', status: 'active', is_active: 1, must_change_password: false, created_at: '2025-04-12' },
  P115937: { username: 'P115937', patient_id: 'P115937', password_hash: DEMO_BCRYPT_HASH, salt: DEMO_SALT, role: 'patient', status: 'active', is_active: 1, must_change_password: false, created_at: '2025-05-01' },
  P171467: { username: 'P171467', patient_id: 'P171467', password_hash: DEMO_BCRYPT_HASH, salt: DEMO_SALT, role: 'patient', status: 'active', is_active: 1, must_change_password: false, created_at: '2025-05-18' },
  P167834: { username: 'P167834', patient_id: 'P167834', password_hash: DEMO_BCRYPT_HASH, salt: DEMO_SALT, role: 'patient', status: 'active', is_active: 1, must_change_password: false, created_at: '2025-06-22' },
  P144799: { username: 'P144799', patient_id: 'P144799', password_hash: DEMO_BCRYPT_HASH, salt: DEMO_SALT, role: 'patient', status: 'active', is_active: 1, must_change_password: false, created_at: '2025-07-09' },
  P118969: { username: 'P118969', patient_id: 'P118969', password_hash: DEMO_BCRYPT_HASH, salt: DEMO_SALT, role: 'patient', status: 'active', is_active: 1, must_change_password: false, created_at: '2025-08-14' },
};

// silver_patients records
const SILVER_PATIENTS: Record<string, PatientProfile> = {
  P182162: {
    patient_id: 'P182162',
    first_name: 'Eleanor',
    last_name: 'Vance',
    email: 'eleanor.vance@patient.mediai.health',
    phone: '+1 (555) 349-8821',
    date_of_birth: '1988-06-14',
    gender: 'Female',
    blood_group: 'O+',
    emergency_contact: 'Thomas Vance (Spouse) - +1 (555) 349-8822',
    address: '422 Elmwood Terrace, Metro District',
    primary_doctor_id: 'DOC-101',
    primary_doctor_name: 'Dr. Marcus Chen, MD',
  },
  P195909: {
    patient_id: 'P195909',
    first_name: 'David',
    last_name: 'Sterling',
    email: 'david.sterling@patient.mediai.health',
    phone: '+1 (555) 482-1944',
    date_of_birth: '1975-11-23',
    gender: 'Male',
    blood_group: 'A+',
    emergency_contact: 'Clara Sterling (Wife) - +1 (555) 482-1945',
    address: '88 Oak Ridge Way, Westside',
    primary_doctor_id: 'DOC-102',
    primary_doctor_name: 'Dr. Sarah Al-Mansoor, MD',
  },
  P198226: {
    patient_id: 'P198226',
    first_name: 'Maya',
    last_name: 'Lin',
    email: 'maya.lin@patient.mediai.health',
    phone: '+1 (555) 791-3042',
    date_of_birth: '1994-03-30',
    gender: 'Female',
    blood_group: 'B+',
    emergency_contact: 'Ken Lin (Father) - +1 (555) 791-3040',
    address: '1504 Waterfront Promenade, Apt 8B',
    primary_doctor_id: 'DOC-103',
    primary_doctor_name: 'Dr. James Thorne, MD',
  },
  P151076: {
    patient_id: 'P151076',
    first_name: 'Lucas',
    last_name: 'Thorne',
    email: 'lucas.thorne@patient.mediai.health',
    phone: '+1 (555) 612-4491',
    date_of_birth: '1982-09-08',
    gender: 'Male',
    blood_group: 'AB-',
    emergency_contact: 'Victoria Thorne (Sister) - +1 (555) 612-4492',
    address: '730 Highland Avenue',
    primary_doctor_id: 'DOC-101',
    primary_doctor_name: 'Dr. Marcus Chen, MD',
  },
  P164835: {
    patient_id: 'P164835',
    first_name: 'Sophia',
    last_name: 'Rodriguez',
    email: 'sophia.rodriguez@patient.mediai.health',
    phone: '+1 (555) 843-9201',
    date_of_birth: '1991-12-19',
    gender: 'Female',
    blood_group: 'A-',
    emergency_contact: 'Carlos Rodriguez (Brother) - +1 (555) 843-9202',
    address: '29 Sunset Boulevard, Suite 4',
    primary_doctor_id: 'DOC-104',
    primary_doctor_name: 'Dr. Emily Watson, MD',
  },
  P115937: {
    patient_id: 'P115937',
    first_name: 'James',
    last_name: 'Wilson',
    email: 'james.wilson@patient.mediai.health',
    phone: '+1 (555) 234-7711',
    date_of_birth: '1968-04-02',
    gender: 'Male',
    blood_group: 'O-',
    emergency_contact: 'Margaret Wilson (Wife) - +1 (555) 234-7712',
    address: '512 Pinecrest Road',
    primary_doctor_id: 'DOC-102',
    primary_doctor_name: 'Dr. Sarah Al-Mansoor, MD',
  },
  P171467: {
    patient_id: 'P171467',
    first_name: 'Aisha',
    last_name: 'Patel',
    email: 'aisha.patel@patient.mediai.health',
    phone: '+1 (555) 902-6150',
    date_of_birth: '1996-07-25',
    gender: 'Female',
    blood_group: 'B-',
    emergency_contact: 'Rajesh Patel (Father) - +1 (555) 902-6151',
    address: '110 University Circle',
    primary_doctor_id: 'DOC-105',
    primary_doctor_name: 'Dr. Robert Hayes, MD',
  },
  P167834: {
    patient_id: 'P167834',
    first_name: 'Benjamin',
    last_name: 'Hayes',
    email: 'benjamin.hayes@patient.mediai.health',
    phone: '+1 (555) 554-1829',
    date_of_birth: '1979-10-14',
    gender: 'Male',
    blood_group: 'O+',
    emergency_contact: 'Laura Hayes (Wife) - +1 (555) 554-1830',
    address: '891 Meadowview Court',
    primary_doctor_id: 'DOC-103',
    primary_doctor_name: 'Dr. James Thorne, MD',
  },
  P144799: {
    patient_id: 'P144799',
    first_name: 'Chloe',
    last_name: 'Bennett',
    email: 'chloe.bennett@patient.mediai.health',
    phone: '+1 (555) 441-9988',
    date_of_birth: '2001-01-18',
    gender: 'Female',
    blood_group: 'A+',
    emergency_contact: 'Diane Bennett (Mother) - +1 (555) 441-9989',
    address: '320 College Parkway',
    primary_doctor_id: 'DOC-104',
    primary_doctor_name: 'Dr. Emily Watson, MD',
  },
  P118969: {
    patient_id: 'P118969',
    first_name: 'Thomas',
    last_name: 'Miller',
    email: 'thomas.miller@patient.mediai.health',
    phone: '+1 (555) 678-2200',
    date_of_birth: '1962-08-31',
    gender: 'Male',
    blood_group: 'AB+',
    emergency_contact: 'Dorothy Miller (Daughter) - +1 (555) 678-2201',
    address: '614 Cedar Ridge Drive',
    primary_doctor_id: 'DOC-101',
    primary_doctor_name: 'Dr. Marcus Chen, MD',
  },
};

// silver_doctors
const SILVER_DOCTORS: DoctorInfo[] = [
  {
    doctor_id: 'DOC-101',
    name: 'Dr. Marcus Chen, MD',
    specialty: 'Cardiology',
    qualification: 'MD, FACC, Harvard Medical School',
    experience_years: 14,
    branch_id: 'BR-MAIN',
    branch_name: 'MediAI Central Medical Center',
    consultation_fee: 150,
    rating: 4.9,
    rating_count: 142,
  },
  {
    doctor_id: 'DOC-102',
    name: 'Dr. Sarah Al-Mansoor, MD',
    specialty: 'General Medicine',
    qualification: 'MD, Johns Hopkins University',
    experience_years: 11,
    branch_id: 'BR-MAIN',
    branch_name: 'MediAI Central Medical Center',
    consultation_fee: 110,
    rating: 4.8,
    rating_count: 198,
  },
  {
    doctor_id: 'DOC-103',
    name: 'Dr. James Thorne, MD',
    specialty: 'Orthopedics',
    qualification: 'MD, MS (Ortho), Stanford Medicine',
    experience_years: 16,
    branch_id: 'BR-WEST',
    branch_name: 'Westside Specialty Care Pavilion',
    consultation_fee: 160,
    rating: 4.7,
    rating_count: 88,
  },
  {
    doctor_id: 'DOC-104',
    name: 'Dr. Emily Watson, MD',
    specialty: 'Pediatrics',
    qualification: 'MD, FAAP, Boston Children’s Hospital',
    experience_years: 9,
    branch_id: 'BR-CHILD',
    branch_name: "St. Jude Children's & Women's Hospital",
    consultation_fee: 120,
    rating: 4.9,
    rating_count: 215,
  },
  {
    doctor_id: 'DOC-105',
    name: 'Dr. Robert Hayes, MD',
    specialty: 'Neurology',
    qualification: 'MD, PhD (Neuro), Columbia University',
    experience_years: 18,
    branch_id: 'BR-WEST',
    branch_name: 'Westside Specialty Care Pavilion',
    consultation_fee: 180,
    rating: 4.8,
    rating_count: 67,
  },
  {
    doctor_id: 'DOC-106',
    name: 'Dr. Priya Sharma, MD',
    specialty: 'General Medicine',
    qualification: 'MBBS, MD, AIIMS & UCSF',
    experience_years: 8,
    branch_id: 'BR-NORTH',
    branch_name: 'Northgate Family Health & Pediatrics',
    consultation_fee: 100,
    rating: 4.7,
    rating_count: 112,
  },
  {
    doctor_id: 'DOC-107',
    name: 'Dr. Alan Vance, MD',
    specialty: 'Cardiology',
    qualification: 'MD, Mayo Clinic College of Medicine',
    experience_years: 15,
    branch_id: 'BR-WEST',
    branch_name: 'Westside Specialty Care Pavilion',
    consultation_fee: 155,
    rating: 4.6,
    rating_count: 53,
  },
  {
    doctor_id: 'DOC-108',
    name: 'Dr. Olivia Martinez, MD',
    specialty: 'Pediatrics',
    qualification: 'MD, University of Pennsylvania',
    experience_years: 10,
    branch_id: 'BR-NORTH',
    branch_name: 'Northgate Family Health & Pediatrics',
    consultation_fee: 115,
    rating: 4.9,
    rating_count: 94,
  },
];

// Initial appointments store (silver_appointments)
let SILVER_APPOINTMENTS: AppointmentRecord[] = [
  {
    appointment_id: 'APT-88210',
    patient_id: 'P182162',
    doctor_id: 'DOC-101',
    doctor_name: 'Dr. Marcus Chen, MD',
    specialty: 'Cardiology',
    branch_id: 'BR-MAIN',
    branch_name: 'MediAI Central Medical Center',
    appointment_date: '2026-10-22',
    appointment_time: '10:30 AM',
    status: 'Confirmed',
    reason: 'Routine quarterly cardiovascular assessment and ECG review',
    created_at: '2026-10-10T14:32:00Z',
  },
  {
    appointment_id: 'APT-88211',
    patient_id: 'P182162',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    specialty: 'General Medicine',
    branch_id: 'BR-MAIN',
    branch_name: 'MediAI Central Medical Center',
    appointment_date: '2026-11-05',
    appointment_time: '02:00 PM',
    status: 'Scheduled',
    reason: 'Annual wellness exam and metabolic panel review',
    created_at: '2026-10-12T09:15:00Z',
  },
  {
    appointment_id: 'APT-87102',
    patient_id: 'P195909',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    specialty: 'General Medicine',
    branch_id: 'BR-MAIN',
    branch_name: 'MediAI Central Medical Center',
    appointment_date: '2026-10-25',
    appointment_time: '11:00 AM',
    status: 'Confirmed',
    reason: 'Follow-up on blood pressure regulation medication',
    created_at: '2026-10-08T11:20:00Z',
  },
];

// silver_encounters (Completed Visits)
const SILVER_ENCOUNTERS: EncounterRecord[] = [
  {
    encounter_id: 'ENC-4921',
    patient_id: 'P182162',
    doctor_id: 'DOC-101',
    doctor_name: 'Dr. Marcus Chen, MD',
    specialty: 'Cardiology',
    encounter_date: '2026-07-18',
    visit_type: 'Outpatient Clinical Follow-up',
    diagnosis: 'Mild Essential Hypertension, Sinus Tachycardia (Controlled)',
    clinical_notes: 'Patient exhibits stable hemodynamic vitals. Blood pressure 124/82 mmHg. Resting heart rate 74 bpm. Recommended continuation of current low-sodium DASH diet and daily aerobic walking.',
    follow_up_date: '2026-10-22',
  },
  {
    encounter_id: 'ENC-4510',
    patient_id: 'P182162',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    specialty: 'General Medicine',
    encounter_date: '2026-03-12',
    visit_type: 'Annual Preventative Health Visit',
    diagnosis: 'Vitamin D Deficiency, Normal BMI',
    clinical_notes: 'Comprehensive annual physical completed. Cardiac, pulmonary, and neurological exams normal. Ordered routine lipid and 25-hydroxy vitamin D panels.',
    follow_up_date: '2026-07-18',
  },
];

// silver_lab_results
const SILVER_LAB_RESULTS: LabResultRecord[] = [
  {
    lab_id: 'LAB-9041',
    patient_id: 'P182162',
    doctor_id: 'DOC-101',
    doctor_name: 'Dr. Marcus Chen, MD',
    test_name: 'Complete Lipid Profile & Apolipoproteins',
    category: 'Clinical Chemistry',
    collected_date: '2026-07-19',
    result_date: '2026-07-20',
    status: 'Normal',
    value: 'Total Chol: 182 mg/dL | LDL: 98 mg/dL | HDL: 62 mg/dL',
    reference_range: 'Total < 200 mg/dL | LDL < 100 mg/dL | HDL > 50 mg/dL',
    flag: 'Normal',
    summary: 'Optimal lipid ratios. Cardiovascular lipid markers indicate low 10-year risk.',
  },
  {
    lab_id: 'LAB-9042',
    patient_id: 'P182162',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    test_name: 'Comprehensive Metabolic Panel (CMP-14)',
    category: 'Biochemistry',
    collected_date: '2026-07-19',
    result_date: '2026-07-20',
    status: 'Normal',
    value: 'Glucose Fasting: 88 mg/dL | Creatinine: 0.85 mg/dL | eGFR: >90',
    reference_range: 'Glucose: 70-99 mg/dL | Creatinine: 0.6-1.1 mg/dL',
    flag: 'Normal',
    summary: 'Renal, hepatic, and glycemic markers are within healthy standard limits.',
  },
  {
    lab_id: 'LAB-8812',
    patient_id: 'P182162',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    test_name: '25-Hydroxy Vitamin D (Total)',
    category: 'Endocrinology / Serology',
    collected_date: '2026-03-14',
    result_date: '2026-03-15',
    status: 'Ready',
    value: '42.6 ng/mL',
    reference_range: '30.0 - 100.0 ng/mL',
    flag: 'Normal',
    summary: 'Adequate vitamin D stores reached following supplemental protocol.',
  },
];

// silver_prescriptions
const SILVER_PRESCRIPTIONS: PrescriptionRecord[] = [
  {
    prescription_id: 'RX-30192',
    patient_id: 'P182162',
    doctor_id: 'DOC-101',
    doctor_name: 'Dr. Marcus Chen, MD',
    medication_name: 'Metoprolol Succinate ER',
    dosage: '25 mg Extended Release',
    frequency: 'Once daily in the morning with water',
    duration: '90 Days',
    prescribed_date: '2026-07-18',
    refills_left: 3,
    instructions: 'Take with or immediately after food. Monitor morning heart rate.',
    status: 'Active',
  },
  {
    prescription_id: 'RX-29841',
    patient_id: 'P182162',
    doctor_id: 'DOC-102',
    doctor_name: 'Dr. Sarah Al-Mansoor, MD',
    medication_name: 'Cholecalciferol (Vitamin D3)',
    dosage: '2,000 IU Softgel',
    frequency: 'Once daily with meals',
    duration: '180 Days',
    prescribed_date: '2026-03-12',
    refills_left: 2,
    instructions: 'Dietary supplement maintenance dose.',
    status: 'Active',
  },
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

  // Extend session on active use
  session.expires_at = Date.now() + 24 * 60 * 60 * 1000;
  // Attach authenticated patient_id strictly from the session token!
  (req as any).authenticatedPatientId = session.patient_id;
  next();
}

// ==========================================
// API ROUTES
// ==========================================

// 1. Patient Login (Requirements: accept app_users.username as patient ID, verify password hash, retrieve silver_patients)
app.post('/api/auth/patient/login', async (req: Request, res: Response) => {
  const patientIdInput = req.body.patientId || req.body.username;
  const password = req.body.password;

  if (!patientIdInput || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide both Patient ID and password.',
    });
  }

  const rawInput = String(patientIdInput).trim();

  // Validate that an email was not passed into the patient username field
  if (rawInput.includes('@')) {
    return res.status(400).json({
      success: false,
      message: 'Demo accounts use Patient IDs (e.g. P182162) as usernames. Please sign in with your Patient ID rather than an email address.',
    });
  }

  const cleanUsername = rawInput.toUpperCase();

  // --- LIVE MYSQL INTEGRATION ---
  if (hasMySQLCredentials) {
    if (!mysqlPool || !isLiveMySQL) {
      return res.status(503).json({
        success: false,
        errorType: 'DATABASE_UNAVAILABLE',
        message: `Database connection error: Unable to connect to MySQL hospital_db (${dbConnectionError || 'connection offline'}). Please verify database status and network connectivity.`,
      });
    }

    try {
      // Query app_users accepting username as patient ID
      const [rows]: any = await mysqlPool.query(
        `SELECT 
          id, 
          username, 
          patient_id, 
          password_hash, 
          salt, 
          role, 
          status, 
          is_active, 
          must_change_password 
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

      // Check active account status
      if (user.status && user.status.toLowerCase() !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'This patient account is currently inactive. Please contact patient services.',
        });
      }
      if (user.is_active !== undefined && (user.is_active === 0 || user.is_active === false)) {
        return res.status(403).json({
          success: false,
          message: 'This patient account is disabled. Please contact patient services.',
        });
      }

      // Verify password against stored password hash (never plaintext!)
      const isPasswordValid = verifyPassword(password, user.password_hash, user.salt);
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

      // Query silver_patients using authenticated patient_id
      const [patientRows]: any = await mysqlPool.query(
        'SELECT * FROM silver_patients WHERE patient_id = ? LIMIT 1',
        [resolvedPatientId]
      );

      const patientProfile = patientRows?.[0] || null;

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
      });
    } catch (err: any) {
      console.error('MySQL database error during login:', err);
      return res.status(503).json({
        success: false,
        errorType: 'DATABASE_UNAVAILABLE',
        message: `Database connection error: ${err.message || 'Unable to communicate with MySQL hospital_db'}.`,
      });
    }
  }

  // --- PROTOTYPE MEDALLION ENGINE (When MySQL credentials not in environment) ---
  const user = APP_USERS[cleanUsername] || APP_USERS[rawInput];
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Patient account not found. Please verify your Patient ID.',
    });
  }

  // Check active status
  if (user.status !== 'active' || user.is_active === 0) {
    return res.status(403).json({
      success: false,
      message: 'This patient account is inactive. Please contact patient services.',
    });
  }

  // Verify password
  const isPasswordValid = verifyPassword(password, user.password_hash, user.salt);
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
  const patientProfile = SILVER_PATIENTS[cleanUsername] || {
    patient_id: cleanUsername,
    first_name: 'Patient',
    last_name: cleanUsername,
    email: `${cleanUsername.toLowerCase()}@patient.mediai.health`,
    phone: '+1 (555) 000-0000',
    date_of_birth: '1990-01-01',
    gender: 'Not specified',
    blood_group: 'O+',
  };

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
  });
});

// 2. Change Password Endpoint (Requirement 9: must_change_password flow)
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
  if (hasMySQLCredentials && mysqlPool) {
    try {
      const [rows]: any = await mysqlPool.query(
        'SELECT id, username, patient_id, password_hash, salt FROM app_users WHERE (username = ? OR patient_id = ?) LIMIT 1',
        [cleanUsername, cleanUsername]
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Patient account not found.' });
      }

      const user = rows[0];
      const isCurrentValid = verifyPassword(currentPassword, user.password_hash, user.salt);
      if (!isCurrentValid) {
        return res.status(401).json({ success: false, message: 'Current password verification failed.' });
      }

      // Hash new password using bcrypt
      const newHash = bcrypt.hashSync(newPassword, 10);

      // Update app_users
      await mysqlPool.query(
        'UPDATE app_users SET password_hash = ?, must_change_password = 0, updated_at = NOW() WHERE (username = ? OR patient_id = ?)',
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
        message: 'Password updated successfully.',
        token,
      });
    } catch (err: any) {
      console.error('MySQL change password error:', err);
      return res.status(503).json({
        success: false,
        errorType: 'DATABASE_UNAVAILABLE',
        message: 'Database connection error during password update.',
      });
    }
  }

  // --- PROTOTYPE STORE ---
  const user = APP_USERS[cleanUsername];
  if (!user) {
    return res.status(404).json({ success: false, message: 'Patient account not found.' });
  }

  const isCurrentValid = verifyPassword(currentPassword, user.password_hash, user.salt);
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
  });
});

// 3. Validate Session / Current User
app.get('/api/auth/verify', authenticatePatientToken, (req: Request, res: Response) => {
  const patientId = (req as any).authenticatedPatientId;
  const profile = SILVER_PATIENTS[patientId];

  if (!profile) {
    return res.status(404).json({ success: false, message: 'Patient profile not found.' });
  }

  return res.json({
    success: true,
    patient: profile,
    isLiveMySQL,
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

// 5. Patient Dashboard Data (Requirement: restricted to authenticated patient ID)
app.get('/api/patient/dashboard', authenticatePatientToken, async (req: Request, res: Response) => {
  const patientId = (req as any).authenticatedPatientId;

  // --- LIVE MYSQL ---
  if (hasMySQLCredentials && mysqlPool) {
    try {
      const [patientRows]: any = await mysqlPool.query(
        'SELECT * FROM silver_patients WHERE patient_id = ? LIMIT 1',
        [patientId]
      );

      const patient = patientRows?.[0] || SILVER_PATIENTS[patientId];

      const [aptRows]: any = await mysqlPool.query(
        'SELECT * FROM silver_appointments WHERE patient_id = ? AND status != "Cancelled" ORDER BY appointment_date ASC',
        [patientId]
      );

      const [encRows]: any = await mysqlPool.query(
        'SELECT * FROM silver_encounters WHERE patient_id = ? ORDER BY encounter_date DESC',
        [patientId]
      );

      const [labRows]: any = await mysqlPool.query(
        'SELECT * FROM silver_lab_results WHERE patient_id = ? ORDER BY result_date DESC',
        [patientId]
      );

      const [rxRows]: any = await mysqlPool.query(
        'SELECT * FROM silver_prescriptions WHERE patient_id = ? ORDER BY prescribed_date DESC',
        [patientId]
      );

      return res.json({
        success: true,
        data: {
          patient,
          upcomingAppointments: aptRows || [],
          completedEncounters: encRows || [],
          labReports: labRows || [],
          prescriptions: rxRows || [],
          notifications: NOTIFICATIONS[patientId] || [],
          backendStatus: {
            isLiveMySQL: true,
            engine: 'MySQL hospital_db (Connected)',
            schema: 'hospital_db (Medallion Silver)',
          },
        },
      });
    } catch (err: any) {
      console.error('MySQL query error on dashboard:', err);
      // Fall through to prototype store if live query failed
    }
  }

  // --- PROTOTYPE STORE ---
  const patient = SILVER_PATIENTS[patientId];
  if (!patient) {
    return res.status(404).json({ success: false, message: 'Patient record not found.' });
  }

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

  const patientNotifications = NOTIFICATIONS[patientId] || [
    {
      id: 'NOTIF-GEN',
      title: 'Welcome to MediAI Patient Portal',
      message: 'Access your appointments, prescriptions, and clinical history in one secure place.',
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
      notifications: patientNotifications,
      backendStatus: {
        isLiveMySQL: false,
        engine: 'Medallion Silver Schema (Prototype Engine)',
        schema: 'hospital_db (Medallion Silver)',
      },
    },
  });
});

// 6. Booking Wizard: Branches
app.get('/api/booking/branches', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    branches: HOSPITAL_BRANCHES,
  });
});

// 7. Booking Wizard: Specialties
app.get('/api/booking/specialties', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    specialties: MEDICAL_SPECIALTIES,
  });
});

// 8. Booking Wizard: Doctors (filtered by branch and specialty)
app.get('/api/booking/doctors', (req: Request, res: Response) => {
  const { branchId, specialty } = req.query;

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
  });
});

// 9. Booking Wizard: Doctor Availability Slots (prevent double-booking)
app.get('/api/booking/availability', (req: Request, res: Response) => {
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
  });
});

// 10. Booking Wizard: Create Appointment (Secured with conflict validation)
app.post('/api/booking/create', authenticatePatientToken, (req: Request, res: Response) => {
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
    appointment_id: `APT-${Math.floor(10000 + Math.random() * 90000)}`,
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
  });
});

// 11. Cancel Appointment
app.post('/api/booking/cancel', authenticatePatientToken, (req: Request, res: Response) => {
  const patientId = (req as any).authenticatedPatientId;
  const { appointmentId } = req.body;

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
