/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AiHospitalAssistantLogo } from './AiHospitalAssistantLogo';
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
        <div className="fixed bottom-6 right-6 z-40">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            title="Open AI Hospital Assistant"
            aria-label="Open AI Hospital Assistant"
            className="group relative flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#00BFA6] to-[#14B8A6] hover:from-[#00A892] hover:to-[#0D9488] text-white shadow-xl shadow-teal-900/20 hover:shadow-2xl hover:shadow-teal-900/30 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00BFA6] focus-visible:ring-offset-2"
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
