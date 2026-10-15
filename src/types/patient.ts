/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Authoritative Schema: silver_patients
// patient_id, name, date_of_birth, age, gender, city, state, socioeconomic_status, occupation, registration_date, phone_number, email
export interface PatientProfile {
  patient_id: string;
  name?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  phone_number?: string;
  date_of_birth: string;
  age?: number;
  gender: string;
  city?: string;
  state?: string;
  socioeconomic_status?: string;
  occupation?: string;
  registration_date?: string;
  blood_group?: string;
  emergency_contact?: string;
  address?: string;
  primary_doctor_id?: string;
  primary_doctor_name?: string;
}

// Authoritative Schema: silver_doctors
// doctor_id, doctor_name, department_id, department_name, specialization, qualification, experience_years, city, employment_type, availability, joining_date, phone_number, email
export interface DoctorInfo {
  doctor_id: string;
  doctor_name?: string;
  name: string;
  department_id?: string;
  department_name?: string;
  specialization?: string;
  specialty: string;
  qualification: string;
  experience_years: number;
  city?: string;
  employment_type?: string;
  availability?: string;
  joining_date?: string;
  phone_number?: string;
  email?: string;
  branch_id?: string;
  branch_name?: string;
  consultation_fee?: number;
  rating?: number;
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

// Authoritative Schema: silver_appointments
// appointment_id, patient_id, doctor_id, appointment_date, appointment_time, appointment_type, department_name, booking_channel, priority, status, wait_time_minutes, consultation_duration_minutes
export interface AppointmentRecord {
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name?: string;
  department_name?: string;
  specialization?: string;
  specialty?: string;
  branch_id?: string;
  branch_name?: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type?: string;
  booking_channel?: string;
  priority?: string;
  status: 'Confirmed' | 'Scheduled' | 'Completed' | 'Cancelled' | string;
  wait_time_minutes?: number;
  consultation_duration_minutes?: number;
  reason?: string;
  created_at?: string;
}

// Authoritative Schema: silver_encounters
// encounter_id, patient_id, doctor_id, department_id, department_name, encounter_date, symptoms, primary_diagnosis, treatment_type, treatment_outcome, appointment_type, encounter_mode, wait_time_minutes, consultation_duration_minutes
export interface EncounterRecord {
  encounter_id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name?: string;
  department_id?: string;
  department_name?: string;
  specialization?: string;
  specialty?: string;
  encounter_date: string;
  symptoms?: string;
  primary_diagnosis?: string;
  diagnosis?: string;
  treatment_type?: string;
  treatment_outcome?: string;
  appointment_type?: string;
  visit_type?: string;
  encounter_mode?: string;
  wait_time_minutes?: number;
  consultation_duration_minutes?: number;
  clinical_notes?: string;
  follow_up_date?: string;
}

// Authoritative Schema: silver_lab_results
// lab_id, patient_id, encounter_id, test_name, test_category, test_date, result_value, unit, reference_range, status
export interface LabResultRecord {
  lab_id: string;
  patient_id: string;
  encounter_id?: string;
  doctor_id?: string;
  doctor_name?: string;
  test_name: string;
  test_category?: string;
  category?: string;
  test_date: string;
  collected_date?: string;
  result_date?: string;
  result_value?: string;
  value?: string;
  unit?: string;
  reference_range?: string;
  status: 'Ready' | 'Normal' | 'Abnormal' | 'Pending Review' | string;
  flag?: 'Normal' | 'High' | 'Low' | 'Critical';
  summary?: string;
}

// Authoritative Schema: silver_prescriptions
// prescription_id, patient_id, encounter_id, prescription_date, medicine_name, medicine_category, dosage, frequency, duration_days, route, quantity, refill_allowed, prescription_status
export interface PrescriptionRecord {
  prescription_id: string;
  patient_id: string;
  encounter_id?: string;
  doctor_id?: string;
  doctor_name?: string;
  prescription_date: string;
  prescribed_date?: string;
  medicine_name: string;
  medication_name?: string;
  medicine_category?: string;
  dosage: string;
  frequency: string;
  duration_days?: number | string;
  duration?: string;
  route?: string;
  quantity?: number | string;
  refill_allowed?: number | boolean | string;
  refills_left?: number;
  prescription_status: 'Active' | 'Completed' | 'Discontinued' | string;
  status?: 'Active' | 'Completed' | 'Discontinued' | string;
  instructions?: string;
}

// Authoritative Schema: silver_feedback
// feedback_id, patient_id, appointment_id, encounter_id, doctor_id, feedback_date, rating, doctor_rating, staff_rating, waiting_time_rating, facility_rating, cleanliness_rating, communication_rating, comments, feedback_channel, sentiment, feedback_status, resolution_notes
export interface FeedbackRecord {
  feedback_id: string;
  patient_id: string;
  appointment_id?: string;
  encounter_id?: string;
  doctor_id?: string;
  doctor_name?: string;
  feedback_date: string;
  rating: number; // 1-5 overall
  doctor_rating?: number;
  staff_rating?: number;
  waiting_time_rating?: number;
  facility_rating?: number;
  cleanliness_rating?: number;
  communication_rating?: number;
  comments: string;
  feedback_channel?: string;
  sentiment?: 'Positive' | 'Neutral' | 'Negative' | string;
  feedback_status?: string;
  resolution_notes?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'appointment' | 'lab' | 'prescription' | 'feedback' | 'general';
  read: boolean;
}

export interface PatientDashboardData {
  patient: PatientProfile;
  upcomingAppointments: AppointmentRecord[];
  completedEncounters: EncounterRecord[];
  labReports: LabResultRecord[];
  prescriptions: PrescriptionRecord[];
  feedbackList: FeedbackRecord[];
  notifications: NotificationItem[];
  backendStatus?: {
    connected?: boolean;
    isLiveMySQL?: boolean;
    engine: string;
    schema: string;
    notice?: string;
    mode?: string;
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
