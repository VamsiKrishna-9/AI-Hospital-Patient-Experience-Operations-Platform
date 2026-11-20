/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AssistantSource {
  source: string;
  title: string;
  section: string;
  page?: number | null;
  chunkId?: string;
  snippet?: string;
  score?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  quickActions?: Array<{
    label: string;
    action: 'book-appointment' | 'view-appointments' | 'view-labs' | 'view-prescriptions' | 'view-feedback' | 'contact-support';
  }>;
  sources?: AssistantSource[];
  isError?: boolean;
}

export interface AiChatResponse {
  success: boolean;
  reply: string;
  sessionId?: string;
  timestamp: string;
  quickActions?: Array<{
    label: string;
    action: 'book-appointment' | 'view-appointments' | 'view-labs' | 'view-prescriptions' | 'view-feedback' | 'contact-support';
  }>;
  sources?: AssistantSource[];
  isConfigured?: boolean;
  message?: string;
  isError?: boolean;
}

import { authService } from './authService';

const CHAT_HISTORY_STORAGE_KEY = 'mediai_ai_assistant_history';
const CHAT_SESSION_STORAGE_KEY = 'mediai_ai_assistant_session_id';
const CHATBOT_ENABLED_STORAGE_KEY = 'mediai_ai_assistant_enabled';

class AiChatService {
  /**
   * Check whether AI Hospital Assistant is enabled for this user.
   * Defaults to true if unconfigured.
   */
  public isChatbotEnabled(): boolean {
    try {
      const stored = localStorage.getItem(CHATBOT_ENABLED_STORAGE_KEY);
      if (stored === null) return true;
      return stored === 'true';
    } catch {
      return true;
    }
  }

  /**
   * Set user's chatbot preference locally and sync with backend API
   */
  public async setChatbotEnabled(enabled: boolean): Promise<{ success: boolean; message: string }> {
    try {
      localStorage.setItem(CHATBOT_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');

      // Sync with server-side user preferences if token available
      const token = this.getAuthToken();
      if (token) {
        try {
          const res = await fetch('/api/user/preferences', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ chatbotEnabled: enabled }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.success) {
            return {
              success: true,
              message: enabled
                ? 'AI Hospital Assistant has been enabled.'
                : 'AI Hospital Assistant has been removed from your interface.',
            };
          }
        } catch (err) {
          console.warn('[AI Assistant] Backend sync warning:', err);
        }
      }

      return {
        success: true,
        message: enabled
          ? 'AI Hospital Assistant has been enabled.'
          : 'AI Hospital Assistant has been removed from your interface.',
      };
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Failed to update chatbot preference.',
      };
    }
  }

  /**
   * Fetch user preferences from server
   */
  public async fetchServerPreferences(): Promise<{ chatbotEnabled: boolean }> {
    const token = this.getAuthToken();
    if (!token) {
      return { chatbotEnabled: this.isChatbotEnabled() };
    }

    try {
      const res = await fetch('/api/user/preferences', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && typeof data.preferences?.chatbot_enabled === 'boolean') {
          const enabled = data.preferences.chatbot_enabled;
          localStorage.setItem(CHATBOT_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
          return { chatbotEnabled: enabled };
        }
      }
    } catch (err) {
      console.warn('[AI Assistant] Preferences fetch warning:', err);
    }

    return { chatbotEnabled: this.isChatbotEnabled() };
  }

  /**
   * Retrieve saved conversation history
   */
  public getHistory(): ChatMessage[] {
    try {
      const raw = sessionStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  /**
   * Save conversation history to session storage
   */
  public saveHistory(messages: ChatMessage[]): void {
    try {
      // Keep last 30 messages in storage
      const trimmed = messages.slice(-30);
      sessionStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
    } catch (err) {
      console.error('[AI Assistant] History storage error:', err);
    }
  }

  /**
   * Retrieve or generate a stable per-conversation session ID (1..128 chars)
   * required by the Railway FastAPI Advanced RAG API.
   */
  public getSessionId(): string {
    try {
      const existing = sessionStorage.getItem(CHAT_SESSION_STORAGE_KEY);
      if (existing && existing.trim().length > 0 && existing.trim().length <= 128) {
        return existing.trim();
      }
      const generated =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `mediai-${crypto.randomUUID()}`
          : `mediai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(CHAT_SESSION_STORAGE_KEY, generated);
      return generated;
    } catch {
      return `mediai-${Date.now()}`;
    }
  }

  /**
   * Clear conversation history and reset remote conversation session
   */
  public clearHistory(): void {
    try {
      const previousSessionId = sessionStorage.getItem(CHAT_SESSION_STORAGE_KEY);
      sessionStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
      sessionStorage.removeItem(CHAT_SESSION_STORAGE_KEY);

      if (previousSessionId) {
        fetch(`/api/ai/session/${encodeURIComponent(previousSessionId)}`, {
          method: 'DELETE',
        }).catch(() => {
          // Best-effort remote session cleanup
        });
      }
    } catch (err) {
      console.error('[AI Assistant] History clearance error:', err);
    }
  }

  /**
   * Send message to MediAI backend proxy -> Railway Advanced RAG API
   */
  public async sendMessage(
    message: string,
    _history: ChatMessage[] = []
  ): Promise<AiChatResponse> {
    const token = this.getAuthToken();
    const sessionId = this.getSessionId();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message,
          session_id: sessionId,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          success: false,
          reply: data.message || `Hospital assistant service error (${res.status}). Please try again.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isConfigured: data.isConfigured,
          isError: true,
        };
      }

      if (typeof data.reply !== 'string' || !data.reply.trim()) {
        return {
          success: false,
          reply: 'Received an empty or invalid response from the MediAI assistant service. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        };
      }

      const returnedSessionId =
        typeof data.sessionId === 'string' && data.sessionId.trim()
          ? data.sessionId.trim()
          : sessionId;
      try {
        sessionStorage.setItem(CHAT_SESSION_STORAGE_KEY, returnedSessionId);
      } catch {
        // Ignore storage write error
      }

      return {
        success: true,
        reply: data.reply,
        sessionId: returnedSessionId,
        timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickActions: data.quickActions,
        sources: Array.isArray(data.sources) ? data.sources : undefined,
        isConfigured: data.isConfigured !== false,
      };
    } catch {
      return {
        success: false,
        reply: 'Network connection error: Unable to reach the MediAI assistant service. Please check your connectivity and try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
    }
  }

  private getAuthToken(): string | null {
    return authService.getAuthToken();
  }
}

export const aiChatService = new AiChatService();
