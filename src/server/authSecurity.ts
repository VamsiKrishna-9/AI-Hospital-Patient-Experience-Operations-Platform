/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';

// Server-side retrieval of privileged invitation codes from environment secrets
export function getValidHospitalInviteCodes(): string[] {
  const envCodes = process.env.HOSPITAL_INVITE_CODES;
  if (envCodes) {
    return envCodes.split(',').map((c) => c.trim()).filter(Boolean);
  }
  // Server-side default keys if environment variable not explicitly set
  return [
    'MED-CLINIC-7721',
    'STJUDE-HOSPITAL-2026',
    'NEURO-SURG-8802',
  ];
}

export function getValidAdminInvitationCodes(): string[] {
  const envCodes = process.env.ADMIN_INVITATION_CODES;
  if (envCodes) {
    return envCodes.split(',').map((c) => c.trim()).filter(Boolean);
  }
  // Server-side default keys if environment variable not explicitly set
  return [
    'MEDIAI-SUPERADMIN-2026',
    'HOSPITAL-GOVERNANCE-EXEC-99',
    'CHIEF-MED-DIRECTOR-4401',
  ];
}

// Timing-safe comparison to prevent side-channel timing attacks
export function isInvitationCodeValid(inputCode: string, validCodes: string[]): boolean {
  if (!inputCode) return false;
  const cleanInput = inputCode.trim();

  for (const code of validCodes) {
    if (code.length === cleanInput.length) {
      try {
        if (crypto.timingSafeEqual(Buffer.from(cleanInput), Buffer.from(code))) {
          return true;
        }
      } catch {
        // Fallback length mismatch
      }
    }
  }
  return false;
}

// Rate Limiter for privileged onboarding to mitigate brute-force attempts
interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const REGISTRATION_RATE_LIMITS = new Map<string, RateLimitBucket>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function checkRegistrationRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const bucket = REGISTRATION_RATE_LIMITS.get(key);

  if (!bucket || bucket.resetAt < now) {
    REGISTRATION_RATE_LIMITS.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0 };
  }

  bucket.count++;
  return { allowed: true, remaining: MAX_ATTEMPTS - bucket.count };
}

// Cleanup expired rate limit buckets periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of REGISTRATION_RATE_LIMITS.entries()) {
    if (bucket.resetAt < now) {
      REGISTRATION_RATE_LIMITS.delete(key);
    }
  }
}, 5 * 60 * 1000);
