/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PasswordStrength } from '../types/auth';

export function calculatePasswordStrength(password: string): PasswordStrength {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

  let score = 0;
  if (hasMinLength) score++;
  if (hasUppercase && hasLowercase) score++;
  if (hasNumber) score++;
  if (hasSpecialChar) score++;

  let label: PasswordStrength['label'] = 'Weak';
  if (score === 2) label = 'Fair';
  else if (score === 3) label = 'Good';
  else if (score >= 4) label = 'Strong';

  return {
    score,
    label,
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar,
  };
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  // Accepts standard international or local formats: +1-234-567-8901, (123) 456-7890, etc.
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  return cleaned.length >= 7 && cleaned.length <= 15 && /^\+?[0-9]+$/.test(cleaned);
}

export function isValidDateOfBirth(dob: string): { valid: boolean; message?: string } {
  if (!dob) return { valid: false, message: 'Date of birth is required.' };
  const date = new Date(dob);
  if (isNaN(date.getTime())) {
    return { valid: false, message: 'Invalid date format.' };
  }
  const today = new Date();
  if (date > today) {
    return { valid: false, message: 'Date of birth cannot be in the future.' };
  }
  const ageInYears = (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (ageInYears > 125) {
    return { valid: false, message: 'Please provide a valid date of birth.' };
  }
  return { valid: true };
}
