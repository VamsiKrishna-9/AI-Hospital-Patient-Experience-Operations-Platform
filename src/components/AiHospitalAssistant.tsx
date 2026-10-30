/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Minus,
  Send,
  Trash2,
  RefreshCw,
  Sparkles,
  ChevronDown,
  Calendar,
  Clock,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Maximize2,
  Minimize2,
  FileText,
  UserCheck,
  Building2,
  Info,
} from 'lucide-react';
import { AiHospitalAssistantLogo } from './AiHospitalAssistantLogo';
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
  content:
    "Hello! I'm your AI Hospital Assistant. I can help you find hospital information, understand appointment procedures, navigate hospital services, and access your available patient information securely. How can I help you today?",
  timestamp: 'Just now',
  quickActions: [
    { label: 'Check Upcoming Appointments', action: 'view-appointments' },
    { label: 'Book New Appointment', action: 'book-appointment' },
    { label: 'View Lab Reports', action: 'view-labs' },
  ],
};

const SUGGESTED_QUESTIONS = [
  'What hospital departments are available?',
  'How can I book an appointment?',
  'How can I check my upcoming appointments?',
  'What are the hospital visiting hours?',
  'How can I access my lab results?',
  'How can I contact hospital support?',
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false); // expanded view in floating mode

  // Confirmation dialog state for "Remove Chatbot"
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  // Confirmation dialog state for "Clear Conversation"
  const [showClearDialog, setShowClearDialog] = useState(false);
  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of conversation
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen || mode === 'fullpage') {
      scrollToBottom();
      // Focus textarea on open
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [messages, isOpen, mode]);

  // Persist messages whenever they change
  useEffect(() => {
    if (messages.length > 0 && messages[0].id !== 'welcome-msg') {
      aiChatService.saveHistory(messages);
    }
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    setErrorMessage(null);
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
        setErrorMessage(response.reply);
      }
    } catch (err: any) {
      setErrorMessage('Unexpected communication error. Please try again.');
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

  // Start fresh conversation (New Chat)
  const handleNewChat = () => {
    const fresh: ChatMessage = {
      ...DEFAULT_WELCOME_MESSAGE,
      id: `welcome-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([fresh]);
    aiChatService.clearHistory();
    setErrorMessage(null);
    setToastMessage('Started a fresh conversation session.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Clear Conversation (with confirmation)
  const handleConfirmClear = () => {
    aiChatService.clearHistory();
    setMessages([DEFAULT_WELCOME_MESSAGE]);
    setShowClearDialog(false);
    setErrorMessage(null);
    setToastMessage('Conversation history has been cleared.');
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Remove Chatbot (with exact title and message requested)
  const handleConfirmRemove = async () => {
    setShowRemoveDialog(false);
    const result = await aiChatService.setChatbotEnabled(false);
    if (onRemoveChatbot) {
      onRemoveChatbot();
    }
    setToastMessage(result.message || 'AI Hospital Assistant has been removed from your account.');
  };

  // Execute quick actions within message bubbles
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
      handleSendMessage('What are the main campus phone numbers and support contact details?');
    }
  };

  // Format message content with markdown-like bullet points and bolding
  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const itemText = trimmed.replace(/^([•\-*]\s*)/, '');
        return (
          <li key={idx} className="ml-4 list-disc text-inherit my-0.5 leading-relaxed">
            {formatBoldText(itemText)}
          </li>
        );
      }
      if (/^\d+\.\s/.test(trimmed)) {
        const itemText = trimmed.replace(/^\d+\.\s*/, '');
        return (
          <li key={idx} className="ml-4 list-decimal text-inherit my-0.5 leading-relaxed">
            {formatBoldText(itemText)}
          </li>
        );
      }
      if (!trimmed) {
        return <div key={idx} className="h-2" />;
      }
      return (
        <p key={idx} className="my-1 leading-relaxed">
          {formatBoldText(trimmed)}
        </p>
      );
    });
  };

  const formatBoldText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-bold text-inherit">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  // If in floating mode and closed, do not render panel
  if (mode === 'floating' && !isOpen) {
    return null;
  }

  const containerClasses =
    mode === 'floating'
      ? `fixed bottom-5 right-5 z-50 flex flex-col bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl rounded-3xl overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-bottom-4 ${
          isExpanded
            ? 'w-[92vw] sm:w-[600px] h-[82vh] max-h-[750px]'
            : 'w-[92vw] sm:w-[410px] h-[580px] max-h-[85vh]'
        }`
      : 'w-full flex-1 flex flex-col bg-slate-900/90 border border-slate-800 text-slate-100 rounded-3xl shadow-sm overflow-hidden min-h-[640px]';

  return (
    <div className={containerClasses} role="region" aria-label="AI Hospital Assistant Chat Interface">
      {/* 1. Header with Branding, Logo, and Controls */}
      <div className="bg-slate-950 text-white px-4 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <AiHospitalAssistantLogo size={36} showText={false} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm sm:text-base text-white tracking-tight leading-none">
                AI Hospital Assistant
              </h2>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-950/60 text-teal-300 border border-teal-500/40">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                24/7 Live
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
              Your 24/7 companion for hospital information, appointments, and more.
            </p>
          </div>
        </div>

        {/* Header Action Tools */}
        <div className="flex items-center gap-1 text-slate-400">
          {/* New Chat */}
          <button
            type="button"
            onClick={handleNewChat}
            title="Start New Chat"
            className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            aria-label="Start new conversation"
          >
            <RefreshCw size={15} />
          </button>

          {/* Clear Conversation */}
          <button
            type="button"
            onClick={() => setShowClearDialog(true)}
            title="Clear Conversation History"
            className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-rose-300 transition-colors cursor-pointer"
            aria-label="Clear conversation history"
          >
            <Trash2 size={15} />
          </button>

          {/* Floating mode: Expand / Minimize */}
          {mode === 'floating' && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'Restore default size' : 'Expand panel'}
              className="hidden sm:inline-flex p-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              aria-label={isExpanded ? 'Restore size' : 'Expand window'}
            >
              {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          )}

          {/* Remove / Disable Chatbot Option */}
          <button
            type="button"
            onClick={() => setShowRemoveDialog(true)}
            title="Remove Chatbot from Account"
            className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 transition-colors cursor-pointer"
          >
            Remove Chatbot
          </button>

          {/* Close button (floating mode only) */}
          {mode === 'floating' && onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close Assistant"
              className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors cursor-pointer ml-1"
              aria-label="Close assistant"
            >
              <X size={17} />
            </button>
          )}
        </div>
      </div>

      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="px-4 py-2 bg-teal-950/40 text-teal-300 text-xs font-semibold border-b border-teal-500/30 flex items-center justify-between animate-in fade-in">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-teal-400 hover:text-teal-200 font-bold ml-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-950/90">
        {/* Verified Hospital AI Safety Notice */}
        <div className="p-3 rounded-2xl bg-teal-950/40 border border-teal-500/30 text-[11px] text-slate-300 flex items-start gap-2.5 shadow-xs">
          <ShieldCheck size={16} className="text-teal-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold text-teal-300">Official MediAI Medical Center Intelligence:</span> Access verified clinic
            schedules, department directories, and your personal appointments securely. In emergencies, please call{' '}
            <strong className="font-bold text-rose-400">911</strong> or visit our 24/7 Emergency Campus immediately.
          </div>
        </div>

        {/* Message Stream */}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
            >
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium px-1">
                <span>{isUser ? user?.name || 'You (Patient)' : 'AI Hospital Assistant'}</span>
                <span>·</span>
                <span>{msg.timestamp}</span>
              </div>

              <div className="flex items-start gap-2 max-w-[88%] sm:max-w-[80%]">
                {!isUser && (
                  <div className="shrink-0 mt-0.5">
                    <AiHospitalAssistantLogo size={28} showText={false} />
                  </div>
                )}

                <div
                  className={`rounded-2xl px-4 py-3 text-xs sm:text-[13px] leading-relaxed shadow-sm transition-all ${
                    isUser
                      ? 'bg-teal-500 text-slate-950 rounded-br-xs font-semibold'
                      : msg.isError
                      ? 'bg-rose-950/40 text-rose-300 border border-rose-500/30 rounded-bl-xs'
                      : 'bg-slate-900 text-slate-100 border border-slate-800 rounded-bl-xs font-normal'
                  }`}
                >
                  {renderMessageContent(msg.content)}

                  {/* Interactive Quick Action Buttons attached to AI reply */}
                  {msg.quickActions && msg.quickActions.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-wrap gap-1.5">
                      {msg.quickActions.map((qa, qidx) => (
                        <button
                          key={qidx}
                          type="button"
                          onClick={() => handleQuickAction(qa.action)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-teal-950/50 text-teal-300 hover:bg-teal-900/60 border border-teal-500/30 transition-colors cursor-pointer"
                        >
                          <Sparkles size={11} className="text-teal-400" />
                          <span>{qa.label}</span>
                          <ChevronRight size={12} className="text-teal-400" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start gap-2 max-w-[85%]">
            <div className="shrink-0 mt-0.5">
              <AiHospitalAssistantLogo size={28} showText={false} />
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-xs px-4 py-3 text-xs text-slate-400 shadow-sm flex items-center gap-2">
              <span className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" />
              </span>
              <span className="font-medium text-slate-300">AI Hospital Assistant is thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Suggested Quick Questions Carousel */}
      <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 overflow-x-auto shrink-0">
        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium mb-1.5">
          <HelpCircle size={12} className="text-teal-400" />
          <span>Suggested Questions:</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {SUGGESTED_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isLoading}
              onClick={() => handleSendMessage(q)}
              className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-teal-300 border border-slate-800 hover:border-teal-500/40 transition-colors cursor-pointer disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Message Input & Send Control */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 shrink-0">
        <div className="flex items-end gap-2 bg-slate-950 border border-slate-800 rounded-2xl p-1.5 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
          <textarea
            ref={inputRef}
            rows={1}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Ask about departments, doctors, appointments, or services..."
            className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 resize-none focus:outline-none min-h-[38px] max-h-32"
          />

          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            aria-label="Send message"
            className="p-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Send size={15} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1 text-[10px] text-slate-500">
          <span>Press Enter to send, Shift + Enter for new line</span>
          <span>MediAI Confidential Healthcare Platform</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONFIRMATION MODAL: REMOVE CHATBOT (Exact specifications from user brief) */}
      {/* ========================================================================= */}
      {showRemoveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 text-slate-100 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/50 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <AlertCircle size={24} />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Remove AI Hospital Assistant?
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to remove the AI Hospital Assistant from your account? You can restore it later from settings, if supported.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <p>• Your patient account, records, and appointments remain completely safe and untouched.</p>
              <p>• Only the assistant launcher and navigation shortcut will be hidden for this account.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRemoveDialog(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONFIRMATION MODAL: CLEAR CONVERSATION HISTORY                            */}
      {/* ========================================================================= */}
      {showClearDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 text-slate-100 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-950/50 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Trash2 size={24} />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Clear Conversation History?
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to clear your current conversation history? This cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearDialog(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
