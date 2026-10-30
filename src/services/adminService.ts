/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HospitalRole } from '../types/auth';

export type EmployeeMappingStatus = 'Linked' | 'Unlinked' | 'Needs Review' | 'Administrator' | 'Patient';

export interface EmployeeAssignmentDetail {
  assignmentId: string;
  assignmentType: string;
  startTime?: string;
  endTime?: string;
  dutyStatus: string;
  priority?: string;
  notes?: string;
  counterpartId?: string;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  fullName: string;
  role: HospitalRole;
  patient_id?: string;
  doctor_id?: string;
  staff_id?: string;
  specialty?: string;
  department?: string;
  phone?: string;
  date_of_birth?: string;
  is_active: boolean;
  created_at: string;
  source?: string;

  // Account-to-Employee Mapping Fields
  mappingStatus?: EmployeeMappingStatus;
  mappingNote?: string;
  employeeId?: string;
  employeeName?: string;
  qualification?: string;
  hospitalBranch?: string;
  shiftName?: string;
  shiftSchedule?: string;
  dutyStatus?: string;
  assignments?: EmployeeAssignmentDetail[];
  assignmentCount?: number;
}

export interface AdminAuditLog {
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

export interface AdminDashboardDateStats {
  selectedDate: string;
  timezone: string;
  kpis: {
    patientVisits: number;
    doctorsOnDuty: number;
    staffPresent: number;
    totalAppointments: number;
  };
  appointmentStatusDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  appointmentsByDepartment: Array<{
    department: string;
    count: number;
    percentage: number;
  }>;
  dailyTrend: Array<{
    date: string;
    displayDate: string;
    dayOfWeek: string;
    visits: number;
    appointments: number;
  }>;
  encountersByType?: Array<{
    type: string;
    count: number;
  }>;
  meta: {
    hasData: boolean;
    latestRecordedDate?: string;
    dataSourceNotes: {
      patientVisits: string;
      doctorsOnDuty: string;
      staffPresent: string;
      totalAppointments: string;
    };
  };
}

class AdminService {
  private getAuthHeaders(): HeadersInit {
    const token =
      sessionStorage.getItem('mediai_patient_auth_token') ||
      localStorage.getItem('mediai_remembered_token') ||
      '';
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async fetchUsers(params?: {
    date?: string;
    department?: string;
    shift?: string;
    search?: string;
    status?: string;
  }): Promise<{
    success: boolean;
    users: AdminUserRecord[];
    availableDepartments: string[];
    availableShifts: string[];
    summary?: {
      totalUsers: number;
      doctorsCount: number;
      staffCount: number;
      patientsCount: number;
      adminsCount: number;
      linkedCount: number;
      unlinkedCount: number;
      needsReviewCount: number;
      onDutyOnSelectedDate: number;
      selectedDate: string;
      timezone: string;
      attendanceNote: string;
    };
    message?: string;
  }> {
    try {
      const q = new URLSearchParams();
      if (params?.date) q.append('date', params.date);
      if (params?.department && params.department !== 'all') q.append('department', params.department);
      if (params?.shift && params.shift !== 'all') q.append('shift', params.shift);
      if (params?.search && params.search.trim()) q.append('search', params.search.trim());
      if (params?.status && params.status !== 'all') q.append('status', params.status);

      const qs = q.toString();
      const url = qs ? `/api/admin/users?${qs}` : '/api/admin/users';
      const res = await fetch(url, {
        headers: this.getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          users: [],
          availableDepartments: [],
          availableShifts: [],
          message: data.message || 'Failed to retrieve user accounts directory.',
        };
      }
      return {
        success: true,
        users: data.users || [],
        availableDepartments: data.availableDepartments || [],
        availableShifts: data.availableShifts || [],
        summary: data.summary,
      };
    } catch (err: any) {
      return {
        success: false,
        users: [],
        availableDepartments: [],
        availableShifts: [],
        message: err.message || 'Network error fetching user accounts directory.',
      };
    }
  }

  async updateUserRole(params: {
    userId?: string;
    email?: string;
    newRole: HospitalRole;
    reason?: string;
  }): Promise<{ success: boolean; message: string; user?: any; auditEntry?: AdminAuditLog }> {
    try {
      const res = await fetch('/api/admin/users/update-role', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(params),
      });
      const data = await res.json();
      return {
        success: data.success ?? false,
        message: data.message || (data.success ? 'Role updated successfully' : 'Failed to update role'),
        user: data.user,
        auditEntry: data.auditEntry,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Network error updating user role.',
      };
    }
  }

