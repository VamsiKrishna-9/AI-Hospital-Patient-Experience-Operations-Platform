/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, Mail, IdCard, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { HospitalRole, LoginFormData, ScreenState, AuthResponse } from '../types/auth';
import { ROLES_CONFIG } from '../data/roles';
import { RoleSelector } from './RoleSelector';
import { authService } from '../services/authService';
import { patientService } from '../services/patientService';
import { isValidEmail } from '../utils/validation';

interface LoginScreenProps {
  onNavigate: (
    screen: ScreenState,
    role?: HospitalRole,
    extra?: { patientId?: string; tempToken?: string }
  ) => void;
  selectedRole: HospitalRole;
  onRoleChange: (role: HospitalRole) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onNavigate,
  selectedRole,
  onRoleChange,
}) => {
  // Login fields start empty
  const [identifier, setIdentifier] = useState(''); // Patient ID or Email
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authResult, setAuthResult] = useState<AuthResponse | null>(null);

  // Check remembered identity on mount if saved previously
  useEffect(() => {
    const remembered = authService.getRememberedIdentity();
    if (remembered) {
      if (remembered.role === 'patient') {
        // Patient usernames are Patient IDs (e.g. P182162), not email addresses.
        // If an old or invalid email was stored, clear it to avoid populating an email.
        if (remembered.email && !remembered.email.includes('@')) {
          setIdentifier(remembered.email.toUpperCase());
          onRoleChange('patient');
          setRememberMe(true);
        } else {
          authService.clearRememberedIdentity();
          setIdentifier('');
        }
      } else {
        setIdentifier(remembered.email);
        onRoleChange(remembered.role);
        setRememberMe(true);
      }
    }
  }, []);

  const handleRoleSelect = (newRole: HospitalRole) => {
    onRoleChange(newRole);
    setError(null);
    setAuthResult(null);

    // If switching to patient, clear any email address previously in the field
    if (newRole === 'patient') {
      if (identifier.includes('@')) {
        setIdentifier('');
      }
    } else {
      // If switching to clinical/staff/admin and field has a patient ID, clear it
      if (/^P\d+$/i.test(identifier.trim())) {
        setIdentifier('');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAuthResult(null);

    // --- PATIENT ROLE AUTHENTICATION ---
    if (selectedRole === 'patient') {
      const cleanPatientId = identifier.trim().toUpperCase();
      if (!cleanPatientId) {
        setError('Please enter your Patient ID (e.g. P182162).');
        return;
      }
      if (cleanPatientId.includes('@')) {
        setError('Please enter your Patient ID username (e.g. P182162), not an email address.');
        return;
      }
      if (!password) {
        setError('Please enter your patient portal password.');
        return;
      }

      setIsLoading(true);
      try {
        const response = await patientService.login(cleanPatientId, password);
        if (response.success) {
          if (rememberMe) {
            authService.saveRememberedIdentity('patient', cleanPatientId);
          } else {
            authService.clearRememberedIdentity();
          }

          // Check if security policy requires setting a new password first
          if (response.mustChangePassword) {
            onNavigate('change-password', 'patient', {
              patientId: response.patientId || cleanPatientId,
              tempToken: response.tempToken,
            });
            return;
          }

          // Direct navigation into Patient Dashboard
          onNavigate('patient-dashboard');
          return;
        } else {
          setError(response.message || 'Invalid Patient ID or password.');
        }
      } catch {
        setError('An unexpected error occurred during patient authentication.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // --- CLINICAL / STAFF / ADMIN AUTHENTICATION ---
    if (!identifier.trim()) {
      setError('Please enter your official email address.');
      return;
    }
    if (!isValidEmail(identifier)) {
      setError('Please provide a valid email format (e.g. name@hospital.org).');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    setIsLoading(true);

    try {
      const payload: LoginFormData = {
        role: selectedRole,
        email: identifier.trim(),
        password,
        rememberMe,
      };

      const response = await authService.login(payload);
      setAuthResult(response);

      if (!response.success) {
        setError(response.message);
      }
    } catch {
      setError('An unexpected error occurred during verification.');
    } finally {
      setIsLoading(false);
    }
  };

  const isPatient = selectedRole === 'patient';

  return (
    <div className="flex flex-col justify-center min-h-full py-8 px-6 sm:px-10 lg:px-14 max-w-xl mx-auto w-full">
      {/* Welcome Heading */}
      <div className="mb-6 space-y-1.5">
        <span className="text-xs font-semibold text-teal-400 tracking-wider uppercase">
          {isPatient ? 'Patient Care Portal' : 'Hospital Operations Portal'}
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          {isPatient ? 'Patient Sign In' : 'Welcome back'}
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          {isPatient
            ? 'Access your upcoming appointments, medical encounters, and digital lab reports.'
            : 'Select your authorized hospital role to sign in to your dashboard.'}
        </p>
      </div>

      {/* Role Selection Matrix */}
      <div className="mb-6">
        <RoleSelector
          selectedRole={selectedRole}
          onSelectRole={handleRoleSelect}
          variant="compact"
          disabled={isLoading}
        />
      </div>

      {/* Clean Feedback Banner if form submitted (non-patient) */}
      {authResult && authResult.success && !isPatient && (
        <div className="mb-5 p-3.5 rounded-xl bg-teal-950/60 border border-teal-500/40 text-xs text-teal-200 animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-teal-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-teal-100">
                Sign In Verified — {ROLES_CONFIG[selectedRole].title} Portal
              </p>
              <p className="text-[11px] text-teal-300/90 leading-relaxed">
                Credentials validated successfully for {identifier}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 animate-in fade-in duration-200 flex items-start gap-2.5"
        >
          <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{error}</div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Identifier Field (Patient ID vs Email) */}
        <div>
          <label
            htmlFor="login-identifier"
            className="block text-xs font-medium text-slate-300 mb-1.5"
          >
            {isPatient ? (
              <span className="flex items-center justify-between">
                <span>Patient ID (Username)</span>
                <span className="text-[10px] text-teal-400 font-mono">e.g. P182162</span>
              </span>
            ) : selectedRole === 'admin' ? (
              'Institutional Administrator Email'
            ) : (
              `${ROLES_CONFIG[selectedRole].title} Email Address`
            )}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              {isPatient ? <IdCard size={16} /> : <Mail size={16} />}
            </div>
            <input
              id="login-identifier"
              type={isPatient ? 'text' : 'email'}
              autoComplete={isPatient ? 'username' : 'email'}
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (error) setError(null);
              }}
              disabled={isLoading}
              placeholder={isPatient ? 'Enter your Patient ID (e.g. P182162)' : 'name@example.com'}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors ${
                isPatient ? 'font-mono tracking-wider' : ''
              }`}
            />
          </div>
          {isPatient && identifier.includes('@') && (
            <p className="mt-1.5 text-[11px] text-amber-400 flex items-center gap-1 font-medium animate-in fade-in duration-150">
              <AlertCircle size={12} className="shrink-0" />
              Patient accounts use Patient IDs as usernames (e.g. P182162), not email addresses.
            </p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="login-password"
              className="block text-xs font-medium text-slate-300"
            >
              Password
            </label>
            <button
              type="button"
              onClick={() => onNavigate('forgot-password', selectedRole)}
              className="text-xs text-teal-400 hover:text-teal-300 transition-colors cursor-pointer"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Lock size={16} />
            </div>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              placeholder={isPatient ? 'Enter patient portal password' : 'Enter your password'}
              className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors font-mono tracking-tight"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Remember Me Checkbox */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isLoading}
              className="rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-teal-500 h-4 w-4"
            />
            <span>Remember this device</span>
          </label>
          <span className="text-[11px] text-slate-500">
            Encrypted Session
          </span>
        </div>

        {/* Prominent Gradient Sign In Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full relative group flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-300 hover:from-teal-300 hover:via-cyan-300 hover:to-teal-200 active:scale-[0.99] transition-all duration-150 shadow-lg shadow-teal-500/25 hover:shadow-teal-500/35 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 size={17} className="animate-spin text-slate-950" />
                <span>Authenticating with hospital services...</span>
              </>
            ) : (
              <>
                <span>{isPatient ? 'Sign In to Patient Dashboard' : 'Sign In to MediAI'}</span>
                <ArrowRight size={16} className="text-slate-950 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Footer Navigation: Create Account */}
      <div className="mt-8 pt-6 border-t border-slate-800/80 text-center text-xs text-slate-400">
        <span>Don't have an account? </span>
        <button
          type="button"
          onClick={() => onNavigate('signup', selectedRole)}
          className="font-semibold text-teal-400 hover:text-teal-300 transition-colors ml-1 cursor-pointer"
        >
          Create account as {ROLES_CONFIG[selectedRole].title}
        </button>
      </div>
    </div>
  );
};
