/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MediAiRobotAvatar } from './AiHospitalAssistantLogo';
import { AiHospitalAssistant } from './AiHospitalAssistant';
import { aiChatService } from '../services/aiChatService';
import { AuthUser } from '../types/auth';

interface AiHospitalAssistantLauncherProps {
  user?: AuthUser | null;
  onOpenBookingWizard?: () => void;
  onNavigateTab?: (tab: string) => void;
  onDisabledStateChange?: (enabled: boolean) => void;
}

export const AiHospitalAssistantLauncher: React.FC<AiHospitalAssistantLauncherProps> = ({
  user,
  onOpenBookingWizard,
  onNavigateTab,
  onDisabledStateChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState<boolean>(() => aiChatService.isChatbotEnabled());
  const [isHovered, setIsHovered] = useState(false);

  // Sync with service preference
  useEffect(() => {
    let mounted = true;
    aiChatService.fetchServerPreferences().then((pref) => {
      if (mounted) {
        setIsEnabled(pref.chatbotEnabled);
        if (onDisabledStateChange) {
          onDisabledStateChange(pref.chatbotEnabled);
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, [onDisabledStateChange]);

  const handleRemove = () => {
    setIsEnabled(false);
    setIsOpen(false);
    if (onDisabledStateChange) {
      onDisabledStateChange(false);
    }
  };

  // If chatbot is removed/disabled by user, do not render launcher
  if (!isEnabled) {
    return null;
  }

  return (
    <>
      {/* Floating Action Launcher Button (Visible when closed) */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5">
          {/* Hover Tooltip: Unmistakably visible as Medi AI Assistant when pointed at */}
          <div
            className={`pointer-events-none transition-all duration-200 select-none px-3 py-1.5 rounded-full bg-slate-900/95 text-white text-xs font-semibold shadow-lg border border-slate-700/60 backdrop-blur-xs flex items-center gap-1.5 ${
              isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#00BFA6] animate-pulse" />
            <span>Medi AI Assistant</span>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(true)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onFocus={() => setIsHovered(true)}
            onBlur={() => setIsHovered(false)}
            aria-label="Medi AI Assistant"
            title="Medi AI Assistant"
            className="group relative flex items-center justify-center w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#0F172A] text-slate-100 shadow-2xl shadow-black/50 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border-2 border-[#00BFA6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 p-1"
          >
            {/* Cute Healthcare Robot Avatar from reference image */}
            <MediAiRobotAvatar size={38} alt="Medi AI Assistant" />

            {/* Subtle Teal active badge */}
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#00BFA6] border-2 border-[#0F172A]" />
            </span>
            <span className="sr-only">Medi AI Assistant</span>
          </button>
        </div>
      )}

      {/* Floating Chatbot Window */}
      {isOpen && (
        <AiHospitalAssistant
          user={user}
          mode="floating"
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onOpenBookingWizard={onOpenBookingWizard}
          onNavigateTab={onNavigateTab}
          onRemoveChatbot={handleRemove}
        />
      )}
    </>
  );
};
