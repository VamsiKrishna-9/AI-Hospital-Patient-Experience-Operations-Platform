/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  User,
  Phone,
  Calendar,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Mail,
  HeartPulse,
} from 'lucide-react';
import { HospitalRole, ScreenState, AuthUser } from '../types/auth';
import { authService } from '../services/authService';
import { patientService } from '../services/patientService';
import { isValidPhone, isValidDateOfBirth } from '../utils/validation';

interface GoogleOnboardingScreenProps {
  authUser?: {
    id: string;
    email: string;
    name?: string;
  };
  token?: string;
  onNavigate: (
    screen: ScreenState,
    role?: HospitalRole,
    extra?: { user?: AuthUser; token?: string }
  ) => void;
}

export const GoogleOnboardingScreen: React.FC<GoogleOnboardingScreenProps> = ({
  authUser,
  token,
  onNavigate,
}) => {
  const [fullName, setFullName] = useState(authUser?.name || '');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!fullName.trim()) {
      errs.fullName = 'Full legal name is required.';
    } else if (fullName.trim().length < 2) {
      errs.fullName = 'Name must be at least 2 characters.';
    }

    if (!phone.trim()) {
      errs.phone = 'Contact phone number is required.';
    } else if (!isValidPhone(phone)) {
      errs.phone = 'Please provide a valid phone number (at least 7 digits).';
    }

    if (!dateOfBirth) {
      errs.dateOfBirth = 'Date of birth is required.';
    } else {
      const dobCheck = isValidDateOfBirth(dateOfBirth);
      if (!dobCheck.valid) {
        errs.dateOfBirth = dobCheck.message || 'Date of birth cannot be in the future.';
      }
    }

    if (!acceptTerms) {
      errs.acceptTerms = 'You must accept the MediAI Patient Care Terms & Privacy Policy.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validate()) {
      return;
    }

    const effectiveToken = token || authService.getAuthToken();
    if (!effectiveToken) {
      setError('Session token missing. Please sign in with Google again.');
      return;
    }

    try {
      setIsLoading(true);

      const res = await fetch('/api/auth/oauth/complete-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify({
          token: effectiveToken,
          fullName: fullName.trim(),
          phone: phone.trim(),
          dateOfBirth,
          requestedRole: 'patient', // Enforced patient role
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setError(data.message || 'Failed to complete registration profile.');
        setIsLoading(false);
        return;
      }

      const user: AuthUser = data.user;
      authService.saveSession(effectiveToken, user);
      patientService.setSession(effectiveToken, user.patient_id || 'P1001', undefined, undefined, user);

      // Navigate to patient dashboard
      onNavigate('patient-dashboard', 'patient', { user });
    } catch (err: any) {
      setError(err?.message || 'An unexpected network error occurred.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center min-h-full py-8 px-6 sm:px-10 lg:px-14 max-w-xl mx-auto w-full">
      {/* Header */}
      <div className="mb-6 space-y-1.5">
        <span className="text-xs font-semibold text-teal-400 tracking-wider uppercase flex items-center gap-1.5">
          <ShieldCheck size={14} />
          <span>Patient Portal Onboarding</span>
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Complete Your MediAI Profile
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Your Google account has been verified. Finalize your patient clinical record to complete enrollment.
        </p>
      </div>

      {/* Verified Google Account Badge */}
      <div className="mb-5 p-3.5 rounded-xl bg-slate-900/90 border border-teal-500/30 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
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
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-teal-400 font-medium uppercase tracking-wider">
            Verified Google Account
          </div>
          <div className="text-sm font-semibold text-slate-200 truncate">
            {authUser?.email || 'Authenticated User'}
          </div>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-300 text-xs font-medium border border-teal-500/20">
          <HeartPulse size={12} />
          <span>Patient</span>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs sm:text-sm">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Full Name */}
        <div>
          <label htmlFor="google-fullname" className="block text-xs font-medium text-slate-300 mb-1.5">
            Full Legal Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <User size={16} />
            </div>
            <input
              id="google-fullname"
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: '' }));
              }}
              disabled={isLoading}
              placeholder="e.g. Eleanor Vance"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40"
            />
          </div>
          {fieldErrors.fullName && (
            <p className="text-xs text-rose-400 mt-1">{fieldErrors.fullName}</p>
          )}
        </div>

        {/* Contact Phone */}
        <div>
          <label htmlFor="google-phone" className="block text-xs font-medium text-slate-300 mb-1.5">
            Contact Phone Number
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Phone size={16} />
            </div>
            <input
              id="google-phone"
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: '' }));
              }}
              disabled={isLoading}
              placeholder="+1 (555) 234-5678"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40 font-mono"
            />
          </div>
          {fieldErrors.phone && (
            <p className="text-xs text-rose-400 mt-1">{fieldErrors.phone}</p>
          )}
        </div>

        {/* Date of Birth */}
        <div>
          <label htmlFor="google-dob" className="block text-xs font-medium text-slate-300 mb-1.5">
            Date of Birth
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Calendar size={16} />
            </div>
            <input
              id="google-dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => {
                setDateOfBirth(e.target.value);
                if (fieldErrors.dateOfBirth) setFieldErrors((prev) => ({ ...prev, dateOfBirth: '' }));
              }}
              disabled={isLoading}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40"
            />
          </div>
          {fieldErrors.dateOfBirth && (
            <p className="text-xs text-rose-400 mt-1">{fieldErrors.dateOfBirth}</p>
          )}
        </div>

        {/* Terms and Governance Agreement */}
        <div className="pt-2">
          <label className="flex items-start gap-2.5 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => {
                setAcceptTerms(e.target.checked);
                if (fieldErrors.acceptTerms) setFieldErrors((prev) => ({ ...prev, acceptTerms: '' }));
              }}
              disabled={isLoading}
              className="rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-teal-500 h-4 w-4 mt-0.5"
            />
            <span>
              I accept the MediAI Patient Care Agreement, HIPAA privacy disclosures, and terms of medical service.
            </span>
          </label>
          {fieldErrors.acceptTerms && (
            <p className="text-xs text-rose-400 mt-1">{fieldErrors.acceptTerms}</p>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-3">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full relative group flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-300 hover:from-teal-300 hover:via-cyan-300 hover:to-teal-200 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-teal-500/10"
          >
            {isLoading ? (
              <>
                <Loader2 size={17} className="animate-spin text-slate-950" />
                <span>Creating patient health profile...</span>
              </>
            ) : (
              <>
                <span>Complete Patient Registration</span>
                <ArrowRight
                  size={16}
                  className="text-slate-950 group-hover:translate-x-0.5 transition-transform"
                />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