  async fetchAuditLogs(): Promise<{ success: boolean; auditLogs: AdminAuditLog[]; message?: string }> {
    try {
      const res = await fetch('/api/admin/audit-logs', {
        headers: this.getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          auditLogs: [],
          message: data.message || 'Failed to retrieve executive audit logs.',
        };
      }
      return {
        success: true,
        auditLogs: data.auditLogs || [],
      };
    } catch (err: any) {
      return {
        success: false,
        auditLogs: [],
        message: err.message || 'Network error fetching audit logs.',
      };
    }
  }

  async fetchDashboardStats(date?: string): Promise<{
    success: boolean;
    data?: AdminDashboardDateStats;
    message?: string;
  }> {
    try {
      const url = date ? `/api/admin/dashboard-stats?date=${encodeURIComponent(date)}` : '/api/admin/dashboard-stats';
      const res = await fetch(url, {
        headers: this.getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'Failed to retrieve date-filtered dashboard statistics.',
        };
      }
      return {
        success: true,
        data,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Network error fetching date-filtered dashboard statistics.',
      };
    }
  }

  async fetchDateRoster(
    date?: string,
    department?: string,
    search?: string
  ): Promise<{
    success: boolean;
    data?: AdminDateRosterResponse;
    message?: string;
  }> {
    try {
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (department && department !== 'all') params.append('department', department);
      if (search && search.trim()) params.append('search', search.trim());

      const qs = params.toString();
      const url = qs ? `/api/admin/roster?${qs}` : '/api/admin/roster';
      const res = await fetch(url, {
        headers: this.getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'Failed to retrieve date-filtered workforce roster.',
        };
      }
      return {
        success: true,
        data,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Network error fetching date-filtered workforce roster.',
      };
    }
  }

  async fetchFeedbackAnalytics(params?: {
    date?: string;
    rating?: string;
    category?: string;
    search?: string;
    sortBy?: string;
  }): Promise<{
    success: boolean;
    data?: AdminFeedbackAnalyticsResponse;
    message?: string;
  }> {
    try {
      const q = new URLSearchParams();
      if (params?.date) q.append('date', params.date);
      if (params?.rating && params.rating !== 'all') q.append('rating', params.rating);
      if (params?.category && params.category !== 'all') q.append('category', params.category);
      if (params?.search && params.search.trim()) q.append('search', params.search.trim());
      if (params?.sortBy) q.append('sortBy', params.sortBy);

      const qs = q.toString();
      const url = qs ? `/api/admin/feedback-analytics?${qs}` : '/api/admin/feedback-analytics';
      const res = await fetch(url, {
        headers: this.getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'Failed to retrieve patient feedback analytics.',
        };
      }
      return {
        success: true,
        data,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Network error fetching patient feedback analytics.',
      };
    }
  }
}

export interface FeedbackItem {
  id: string;
  feedbackId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  category: string;
  department: string;
  rating: number;
  waitTimeRating?: number | null;
  cleanlinessRating?: number | null;
  staffBehaviorRating?: number | null;
  comments: string;
  feedbackDate: string;
  submittedAt: string;
}

export interface FeedbackAnalyticsMetrics {
  dailyFeedbackCount: number;
  dailyAverageRating: number | null;
  dailyRatingCount: number;
  overallFeedbackCount: number;
  overallAverageRating: number;
  overallRatingCount: number;
  ratingScale: {
    min: number;
    max: number;
  };
}

export interface AdminFeedbackAnalyticsResponse {
  success: boolean;
  selectedDate: string;
  timezone: string;
  metrics: FeedbackAnalyticsMetrics;
  feedbackList: FeedbackItem[];
  totalDailyItems: number;
  filteredCount: number;
  categories: string[];
  message?: string;
}

export interface RosterDoctorItem {
  id: string;
  name: string;
  specialization: string;
  department: string;
  hospitalBranch?: string | null;
  shift: string;
  shiftStart?: string;
  shiftEnd?: string;
  dutyStatus: string;
  consultationCount: number;
  assignmentCount: number;
  consultationTypes: string[];
  assignmentTypes: string[];
  source: string;
}

export interface RosterStaffItem {
  assignmentId: string;
  id: string;
  name: string;
  role: string;
  department: string;
  shift: string;
  shiftType: string;
  shiftStart?: string;
  shiftEnd?: string;
  dutyStatus: string;
  assignmentType: string;
  priority: string;
  notes: string;
  assignedDoctorId?: string;
}

export interface AdminDateRosterResponse {
  success: boolean;
  selectedDate: string;
  timezone: string;
  summary: {
    totalDoctorsScheduled: number;
    totalStaffScheduled: number;
    totalWorkforce: number;
    filteredDoctorsCount: number;
    filteredStaffCount: number;
    actualAttendanceVerified: boolean;
    attendanceNote: string;
  };
  doctors: RosterDoctorItem[];
  staff: RosterStaffItem[];
  departments: string[];
  message?: string;
}

export const adminService = new AdminService();
