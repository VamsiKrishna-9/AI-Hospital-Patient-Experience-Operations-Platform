/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PatientProfile {
  patient_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  blood_group?: string;
  emergency_contact?: string;
  address?: string;
  primary_doctor_id?: string;
  primary_doctor_name?: string;
}

export interface DoctorInfo {
  doctor_id: string;
  name: string;
  specialty: string;
  qualification: string;
  experience_years: number;
  branch_id: string;
  branch_name: string;
  consultation_fee: number;
  rating?: number; // Average from silver_feedback if available
  rating_count?: number;
  avatar_url?: string;
}

export interface HospitalBranch {
  branch_id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  working_hours: string;
}

export interface AppointmentRecord {
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name: string;
  specialty: string;
  branch_id: string;
  branch_name: string;
  appointment_date: string;
  appointment_time: string;
  status: 'Confirmed' | 'Scheduled' | 'Completed' | 'Cancelled';
  reason?: string;
  created_at: string;
}

export interface EncounterRecord {
  encounter_id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name: string;
  specialty: string;
  encounter_date: string;
  visit_type: string;
  diagnosis: string;
  clinical_notes: string;
  follow_up_date?: string;
}

export interface LabResultRecord {
  lab_id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name: string;
  test_name: string;
  category: string;
  collected_date: string;
  result_date: string;
  status: 'Ready' | 'Normal' | 'Abnormal' | 'Pending Review';
  value: string;
  reference_range: string;
  flag?: 'Normal' | 'High' | 'Low' | 'Critical';
  summary?: string;
}

export interface PrescriptionRecord {
  prescription_id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  prescribed_date: string;
  refills_left: number;
  instructions: string;
  status: 'Active' | 'Completed' | 'Discontinued';
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'appointment' | 'lab' | 'prescription' | 'general';
  read: boolean;
}

export interface PatientDashboardData {
  patient: PatientProfile;
  upcomingAppointments: AppointmentRecord[];
  completedEncounters: EncounterRecord[];
  labReports: LabResultRecord[];
  prescriptions: PrescriptionRecord[];
  notifications: NotificationItem[];
  backendStatus: {
    isLiveMySQL: boolean;
    engine: string;
    schema: 'hospital_db (Medallion Silver)';
  };
}

export interface BookingWizardState {
  step: number; // 1 to 7
  branchId: string;
  branchName: string;
  specialty: string;
  doctor: DoctorInfo | null;
  date: string;
  timeSlot: string;
  reason: string;
}
