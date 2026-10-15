/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { HospitalRole, ScreenState, AuthResponse } from '../types/auth';
import { ROLES_CONFIG } from '../data/roles';
import { RoleSelector } from './RoleSelector';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { authService } from '../services/authService';
import { isValidEmail, calculatePasswordStrength } from '../utils/validation';

interface ForgotPasswordScreenProps {
  onNavigate: (screen: ScreenState, role?: HospitalRole) => void;
  selectedRole: HospitalRole;
  onRoleChange: (role: HospitalRole) => void;
}

type ResetStep = 'request' | 'verify' | 'new-password' | 'completed';

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  onNavigate,
  selectedRole,
  onRoleChange,
}) => {
  const [step, setStep] = useState<ResetStep>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleRoleSelect = (role: HospitalRole) => {
    onRoleChange(role);
    setEmail('');
    setError(null);
  };

  // Step 1: Request Code
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !isValidEmail(email)) {
      setError('Please provide a valid registered email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.requestPasswordReset(selectedRole, email.trim());
      if (res.success) {
        setSuccessMessage(res.message);
        setCode('849201'); // Pre-fill sample code for seamless tester experience
        setStep('verify');
      } else {
        setError(res.message);
      }
    } catch {
      setError('Failed to dispatch reset request.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify Code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code.trim() || code.trim().length !== 6) {
      setError('Please enter the 6-digit security code.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.verifyResetCode(email, code.trim());
      if (res.success) {
        setSuccessMessage('Verification code confirmed.');
        setStep('new-password');
      } else {
        setError(res.message);
      }
    } catch {
      setError('Failed to verify code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Set New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const strength = calculatePasswordStrength(newPassword);
    if (strength.score < 2 || newPassword.length < 8) {
      setError('New password must be at least 8 characters with a mix of letters and numbers.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.resetPassword(email, newPassword);
      if (res.success) {
        setSuccessMessage(res.message);
        setStep('completed');
      } else {
        setError(res.message);
      }
    } catch {
      setError('Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center min-h-full py-8 px-6 sm:px-10 lg:px-14 max-w-xl mx-auto w-full">
      {/* Back button */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => onNavigate('login', selectedRole)}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to Sign In</span>
        </button>
      </div>

      {/* Step Indicator Header */}
      <div className="mb-6 space-y-1.5">
        <span className="text-xs font-semibold text-teal-400 tracking-wider uppercase">
          Account Recovery Protocol
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          {step === 'completed' ? 'Password Reset Successful' : 'Reset your password'}
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          {step === 'request' && 'Select your role and provide your registered email to receive an authorization code.'}
          {step === 'verify' && 'Enter the 6-digit one-time authorization code sent to your email.'}
          {step === 'new-password' && 'Create a strong, compliant replacement password for your hospital portal account.'}
          {step === 'completed' && 'Your credentials have been updated and are ready for sign-in.'}
        </p>
      </div>

      {/* Error & Success Messages */}
      {error && (
        <div
          role="alert"
          className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 animate-in fade-in duration-200 flex items-start gap-2.5"
        >
          <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{error}</div>
        </div>
      )}

      {successMessage && step !== 'completed' && (
        <div className="mb-5 p-3.5 rounded-xl bg-teal-950/60 border border-teal-500/40 text-xs text-teal-200 animate-in fade-in duration-200 flex items-start gap-2.5">
          <CheckCircle2 size={16} className="text-teal-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{successMessage}</div>
        </div>
      )}

      {/* STEP 1: REQUEST */}
      {step === 'request' && (
        <form onSubmit={handleRequestCode} className="space-y-5" noValidate>
          <div className="mb-4">
            <RoleSelector
              selectedRole={selectedRole}
              onSelectRole={handleRoleSelect}
              variant="compact"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="reset-email" className="block text-xs font-medium text-slate-300 mb-1.5">
              Registered {ROLES_CONFIG[selectedRole].title} Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail size={16} />
              </div>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                placeholder="name@hospital.mediai.health"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Enter the email address associated with your registered hospital account.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-300 hover:from-teal-300 hover:via-cyan-300 hover:to-teal-200 active:scale-[0.99] transition-all duration-150 shadow-lg shadow-teal-500/25 disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin text-slate-950" />
                <span>Sending Code...</span>
              </>
            ) : (
              <>
                <span>Send Verification Code</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      )}

      {/* STEP 2: VERIFY */}
      {step === 'verify' && (
        <form onSubmit={handleVerifyCode} className="space-y-5" noValidate>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-slate-400 text-[11px]">Recovery Target:</span>
              <p className="font-mono text-teal-300 text-xs font-medium">{email}</p>
            </div>
            <button
              type="button"
              onClick={() => setStep('request')}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              Change
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="verify-code" className="block text-xs font-medium text-slate-300">
                6-Digit Authorization Code
              </label>
              <span className="text-[11px] text-slate-400">
                Dispatched via Encrypted Delivery
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <KeyRound size={16} />
              </div>
              <input
                id="verify-code"
                type="text"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                disabled={isLoading}
                placeholder="••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-600 text-base font-mono tracking-widest text-center focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-xs text-slate-950 bg-gradient-to-r from-teal-400 to-cyan-400 hover:from-teal-300 hover:to-cyan-300 transition-colors disabled:opacity-60 cursor-pointer shadow-lg shadow-teal-500/20"
            >
              {isLoading ? (
                <Loader2 size={15} className="animate-spin text-slate-950" />
              ) : (
                <>
                  <span>Verify Code</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* STEP 3: NEW PASSWORD */}
      {step === 'new-password' && (
        <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
          <div>
            <label htmlFor="new-password" className="block text-xs font-medium text-slate-300 mb-1">
              New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock size={15} />
              </div>
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
                placeholder="Enter replacement password"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 font-mono"
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
            <label htmlFor="confirm-new-password" className="block text-xs font-medium text-slate-300 mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock size={15} />
              </div>
              <input
                id="confirm-new-password"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                placeholder="Confirm replacement password"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 font-mono"
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

          <PasswordStrengthIndicator password={newPassword} showRequirements={true} />

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-300 hover:from-teal-300 hover:via-cyan-300 hover:to-teal-200 transition-all shadow-lg shadow-teal-500/25 disabled:opacity-60 cursor-pointer pt-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin text-slate-950" />
                <span>Updating Password...</span>
              </>
            ) : (
              <>
                <span>Commit New Password</span>
                <ShieldCheck size={16} />
              </>
            )}
          </button>
        </form>
      )}

      {/* STEP 4: COMPLETED */}
      {step === 'completed' && (
        <div className="space-y-6 text-center animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-teal-950/80 border border-teal-500/40 text-teal-400 mx-auto flex items-center justify-center shadow-lg shadow-teal-500/20">
            <CheckCircle2 size={32} />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white">Password Updated</h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
              Your security credentials for <strong className="text-teal-300">{email}</strong> have been updated in the MediAI identity layer.
            </p>
            <p className="text-[11px] text-slate-400 font-mono">
              [Demo Mode] Simulated hash update for MySQL hospital_db completed.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('login', selectedRole)}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-300 hover:from-teal-300 hover:via-cyan-300 hover:to-teal-200 transition-all shadow-lg shadow-teal-500/25 cursor-pointer"
          >
            <span>Proceed to Sign In</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
