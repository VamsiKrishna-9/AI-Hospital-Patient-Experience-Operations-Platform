/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HeartPulse, Stethoscope, ClipboardCheck, ShieldAlert } from 'lucide-react';
import { HospitalRole } from '../types/auth';
import { ROLES_CONFIG } from '../data/roles';

interface RoleSelectorProps {
  selectedRole: HospitalRole;
  onSelectRole: (role: HospitalRole) => void;
  variant?: 'compact' | 'full';
  disabled?: boolean;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({
  selectedRole,
  onSelectRole,
  variant = 'compact',
  disabled = false,
}) => {
  const roles: HospitalRole[] = ['patient', 'doctor', 'staff', 'admin'];

  const getRoleIcon = (role: HospitalRole, isSelected: boolean) => {
    const size = 18;
    switch (role) {
      case 'patient':
        return <HeartPulse size={size} className={isSelected ? 'text-teal-400' : 'text-slate-400 group-hover:text-teal-300'} />;
      case 'doctor':
        return <Stethoscope size={size} className={isSelected ? 'text-cyan-400' : 'text-slate-400 group-hover:text-cyan-300'} />;
      case 'staff':
        return <ClipboardCheck size={size} className={isSelected ? 'text-violet-400' : 'text-slate-400 group-hover:text-violet-300'} />;
      case 'admin':
        return <ShieldAlert size={size} className={isSelected ? 'text-amber-400' : 'text-slate-400 group-hover:text-amber-300'} />;
    }
  };

  const getActiveStyles = (role: HospitalRole) => {
    switch (role) {
      case 'patient':
        return 'border-teal-400/80 bg-teal-950/40 text-teal-100 shadow-[0_0_20px_rgba(20,184,166,0.22)] ring-1 ring-teal-400/50 scale-[1.02]';
      case 'doctor':
        return 'border-teal-400/80 bg-cyan-950/40 text-cyan-100 shadow-[0_0_20px_rgba(6,182,212,0.22)] ring-1 ring-teal-400/50 scale-[1.02]';
      case 'staff':
        return 'border-teal-400/80 bg-violet-950/40 text-violet-100 shadow-[0_0_20px_rgba(139,92,246,0.22)] ring-1 ring-teal-400/50 scale-[1.02]';
      case 'admin':
        return 'border-teal-400/80 bg-amber-950/30 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.22)] ring-1 ring-teal-400/50 scale-[1.02]';
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Select Your Portal Role
        </label>
        <span className="text-[11px] text-slate-400">
          {ROLES_CONFIG[selectedRole].subtitle}
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label="Hospital role selection"
        className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
      >
        {roles.map((role) => {
          const isSelected = selectedRole === role;
          const config = ROLES_CONFIG[role];

          return (
            <button
              key={role}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onSelectRole(role)}
              className={`group relative flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                isSelected
                  ? `${getActiveStyles(role)} ring-1 ring-white/10`
                  : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-850/80 hover:text-white'
              }`}
            >
              {/* Active pip indicator */}
              {isSelected && (
                <span className="absolute top-2 right-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                </span>
              )}

              <div
                className={`p-2 rounded-lg mb-1.5 transition-colors ${
                  isSelected
                    ? 'bg-slate-900/80 shadow-inner'
                    : 'bg-slate-800/60 group-hover:bg-slate-800'
                }`}
              >
                {getRoleIcon(role, isSelected)}
              </div>

              <span className="text-xs font-semibold tracking-tight">{config.title}</span>
              <span className="text-[10px] text-slate-400 group-hover:text-slate-300 mt-0.5 line-clamp-1">
                {role === 'admin' ? 'Security' : role === 'staff' ? 'Operations' : role === 'doctor' ? 'Clinical' : 'Patient'}
              </span>
            </button>
          );
        })}
      </div>

      {variant === 'full' && (
        <div className="mt-2.5 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
          <span className="text-teal-400 font-medium">Role Note:</span>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            {ROLES_CONFIG[selectedRole].description}
          </p>
        </div>
      )}
    </div>
  );
};
