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
  doctor_name: string;
  name: string;
  department_id?: string;
  department_name?: string;
  specialization: string;
  specialty: string;
  qualification: string;
  experience_years: number;
  city?: string;
  employment_type?: string;
  availability?: string;
  availability_schedule?: string;
  joining_date?: string;
  phone_number?: string;
  email?: string;
  hospital_branch?: string;
  branch_id?: string;
  branch_name?: string;
  consultation_fee?: number;
  rating?: number;
  rating_count?: number;
  avatar_url?: string;
  is_active?: boolean;
  user_id?: string | null;
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
  hospital_branch?: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type?: string;
  consultation_type?: string;
  booking_channel?: string;
  priority?: string;
  status: 'Confirmed' | 'Scheduled' | 'Completed' | 'Cancelled' | 'No Show' | string;
  wait_time_minutes?: number;
  consultation_duration_minutes?: number;
  consultation_fee?: number;
  payment_status?: string;
  cancellation_reason?: string;
  reason?: string;
  symptoms?: string;
  notes?: string;
  created_at?: string;
}

// Authoritative Schema: silver_encounters
// encounter_id, patient_id, doctor_id, department_id, department_name, encounter_date, symptoms, primary_diagnosis, treatment_type, treatment_outcome, appointment_type, encounter_mode, wait_time_minutes, consultation_duration_minutes
// CRITICAL: appointment_id is NOT in canonical source MySQL schema, and is strictly optional/nullable in Supabase
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
  chief_complaint?: string;
  primary_diagnosis?: string;
  diagnosis?: string;
  treatment_type?: string;
  treatment_outcome?: string;
  appointment_type?: string;
  visit_type?: string;
  encounter_type?: string;
  encounter_mode?: string;
  wait_time_minutes?: number;
  consultation_duration_minutes?: number;
  appointment_id?: string | null;
  clinical_notes?: string;
  treatment_plan?: string;
  notes?: string;
  follow_up_date?: string;
}

// Authoritative Schema: silver_lab_results
// lab_id, patient_id, encounter_id, test_name, test_category, test_date, result_value, unit, reference_range, status
export interface LabResultRecord {
  lab_id: string;
  patient_id: string;
  encounter_id?: string | null;
  doctor_id?: string;
  doctor_name?: string;
  test_name: string;
  test_category?: string;
  category?: string;
  test_date: string;
  collected_date?: string;
  result_date?: string;
  result_value?: string;
  test_value?: string;
  value?: string;
  unit?: string;
  reference_range?: string;
  status: 'Ready' | 'Normal' | 'Abnormal' | 'Pending Review' | 'Completed' | 'Pending' | string;
  flag?: 'Normal' | 'High' | 'Low' | 'Critical';
  summary?: string;
  notes?: string;
}

// Authoritative Schema: silver_prescriptions
// prescription_id, patient_id, encounter_id, prescription_date, medicine_name, medicine_category, dosage, frequency, duration_days, route, quantity, refill_allowed, prescription_status
export interface PrescriptionRecord {
  prescription_id: string;
  patient_id: string;
  encounter_id?: string | null;
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
  appointment_id?: string | null;
  encounter_id?: string | null;
  doctor_id?: string;
  doctor_name?: string;
  feedback_date: string;
  rating: number; // 1-5 overall
  doctor_rating?: number;
  staff_rating?: number;
  staff_behavior_rating?: number;
  waiting_time_rating?: number;
  wait_time_rating?: number;
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
  assignedStaff?: StaffAssignmentRecord[];
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

// Authoritative Schema: silver_staff
// staff_id, staff_name, staff_type, role, department_name, ward_id, shift_type, shift_start, shift_end, employment_type, experience_years, status, joining_date
// Persistent application extensions: user_id, hospital_branch, contact_number, email, is_active
export interface StaffInfo {
  staff_id: string;
  user_id?: string | null;
  staff_name: string;
  staff_type?: string;
  role: string;
  department_name?: string;
  department?: string;
  ward_id?: string | null;
  shift_type?: string | null;
  shift_start?: string | null;
  shift_end?: string | null;
  shift?: string | null;
  employment_type?: string;
  experience_years?: number;
  status?: string;
  joining_date?: string;
  hospital_branch?: string | null;
  contact_number?: string | null;
  email?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Authoritative Schema: silver_staff_assignment (EXACTLY 14 columns in canonical order)
// 1. assignment_id
// 2. staff_id
// 3. patient_id
// 4. doctor_id
// 5. encounter_id
// 6. appointment_id
// 7. assignment_type
// 8. assignment_date
// 9. start_time
// 10. end_time
// 11. priority
// 12. assignment_status
// 13. assigned_by
// 14. notes
export interface StaffAssignmentRecord {
  assignment_id: string;
  staff_id: string;
  patient_id?: string | null;
  doctor_id?: string | null;
  encounter_id?: string | null;
  appointment_id?: string | null;
  assignment_type: string;
  assignment_date: string;
  start_time?: string | null;
  end_time?: string | null;
  priority?: 'Low' | 'Normal' | 'High' | 'Urgent' | 'Critical' | string;
  assignment_status: 'Scheduled' | 'Active' | 'In Progress' | 'Completed' | 'Cancelled' | 'Reassigned' | string;
  assigned_by?: string | null;
  notes?: string | null;
  // Enriched presentation fields
  staff_name?: string;
  staff_role?: string;
  department?: string;
  patient_name?: string;
  patient_age?: number;
  patient_gender?: string;
  doctor_name?: string;
}


