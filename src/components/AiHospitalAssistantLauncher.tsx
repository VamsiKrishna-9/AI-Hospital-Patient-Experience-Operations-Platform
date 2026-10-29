/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AiHospitalAssistantLogo } from './AiHospitalAssistantLogo';
import { AiHospitalAssistant } from './AiHospitalAssistant';
import { aiChatService } from '../services/aiChatService';
import { AuthUser } from '../types/auth';
import { Sparkles, X } from 'lucide-react';

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
  const [showTooltip, setShowTooltip] = useState(false);

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
  }, []);

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
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
          {/* Subtle Attention Prompt Pill */}
          <div
            className={`hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/95 text-slate-800 text-xs font-bold shadow-xl border border-teal-200/80 backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-right-4 ${
              showTooltip ? 'opacity-100 scale-100' : 'opacity-90'
            }`}
          >
            <Sparkles size={14} className="text-teal-600 animate-pulse" />
            <span>Need hospital help? Ask AI</span>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(true)}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            aria-label="Open AI Hospital Assistant"
            className="group relative flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 via-teal-600 to-emerald-600 text-white shadow-xl shadow-teal-900/25 hover:shadow-2xl hover:shadow-teal-900/35 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2"
          >
            <AiHospitalAssistantLogo size={36} showText={false} />
            <span className="sr-only">Open AI Hospital Assistant</span>
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
