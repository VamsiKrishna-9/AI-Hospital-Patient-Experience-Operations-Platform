/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Phone,
  Calendar,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  HospitalRole,
  ScreenState,
  SignupFormData,
  AuthResponse,
  AuthUser,
} from '../types/auth';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { authService } from '../services/authService';
import {
  calculatePasswordStrength,
  isValidEmail,
  isValidPhone,
  isValidDateOfBirth,
} from '../utils/validation';

interface SignupScreenProps {
  onNavigate: (
    screen: ScreenState,
    role?: HospitalRole,
    extra?: { patientId?: string; tempToken?: string; user?: AuthUser }
  ) => void;
  selectedRole?: HospitalRole;
  onRoleChange?: (role: HospitalRole) => void;
}

export const SignupScreen: React.FC<SignupScreenProps> = ({
  onNavigate,
  selectedRole = 'patient',
  onRoleChange,
}) => {
  // Form fields (Standard Patient Registration)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Submission state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authResult, setAuthResult] = useState<AuthResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAuthResult(null);

    // Validation
    if (!fullName.trim()) {
      setError('Please provide your full legal name.');
      return;
    }

    if (!email.trim() || !isValidEmail(email)) {
      setError('Please provide a valid email address.');
      return;
    }

    if (!phone.trim() || !isValidPhone(phone)) {
      setError('Please provide a valid contact phone number.');
      return;
    }

    const dobCheck = isValidDateOfBirth(dateOfBirth);
    if (!dobCheck.valid) {
      setError(dobCheck.message || 'Please provide a valid date of birth.');
      return;
    }

    const strength = calculatePasswordStrength(password);
    if (strength.score < 2 || password.length < 8) {
      setError('Password does not meet minimum security requirements (at least 8 characters with mixed case and numbers).');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    if (!acceptTerms) {
      setError('You must review and consent to the MediAI Data Governance and Terms of Service to proceed.');
      return;
    }

    setIsLoading(true);

    try {
      // All registrations are strictly Patient role by default
      const payload: SignupFormData = {
        role: 'patient',
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        dateOfBirth,
        password,
        confirmPassword,
        acceptTerms,
      };

      const response = await authService.signup(payload);
      setAuthResult(response);

      if (!response.success) {
        setError(response.message);
      } else if (onRoleChange) {
        onRoleChange('patient');
      }
    } catch {
      setError('An error occurred during account registration dispatch.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await authService.googleLogin({
        email: email.includes('@') ? email.trim() : undefined,
        name: fullName.trim() || undefined,
      });

      if (response.success && response.user) {
        const userRole = response.user.role || 'patient';
        if (onRoleChange) onRoleChange(userRole);

        if (userRole === 'doctor') {
          onNavigate('doctor-dashboard', 'doctor', { user: response.user });
        } else if (userRole === 'staff') {
          onNavigate('staff-dashboard', 'staff', { user: response.user });
        } else if (userRole === 'admin') {
          onNavigate('admin-dashboard', 'admin', { user: response.user });
        } else {
          onNavigate('patient-dashboard', 'patient', {
            patientId: response.patientId || response.user.patient_id,
            user: response.user,
          });
        }
        return;
      }

      setError(response.message || 'Google account creation failed.');
    } catch {
      setError('Failed to create account via Google identity provider.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center min-h-full py-8 px-6 sm:px-10 lg:px-14 max-w-xl mx-auto w-full">
      {/* Header */}
      <div className="mb-5 space-y-1.5">
        <span className="text-xs font-semibold text-teal-400 tracking-wider uppercase">
          New Account Registration
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Join MediAI Platform
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Default registration assigns <span className="text-teal-300 font-semibold">Patient</span> status to all new healthcare participants. Institutional role modifications are managed by Hospital Administration.
        </p>
      </div>

      {/* Google Quick Signup Action */}
      <div className="mb-5">
        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl font-medium text-xs sm:text-sm text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 transition-all shadow-xs disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Sign up with Google</span>
          <span className="text-[10px] text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-500/30 font-mono">
            Default: Patient
          </span>
        </button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-[11px] uppercase">
            <span className="bg-slate-950 px-2 text-slate-500">or register with email</span>
          </div>
        </div>
      </div>

      {/* Success Feedback Banner */}
      {authResult && authResult.success && (
        <div className="mb-5 p-4 rounded-xl bg-teal-950/70 border border-teal-500/50 text-xs text-teal-200 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} className="text-teal-400 shrink-0 mt-0.5" />
            <div className="space-y-2 w-full">
              <div>
                <p className="font-semibold text-teal-100 text-sm">
                  Registration Complete — Patient Portal
                </p>
                <p className="text-[12px] text-teal-300/90 leading-relaxed mt-0.5">
                  {authResult.message || `Welcome to MediAI. Your patient account has been created successfully.`}
                </p>
              </div>

              {(authResult.patientId || authResult.user?.patient_id) && (
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-teal-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Your Official Patient ID</span>
                    <span className="text-sm font-mono font-bold text-teal-300">{authResult.patientId || authResult.user?.patient_id}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Save for login</span>
                </div>
              )}

              {authResult.requiresEmailConfirmation ? (
                <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-200 text-[11px]">
                  <strong>Action Required:</strong> A verification link has been sent to your email. Please verify your email before logging in.
                </div>
              ) : (
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('patient-dashboard', 'patient', {
                        patientId: authResult.patientId || authResult.user?.patient_id,
                        user: authResult.user,
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-400 text-slate-950 font-bold text-xs hover:bg-teal-300 transition-colors shadow-xs cursor-pointer"
                  >
                    <span>Enter Patient Portal Now</span>
                    <ArrowRight size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('login', 'patient')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 font-medium text-xs hover:text-white transition-colors cursor-pointer"
                  >
                    <span>Go to Sign In</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 animate-in fade-in duration-200 flex items-start gap-2.5"
        >
          <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{error}</div>
        </div>
      )}

      {/* Common Patient Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
        {/* Full Name */}
        <div>
          <label htmlFor="reg-fullname" className="block text-xs font-medium text-slate-300 mb-1">
            Full Legal Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <User size={15} />
            </div>
            <input
              id="reg-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isLoading}
              placeholder="Eleanor Vance"
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Email Address */}
        <div>
          <label htmlFor="reg-email" className="block text-xs font-medium text-slate-300 mb-1">
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Mail size={15} />
            </div>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              placeholder="user@hospital.mediai.health"
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Contact Phone Number */}
        <div>
          <label htmlFor="reg-phone" className="block text-xs font-medium text-slate-300 mb-1">
            Contact Phone Number
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Phone size={15} />
            </div>
            <input
              id="reg-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isLoading}
              placeholder="+1 (555) 000-0000"
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Date of Birth */}
        <div>
          <label htmlFor="reg-dob" className="block text-xs font-medium text-slate-300 mb-1">
            Date of Birth (Required for Medical Record Matching)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Calendar size={15} />
            </div>
            <input
              id="reg-dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              disabled={isLoading}
              max={new Date().toISOString().split('T')[0]}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Password & Confirm Password */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label htmlFor="reg-password" className="block text-xs font-medium text-slate-300 mb-1">
              Create Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock size={15} />
              </div>
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                placeholder="Min. 8 characters"
                className="w-full pl-10 pr-10 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="reg-confirm-password" className="block text-xs font-medium text-slate-300 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock size={15} />
              </div>
              <input
                id="reg-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                placeholder="Re-enter password"
                className="w-full pl-10 pr-10 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Password Strength Indicator */}
        <PasswordStrengthIndicator password={password} showRequirements={true} />

        {/* Terms of Service & Privacy Consent */}
        <div className="pt-2">
          <label className="flex items-start gap-2.5 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              disabled={isLoading}
              className="mt-0.5 rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-teal-500 h-4 w-4 shrink-0"
            />
            <span className="leading-snug text-[11px]">
              I confirm accurate information and consent to MediAI's{' '}
              <span className="text-teal-300 hover:underline">HIPAA Privacy Notice</span>,{' '}
              <span className="text-teal-300 hover:underline">Clinical Data Governance Policy</span>, and{' '}
              <span className="text-teal-300 hover:underline">Role-Based Auditing Terms</span>.
            </span>
          </label>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full group flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-300 hover:from-teal-300 hover:via-cyan-300 hover:to-teal-200 active:scale-[0.99] transition-all duration-150 shadow-lg shadow-teal-500/25 hover:shadow-teal-500/35 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin text-slate-950" />
                <span>Registering Patient Account...</span>
              </>
            ) : (
              <>
                <span>Complete Patient Registration</span>
                <ArrowRight size={16} className="text-slate-950 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Navigation back to Login */}
      <div className="mt-6 pt-5 border-t border-slate-800/80 text-center text-xs text-slate-400">
        <span>Already have an authorized account? </span>
        <button
          type="button"
          onClick={() => onNavigate('login', selectedRole)}
          className="font-semibold text-teal-400 hover:text-teal-300 transition-colors ml-1 cursor-pointer"
        >
          Sign in to your portal
        </button>
      </div>
    </div>
  );
};
