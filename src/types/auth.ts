/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type HospitalRole = 'patient' | 'doctor' | 'staff' | 'admin';

export type ScreenState = 'login' | 'signup' | 'forgot-password' | 'patient-dashboard' | 'change-password';

export interface RoleConfig {
  id: HospitalRole;
  title: string;
  subtitle: string;
  badge: string;
  accentColor: string; // Tailwind color class key
  iconName: string;
  description: string;
}

export interface LoginFormData {
  role: HospitalRole;
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface PatientSignupFormData {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export interface DoctorSignupFormData {
  fullName: string;
  email: string;
  phone: string;
  specialization: string;
  medicalRegNumber: string;
  hospitalInviteCode: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export interface StaffSignupFormData {
  fullName: string;
  email: string;
  phone: string;
  staffId: string;
  department: string;
  hospitalInviteCode: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export interface AdminSignupFormData {
  fullName: string;
  officialEmail: string;
  adminInviteCode: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export type SignupFormData = {
  role: HospitalRole;
} & (
  | ({ role: 'patient' } & PatientSignupFormData)
  | ({ role: 'doctor' } & DoctorSignupFormData)
  | ({ role: 'staff' } & StaffSignupFormData)
  | ({ role: 'admin' } & AdminSignupFormData)
);

export interface PasswordStrength {
  score: number; // 0 to 4
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  isDemoMode?: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    role: HospitalRole;
    patient_id?: string;
  };
  patientId?: string;
  requiresEmailConfirmation?: boolean;
  token?: string;
  errors?: Record<string, string>;
  targetEndpoint?: string;
}

/**
 * Medallion Architecture Bronze Layer Database schema references.
 * Preserves MySQL hospital_db bronze table specifications for future FastAPI backend.
 */
export interface BronzePatientRecord {
  patient_id?: string;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  password_hash?: string;
  source_system?: string;
  ingestion_timestamp?: string;
}

export interface BronzeDoctorRecord {
  doctor_id?: string;
  full_name: string;
  email: string;
  phone: string;
  specialization: string;
  medical_registration_number: string;
  hospital_invite_code: string;
  password_hash?: string;
  source_system?: string;
  ingestion_timestamp?: string;
}

export interface BronzeStaffRecord {
  staff_id: string;
  full_name: string;
  email: string;
  phone: string;
  department: string;
  hospital_invite_code: string;
  password_hash?: string;
  source_system?: string;
  ingestion_timestamp?: string;
}

export interface BronzeAdminRecord {
  admin_id?: string;
  full_name: string;
  official_email: string;
  invitation_code_hash: string;
  password_hash?: string;
  verified_at?: string;
  source_system?: string;
  ingestion_timestamp?: string;
}

/**
 * Hospital Medallion Architecture Bronze tables cataloged:
 * 1. bronze_patients
 * 2. bronze_doctors
 * 3. bronze_encounters
 * 4. bronze_feedback
 * 5. bronze_lab_results
 * 6. bronze_prescriptions
 * 7. bronze_staff
 * 8. bronze_staff_assignment
 * 9. bronze_appointments
 */
export const BRONZE_TABLES = [
  'bronze_patients',
  'bronze_doctors',
  'bronze_encounters',
  'bronze_feedback',
  'bronze_lab_results',
  'bronze_prescriptions',
  'bronze_staff',
  'bronze_staff_assignment',
  'bronze_appointments'
] as const;

/**
 * Authoritative Supabase Silver Identity Mapping: app_users
 * Linked 1:1 with auth.users(id) as primary key.
 */
export interface AppUser {
  id: string; // Linked directly to auth.users(id)
  patient_id?: string | null;
  doctor_id?: string | null;
  staff_id?: string | null;
  must_change_password: boolean;
  email: string;
  role: HospitalRole;
  full_name?: string | null;
  phone?: string | null;
  is_active: boolean;
  last_login?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const SILVER_TABLES = [
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
] as const;

