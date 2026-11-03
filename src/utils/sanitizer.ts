/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Reusable helper to sanitize doctor specialties/designations.
 * Returns empty string if the value is null, undefined, empty, or a placeholder like ****, ***, or star-only strings.
 */
export function sanitizeSpecialty(specialty?: string | null): string {
  if (!specialty) return '';
  const raw = String(specialty).trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (
    lower === 'null' ||
    lower === 'undefined' ||
    raw.includes('*') ||
    /^\*+$/.test(raw) ||
    raw === '***' ||
    raw === '****' ||
    raw === '*****'
  ) {
    return '';
  }
  return raw;
}
