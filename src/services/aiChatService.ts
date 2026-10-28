/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  quickActions?: Array<{
    label: string;
    action: 'book-appointment' | 'view-appointments' | 'view-labs' | 'view-prescriptions' | 'view-feedback' | 'contact-support';
  }>;
  isError?: boolean;
}

export interface AiChatResponse {
  success: boolean;
  reply: string;
  timestamp: string;
  quickActions?: Array<{
    label: string;
    action: 'book-appointment' | 'view-appointments' | 'view-labs' | 'view-prescriptions' | 'view-feedback' | 'contact-support';
  }>;
  isConfigured?: boolean;
  message?: string;
  isError?: boolean;
}

const CHAT_HISTORY_STORAGE_KEY = 'mediai_ai_assistant_history';
const CHATBOT_ENABLED_STORAGE_KEY = 'mediai_ai_assistant_enabled';
const AUTH_TOKEN_KEY = 'mediai_patient_auth_token';

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
   * Clear conversation history
   */
  public clearHistory(): void {
    try {
      sessionStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
    } catch (err) {
      console.error('[AI Assistant] History clearance error:', err);
    }
  }

  /**
   * Send message to backend Gemini endpoint
   */
  public async sendMessage(
    message: string,
    history: ChatMessage[] = []
  ): Promise<AiChatResponse> {
    const token = this.getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Format last 8 history messages for context
    const formattedHistory = history
      .slice(-8)
      .filter((m) => !m.isError)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message,
          history: formattedHistory,
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

      return {
        success: true,
        reply: data.reply || 'I am ready to assist you with hospital information and appointments.',
        timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickActions: data.quickActions,
        isConfigured: data.isConfigured !== false,
      };
    } catch (error: any) {
      return {
        success: false,
        reply: 'Network connection error: Unable to reach the MediAI assistant service. Please check your connectivity.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
    }
  }

  private getAuthToken(): string | null {
    try {
      return sessionStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  }
}

export const aiChatService = new AiChatService();
