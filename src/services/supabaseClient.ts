/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Browser-safe Supabase client initialization fetching configuration securely from /api/config
let client: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;

const getEnvVar = (key: string): string => {
  try {
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv[key]) return metaEnv[key];
  } catch {}
  try {
    // @ts-ignore
    if (typeof window !== 'undefined' && (window as any)[key]) return (window as any)[key];
  } catch {}
  return '';
};

export const getSupabaseBrowserClient = async (): Promise<SupabaseClient | null> => {
  if (client) return client;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // 1. Check build-time or window env vars first
    let url = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('SUPABASE_URL');
    let anon = getEnvVar('VITE_SUPABASE_ANON_KEY') || getEnvVar('SUPABASE_ANON_KEY');

    // 2. If missing, fetch securely from backend /api/config endpoint
    if (!url || !anon || url.includes('example.com') || url.includes('[PROJECT_REF]')) {
      try {
        const res = await fetch('/api/config');
        const data = await res.json().catch(() => ({}));
        if (data.success && data.supabaseUrl && data.supabaseAnonKey) {
          url = data.supabaseUrl;
          anon = data.supabaseAnonKey;
        }
      } catch (err) {
        console.warn('Failed to fetch public Supabase config from /api/config:', err);
      }
    }

    if (url && anon && !url.includes('example.com') && !url.includes('[PROJECT_REF]')) {
      try {
        client = createClient(url, anon, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });
      } catch (err) {
        console.error('Failed to create Supabase browser client instance:', err);
      }
    }

    return client;
  })();

  return initPromise;
};

// Singleton export with async initialization fallback
export const supabase = {
  auth: {
    signInWithOAuth: async (options: any) => {
      const cli = await getSupabaseBrowserClient();
      if (!cli) {
        return {
          error: new Error('Supabase client not configured. Please configure SUPABASE_URL and SUPABASE_ANON_KEY in your AI Studio Secrets.'),
        };
      }
      return cli.auth.signInWithOAuth(options);
    },
    getSession: async () => {
      const cli = await getSupabaseBrowserClient();
      if (!cli) return { data: { session: null }, error: null };
      return cli.auth.getSession();
    },
    onAuthStateChange: (callback: any) => {
      getSupabaseBrowserClient().then((cli) => {
        if (cli) cli.auth.onAuthStateChange(callback);
      });
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
  },
} as any;
