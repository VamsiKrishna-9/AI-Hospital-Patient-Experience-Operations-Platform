/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  PatientDashboardData,
  HospitalBranch,
  DoctorInfo,
  AppointmentRecord,
  FeedbackRecord,
} from '../types/patient';

const TOKEN_KEY = 'mediai_patient_auth_token';
const CURRENT_PATIENT_KEY = 'mediai_current_patient_id';

class PatientService {
  private getToken(): string | null {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  public setSession(token: string, patientId: string): void {
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(CURRENT_PATIENT_KEY, patientId);
    } catch (e) {
      console.error('Session storage failed', e);
    }
  }

  public clearSession(): void {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(CURRENT_PATIENT_KEY);
    } catch (e) {
      console.error('Session clearance failed', e);
    }
  }

  public getSavedPatientId(): string | null {
    try {
      return sessionStorage.getItem(CURRENT_PATIENT_KEY);
    } catch {
      return null;
    }
  }

  public isAuthenticated(): boolean {
    return Boolean(this.getToken());
  }

  private getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /**
   * Authenticate patient using Patient ID / username and password
   */
  public async login(
    patientId: string,
    password: string
  ): Promise<{
    success: boolean;
    message: string;
    patient?: any;
    patientId?: string;
    token?: string;
    mustChangePassword?: boolean;
    tempToken?: string;
    errorType?: string;
  }> {
    try {
      const res = await fetch('/api/auth/patient/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, password }),
      });

      const data = await res.json().catch(() => ({}));

      // Check for forced password change policy
      if (res.ok && data.success && data.mustChangePassword) {
        return {
          success: true,
          mustChangePassword: true,
          tempToken: data.tempToken,
          patientId: data.patientId || patientId,
          patient: data.patient,
          message: data.message || 'Password update required.',
        };
      }

      if (res.ok && data.success && data.token) {
        this.setSession(data.token, data.patient?.patient_id || patientId);
        return {
          success: true,
          message: data.message || 'Login successful',
          patient: data.patient,
          token: data.token,
        };
      }

      // If backend reports explicit database or connection error
      if (data.errorType === 'DATABASE_UNAVAILABLE' || data.errorType === 'DATABASE_NOT_CONFIGURED' || res.status === 503) {
        return {
          success: false,
          errorType: 'DATABASE_NOT_CONFIGURED',
          message: data.message || 'Database not configured. Connect Supabase to load this information.',
        };
      }

      return {
        success: false,
        errorType: data.errorType,
        message: data.message || 'Authentication failed. Please verify your credentials.',
      };
    } catch (err) {
      return {
        success: false,
        errorType: 'NETWORK_ERROR',
        message: 'Backend connection error: The MediAI hospital server is currently unreachable. Please check backend connectivity.',
      };
    }
  }

  /**
   * Change patient password
   */
  public async changePassword(payload: {
    patientId: string;
    currentPassword: string;
    newPassword: string;
    tempToken?: string;
  }): Promise<{ success: boolean; message: string; token?: string }> {
    try {
      const res = await fetch('/api/auth/patient/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.token) {
        this.setSession(data.token, payload.patientId);
        return {
          success: true,
          message: data.message || 'Password updated successfully.',
          token: data.token,
        };
      }
      return {
        success: false,
        message: data.message || 'Failed to update password. Please check your credentials.',
      };
    } catch {
      return {
        success: false,
        message: 'Network error connecting to hospital authentication service.',
      };
    }
  }

  /**
   * Logout patient
   */
  public async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });
    } catch {
      // Ignore network errors on logout
    } finally {
      this.clearSession();
    }
  }

  /**
   * Fetch authenticated patient dashboard records
   */
  public async getDashboardData(): Promise<{
    success: boolean;
    data?: PatientDashboardData;
    message?: string;
  }> {
    try {
      const res = await fetch('/api/patient/dashboard', {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (res.status === 401) {
        this.clearSession();
        return {
          success: false,
          message: 'Your session has expired. Please sign in again.',
        };
      }

      const json = await res.json();
      if (res.ok && json.success) {
        return {
          success: true,
          data: json.data,
        };
      }
      return {
        success: false,
        message: json.message || 'Failed to retrieve patient dashboard.',
      };
    } catch (err) {
      return {
        success: false,
        message: 'Network error communicating with hospital services.',
      };
    }
  }

  /**
   * Get hospital branches
   */
  public async getBranches(): Promise<HospitalBranch[]> {
    try {
      const res = await fetch('/api/booking/branches');
      const data = await res.json();
      return data.branches || [];
    } catch {
      return [];
    }
  }

  /**
   * Get medical specialties
   */
  public async getSpecialties(): Promise<string[]> {
    try {
      const res = await fetch('/api/booking/specialties');
      const data = await res.json();
      return data.specialties || [];
    } catch {
      return [];
    }
  }

  /**
   * Search doctors by branch & specialty
   */
  public async getDoctors(branchId?: string, specialty?: string): Promise<DoctorInfo[]> {
    try {
      const params = new URLSearchParams();
      if (branchId) {
        params.append('branch', branchId);
        params.append('branchId', branchId);
      }
      if (specialty) params.append('specialty', specialty);

      const res = await fetch(`/api/booking/doctors?${params.toString()}`);
      const data = await res.json();
      return data.doctors || [];
    } catch {
      return [];
    }
  }

  /**
   * Check real-time doctor availability slots
   */
  public async getAvailability(
    doctorId: string,
    date: string
  ): Promise<{ time: string; isAvailable: boolean }[]> {
    try {
      const res = await fetch(
        `/api/booking/availability?doctorId=${encodeURIComponent(doctorId)}&date=${encodeURIComponent(date)}`
      );
      const data = await res.json();
      return (data.slots || []).map((s: any) => ({
        time: s.time,
        isAvailable: Boolean(s.isAvailable ?? s.available),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Book appointment
   * Uses canonical appointmentDate, appointmentTime, and appointmentType with backwards-compatible aliases
   */
  public async bookAppointment(payload: {
    doctorId?: string;
    doctor_id?: string;
    branchId?: string;
    date?: string;
    timeSlot?: string;
    appointmentDate?: string;
    appointmentTime?: string;
    appointmentType?: string;
    consultationType?: string;
    departmentName?: string;
    department_name?: string;
    bookingChannel?: string;
    priority?: string;
    reason?: string;
    symptoms?: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string; appointment?: AppointmentRecord }> {
    try {
      const canonicalDate = payload.appointmentDate || payload.date;
      const canonicalTime = payload.appointmentTime || payload.timeSlot;
      const canonicalDoctorId = payload.doctorId || payload.doctor_id;
      const canonicalType = payload.appointmentType || payload.consultationType || 'In-Person';

      const bodyPayload = {
        doctorId: canonicalDoctorId,
        appointmentDate: canonicalDate,
        appointmentTime: canonicalTime,
        appointmentType: canonicalType,
        consultationType: canonicalType,
        departmentName: payload.departmentName || payload.department_name || null,
        department_name: payload.departmentName || payload.department_name || null,
        bookingChannel: payload.bookingChannel || 'Online Portal',
        priority: payload.priority || 'Normal',
        reason: payload.reason || null,
        symptoms: payload.symptoms || null,
        notes: payload.notes || null,
        // Legacy aliases for backward compatibility
        date: canonicalDate,
        timeSlot: canonicalTime,
        doctor_id: canonicalDoctorId,
      };

      const res = await fetch('/api/booking/create', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json().catch(() => ({}));
      return {
        success: res.ok && data.success,
        message: data.message || (res.ok ? 'Appointment scheduled successfully.' : 'Appointment booking failed.'),
        appointment: data.appointment,
      };
    } catch {
      return {
        success: false,
        message: 'Network error booking appointment.',
      };
    }
  }

  /**
   * Cancel an appointment
   */
  public async cancelAppointment(appointmentId: string): Promise<boolean> {
    try {
      const res = await fetch('/api/booking/cancel', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ appointmentId }),
      });
      const data = await res.json();
      return Boolean(res.ok && data.success);
    } catch {
      return false;
    }
  }

  /**
   * Submit patient care feedback (stores into silver_feedback)
   * Supports canonical source columns (waiting_time_rating, staff_rating, doctor_rating, appointment_id) and legacy aliases
   */
  public async submitFeedback(payload: {
    appointmentId?: string;
    appointment_id?: string;
    encounterId?: string;
    encounter_id?: string;
    doctorId?: string;
    doctor_id?: string;
    rating: number;
    doctorRating?: number;
    doctor_rating?: number;
    staffRating?: number;
    staff_rating?: number;
    staffBehaviorRating?: number;
    waitingTimeRating?: number;
    waiting_time_rating?: number;
    waitRating?: number;
    facilityRating?: number;
    facility_rating?: number;
    cleanlinessRating?: number;
    cleanliness_rating?: number;
    communicationRating?: number;
    communication_rating?: number;
    comments: string;
    feedbackChannel?: string;
    feedback_channel?: string;
  }): Promise<{ success: boolean; message: string; feedback?: FeedbackRecord }> {
    try {
      const canonicalDoctorId = payload.doctorId || payload.doctor_id;
      const canonicalAppointmentId = payload.appointmentId || payload.appointment_id;
      const canonicalEncounterId = payload.encounterId || payload.encounter_id;
      const resolvedDoctorRating = payload.doctorRating ?? payload.doctor_rating;
      const resolvedStaffRating = payload.staffRating ?? payload.staff_rating ?? payload.staffBehaviorRating;
      const resolvedWaitRating = payload.waitingTimeRating ?? payload.waiting_time_rating ?? payload.waitRating;
      const resolvedFacilityRating = payload.facilityRating ?? payload.facility_rating;
      const resolvedCleanlinessRating = payload.cleanlinessRating ?? payload.cleanliness_rating;
      const resolvedCommRating = payload.communicationRating ?? payload.communication_rating;
      const resolvedChannel = payload.feedbackChannel || payload.feedback_channel || 'Online Portal';

      const bodyPayload = {
        doctorId: canonicalDoctorId,
        doctor_id: canonicalDoctorId,
        appointmentId: canonicalAppointmentId,
        appointment_id: canonicalAppointmentId,
        encounterId: canonicalEncounterId,
        encounter_id: canonicalEncounterId,
        rating: payload.rating,
        doctorRating: resolvedDoctorRating,
        doctor_rating: resolvedDoctorRating,
        staffRating: resolvedStaffRating,
        staff_rating: resolvedStaffRating,
        staff_behavior_rating: resolvedStaffRating,
        waitingTimeRating: resolvedWaitRating,
        waiting_time_rating: resolvedWaitRating,
        waitRating: resolvedWaitRating,
        wait_time_rating: resolvedWaitRating,
        facilityRating: resolvedFacilityRating,
        facility_rating: resolvedFacilityRating,
        cleanlinessRating: resolvedCleanlinessRating,
        cleanliness_rating: resolvedCleanlinessRating,
        communicationRating: resolvedCommRating,
        communication_rating: resolvedCommRating,
        comments: payload.comments,
        feedbackChannel: resolvedChannel,
        feedback_channel: resolvedChannel,
      };

      const res = await fetch('/api/patient/feedback', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();
      return {
        success: res.ok && data.success,
        message: data.message || 'Feedback submitted.',
        feedback: data.feedback,
      };
    } catch {
      return {
        success: false,
        message: 'Network error submitting feedback.',
      };
    }
  }
}

export const patientService = new PatientService();
