/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { calculatePasswordStrength } from '../utils/validation';
import { patientService } from '../services/patientService';

interface ChangePasswordScreenProps {
  patientId: string;
  tempToken?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({
  patientId,
  tempToken,
  onSuccess,
  onCancel,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError('Please enter your current or temporary password.');
      return;
    }

    const strength = calculatePasswordStrength(newPassword);
    if (strength.score < 2 || newPassword.length < 8) {
      setError('New password must be at least 8 characters with a mix of letters and numbers.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match. Please re-enter.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('Your new password must be different from your temporary password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await patientService.changePassword({
        patientId,
        currentPassword,
        newPassword,
        tempToken,
      });

      if (res.success) {
        onSuccess();
      } else {
        setError(res.message || 'Failed to update password.');
      }
    } catch {
      setError('An error occurred during password update. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center min-h-full py-8 px-6 sm:px-10 lg:px-14 max-w-xl mx-auto w-full animate-in fade-in duration-200">
      {/* Header */}
      <div className="mb-6 space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/60 border border-amber-500/40 text-amber-300">
          <ShieldCheck size={12} />
          <span>Security Policy Requirement</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Update Your Password
        </h2>

        <p className="text-xs sm:text-sm text-slate-400">
          Account <span className="font-mono text-teal-300 font-semibold">{patientId}</span> has a temporary password or requires a security update before opening your patient portal.
        </p>
      </div>

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

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Current Password */}
        <div>
          <label
            htmlFor="current-password"
            className="block text-xs font-medium text-slate-300 mb-1"
          >
            Current / Temporary Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Lock size={15} />
            </div>
            <input
              id="current-password"
              type={showCurrent ? 'text' : 'password'}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isLoading}
              placeholder="Enter current password"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              aria-label={showCurrent ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label
            htmlFor="new-patient-password"
            className="block text-xs font-medium text-slate-300 mb-1"
          >
            New Security Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Lock size={15} />
            </div>
            <input
              id="new-patient-password"
              type={showNew ? 'text' : 'password'}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isLoading}
              placeholder="At least 8 characters with letters & numbers"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              aria-label={showNew ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label
            htmlFor="confirm-patient-password"
            className="block text-xs font-medium text-slate-300 mb-1"
          >
            Confirm New Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Lock size={15} />
            </div>
            <input
              id="confirm-patient-password"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              placeholder="Re-enter your new password"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Strength Meter */}
        <PasswordStrengthIndicator password={newPassword} showRequirements={true} />

        {/* Submit Button */}
        <div className="pt-3 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="order-2 sm:order-1 flex-1 py-3 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 transition-colors cursor-pointer"
          >
            Cancel &amp; Sign Out
          </button>

          <button
            type="submit"
            disabled={isLoading}
            className="order-1 sm:order-2 flex-[2] flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-300 hover:from-teal-300 hover:via-cyan-300 hover:to-teal-200 active:scale-[0.99] transition-all duration-150 shadow-lg shadow-teal-500/25 disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin text-slate-950" />
                <span>Updating Password...</span>
              </>
            ) : (
              <>
                <span>Commit &amp; Open Dashboard</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
