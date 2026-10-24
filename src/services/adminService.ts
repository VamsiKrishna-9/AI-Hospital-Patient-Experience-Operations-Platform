/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HospitalRole } from '../types/auth';

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

  async fetchUsers(): Promise<{ success: boolean; users: AdminUserRecord[]; message?: string }> {
    try {
      const res = await fetch('/api/admin/users', {
        headers: this.getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          users: [],
          message: data.message || 'Failed to retrieve user accounts directory.',
        };
      }
      return {
        success: true,
        users: data.users || [],
      };
    } catch (err: any) {
      return {
        success: false,
        users: [],
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
}

export const adminService = new AdminService();
