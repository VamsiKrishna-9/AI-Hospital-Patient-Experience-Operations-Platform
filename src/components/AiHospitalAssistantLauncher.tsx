/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Maximize2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
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

type LauncherViewState = 'closed' | 'open' | 'minimized';

export const AiHospitalAssistantLauncher: React.FC<AiHospitalAssistantLauncherProps> = ({
  user,
  onOpenBookingWizard,
  onNavigateTab,
  onDisabledStateChange,
}) => {
  const [viewState, setViewState] = useState<LauncherViewState>('closed');
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
  }, [onDisabledStateChange]);

  const handleRemove = () => {
    setIsEnabled(false);
    setViewState('closed');
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
      <AnimatePresence mode="wait">
        {/* Floating Launcher Button (Closed state) */}
        {viewState === 'closed' && (
          <motion.div
            key="mediai-launcher-btn"
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 12 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40"
          >
            <button
              type="button"
              onClick={() => setViewState('open')}
              aria-label="Open Medi AI Assistant"
              title="Medi AI Assistant"
              className="group relative flex items-center gap-2.5 rounded-full bg-gradient-to-r from-[#00C9A7] to-[#00D4FF] p-1.5 sm:pr-4 text-[#06131F] shadow-[0_12px_32px_rgba(0,201,167,0.42)] hover:shadow-[0_16px_40px_rgba(0,212,255,0.52)] hover:-translate-y-0.5 hover:scale-[1.03] active:scale-95 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1220]"
            >
              <div className="relative rounded-full bg-[#0B1220] p-0.5 shadow-inner">
                <MediAiRobotAvatar
                  size={40}
                  alt="Medi AI Assistant"
                  className="border-0 bg-[#0B1220]"
                />
              </div>
              <span className="hidden sm:inline text-[13.5px] font-semibold tracking-tight whitespace-nowrap pr-0.5">
                Medi AI Assistant
              </span>
            </button>
          </motion.div>
        )}

        {/* Compact Minimized Bar (Minimized state) */}
        {viewState === 'minimized' && (
          <motion.div
            key="mediai-minimized-bar"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 rounded-full bg-[#111C30] border border-[#00C9A7]/30 pl-2 pr-2 py-1.5 text-[#F8FAFC] shadow-[0_14px_36px_rgba(2,8,23,0.65)]"
          >
            <button
              type="button"
              onClick={() => setViewState('open')}
              aria-label="Restore Medi AI Assistant"
              className="flex items-center gap-2.5 pr-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4FF] rounded-full"
            >
              <div className="relative shrink-0 p-[1.5px] rounded-full bg-gradient-to-br from-[#00C9A7] to-[#00D4FF]">
                <MediAiRobotAvatar
                  size={30}
                  alt="Medi AI Assistant"
                  className="border-0 bg-[#0B1220]"
                />
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#111C30]"
                  aria-hidden="true"
                />
              </div>
              <span className="text-[13px] font-semibold tracking-tight whitespace-nowrap">
                Medi AI Assistant
              </span>
            </button>

            <button
              type="button"
              onClick={() => setViewState('open')}
              aria-label="Expand chat"
              title="Expand"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#1A2940] hover:text-[#F8FAFC] transition-colors cursor-pointer"
            >
              <Maximize2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewState('closed')}
              aria-label="Close Medi AI Assistant"
              title="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#1A2940] hover:text-[#F8FAFC] transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </motion.div>
        )}

        {/* Mobile-Style Chat Window (Open state) */}
        {viewState === 'open' && (
          <AiHospitalAssistant
            key="mediai-chat-panel"
            user={user}
            mode="floating"
            isOpen={true}
            onMinimize={() => setViewState('minimized')}
            onClose={() => setViewState('closed')}
            onOpenBookingWizard={onOpenBookingWizard}
            onNavigateTab={onNavigateTab}
            onRemoveChatbot={handleRemove}
          />
        )}
      </AnimatePresence>
    </>
  );
};
