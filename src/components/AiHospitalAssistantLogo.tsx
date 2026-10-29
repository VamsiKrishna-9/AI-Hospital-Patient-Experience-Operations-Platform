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
 * AI Hospital Assistant Logo
 * Concepts: Friendly healthcare robotic intelligence + medical cross + communication chat bubble.
 * Palette: Medical Blue (#0284C7 / #2563EB), Hospital Teal (#0D9488 / #059669), Mint (#10B981 / #ECFDF5), White.
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
      {/* Scalable SVG Icon Container */}
      <div
        className="relative shrink-0 flex items-center justify-center select-none"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm transition-transform duration-200"
        >
          <defs>
            {/* Medical Blue to Hospital Teal Main Gradient */}
            <linearGradient id="aiLogoGradient" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0284C7" />
              <stop offset="55%" stopColor="#0D9488" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            {/* Glowing Accent Gradient for Antennas and Visor */}
            <linearGradient id="aiVisorGradient" x1="12" y1="18" x2="36" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#E0F2FE" />
              <stop offset="100%" stopColor="#CCFBF1" />
            </linearGradient>

            {/* Soft Glow filter */}
            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0284C7" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* 1. Chat Bubble Base with Smooth Medical Silhouette */}
          <path
            d="M8 12C8 7.58172 11.5817 4 16 4H32C36.4183 4 40 7.58172 40 12V28C40 32.4183 36.4183 36 32 36H20L11.5 42.5C10.15 43.5 8 42.6 8 40.8V36C8 36 8 36 8 36C8 36 8 12 8 12Z"
            fill="url(#aiLogoGradient)"
          />

          {/* 2. Top Sensor Antenna & Connectivity Signal */}
          <circle cx="24" cy="9.5" r="2.2" fill="#FFFFFF" />
          <path d="M24 11.7V14" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />

          {/* 3. Healthcare Robot Visor / Screen Face */}
          <rect
            x="13.5"
            y="14"
            width="21"
            height="13.5"
            rx="5.5"
            fill="#0F172A"
            stroke="url(#aiVisorGradient)"
            strokeWidth="1.2"
          />

          {/* 4. Robot Eyes: Attentive, Caring & Friendly Curved Arcs */}
          <circle cx="19" cy="19.5" r="1.8" fill="#38BDF8" />
          <circle cx="19.5" cy="19" r="0.6" fill="#FFFFFF" />

          <circle cx="29" cy="19.5" r="1.8" fill="#38BDF8" />
          <circle cx="29.5" cy="19" r="0.6" fill="#FFFFFF" />

          {/* Robot Gentle Smile */}
          <path
            d="M21.5 23.5C22.2 24.3 23 24.7 24 24.7C25 24.7 25.8 24.3 26.5 23.5"
            stroke="#34D399"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* 5. Prominent Medical Cross Badge on Base */}
          <g filter="url(#softGlow)">
            {/* White Circular Badge */}
            <circle cx="35" cy="32" r="7" fill="#FFFFFF" />
            <circle cx="35" cy="32" r="6.2" fill="#ECFDF5" />
            {/* Medical Cross in Hospital Emerald / Teal */}
            <path
              d="M33.5 28.5H36.5V30.5H38.5V33.5H36.5V35.5H33.5V33.5H31.5V30.5H33.5V28.5Z"
              fill="#059669"
            />
          </g>

          {/* Subtle Ear sensors */}
          <path d="M10.5 18.5V23" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
          <path d="M37.5 18.5V23" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        </svg>

        {/* Live Active Pulse Indicator Dot */}
        <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white" />
        </span>
      </div>

      {/* Optional Branding Text */}
      {showText && (
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-bold tracking-tight text-sm sm:text-base ${
                variant === 'dark' ? 'text-white' : variant === 'light' ? 'text-slate-900' : 'text-slate-900 dark:text-white'
              }`}
            >
              AI Hospital Assistant
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
