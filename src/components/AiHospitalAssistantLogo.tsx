/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface AiHospitalAssistantLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  showSubtitle?: boolean;
  variant?: 'light' | 'dark' | 'auto';
}

/**
 * Medi AI Assistant Robot Avatar Component
 * Displays the healthcare companion robot from the uploaded reference image
 */
export const MediAiRobotAvatar: React.FC<{
  size?: number;
  className?: string;
  alt?: string;
}> = ({ size = 32, className = '', alt = 'Medi AI Assistant' }) => {
  return (
    <div
      className={`relative shrink-0 rounded-full overflow-hidden bg-[#EBF6FD] flex items-center justify-center border border-white/80 shadow-xs select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src="/assets/aistudio/medi_ai_avatar_square.png"
        alt={alt}
        className="w-full h-full object-cover rounded-full"
        loading="eager"
      />
    </div>
  );
};

/**
 * Medi AI Hospital Assistant Logo
 * Palette: Medical Blue (#0284C7 / #2563EB), Hospital Teal (#0D9488 / #00BFA6), Mint, White.
 */
export const AiHospitalAssistantLogo: React.FC<AiHospitalAssistantLogoProps> = ({
  size = 36,
  className = '',
  showText = false,
  showSubtitle = false,
  variant = 'auto',
}) => {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Robot Avatar Image Container */}
      <MediAiRobotAvatar size={size} alt="Medi AI Assistant" />

      {/* Optional Branding Text */}
      {showText && (
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-bold tracking-tight text-sm sm:text-base ${
                variant === 'dark'
                  ? 'text-white'
                  : variant === 'light'
                  ? 'text-slate-900'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              Medi AI Assistant
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200">
              24/7
            </span>
          </div>
          {showSubtitle && (
            <p className="text-[11px] text-slate-500 leading-tight">
              Your 24/7 companion for hospital information, appointments, and more.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
