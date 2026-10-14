/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Check, X } from 'lucide-react';
import { calculatePasswordStrength } from '../utils/validation';

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  showRequirements = true,
}) => {
  if (!password) return null;

  const strength = calculatePasswordStrength(password);

  const getBarColor = (score: number) => {
    switch (score) {
      case 1:
        return 'bg-rose-500';
      case 2:
        return 'bg-amber-500';
      case 3:
        return 'bg-cyan-500';
      case 4:
        return 'bg-emerald-400';
      default:
        return 'bg-slate-700';
    }
  };

  const getLabelColor = (score: number) => {
    switch (score) {
      case 1:
        return 'text-rose-400';
      case 2:
        return 'text-amber-400';
      case 3:
        return 'text-cyan-400';
      case 4:
        return 'text-emerald-400';
      default:
        return 'text-slate-400';
    }
  };

  const requirements = [
    { label: 'At least 8 characters', met: strength.hasMinLength },
    { label: 'Uppercase letter (A-Z)', met: strength.hasUppercase },
    { label: 'Lowercase letter (a-z)', met: strength.hasLowercase },
    { label: 'Number (0-9)', met: strength.hasNumber },
    { label: 'Special symbol (!@#$)', met: strength.hasSpecialChar },
  ];

  return (
    <div className="mt-2 space-y-2 text-xs">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Password Strength</span>
          <span className={`font-semibold ${getLabelColor(strength.score)}`}>
            {strength.label}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 h-1.5">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`rounded-full h-full transition-all duration-300 ${
                step <= strength.score ? getBarColor(strength.score) : 'bg-slate-800'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Requirements checklist */}
      {showRequirements && (
        <div className="pt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-400">
          {requirements.map((req, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              {req.met ? (
                <Check size={12} className="text-emerald-400 shrink-0" />
              ) : (
                <X size={12} className="text-slate-600 shrink-0" />
              )}
              <span className={req.met ? 'text-slate-200' : 'text-slate-500'}>
                {req.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
