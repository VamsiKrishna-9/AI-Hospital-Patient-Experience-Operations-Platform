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
import { VALID_ADMIN_INVITATION_CODES, VALID_HOSPITAL_INVITE_CODES } from '../data/roles';
import { API_CONFIG } from './apiConfig';

class AuthService {
  /**
   * Helper to simulate network latency in Demo Mode
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Safe storage helper - NEVER stores plaintext passwords
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
   * Connects to Python FastAPI POST /api/v1/auth/login or runs in transparent Demo Mode.
   */
  public async login(data: LoginFormData): Promise<AuthResponse> {
    // Check if real FastAPI backend is configured and accessible
    if (API_CONFIG.isBackendConnected) {
      try {
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.login}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: data.role,
            email: data.email,
            password: data.password, // In real HTTPS flow sent to FastAPI
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return {
            success: false,
            isDemoMode: false,
            message: errorData.detail || 'Authentication failed on server.',
            targetEndpoint: `POST ${API_CONFIG.endpoints.login}`,
          };
        }

        const result = await response.json();
        return {
          success: true,
          isDemoMode: false,
          message: 'Authenticated successfully with hospital_db.',
          user: result.user,
          token: result.token,
          targetEndpoint: `POST ${API_CONFIG.endpoints.login}`,
        };
      } catch (err) {
        return {
          success: false,
          isDemoMode: false,
          message: 'Unable to reach Python FastAPI backend at ' + API_CONFIG.baseUrl,
          targetEndpoint: `POST ${API_CONFIG.endpoints.login}`,
        };
      }
    }

    // --- Standalone DEMO MODE (Explicitly labeled) ---
    await this.delay(750);

    // Basic validation
    if (!data.email || !data.password) {
      return {
        success: false,
        isDemoMode: true,
        message: 'Please provide both email and password.',
      };
    }

    // Role-specific simulated validation
    const demoNames: Record<HospitalRole, string> = {
      patient: 'Eleanor Vance',
      doctor: 'Dr. Marcus Chen, MD',
      staff: 'Sarah Jenkins, RN Lead',
      admin: 'Chief Medical Information Officer',
    };

    if (data.rememberMe) {
      this.saveRememberedIdentity(data.role, data.email);
    } else {
      this.clearRememberedIdentity();
    }

    return {
      success: true,
      isDemoMode: true,
      message: `[Demo Mode] Form payload validated for ${data.role.toUpperCase()} role. Note: No backend is connected yet; real authentication will require Python FastAPI + MySQL hospital_db.`,
      user: {
        id: `DEMO-${data.role.toUpperCase()}-001`,
        name: demoNames[data.role],
        email: data.email,
        role: data.role,
      },
      token: 'demo-jwt-preview-token-unsigned',
      targetEndpoint: `POST ${API_CONFIG.endpoints.login}`,
    };
  }

  /**
   * Register a new user with role-specific schema fields.
   * Maps to future FastAPI endpoints feeding MySQL Medallion Architecture Bronze tables.
   */
  public async signup(data: SignupFormData): Promise<AuthResponse> {
    const endpointMap: Record<HospitalRole, string> = {
      patient: API_CONFIG.endpoints.registerPatient,
      doctor: API_CONFIG.endpoints.registerDoctor,
      staff: API_CONFIG.endpoints.registerStaff,
      admin: API_CONFIG.endpoints.registerAdmin,
    };

    const targetEndpoint = endpointMap[data.role];

    // Check if real FastAPI backend is configured
    if (API_CONFIG.isBackendConnected) {
      try {
        const response = await fetch(`${API_CONFIG.baseUrl}${targetEndpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return {
            success: false,
            isDemoMode: false,
            message: errorData.detail || 'Registration failed on server.',
            targetEndpoint: `POST ${targetEndpoint}`,
          };
        }

        const result = await response.json();
        return {
          success: true,
          isDemoMode: false,
          message: 'Account successfully created and queued for Bronze ingestion.',
          user: result.user,
          targetEndpoint: `POST ${targetEndpoint}`,
        };
      } catch {
        return {
          success: false,
          isDemoMode: false,
          message: 'Unable to reach Python FastAPI backend at ' + API_CONFIG.baseUrl,
          targetEndpoint: `POST ${targetEndpoint}`,
        };
      }
    }

    // --- Standalone DEMO MODE ---
    await this.delay(850);

    // Role specific security validations
    if (data.role === 'admin') {
      const code = data.adminInviteCode?.trim().toUpperCase();
      if (!VALID_ADMIN_INVITATION_CODES.includes(code)) {
        return {
          success: false,
          isDemoMode: true,
          message: 'Invalid Administrator Invitation Code. Administrator registration requires authorized governance verification.',
          errors: { adminInviteCode: 'Authorization code is unverified or expired.' },
          targetEndpoint: `POST ${targetEndpoint}`,
        };
      }
    }

    if (data.role === 'doctor') {
      const code = data.hospitalInviteCode?.trim().toUpperCase();
      if (!VALID_HOSPITAL_INVITE_CODES.includes(code)) {
        return {
          success: false,
          isDemoMode: true,
          message: 'Invalid Hospital Invitation Code. Physician accounts must be pre-authorized by hospital administration.',
          errors: { hospitalInviteCode: 'Invalid hospital invitation key.' },
          targetEndpoint: `POST ${targetEndpoint}`,
        };
      }
    }

    if (data.role === 'staff') {
      const code = data.hospitalInviteCode?.trim().toUpperCase();
      if (!VALID_HOSPITAL_INVITE_CODES.includes(code)) {
        return {
          success: false,
          isDemoMode: true,
          message: 'Invalid Hospital Unit Code. Clinical staff accounts must be authorized by unit supervision.',
          errors: { hospitalInviteCode: 'Invalid unit invitation key.' },
          targetEndpoint: `POST ${targetEndpoint}`,
        };
      }
    }

    const email = data.role === 'admin' ? data.officialEmail : data.email;
    const bronzeTableMap: Record<HospitalRole, string> = {
      patient: 'bronze_patients',
      doctor: 'bronze_doctors',
      staff: 'bronze_staff',
      admin: 'governance_audit_log & bronze_staff',
    };

    return {
      success: true,
      isDemoMode: true,
      message: `[Demo Mode] Registration payload validated for ${data.role.toUpperCase()}. In production, this dispatches to POST ${targetEndpoint} to ingest into MySQL table '${bronzeTableMap[data.role]}'.`,
      user: {
        id: `DEMO-NEW-${data.role.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
        name: data.fullName,
        email,
        role: data.role,
      },
      targetEndpoint: `POST ${targetEndpoint}`,
    };
  }

  /**
   * Request password reset link / 6-digit verification code.
   */
  public async requestPasswordReset(role: HospitalRole, email: string): Promise<AuthResponse> {
    if (API_CONFIG.isBackendConnected) {
      try {
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.forgotPassword}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, email }),
        });
        const result = await response.json();
        return {
          success: response.ok,
          isDemoMode: false,
          message: result.message || 'Reset instructions sent.',
          targetEndpoint: `POST ${API_CONFIG.endpoints.forgotPassword}`,
        };
      } catch {
        return {
          success: false,
          isDemoMode: false,
          message: 'Unable to reach FastAPI backend.',
        };
      }
    }

    await this.delay(600);
    return {
      success: true,
      isDemoMode: true,
      message: `[Demo Mode] Verification code generated and securely dispatched to ${email}.`,
      targetEndpoint: `POST ${API_CONFIG.endpoints.forgotPassword}`,
    };
  }

  /**
   * Verify 6-digit code in forgot password flow.
   */
  public async verifyResetCode(email: string, code: string): Promise<AuthResponse> {
    await this.delay(500);
    const cleanedCode = code.trim();
    if (cleanedCode === '849201' || cleanedCode.length === 6) {
      return {
        success: true,
        isDemoMode: true,
        message: '[Demo Mode] Verification code validated.',
        targetEndpoint: `POST ${API_CONFIG.endpoints.verifyCode}`,
      };
    }
    return {
      success: false,
      isDemoMode: true,
      message: 'Invalid verification code. Please check your secure inbox and enter your 6-digit code.',
      targetEndpoint: `POST ${API_CONFIG.endpoints.verifyCode}`,
    };
  }

  /**
   * Complete password reset
   */
  public async resetPassword(email: string, newPassword: string): Promise<AuthResponse> {
    await this.delay(650);
    return {
      success: true,
      isDemoMode: true,
      message: `[Demo Mode] Password reset verified for ${email}. In production, this updates password hash via Argon2/PBKDF2 in hospital_db.`,
      targetEndpoint: `POST ${API_CONFIG.endpoints.resetPassword}`,
    };
  }
}

export const authService = new AuthService();
