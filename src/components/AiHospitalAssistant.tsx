/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Minus,
  SendHorizontal,
  FileText,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { MediAiRobotAvatar } from './AiHospitalAssistantLogo';
import { aiChatService, ChatMessage } from '../services/aiChatService';
import { AuthUser } from '../types/auth';

interface AiHospitalAssistantProps {
  user?: AuthUser | null;
  mode?: 'floating' | 'fullpage';
  isOpen?: boolean;
  onClose?: () => void;
  onMinimize?: () => void;
  onOpenBookingWizard?: () => void;
  onNavigateTab?: (tab: string) => void;
  onRemoveChatbot?: () => void;
}

/**
 * Filter out any legacy static welcome greeting stored from previous versions
 * so a fresh session displays the clean minimal welcome screen.
 */
function loadCleanHistory(): ChatMessage[] {
  const saved = aiChatService.getHistory();
  return saved.filter(
    (msg) =>
      msg &&
      typeof msg.content === 'string' &&
      !msg.id.startsWith('welcome') &&
      !msg.content.includes('Need my help?')
  );
}

export const AiHospitalAssistant: React.FC<AiHospitalAssistantProps> = ({
  mode = 'floating',
  isOpen = false,
  onClose,
  onMinimize,
  onOpenBookingWizard,
  onNavigateTab,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadCleanHistory());
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen || mode === 'fullpage') {
      scrollToBottom();
    }
  }, [messages, isLoading, isOpen, mode]);

  useEffect(() => {
    if (isOpen || mode === 'fullpage') {
      const timer = setTimeout(() => textareaRef.current?.focus(), 180);
      return () => clearTimeout(timer);
    }
  }, [isOpen, mode]);

  useEffect(() => {
    if (messages.length > 0) {
      aiChatService.saveHistory(messages);
    }
  }, [messages]);

  // Auto-resize composer textarea cleanly up to ~112px
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [inputMessage]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    try {
      const response = await aiChatService.sendMessage(text, nextMessages);
      if (response.success) {
        const assistantMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'model',
          content: response.reply,
          timestamp: response.timestamp,
          quickActions: response.quickActions,
          sources: response.sources,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: `ai-err-${Date.now()}`,
          role: 'model',
          content: response.reply,
          timestamp: response.timestamp,
          isError: true,
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: 'model',
          content: 'Unable to reach Medi AI Assistant right now. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickAction = (action: string) => {
    if (action === 'book-appointment' && onOpenBookingWizard) {
      onOpenBookingWizard();
      if (mode === 'floating' && onClose) onClose();
    } else if (action === 'view-appointments' && onNavigateTab) {
      onNavigateTab('appointments');
      if (mode === 'floating' && onClose) onClose();
    } else if (action === 'view-labs' && onNavigateTab) {
      onNavigateTab('labs');
      if (mode === 'floating' && onClose) onClose();
    } else if (action === 'view-prescriptions' && onNavigateTab) {
      onNavigateTab('prescriptions');
      if (mode === 'floating' && onClose) onClose();
    } else if (action === 'view-feedback' && onNavigateTab) {
      onNavigateTab('feedback');
      if (mode === 'floating' && onClose) onClose();
    } else if (action === 'contact-support') {
      handleSendMessage('What are the hospital main contact details and campus locations?');
    }
  };

  const renderInlineFormatting = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <strong key={i} className="font-semibold text-[#F8FAFC]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 rounded bg-[#0B1220]/70 text-[#00D4FF] text-[12px] font-mono"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });
  };

  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={idx} className="h-2" />;
      }
      const isBullet = /^([•*-])\s+/.test(trimmed);
      if (isBullet) {
        const bulletBody = trimmed.replace(/^([•*-])\s+/, '');
        return (
          <div key={idx} className="flex items-start gap-2 leading-relaxed">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00C9A7]" aria-hidden="true" />
            <span className="flex-1 break-words">{renderInlineFormatting(bulletBody)}</span>
          </div>
        );
      }
      return (
        <p key={idx} className="leading-relaxed break-words">
          {renderInlineFormatting(trimmed)}
        </p>
      );
    });
  };

  if (mode === 'floating' && !isOpen) {
    return null;
  }

  const hasConversation = messages.length > 0;

  const chatShell = (
    <div className="relative flex h-full w-full flex-col overflow-hidden overflow-x-hidden bg-[#0B1220] text-[#F8FAFC] sm:rounded-[28px] sm:border sm:border-[#00C9A7]/20 sm:shadow-[0_24px_64px_rgba(2,8,23,0.7)]">
      {/* Header — Subtle Teal-to-Cyan Gradient */}
      <header className="shrink-0 bg-gradient-to-r from-[#0A3D4C] via-[#0B5E6D] to-[#0B7A91] border-b border-[#00D4FF]/20 px-4 pt-[max(0.875rem,env(safe-area-inset-top))] pb-3.5 sm:pt-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0 p-[2px] rounded-full bg-gradient-to-br from-[#00C9A7] to-[#00D4FF] shadow-[0_0_16px_rgba(0,201,167,0.35)]">
              <MediAiRobotAvatar
                size={34}
                alt="Medi AI Assistant"
                className="border-0 bg-[#0B1220]"
              />
              <span
                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0A3D4C]"
                aria-label="Online"
                title="Online"
              />
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-semibold tracking-tight text-[#F8FAFC]">
                Medi AI Assistant
              </h2>
            </div>
          </div>

          {/* Minimal Window Controls: Minimize & Close */}
          <div className="flex items-center gap-1 shrink-0">
            {(onMinimize || (mode === 'floating' && onClose)) && (
              <button
                type="button"
                onClick={onMinimize || onClose}
                aria-label="Minimize Medi AI Assistant"
                title="Minimize"
                className="flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-full text-[#F8FAFC]/85 hover:bg-white/15 hover:text-white active:scale-95 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4FF]"
              >
                <Minus size={17} strokeWidth={2.4} />
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close Medi AI Assistant"
                title="Close"
                className="flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-full text-[#F8FAFC]/85 hover:bg-white/15 hover:text-white active:scale-95 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4FF]"
              >
                <X size={17} strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Message Area / Minimal Welcome Screen */}
      <div className="mediai-chat-scroll flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 scroll-smooth">
        {!hasConversation && !isLoading ? (
          <div className="flex h-full min-h-[260px] flex-col items-center justify-center px-6 text-center select-none">
            <div className="mb-5 p-[2.5px] rounded-full bg-gradient-to-br from-[#00C9A7] to-[#00D4FF] shadow-[0_0_32px_rgba(0,201,167,0.28)]">
              <div className="rounded-full bg-[#111C30] p-1">
                <MediAiRobotAvatar
                  size={56}
                  alt="Medi AI Assistant"
                  className="border-0 bg-[#0B1220]"
                />
              </div>
            </div>
            <h3 className="text-[22px] font-semibold tracking-tight text-[#F8FAFC] text-balance">
              How can I help you?
            </h3>
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`flex items-end gap-2 max-w-[88%] ${
                      isUser ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    {!isUser && (
                      <div className="mb-1 shrink-0 p-[1.5px] rounded-full bg-gradient-to-br from-[#00C9A7]/80 to-[#00D4FF]/80">
                        <MediAiRobotAvatar
                          size={24}
                          alt="Medi AI"
                          className="border-0 bg-[#0B1220]"
                        />
                      </div>
                    )}

                    <div
                      className={`px-4 py-3 text-[13.5px] leading-relaxed break-words ${
                        isUser
                          ? 'rounded-[20px] rounded-br-[6px] bg-gradient-to-br from-[#0B7E74] to-[#0B6D93] text-[#F8FAFC] shadow-md shadow-[#00C9A7]/10'
                          : msg.isError
                          ? 'rounded-[20px] rounded-bl-[6px] bg-rose-950/60 border border-rose-500/30 text-rose-100'
                          : 'rounded-[20px] rounded-bl-[6px] bg-[#111C30] border border-[#00C9A7]/15 text-[#F8FAFC]'
                      }`}
                    >
                      {msg.isError && (
                        <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-rose-300">
                          <AlertCircle size={13} />
                          <span>Connection Notice</span>
                        </div>
                      )}

                      <div className="space-y-1">{renderMessageContent(msg.content)}</div>

                      {/* Retrieved Knowledge Base Source References */}
                      {!isUser && !msg.isError && msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-[#00C9A7]/15 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#94A3B8]">
                            <FileText size={12} className="text-[#00C9A7]" />
                            <span>Sources</span>
                          </div>
                          <ul className="space-y-1.5">
                            {msg.sources.slice(0, 3).map((src, sidx) => (
                              <li
                                key={src.chunkId || `${src.source}-${sidx}`}
                                className="rounded-xl bg-[#1A2940] px-2.5 py-1.5 text-[11.5px] leading-snug border border-[#00C9A7]/15 text-[#F8FAFC]"
                              >
                                <span className="font-medium text-[#F8FAFC]">
                                  {src.title || src.source}
                                </span>
                                {src.section && (
                                  <span className="text-[#94A3B8]"> · {src.section}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Preserved Quick Actions compatibility for assistant replies */}
                      {!isUser && !msg.isError && msg.quickActions && msg.quickActions.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-[#00C9A7]/15 flex flex-wrap gap-1.5">
                          {msg.quickActions.map((qa, qidx) => (
                            <button
                              key={qidx}
                              type="button"
                              onClick={() => handleQuickAction(qa.action)}
                              className="inline-flex items-center gap-1 rounded-xl bg-[#1A2940] px-3 py-1.5 text-[11.5px] font-medium text-[#00D4FF] hover:bg-[#223654] hover:text-white border border-[#00C9A7]/20 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <span>{qa.label}</span>
                              <ChevronRight size={12} className="text-[#00C9A7]" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Subtle Timestamp */}
                  <span
                    className={`mt-1 text-[10.5px] text-[#94A3B8] ${
                      isUser ? 'pr-1' : 'pl-9'
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              );
            })}

            {/* Subtle Typing / Loading Animation */}
            {isLoading && (
              <div className="flex items-end gap-2">
                <div className="mb-1 shrink-0 p-[1.5px] rounded-full bg-gradient-to-br from-[#00C9A7]/80 to-[#00D4FF]/80">
                  <MediAiRobotAvatar
                    size={24}
                    alt="Medi AI"
                    className="border-0 bg-[#0B1220]"
                  />
                </div>
                <div
                  className="rounded-[20px] rounded-bl-[6px] bg-[#111C30] border border-[#00C9A7]/15 px-4 py-3 flex items-center gap-1.5"
                  aria-label="Medi AI Assistant is typing"
                >
                  <span className="h-2 w-2 rounded-full bg-[#00C9A7] animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 rounded-full bg-[#00D4FF] animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 rounded-full bg-[#00C9A7] animate-bounce" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Fixed Bottom Chat Input Composer */}
      <div className="shrink-0 bg-[#0B1220] border-t border-[#00C9A7]/15 px-3.5 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
        <div className="flex items-end gap-2 rounded-[26px] bg-[#111C30] border border-[#00C9A7]/20 pl-4 pr-1.5 py-1.5 transition-all duration-150 hover:border-[#00C9A7]/40 focus-within:border-[#00D4FF]/70 focus-within:ring-2 focus-within:ring-[#00D4FF]/20">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Ask MediAI anything..."
            aria-label="Message Medi AI Assistant"
            className="flex-1 resize-none bg-transparent py-2 text-[14px] leading-snug text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none max-h-28 overflow-y-auto disabled:opacity-60"
          />

          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            aria-label="Send message"
            title="Send message"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#00C9A7] to-[#00D4FF] text-[#06131F] shadow-[0_4px_14px_rgba(0,201,167,0.35)] hover:brightness-110 active:scale-95 transition-all duration-150 disabled:opacity-35 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111C30]"
          >
            <SendHorizontal size={18} strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </div>
  );

  if (mode === 'fullpage') {
    return (
      <div className="w-full flex items-center justify-center py-6 px-3 sm:py-8 bg-[#0B1220]/95 rounded-3xl min-h-[680px]">
        <div className="w-full max-w-[400px] h-[660px]">{chatShell}</div>
      </div>
    );
  }

  return (
    <motion.div
      key="mediai-chat-window"
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.96 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-50 h-[100dvh] w-full sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[680px] sm:max-h-[calc(100vh-48px)] sm:w-[390px] sm:max-w-[calc(100vw-32px)]"
      role="dialog"
      aria-label="Medi AI Assistant"
    >
      {chatShell}
    </motion.div>
  );
};
