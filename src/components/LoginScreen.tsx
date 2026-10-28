/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { HospitalRole, ScreenState, AuthUser } from '../types/auth';
import { authService } from '../services/authService';

interface LoginScreenProps {
  onNavigate: (
    screen: ScreenState,
    role?: HospitalRole,
    extra?: { patientId?: string; tempToken?: string; user?: AuthUser }
  ) => void;
  selectedRole: HospitalRole;
  onRoleChange: (role: HospitalRole) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onNavigate,
  selectedRole,
  onRoleChange,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);



  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const search = window.location.search;

      if (hash || search) {
        const hashParams = new URLSearchParams(
          hash.startsWith('#') ? hash.substring(1) : hash
        );
        const searchParams = new URLSearchParams(search);

        const isSignupConfirmation =
          hashParams.get('type') === 'signup' ||
          searchParams.get('type') === 'signup' ||
          hashParams.has('access_token');

        const errorDesc =
          hashParams.get('error_description') ||
          searchParams.get('error_description');

        if (isSignupConfirmation) {
          setVerificationNotice(
            'Email verified successfully! Your account is active. Please sign in.'
          );
          window.history.replaceState(null, '', window.location.pathname);
        } else if (errorDesc) {
          setError(
            decodeURIComponent(errorDesc).replace(/\+/g, ' ') ||
              'Email verification link is invalid or has expired.'
          );
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    }

    const remembered = authService.getRememberedIdentity();
    if (remembered && remembered.email) {
      setIdentifier(remembered.email);
      setRememberMe(true);
    }
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanInput = identifier.trim();

    if (!cleanInput) {
      setError('Please enter your registered email address or ID.');
      return;
    }

    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.commonLogin({
        identifier: cleanInput,
        password,
        rememberMe,
      });

      if (response.success && response.user) {
        // Enforce account authorization check before navigating
        if ((response.user as any).is_active === false || (response.user as any).status === 'pending_approval') {
          setError('Your account is pending verification and approval by Hospital Administration. Please check back later.');
          return;
        }

        const userRole = response.user.role;
        onRoleChange(userRole);

        if (response.mustChangePassword) {
          onNavigate('change-password', userRole, {
            patientId: response.patientId || response.user.patient_id,
            tempToken: response.tempToken,
          });
          return;
        }

        // Dedicated post-login routing for each role
        if (userRole === 'doctor') {
          onNavigate('doctor-dashboard', 'doctor', {
            user: response.user,
          });
        } else if (userRole === 'staff') {
          onNavigate('staff-dashboard', 'staff', {
            user: response.user,
          });
        } else if (userRole === 'admin') {
          onNavigate('admin-dashboard', 'admin', {
            user: response.user,
          });
        } else {
          onNavigate('patient-dashboard', 'patient', {
            patientId: response.patientId || response.user.patient_id,
            user: response.user,
          });
        }
        return;
      }

      setError(response.message || 'Authentication failed. Please verify your credentials.');
    } catch {
      setError('An unexpected error occurred while connecting to hospital authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const remembered = authService.getRememberedIdentity();
      const loginEmail = identifier.includes('@')
        ? identifier.trim()
        : (remembered?.email && remembered.email.includes('@'))
        ? remembered.email.trim()
        : undefined;

      const response = await authService.googleLogin({
        email: loginEmail,
      });

      if (response.success && response.user) {
        const userRole = response.user.role || 'patient';
        onRoleChange(userRole);

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

      setError(response.message || 'Google authentication failed. Please try again.');
    } catch {
      setError('Failed to authenticate with Google identity provider.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center min-h-full py-8 px-6 sm:px-10 lg:px-14 max-w-xl mx-auto w-full">
      {/* Header */}
      <div className="mb-6 space-y-1.5">
        <span className="text-xs font-semibold text-teal-400 tracking-wider uppercase flex items-center gap-1.5">
          <ShieldCheck size={14} />
          <span>Unified Hospital Access</span>
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Sign In to MediAI
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Enter your registered email address or ID to access your hospital workspace and medical records.
        </p>
      </div>

      {/* Google Sign In Direct Action */}
      <div className="mb-5">
        <button
          type="button"
          onClick={handleGoogleLogin}
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
          <span>Continue with Google</span>
        </button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-[11px] uppercase">
            <span className="bg-slate-950 px-2 text-slate-500">or sign in with credentials</span>
          </div>
        </div>
      </div>


      {verificationNotice && (
        <div
          role="status"
          className="mb-5 p-3.5 rounded-xl bg-teal-950/60 border border-teal-500/40 text-xs text-teal-200 animate-in fade-in duration-200 flex items-start gap-2.5"
        >
          <CheckCircle2 size={16} className="text-teal-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{verificationNotice}</div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 animate-in fade-in duration-200 flex items-start gap-2.5"
        >
          <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{error}</div>
        </div>
      )}

      {/* Common Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="common-identifier" className="block text-xs font-medium text-slate-300">
              Email Address or ID
            </label>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Mail size={16} />
            </div>
            <input
              id="common-identifier"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (error) setError(null);
              }}
              disabled={isLoading}
              placeholder="Enter your registered email address or ID"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40 font-mono"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="login-password" className="block text-xs font-medium text-slate-300">
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
              placeholder="Enter your account password"
              className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40"
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
          <span className="text-[11px] text-slate-500">Encrypted Hospital Session</span>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full relative group flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-300 hover:from-teal-300 hover:via-cyan-300 hover:to-teal-200 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 size={17} className="animate-spin text-slate-950" />
                <span>Authenticating with hospital services...</span>
              </>
            ) : (
              <>
                <span>Sign In to MediAI</span>
                <ArrowRight
                  size={16}
                  className="text-slate-950 group-hover:translate-x-0.5 transition-transform"
                />
              </>
            )}
          </button>
        </div>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-800/80 text-center text-xs text-slate-400">
        <span>Need a new account? </span>
        <button
          type="button"
          onClick={() => onNavigate('signup', 'patient')}
          className="font-semibold text-teal-400 hover:text-teal-300 transition-colors ml-1 cursor-pointer"
        >
          Register as Patient, Doctor, or Staff
        </button>
      </div>
    </div>
  );
};
