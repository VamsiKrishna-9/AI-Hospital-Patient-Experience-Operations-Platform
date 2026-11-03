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
  private static readonly ACCESS_TOKEN_KEY = 'mediai_access_token';
  private static readonly REFRESH_TOKEN_KEY = 'mediai_refresh_token';
  private static readonly EXPIRES_AT_KEY = 'mediai_token_expires_at';
  private static readonly SESSION_USER_KEY = 'mediai_session_user';
  private static readonly LEGACY_TOKEN_KEY = 'mediai_patient_auth_token';
  private static readonly CURRENT_PATIENT_KEY = 'mediai_current_patient_id';

  private refreshPromise: Promise<boolean> | null = null;

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

  /**
   * Centralized token and session storage across all roles
   */
  public saveSession(token: string, user: any, refreshToken?: string, expiresAt?: number): void {
    try {
      sessionStorage.setItem(AuthService.ACCESS_TOKEN_KEY, token);
      // Backward compatibility with legacy key
      sessionStorage.setItem(AuthService.LEGACY_TOKEN_KEY, token);
      if (user) {
        sessionStorage.setItem(AuthService.SESSION_USER_KEY, JSON.stringify(user));
      }
      if (refreshToken) {
        sessionStorage.setItem(AuthService.REFRESH_TOKEN_KEY, refreshToken);
      }
      if (expiresAt) {
        sessionStorage.setItem(AuthService.EXPIRES_AT_KEY, String(expiresAt));
      }
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

  public getAuthToken(): string | null {
    try {
      return (
        sessionStorage.getItem(AuthService.ACCESS_TOKEN_KEY) ||
        sessionStorage.getItem(AuthService.LEGACY_TOKEN_KEY) ||
        localStorage.getItem('mediai_remembered_token') ||
        null
      );
    } catch {
      return null;
    }
  }

  public getToken(): string | null {
    return this.getAuthToken();
  }

  public getRefreshToken(): string | null {
    try {
      return sessionStorage.getItem(AuthService.REFRESH_TOKEN_KEY) || null;
    } catch {
      return null;
    }
  }

  public isTokenExpired(): boolean {
    try {
      let expiresAtSec: number | null = null;
      const expiresAtStr = sessionStorage.getItem(AuthService.EXPIRES_AT_KEY);
      if (expiresAtStr) {
        expiresAtSec = parseInt(expiresAtStr, 10);
      }

      // Fallback: decode JWT expiration from token payload if EXPIRES_AT_KEY is missing
      if (!expiresAtSec || isNaN(expiresAtSec)) {
        const token = this.getAuthToken();
        if (token && token.includes('.')) {
          const parts = token.split('.');
          if (parts.length >= 2) {
            try {
              const decodedStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
              const payload = JSON.parse(decodedStr);
              if (payload?.exp && typeof payload.exp === 'number') {
                expiresAtSec = payload.exp;
                sessionStorage.setItem(AuthService.EXPIRES_AT_KEY, String(payload.exp));
              }
            } catch {
              // Ignore payload decode failure
            }
          }
        }
      }

      if (!expiresAtSec || isNaN(expiresAtSec)) return false;
      // Consider expired if within 60 seconds of expiration
      const nowSec = Math.floor(Date.now() / 1000);
      return nowSec >= (expiresAtSec - 60);
    } catch {
      return false;
    }
  }

  public async refreshToken(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) return false;

      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success || !data.token) {
          return false;
        }

        const activeUser = this.getActiveUser() || data.user;
        this.saveSession(data.token, activeUser, data.refreshToken, data.expiresAt);
        return true;
      } catch {
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  public handleSessionExpired(): void {
    this.clearSession();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mediai:session-expired'));
    }
  }

  public clearSession(): void {
    try {
      sessionStorage.removeItem(AuthService.ACCESS_TOKEN_KEY);
      sessionStorage.removeItem(AuthService.LEGACY_TOKEN_KEY);
      sessionStorage.removeItem(AuthService.REFRESH_TOKEN_KEY);
      sessionStorage.removeItem(AuthService.EXPIRES_AT_KEY);
      sessionStorage.removeItem(AuthService.SESSION_USER_KEY);
      sessionStorage.removeItem(AuthService.CURRENT_PATIENT_KEY);
      localStorage.removeItem('mediai_remembered_token');
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
        this.saveSession(result.token, result.user, result.refreshToken, result.expiresAt);
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
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
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
        this.saveSession(result.token, result.user, result.refreshToken, result.expiresAt);
      }

      return {
        success: true,
        isDemoMode: Boolean(result.isDemoMode),
        message: result.message || 'Signed in via Google successfully.',
        user: result.user,
        patient: result.patient,
        patientId: result.patientId || result.user?.patient_id,
        token: result.token,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
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
        this.saveSession(result.token, result.user, result.refreshToken, result.expiresAt);
      }

      return {
        success: true,
        message: result.message || `Role updated to ${newRole.toUpperCase()}.`,
        user: result.user,
        token: result.token,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
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
        this.saveSession(result.token, result.user, result.refreshToken, result.expiresAt);
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
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
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
