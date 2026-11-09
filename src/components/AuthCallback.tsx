/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { HospitalRole, ScreenState, AuthUser } from '../types/auth';
import { supabase } from '../services/supabaseClient';
import { authService } from '../services/authService';
import { patientService } from '../services/patientService';

interface AuthCallbackProps {
  onNavigate: (
    screen: ScreenState,
    role?: HospitalRole,
    extra?: {
      user?: AuthUser;
      token?: string;
      onboardingData?: { authUser: any; token: string };
    }
  ) => void;
}

export const AuthCallback: React.FC<AuthCallbackProps> = ({ onNavigate }) => {
  const [statusText, setStatusText] = useState('Verifying your Google session...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const processOAuthResponse = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const hash = window.location.hash;
        const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : hash);

        // Check for error return from OAuth provider
        const urlError = searchParams.get('error') || hashParams.get('error');
        const urlErrorDescription = searchParams.get('error_description') || hashParams.get('error_description');

        if (urlError) {
          const formatted = urlErrorDescription
            ? decodeURIComponent(urlErrorDescription).replace(/\+/g, ' ')
            : 'Authentication was cancelled or declined.';
          if (!isCancelled) {
            setErrorMessage(formatted);
          }
          return;
        }

        const code = searchParams.get('code');
        let accessToken = hashParams.get('access_token');
        let refreshToken = hashParams.get('refresh_token') || undefined;
        let expiresInStr = hashParams.get('expires_in');
        let expiresAt = expiresInStr ? Math.floor(Date.now() / 1000) + parseInt(expiresInStr, 10) : undefined;

        // 1. If PKCE authorization code present, exchange it for session
        if (code) {
          setStatusText('Exchanging authorization credentials...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('Error exchanging PKCE code:', error);
            // Don't fail immediately, check if session already established
          } else if (data?.session) {
            accessToken = data.session.access_token;
            refreshToken = data.session.refresh_token;
            expiresAt = data.session.expires_at;
          }
        }

        // 2. If no token yet, inspect existing Supabase session
        if (!accessToken) {
          setStatusText('Validating security session...');
          const { data } = await supabase.auth.getSession();
          if (data?.session) {
            accessToken = data.session.access_token;
            refreshToken = data.session.refresh_token;
            expiresAt = data.session.expires_at;
          }
        }

        if (!accessToken) {
          if (!isCancelled) {
            setErrorMessage('Unable to retrieve an authenticated session from Google. Please return to the sign in page and try again.');
          }
          return;
        }

        // 3. Resolve user identity and role mapping via MediAI backend
        setStatusText('Resolving your MediAI profile and clinical credentials...');
        const resolveRes = await fetch('/api/auth/oauth/resolve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ token: accessToken }),
        });

        const resolveData = await resolveRes.json().catch(() => ({}));

        if (!resolveRes.ok || !resolveData.success) {
          const msg = resolveData.message || 'Unable to resolve your MediAI account profile.';
          if (!isCancelled) {
            setErrorMessage(msg);
          }
          return;
        }

        // Clean up OAuth query parameters and hash from browser URL bar
        try {
          const cleanUrl = window.location.pathname.replace(/\/auth\/callback\/?$/, '') || '/';
          window.history.replaceState({}, document.title, cleanUrl);
        } catch {}

        // Handle Status: 'needs_profile' (New Google User -> Onboarding)
        if (resolveData.status === 'needs_profile') {
          if (!isCancelled) {
            setIsSuccess(true);
            setStatusText('Connecting to patient onboarding...');
            setTimeout(() => {
              onNavigate('google-onboarding', 'patient', {
                onboardingData: {
                  authUser: resolveData.authUser,
                  token: accessToken,
                },
              });
            }, 400);
          }
          return;
        }

        // Handle Status: 'authenticated' (Existing User -> Dashboard)
        if (resolveData.status === 'authenticated' && resolveData.user) {
          const user: AuthUser = resolveData.user;
          const userRole: HospitalRole = resolveData.role || user.role || 'patient';

          // Persist verified session
          authService.saveSession(accessToken, user, refreshToken, expiresAt);
          if (userRole === 'patient') {
            patientService.setSession(accessToken, user.patient_id || 'P1001', refreshToken, expiresAt, user);
          }

          if (!isCancelled) {
            setIsSuccess(true);
            setStatusText(`Welcome back, ${user.name || 'User'}! Launching portal...`);
            setTimeout(() => {
              const targetDashboard =
                userRole === 'doctor'
                  ? 'doctor-dashboard'
                  : userRole === 'staff'
                  ? 'staff-dashboard'
                  : userRole === 'admin'
                  ? 'admin-dashboard'
                  : 'patient-dashboard';

              onNavigate(targetDashboard, userRole, { user });
            }, 450);
          }
          return;
        }

        if (!isCancelled) {
          setErrorMessage('Unexpected response status from authentication server.');
        }
      } catch (err: any) {
        console.error('OAuth Callback processing error:', err);
        if (!isCancelled) {
          setErrorMessage(err?.message || 'An unexpected error occurred while finishing Google sign-in.');
        }
      }
    };

    processOAuthResponse();

    return () => {
      isCancelled = true;
    };
  }, [onNavigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] py-12 px-6 sm:px-10 max-w-lg mx-auto w-full text-center">
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Subtle accent glow */}
        <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full bg-teal-500/10 blur-2xl" />

        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
            {errorMessage ? (
              <AlertCircle size={28} className="text-rose-400" />
            ) : isSuccess ? (
              <CheckCircle2 size={28} className="text-teal-400 animate-pulse" />
            ) : (
              <Loader2 size={28} className="text-teal-400 animate-spin" />
            )}
          </div>
        </div>

        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-teal-400 tracking-wider uppercase">
            <ShieldCheck size={14} />
            <span>Google Institutional Authentication</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {errorMessage ? 'Authentication Failed' : isSuccess ? 'Verified Successfully' : 'Connecting to MediAI'}
          </h2>
          <p className="text-sm text-slate-400">
            {errorMessage || statusText}
          </p>
        </div>

        {errorMessage && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                try {
                  const cleanUrl = window.location.pathname.replace(/\/auth\/callback\/?$/, '') || '/';
                  window.history.replaceState({}, document.title, cleanUrl);
                } catch {}
                onNavigate('login');
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-sm text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>Back to Sign In</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
