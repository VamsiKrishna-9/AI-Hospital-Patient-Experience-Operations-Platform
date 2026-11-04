/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ArrowUp,
  RefreshCw,
  Trash2,
  AlertCircle,
  HelpCircle,
  MinusCircle,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { MediAiRobotAvatar } from './AiHospitalAssistantLogo';
import { aiChatService, ChatMessage } from '../services/aiChatService';
import { AuthUser } from '../types/auth';

interface AiHospitalAssistantProps {
  user?: AuthUser | null;
  mode?: 'floating' | 'fullpage';
  isOpen?: boolean;
  onClose?: () => void;
  onOpenBookingWizard?: () => void;
  onNavigateTab?: (tab: string) => void;
  onRemoveChatbot?: () => void;
}

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome-msg',
  role: 'model',
  content: 'Need my help?\nStart chat now',
  timestamp: 'Just now',
  quickActions: [
    { label: 'Book Appointment', action: 'book-appointment' },
    { label: 'Upcoming Visits', action: 'view-appointments' },
    { label: 'Hospital Contact', action: 'contact-support' },
  ],
};

const SUGGESTED_QUESTIONS = [
  'How do I book an appointment?',
  'What departments are available?',
  'What are the visiting hours?',
  'How can I view my lab results?',
];

