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
  /**
   * Safe storage helper - stores only remembered user identifier, NEVER plaintext passwords
   */
  public saveRememberedIdentity(role: HospitalRole, email: string): void {
    try {
      localStorage.setItem('mediai_remembered_identity', JSON.stringify({ role, email }));
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

      if (data.rememberMe) {
        this.saveRememberedIdentity(data.role, data.email);
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
   * Register a new user with role-specific schema fields.
   * Connects to backend registration service; never simulates dummy accounts.
   */
  public async signup(data: SignupFormData): Promise<AuthResponse> {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
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

      return {
        success: true,
        isDemoMode: false,
        message: result.message || 'Registration successful.',
        user: result.user,
        patientId: result.patientId || result.user?.patient_id,
        requiresEmailConfirmation: result.requiresEmailConfirmation,
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
