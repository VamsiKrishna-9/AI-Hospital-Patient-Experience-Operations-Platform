/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AuthResponse,
  HospitalRole,
  LoginFormData,
  SignupFormData,
} from '../types/auth';

class AuthService {
  private static readonly SESSION_USER_KEY = 'mediai_session_user';
  private static readonly TOKEN_KEY = 'mediai_patient_auth_token';
  private static readonly CURRENT_PATIENT_KEY = 'mediai_current_patient_id';

  /**
   * Safe storage helper - stores only remembered user identifier, NEVER plaintext passwords
   */
  public saveRememberedIdentity(role: HospitalRole, emailOrId: string): void {
    try {
      localStorage.setItem('mediai_remembered_identity', JSON.stringify({ role, email: emailOrId }));
    } catch {
      // Storage unavailable or disabled
    }
  }

  public getRememberedIdentity(): { role: HospitalRole; email: string } | null {
    try {
      const data = localStorage.getItem('mediai_remembered_identity');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  public clearRememberedIdentity(): void {
    try {
      localStorage.removeItem('mediai_remembered_identity');
    } catch {
      // Storage unavailable
    }
  }

  public saveSession(token: string, user: any): void {
    try {
      sessionStorage.setItem(AuthService.TOKEN_KEY, token);
      sessionStorage.setItem(AuthService.SESSION_USER_KEY, JSON.stringify(user));
      if (user?.patient_id) {
        sessionStorage.setItem(AuthService.CURRENT_PATIENT_KEY, user.patient_id);
      }
    } catch {
      // session storage disabled
    }
  }

  public getActiveUser(): any | null {
    try {
      const data = sessionStorage.getItem(AuthService.SESSION_USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  public getToken(): string | null {
    try {
      return sessionStorage.getItem(AuthService.TOKEN_KEY);
    } catch {
      return null;
    }
  }

  public clearSession(): void {
    try {
      sessionStorage.removeItem(AuthService.TOKEN_KEY);
      sessionStorage.removeItem(AuthService.SESSION_USER_KEY);
      sessionStorage.removeItem(AuthService.CURRENT_PATIENT_KEY);
    } catch {
      // storage unavailable
    }
  }

  /**
   * Common Unified Login for all 4 roles (Patient, Doctor, Staff, Admin)
   */
  public async commonLogin(params: {
    identifier: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<AuthResponse> {
    try {
      const response = await fetch('/api/auth/common-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: params.identifier,
          password: params.password,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        return {
          success: false,
          isDemoMode: false,
          message: result.message || 'Invalid credentials. Please check your email address or ID.',
          errors: result.errors,
        };
      }

      if (result.token && result.user) {
        this.saveSession(result.token, result.user);
      }

      if (params.rememberMe && result.role) {
        this.saveRememberedIdentity(result.role, params.identifier);
      } else {
        this.clearRememberedIdentity();
      }

      return {
        success: true,
        isDemoMode: Boolean(result.isDemoMode),
        message: result.message || 'Authenticated successfully.',
        user: result.user,
        patient: result.patient,
        patientId: result.patientId || result.user?.patient_id,
        doctorId: result.doctorId || result.user?.doctor_id,
        staffId: result.staffId || result.user?.staff_id,
        role: result.role || result.user?.role,
        token: result.token,
        mustChangePassword: result.mustChangePassword,
        tempToken: result.tempToken,
      };
    } catch (err) {
      return {
        success: false,
        message: 'Network error connecting to hospital services.',
      };
    }
  }

  /**
   * Authenticate user with role-based credentials.
   * Dispatches to server-side authentication API.
   * No hardcoded demo credentials or fake success shortcuts.
   */
  public async login(data: LoginFormData): Promise<AuthResponse> {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: data.role,
          email: data.email,
          password: data.password,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        return {
          success: false,
          isDemoMode: false,
          message: result.message || 'Database not configured. Connect Supabase to load this information.',
          errors: result.errors,
        };
      }

      if (data.rememberMe && data.role) {
        this.saveRememberedIdentity(data.role, data.email || data.identifier || '');
      } else {
        this.clearRememberedIdentity();
      }

      return {
        success: true,
        isDemoMode: false,
        message: result.message || 'Authenticated successfully.',
        user: result.user,
        token: result.token,
      };
    } catch {
      return {
        success: false,
        isDemoMode: false,
        message: 'Database not configured. Connect Supabase to load this information.',
      };
    }
  }

  /**
   * Google Single Sign-On and Registration using Supabase / Identity Provider
   */
  public async googleLogin(payload?: { email?: string; name?: string }): Promise<AuthResponse> {
    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        return {
          success: false,
          message: result.message || 'Google authentication failed.',
        };
      }

      if (result.token && result.user) {
        this.saveSession(result.token, result.user);
      }

      return {
        success: true,
        isDemoMode: Boolean(result.isDemoMode),
        message: result.message || 'Signed in via Google successfully.',
        user: result.user,
        patient: result.patient,
        patientId: result.patientId || result.user?.patient_id,
        token: result.token,
      };
    } catch {
      return {
        success: false,
        message: 'Network error connecting to Google authentication service.',
      };
    }
  }

  /**
   * Elevate or switch role dynamically ("after first login i will update my self as platform admin role")
   */
  public async updateRole(newRole: HospitalRole): Promise<AuthResponse> {
    try {
      const token = this.getToken();
      const currentUser = this.getActiveUser();

      const response = await fetch('/api/auth/update-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          newRole,
          email: currentUser?.email,
          patientId: currentUser?.patient_id,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        return {
          success: false,
          message: result.message || 'Failed to update account role.',
        };
      }

      if (result.token && result.user) {
        this.saveSession(result.token, result.user);
      }

      return {
        success: true,
        message: result.message || `Role updated to ${newRole.toUpperCase()}.`,
        user: result.user,
        token: result.token,
      };
    } catch {
      return {
        success: false,
        message: 'Network error updating user role.',
      };
    }
  }

  /**
   * Register a new user with default "patient" role or privileged clinical role.
   */
  public async signup(data: SignupFormData): Promise<AuthResponse> {
    try {
      const response = await fetch('/api/auth/common-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        return {
          success: false,
          isDemoMode: false,
          message: result.message || 'Failed to complete registration.',
          errors: result.errors,
        };
      }

      if (result.token && result.user) {
        this.saveSession(result.token, result.user);
      }

      return {
        success: true,
        isDemoMode: false,
        message: result.message || 'Registration successful.',
        user: result.user,
        patientId: result.patientId || result.user?.patient_id,
        doctorId: result.doctorId || result.user?.doctor_id,
        staffId: result.staffId || result.user?.staff_id,
        role: result.role || result.user?.role,
        token: result.token,
        requiresEmailConfirmation: result.requiresEmailConfirmation,
        requiresApproval: Boolean(result.requiresApproval),
        status: result.status,
      };
    } catch {
      return {
        success: false,
        isDemoMode: false,
        message: 'Network error during account registration.',
      };
    }
  }

  /**
   * Request password reset link / verification code.
   */
  public async requestPasswordReset(role: HospitalRole, email: string): Promise<AuthResponse> {
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, email }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        return {
          success: false,
          isDemoMode: false,
          message: result.message || 'Database not configured. Connect Supabase to load this information.',
        };
      }

      return {
        success: true,
        isDemoMode: false,
        message: result.message || 'Password reset instructions dispatched.',
      };
    } catch {
      return {
        success: false,
        isDemoMode: false,
        message: 'Database not configured. Connect Supabase to load this information.',
      };
    }
  }

  /**
   * Verify verification code in password recovery flow.
   */
  public async verifyResetCode(email: string, code: string): Promise<AuthResponse> {
    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        return {
          success: false,
          isDemoMode: false,
          message: result.message || 'Database not configured. Connect Supabase to load this information.',
        };
      }

      return {
        success: true,
        isDemoMode: false,
        message: result.message || 'Verification code confirmed.',
      };
    } catch {
      return {
        success: false,
        isDemoMode: false,
        message: 'Database not configured. Connect Supabase to load this information.',
      };
    }
  }

  /**
   * Complete password reset
   */
  public async resetPassword(email: string, newPassword: string): Promise<AuthResponse> {
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        return {
          success: false,
          isDemoMode: false,
          message: result.message || 'Database not configured. Connect Supabase to load this information.',
        };
      }

      return {
        success: true,
        isDemoMode: false,
        message: result.message || 'Password updated successfully.',
      };
    } catch {
      return {
        success: false,
        isDemoMode: false,
        message: 'Database not configured. Connect Supabase to load this information.',
      };
    }
  }
}

export const authService = new AuthService();