export const AiHospitalAssistant: React.FC<AiHospitalAssistantProps> = ({
  user,
  mode = 'floating',
  isOpen = false,
  onClose,
  onOpenBookingWizard,
  onNavigateTab,
  onRemoveChatbot,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = aiChatService.getHistory();
    return saved.length > 0 ? saved : [DEFAULT_WELCOME_MESSAGE];
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen || mode === 'fullpage') {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [messages, isOpen, mode]);

  useEffect(() => {
    if (messages.length > 0 && messages[0].id !== 'welcome-msg') {
      aiChatService.saveHistory(messages);
    }
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsgId = `usr-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputMessage('');
    setIsLoading(true);
    setShowSuggestions(false);

    try {
      const response = await aiChatService.sendMessage(text, newMessages);
      if (response.success) {
        const assistantMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'model',
          content: response.reply,
          timestamp: response.timestamp,
          quickActions: response.quickActions,
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
          content: 'Unable to communicate with the assistant. Please try again.',
          timestamp: 'Just now',
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewChat = () => {
    const fresh: ChatMessage = {
      ...DEFAULT_WELCOME_MESSAGE,
      id: `welcome-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([fresh]);
    aiChatService.clearHistory();
    setToastMessage('Started new session');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleConfirmClear = () => {
    aiChatService.clearHistory();
    setMessages([DEFAULT_WELCOME_MESSAGE]);
    setShowClearDialog(false);
    setToastMessage('Conversation cleared');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleConfirmRemove = async () => {
    setShowRemoveDialog(false);
    const result = await aiChatService.setChatbotEnabled(false);
    if (onRemoveChatbot) {
      onRemoveChatbot();
    }
    setToastMessage(result.message || 'AI Assistant removed');
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
    } else if (action === 'contact-support') {
      handleSendMessage('What are the hospital main contact details and campus departments?');
    }
  };

  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={idx} className="h-1.5" />;
      }
      return (
        <p key={idx} className="leading-relaxed">
          {trimmed}
        </p>
      );
    });
  };

  if (mode === 'floating' && !isOpen) {
    return null;
  }

  const cardContent = (
    <div className="relative w-full h-full flex flex-col">
      {/* Standalone Circular Close Button at Top-Right (matching reference layout) */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Medi AI Assistant"
          title="Close Medi AI Assistant"
          className="absolute -top-3.5 -right-3.5 w-10 h-10 rounded-full bg-[#0F172A] shadow-xl border border-slate-700/80 flex items-center justify-center text-[#00BFA6] hover:text-teal-300 hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer z-30"
        >
          <X size={20} strokeWidth={2.8} />
        </button>
      )}

      {/* Main Card with High-Visibility Dark Theme */}
      <div className="relative w-full h-full bg-[#0F172A] rounded-[32px] shadow-2xl shadow-black/50 flex flex-col p-5 sm:p-6 overflow-hidden border border-slate-700/80">
        {/* Top Header Row */}
        <div className="flex items-center justify-between shrink-0 mb-3">
          {/* Vibrant Teal Pill Header with Medi AI Robot Avatar */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#00BFA6] text-white shadow-md">
            <MediAiRobotAvatar size={24} className="border border-white/80" />
            <span className="font-semibold text-[13px] tracking-wide text-white select-none">
              Medi AI Assistant
            </span>
          </div>

          {/* Discreet Auxiliary Controls */}
          <div className="flex items-center gap-1 text-slate-400">
            <button
              type="button"
              onClick={handleNewChat}
              title="Start New Chat"
              aria-label="New chat"
              className="p-1.5 rounded-full hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <RefreshCw size={13} />
            </button>
            <button
              type="button"
              onClick={() => setShowClearDialog(true)}
              title="Clear Conversation"
              aria-label="Clear conversation"
              className="p-1.5 rounded-full hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
            </button>
            <button
              type="button"
              onClick={() => setShowRemoveDialog(true)}
              title="Remove Chatbot"
              aria-label="Remove Chatbot"
              className="p-1.5 rounded-full hover:bg-rose-950/50 hover:text-rose-400 transition-colors cursor-pointer"
            >
              <MinusCircle size={13} />
            </button>
          </div>
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div className="mb-2 px-3 py-1.5 bg-teal-950/80 text-teal-200 text-[11px] font-medium rounded-xl flex items-center justify-between border border-teal-700/80 animate-in fade-in">
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-teal-400 hover:text-teal-200 font-bold ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Conversation Message Stream */}
        <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1 no-scrollbar">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
              >
                <div
                  className={`px-4 py-2.5 max-w-[85%] text-[13px] leading-snug transition-all ${
                    isUser
                      ? 'bg-[#1E293B] text-slate-100 border border-slate-700/80 rounded-[22px] rounded-tr-xs font-normal shadow-xs'
                      : msg.isError
                      ? 'bg-rose-950/60 text-rose-200 border border-rose-800/80 rounded-[22px] rounded-tl-xs'
                      : 'bg-[#00BFA6] text-white rounded-[22px] rounded-tl-xs font-normal shadow-sm'
                  }`}
                >
                  {renderMessageContent(msg.content)}

                  {/* Quick Action Chips attached to greeting or AI reply */}
                  {!isUser && msg.quickActions && msg.quickActions.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-white/20 flex flex-wrap gap-1.5">
                      {msg.quickActions.map((qa, qidx) => (
                        <button
                          key={qidx}
                          type="button"
                          onClick={() => handleQuickAction(qa.action)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-900/90 text-teal-200 hover:bg-slate-950 hover:text-white transition-colors shadow-2xs cursor-pointer border border-teal-400/30"
                        >
                          <Sparkles size={10} className="text-teal-400" />
                          <span>{qa.label}</span>
                          <ChevronRight size={10} className="text-teal-400" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Thinking / Loading indicator */}
          {isLoading && (
            <div className="flex items-start">
              <div className="bg-[#00BFA6] text-white rounded-[22px] rounded-tl-xs px-4 py-2.5 text-xs flex items-center gap-2 shadow-xs">
                <span className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" />
                </span>
                <span className="font-medium text-white/90">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestions toggle/chips */}
        <div className="pt-1.5 pb-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <button
              type="button"
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="inline-flex items-center gap-1 hover:text-teal-400 transition-colors cursor-pointer"
            >
              <HelpCircle size={11} />
              <span>{showSuggestions ? 'Hide suggested questions' : 'Quick questions'}</span>
            </button>
          </div>
          {showSuggestions && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar animate-in fade-in">
              {SUGGESTED_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleSendMessage(q)}
                  className="shrink-0 px-2.5 py-1 rounded-full text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-teal-300 border border-slate-700 hover:border-teal-500/50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pill Input Bar with Circular Send Button */}
        <div className="shrink-0">
          <div className="flex items-center justify-between bg-[#1E293B] border border-slate-700/80 rounded-full px-4 py-1.5 transition-all focus-within:ring-2 focus-within:ring-teal-400/30 focus-within:border-teal-400/80">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Your text here....."
              className="flex-1 bg-transparent text-[13px] text-white placeholder-slate-400 focus:outline-none py-1.5"
            />

            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || isLoading}
              aria-label="Send message"
              title="Send"
              className="w-8 h-8 rounded-full bg-[#00BFA6] hover:bg-[#00A892] text-white flex items-center justify-center shrink-0 shadow-md transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ml-2"
            >
              <ArrowUp size={16} strokeWidth={2.8} />
            </button>
          </div>
        </div>
      </div>

      {/* Cascading Stacked Deck Underneath (Layer 1) - matching reference layout in dark theme */}
      <div
        className="absolute -bottom-3 inset-x-5 h-7 bg-[#1E293B] border-b border-x border-slate-700/60 rounded-b-[28px] -z-10 shadow-sm pointer-events-none"
        aria-hidden="true"
      />

      {/* Cascading Stacked Deck Underneath (Layer 2) - matching reference layout in dark theme */}
      <div
        className="absolute -bottom-6 inset-x-9 h-7 bg-[#334155] border-b border-x border-slate-700/40 rounded-b-[24px] -z-20 shadow-sm pointer-events-none"
        aria-hidden="true"
      />

      {/* Remove Confirmation Modal */}
      {showRemoveDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-700/80 space-y-3.5 animate-in zoom-in-95">
            <div className="w-10 h-10 rounded-2xl bg-rose-950/60 text-rose-400 flex items-center justify-center border border-rose-800/60">
              <AlertCircle size={20} />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white tracking-tight">
                Remove Medi AI Assistant?
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to remove Medi AI Assistant from your view? You can restore it later if needed.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowRemoveDialog(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear History Confirmation Modal */}
      {showClearDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-700/80 space-y-3.5 animate-in zoom-in-95">
            <div className="w-10 h-10 rounded-2xl bg-amber-950/60 text-amber-400 flex items-center justify-center border border-amber-800/60">
              <Trash2 size={20} />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white tracking-tight">
                Clear Conversation?
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Clear all conversation history? This cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowClearDialog(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (mode === 'fullpage') {
    return (
      <div className="w-full flex items-center justify-center py-6 sm:py-10 bg-slate-950/80 rounded-3xl min-h-[540px]">
        <div className="w-[350px] max-w-[92vw] h-[460px]">{cardContent}</div>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-10 right-6 sm:right-8 z-50 w-[calc(100vw-36px)] sm:w-[350px] max-w-[360px] h-[450px] max-h-[82vh] animate-in fade-in slide-in-from-bottom-4 duration-200"
      role="region"
      aria-label="Medi AI Assistant"
    >
      {cardContent}
    </div>
  );
};
