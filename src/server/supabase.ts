/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Sanitize connection error messages to prevent credential leakage
export function sanitizeError(err: any): string {
  if (!err) return 'Unknown error';
  const str = typeof err === 'string' ? err : err?.message || String(err);
  return str
    .replace(/(password|passwd|pwd)=[^\s&;]+/gi, '$1=******')
    .replace(/\/\/[^:]+:[^@]+@/g, '//***:***@');
}

export interface SupabaseConfig {
  configured: boolean;
  supabaseUrl: string | null;
  hasServiceRoleKey: boolean;
  hasAnonKey: boolean;
}

// Read configuration strictly from server-side environment variables
export function getSupabaseConfig(): SupabaseConfig {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim() || null;

  const isPlaceholderUrl = !supabaseUrl || supabaseUrl.includes('[PROJECT_REF]') || supabaseUrl.includes('example.com');
  const isPlaceholderKey = !serviceRoleKey || serviceRoleKey.includes('your-') || serviceRoleKey.length < 20;

  const configured = Boolean(supabaseUrl && !isPlaceholderUrl && serviceRoleKey && !isPlaceholderKey);

  return {
    configured,
    supabaseUrl: isPlaceholderUrl ? null : supabaseUrl,
    hasServiceRoleKey: Boolean(serviceRoleKey && !isPlaceholderKey),
    hasAnonKey: Boolean(anonKey && !anonKey.includes('your-')),
  };
}

let adminClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.configured || !config.supabaseUrl) return null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) return null;

  if (!adminClient) {
    adminClient = createClient(config.supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return adminClient;
}

export function getSupabaseAnon(): SupabaseClient | null {
  const config = getSupabaseConfig();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!config.supabaseUrl || !anonKey || anonKey.includes('your-')) return null;

  if (!anonClient) {
    anonClient = createClient(config.supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return anonClient;
}

/**
 * Creates a client scoped with a specific user's JWT token
 * ensuring requests execute under that user's identity and RLS policies.
 */
export function getSupabaseUserClient(token: string): SupabaseClient | null {
  const config = getSupabaseConfig();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!config.supabaseUrl || !anonKey) return null;

  return createClient(config.supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

/**
 * Real database connectivity probe against existing canonical tables.
 * Returns true ONLY if a real query succeeds.
 */
export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  message: string;
  error?: string;
}> {
  const config = getSupabaseConfig();

  if (!config.configured) {
    return {
      connected: false,
      message: 'Supabase PostgreSQL credentials pending configuration.',
      error: 'Environment variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured.',
    };
  }

  const client = getSupabaseAdmin();
  if (!client) {
    return {
      connected: false,
      message: 'Failed to initialize Supabase administrative client.',
      error: 'Client initialization failed.',
    };
  }

  try {
    // Probe the authoritative public.app_users table with timeout protection
    const probePromise = client
      .from('app_users')
      .select('id', { count: 'exact', head: true });

    const timeoutPromise = new Promise<{ data: null; count: null; error: { message: string } }>((_, reject) => {
      setTimeout(() => reject(new Error('Supabase connection probe timed out after 3500ms')), 3500);
    });

    const { error } = (await Promise.race([probePromise, timeoutPromise])) as any;

    if (error) {
      return {
        connected: false,
        message: `Supabase connection probe failed: ${sanitizeError(error.message)}`,
        error: sanitizeError(error.message),
      };
    }

    return {
      connected: true,
      message: 'Connected to Supabase PostgreSQL database.',
    };
  } catch (err: any) {
    return {
      connected: false,
      message: `Database connection error: ${sanitizeError(err)}`,
      error: sanitizeError(err),
    };
  }
}
