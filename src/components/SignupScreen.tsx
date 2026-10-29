/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Phone,
  Calendar,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Stethoscope,
  HeartPulse,
  ShieldCheck,
  Building2,
  Award,
  KeyRound,
  IdCard,
  Briefcase,
  Clock,
} from 'lucide-react';
import {
  HospitalRole,
  PublicHospitalRole,
  ScreenState,
  SignupFormData,
  AuthResponse,
  AuthUser,
} from '../types/auth';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { authService } from '../services/authService';
import {
  calculatePasswordStrength,
  isValidEmail,
  isValidPhone,
  isValidDateOfBirth,
} from '../utils/validation';

interface SignupScreenProps {
  onNavigate: (
    screen: ScreenState,
    role?: HospitalRole,
    extra?: { patientId?: string; tempToken?: string; user?: AuthUser }
  ) => void;
  selectedRole?: HospitalRole;
  onRoleChange?: (role: HospitalRole) => void;
}

export const SignupScreen: React.FC<SignupScreenProps> = ({
  onNavigate,
  selectedRole = 'patient',
  onRoleChange,
}) => {
  // Public Account Type Dropdown State (defaults to 'patient', permits patient, doctor, staff)
  const initialRole: PublicHospitalRole =
    selectedRole === 'doctor' || selectedRole === 'staff' ? selectedRole : 'patient';
  const [accountType, setAccountType] = useState<PublicHospitalRole>(initialRole);

  // Shared Form Fields across roles
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Doctor-Specific Fields
  const [specialization, setSpecialization] = useState('Cardiology & Vascular Medicine');
  const [qualifications, setQualifications] = useState('');
  const [doctorExperience, setDoctorExperience] = useState('');
  const [doctorDepartment, setDoctorDepartment] = useState('Cardiovascular Specialty Institute');

  // Staff-Specific Fields
  const [staffDepartment, setStaffDepartment] = useState('Inpatient Ward 4B & Clinical Triage');
  const [designation, setDesignation] = useState('Registered Nurse (RN)');
  const [staffExperience, setStaffExperience] = useState('');

  // Validation Errors Map for inline field feedback
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Submission State
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [authResult, setAuthResult] = useState<AuthResponse | null>(null);

  // Handle Account Type Change while preserving shared field values
  const handleAccountTypeChange = (newRole: PublicHospitalRole) => {
    setAccountType(newRole);
    setFieldErrors({});
    setGeneralError(null);
    setAuthResult(null);
    if (onRoleChange) {
      onRoleChange(newRole);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // 1. Full Legal Name (all roles)
    if (!fullName.trim()) {
      errors.fullName = 'Full legal name is required.';
    } else if (fullName.trim().length < 2) {
      errors.fullName = 'Name must be at least 2 characters.';
    }

    // 2. Email Address (all roles)
    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!isValidEmail(email)) {
      errors.email = 'Please provide a valid email format (e.g. name@domain.com).';
    }

    // 3. Contact Phone Number (all roles)
    if (!phone.trim()) {
      errors.phone = 'Contact phone number is required.';
    } else if (!isValidPhone(phone)) {
      errors.phone = 'Please provide a valid phone number (at least 7 digits).';
    }

    // 4. Date of Birth (Patient, Doctor, Staff)
    if (!dateOfBirth) {
      errors.dateOfBirth = 'Date of birth is required.';
    } else {
      const dobCheck = isValidDateOfBirth(dateOfBirth);
      if (!dobCheck.valid) {
        errors.dateOfBirth = dobCheck.message || 'Date of birth cannot be in the future.';
      }
    }

    // 5. Password & Confirm Password (all roles)
    const strength = calculatePasswordStrength(password);
    if (!password) {
      errors.password = 'Account password is required.';
    } else if (password.length < 8 || strength.score < 2) {
      errors.password = 'Password must be at least 8 characters with numbers and mixed casing.';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Password confirmation is required.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    // 6. Role-Specific Validations
    if (accountType === 'doctor') {
      if (!specialization.trim()) {
        errors.specialization = 'Medical specialization is required.';
      }
      if (!qualifications.trim()) {
        errors.qualifications = 'Professional qualifications are required (e.g. MBBS, MD).';
      }
      if (!doctorDepartment.trim()) {
        errors.doctorDepartment = 'Hospital department is required.';
      }
      if (!acceptTerms) {
        errors.acceptTerms = 'You must review and consent to clinical data governance policies.';
      }
    } else if (accountType === 'staff') {
      if (!staffDepartment.trim()) {
        errors.staffDepartment = 'Hospital clinical department is required.';
      }
      if (!designation.trim()) {
        errors.designation = 'Staff designation / title is required.';
      }
      if (!acceptTerms) {
        errors.acceptTerms = 'You must review and consent to hospital operational governance policies.';
      }
    } else {
      // Patient
      if (!acceptTerms) {
        errors.acceptTerms = 'You must review and consent to the MediAI Data Governance and Terms of Service.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setAuthResult(null);

    if (!validateForm()) {
      setGeneralError('Please correct the highlighted fields before submitting.');
      return;
    }

    setIsLoading(true);

    try {
      let payload: SignupFormData;

      if (accountType === 'doctor') {
        payload = {
          role: 'doctor',
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          dateOfBirth,
          specialization: specialization.trim(),
          qualifications: qualifications.trim(),
          yearsOfExperience: doctorExperience.trim(),
          department: doctorDepartment.trim(),
          password,
          confirmPassword,
          acceptTerms,
        };
      } else if (accountType === 'staff') {
        payload = {
          role: 'staff',
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          dateOfBirth,
          department: staffDepartment.trim(),
          designation: designation.trim(),
          yearsOfExperience: staffExperience.trim(),
          password,
          confirmPassword,
          acceptTerms,
        };
      } else {
        payload = {
          role: 'patient',
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          dateOfBirth,
          password,
          confirmPassword,
          acceptTerms,
        };
      }

      const response = await authService.signup(payload);
      setAuthResult(response);

      if (!response.success) {
        setGeneralError(response.message || 'Registration request could not be completed.');
      } else if (onRoleChange) {
        onRoleChange(response.role || accountType);
      }
    } catch {
      setGeneralError('An unexpected network error occurred while submitting registration.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google sign up adheres to safe default Patient role
  const handleGoogleSignup = async () => {
    setGeneralError(null);
    setIsLoading(true);
    try {
      const response = await authService.googleLogin({
        email: email.includes('@') ? email.trim() : undefined,
        name: fullName.trim() || undefined,
      });

      if (response.success && response.user) {
        const userRole = response.user.role || 'patient';
        if (onRoleChange) onRoleChange(userRole);

        if (userRole === 'doctor') {
          onNavigate('doctor-dashboard', 'doctor', { user: response.user });
        } else if (userRole === 'staff') {
          onNavigate('staff-dashboard', 'staff', { user: response.user });
        } else if (userRole === 'admin') {
          onNavigate('admin-dashboard', 'admin', { user: response.user });
        } else {
          onNavigate('patient-dashboard', 'patient', {
            patientId: response.patientId || response.user.patient_id,
            user: response.user,
          });
        }
        return;
      }

      setGeneralError(response.message || 'Google account creation failed.');
    } catch {
      setGeneralError('Failed to create account via Google identity provider.');
    } finally {
      setIsLoading(false);
    }
  };

  // Dynamic submit button label
  const getSubmitButtonLabel = () => {
    switch (accountType) {
      case 'doctor':
        return 'Submit Doctor Registration';
      case 'staff':
        return 'Submit Staff Registration';
      case 'patient':
      default:
        return 'Complete Patient Registration';
    }
  };

  return (
    <div className="flex flex-col justify-center min-h-full py-8 px-6 sm:px-10 lg:px-14 max-w-xl mx-auto w-full">
      {/* Header */}
      <div className="mb-5 space-y-1.5">
        <span className="text-xs font-semibold text-teal-400 tracking-wider uppercase flex items-center gap-1.5">
          <ShieldCheck size={14} />
          <span>New Account Registration</span>
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Join MediAI Platform
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Select your institutional account type below. Relevant registration credentials and governance requirements adapt automatically.
        </p>
      </div>

      {/* Account Type Dropdown (Immediately below heading and introductory description) */}
      <div className="mb-5">
        <label
          htmlFor="account-type-select"
          className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between"
        >
          <span>Account Type</span>
          <span className="text-[11px] font-normal text-teal-400 lowercase">
            {accountType === 'patient' && 'self-service care access'}
            {accountType === 'doctor' && 'physician verification required'}
            {accountType === 'staff' && 'ward operations approval'}
          </span>
        </label>
        <div className="relative">
          <select
            id="account-type-select"
            value={accountType}
            onChange={(e) => handleAccountTypeChange(e.target.value as PublicHospitalRole)}
            disabled={isLoading}
            className="w-full h-11 px-3.5 pr-10 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-white font-medium text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40 cursor-pointer transition-colors shadow-sm"
          >
            <option value="patient">Patient — Personal Health & Appointment Portal</option>
            <option value="doctor">Doctor — Attending Physician & Clinical Specialist</option>
            <option value="staff">Staff — Nursing, Ward & Clinical Operations</option>
          </select>
        </div>
      </div>

      {/* Google Quick Signup Action (Defaults safely to Patient) */}
      <div className="mb-5">
        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl font-medium text-xs sm:text-sm text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 transition-all shadow-xs disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Sign up with Google</span>
        </button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-[11px] uppercase">
            <span className="bg-slate-950 px-2 text-slate-500">
              or register with {accountType} credentials
            </span>
          </div>
        </div>
      </div>

      {/* Success / Pending Approval Feedback Banner */}
      {authResult && authResult.success && (
        <div className="mb-5 p-4 rounded-xl bg-teal-950/70 border border-teal-500/50 text-xs text-teal-200 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} className="text-teal-400 shrink-0 mt-0.5" />
            <div className="space-y-2 w-full">
              <div>
                <p className="font-semibold text-teal-100 text-sm">
                  {accountType === 'patient'
                    ? 'Registration Complete — Patient Portal'
                    : accountType === 'doctor'
                    ? 'Doctor Registration Submitted — Pending Approval'
                    : 'Staff Registration Submitted — Pending Verification'}
                </p>
                <p className="text-[12px] text-teal-300/90 leading-relaxed mt-0.5">
                  {authResult.message}
                </p>
              </div>

              {/* Show Patient ID if patient */}
              {(authResult.patientId || authResult.user?.patient_id) && accountType === 'patient' && (
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-teal-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Your Official Patient ID</span>
                    <span className="text-sm font-mono font-bold text-teal-300">{authResult.patientId || authResult.user?.patient_id}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Save for login</span>
                </div>
              )}

              {/* Show Doctor ID if doctor */}
              {(authResult.doctorId || authResult.user?.doctor_id) && accountType === 'doctor' && (
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-cyan-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Your Generated Doctor ID</span>
                    <span className="text-sm font-mono font-bold text-cyan-300">{authResult.doctorId || authResult.user?.doctor_id}</span>
                  </div>
                  <span className="text-[11px] text-cyan-400 font-medium">Pending Approval</span>
                </div>
              )}

              {/* Show Staff ID if staff */}
              {(authResult.staffId || authResult.user?.staff_id) && accountType === 'staff' && (
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-emerald-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Your Generated Staff ID</span>
                    <span className="text-sm font-mono font-bold text-emerald-300">{authResult.staffId || authResult.user?.staff_id}</span>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-medium">Pending Verification</span>
                </div>
              )}

              {/* Approval status banner for Doctor and Staff */}
              {authResult.requiresApproval && (
                <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 text-[11px] flex items-center gap-2">
                  <Clock size={14} className="text-cyan-400 shrink-0" />
                  <span>
                    {accountType === 'doctor'
                      ? 'Your credentials have been logged in the verification queue. Hospital Governance will activate your workspace once verified.'
                      : 'Your application has been logged in the operational queue. Nursing Operations will activate your workspace once verified.'}
                  </span>
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center gap-2">
                {accountType === 'patient' && !authResult.requiresEmailConfirmation && (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('patient-dashboard', 'patient', {
                        patientId: authResult.patientId || authResult.user?.patient_id,
                        user: authResult.user,
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-400 text-slate-950 font-bold text-xs hover:bg-teal-300 transition-colors shadow-xs cursor-pointer"
                  >
                    <span>Enter Patient Portal Now</span>
                    <ArrowRight size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onNavigate('login', accountType)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 font-medium text-xs hover:text-white transition-colors cursor-pointer"
                >
                  <span>Go to Sign In</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* General Error Alert */}
      {generalError && (
        <div
          role="alert"
          className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 animate-in fade-in duration-200 flex items-start gap-2.5"
        >
          <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{generalError}</div>
        </div>
      )}

      {/* Dynamic Role-Based Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Full Legal Name (All Roles) */}
        <div>
          <label htmlFor="reg-fullname" className="block text-xs font-medium text-slate-300 mb-1.5">
            Full Legal Name <span className="text-teal-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <User size={16} />
            </div>
            <input
              id="reg-fullname"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: '' }));
              }}
              disabled={isLoading}
              placeholder={accountType === 'doctor' ? 'Dr. Jane Smith, MD' : 'e.g. Johnathan Doe'}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border ${
                fieldErrors.fullName ? 'border-rose-500' : 'border-slate-800'
              } text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40`}
            />
          </div>
          {fieldErrors.fullName && (
            <p className="mt-1 text-xs text-rose-400 flex items-center gap-1">
              <AlertCircle size={12} />
              <span>{fieldErrors.fullName}</span>
            </p>
          )}
        </div>

        {/* Email Address (All Roles) */}
        <div>
          <label htmlFor="reg-email" className="block text-xs font-medium text-slate-300 mb-1.5">
            Email Address <span className="text-teal-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Mail size={16} />
            </div>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
              }}
              disabled={isLoading}
              placeholder={
                accountType === 'doctor'
                  ? 'doctor@hospital.org'
                  : accountType === 'staff'
                  ? 'staff@hospital.org'
                  : 'patient@example.com'
              }
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border ${
                fieldErrors.email ? 'border-rose-500' : 'border-slate-800'
              } text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40 font-mono`}
            />
          </div>
          {fieldErrors.email && (
            <p className="mt-1 text-xs text-rose-400 flex items-center gap-1">
              <AlertCircle size={12} />
              <span>{fieldErrors.email}</span>
            </p>
          )}
        </div>

        {/* Contact Phone Number (All Roles) */}
        <div>
          <label htmlFor="reg-phone" className="block text-xs font-medium text-slate-300 mb-1.5">
            Contact Phone Number <span className="text-teal-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Phone size={16} />
            </div>
            <input
              id="reg-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: '' }));
              }}
              disabled={isLoading}
              placeholder="+1 (555) 234-5678"
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border ${
                fieldErrors.phone ? 'border-rose-500' : 'border-slate-800'
              } text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40 font-mono`}
            />
          </div>
          {fieldErrors.phone && (
            <p className="mt-1 text-xs text-rose-400 flex items-center gap-1">
              <AlertCircle size={12} />
              <span>{fieldErrors.phone}</span>
            </p>
          )}
        </div>

        {/* Date of Birth (Patient, Doctor, Staff) */}
        <div>
          <label htmlFor="reg-dob" className="block text-xs font-medium text-slate-300 mb-1.5">
            Date of Birth <span className="text-teal-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Calendar size={16} />
            </div>
            <input
              id="reg-dob"
              type="date"
              max={new Date().toISOString().split('T')[0]}
              value={dateOfBirth}
              onChange={(e) => {
                setDateOfBirth(e.target.value);
                if (fieldErrors.dateOfBirth) setFieldErrors((prev) => ({ ...prev, dateOfBirth: '' }));
              }}
              disabled={isLoading}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border ${
                fieldErrors.dateOfBirth ? 'border-rose-500' : 'border-slate-800'
              } text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40`}
            />
          </div>
          {fieldErrors.dateOfBirth ? (
            <p className="mt-1 text-xs text-rose-400 flex items-center gap-1">
              <AlertCircle size={12} />
              <span>{fieldErrors.dateOfBirth}</span>
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-slate-500">Cannot be a future date.</p>
          )}
        </div>

        {/* --- DOCTOR-SPECIFIC FIELDS --- */}
        {accountType === 'doctor' && (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-cyan-500/30 space-y-3.5 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
              <Stethoscope size={15} />
              <span>Physician Clinical Profile & Specialization</span>
            </div>

            {/* Medical Specialization */}
            <div>
              <label htmlFor="reg-doc-spec" className="block text-xs font-medium text-slate-300 mb-1.5">
                Medical Specialization <span className="text-cyan-400">*</span>
              </label>
              <input
                id="reg-doc-spec"
                type="text"
                value={specialization}
                onChange={(e) => {
                  setSpecialization(e.target.value);
                  if (fieldErrors.specialization) setFieldErrors((prev) => ({ ...prev, specialization: '' }));
                }}
                disabled={isLoading}
                placeholder="e.g. Cardiology, Neurology, General Medicine"
                className={`w-full px-3 py-2 rounded-xl bg-slate-950 border ${
                  fieldErrors.specialization ? 'border-rose-500' : 'border-slate-800'
                } text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500`}
              />
              {fieldErrors.specialization && (
                <p className="mt-1 text-xs text-rose-400">{fieldErrors.specialization}</p>
              )}
            </div>

            {/* Qualifications */}
            <div>
              <label htmlFor="reg-doc-qual" className="block text-xs font-medium text-slate-300 mb-1.5">
                Qualifications <span className="text-cyan-400">*</span>
              </label>
              <input
                id="reg-doc-qual"
                type="text"
                value={qualifications}
                onChange={(e) => {
                  setQualifications(e.target.value);
                  if (fieldErrors.qualifications) setFieldErrors((prev) => ({ ...prev, qualifications: '' }));
                }}
                disabled={isLoading}
                placeholder="e.g. MBBS, MD (Cardiology), FACC"
                className={`w-full px-3 py-2 rounded-xl bg-slate-950 border ${
                  fieldErrors.qualifications ? 'border-rose-500' : 'border-slate-800'
                } text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500`}
              />
              {fieldErrors.qualifications && (
                <p className="mt-1 text-xs text-rose-400">{fieldErrors.qualifications}</p>
              )}
            </div>

            {/* Department and Years of Experience in 2 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-doc-dept" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Department <span className="text-cyan-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Building2 size={14} />
                  </div>
                  <input
                    id="reg-doc-dept"
                    type="text"
                    value={doctorDepartment}
                    onChange={(e) => {
                      setDoctorDepartment(e.target.value);
                      if (fieldErrors.doctorDepartment) setFieldErrors((prev) => ({ ...prev, doctorDepartment: '' }));
                    }}
                    disabled={isLoading}
                    placeholder="Cardiovascular Institute"
                    className={`w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border ${
                      fieldErrors.doctorDepartment ? 'border-rose-500' : 'border-slate-800'
                    } text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500`}
                  />
                </div>
                {fieldErrors.doctorDepartment && (
                  <p className="mt-1 text-xs text-rose-400">{fieldErrors.doctorDepartment}</p>
                )}
              </div>

              <div>
                <label htmlFor="reg-doc-exp" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Years of Experience
                </label>
                <input
                  id="reg-doc-exp"
                  type="number"
                  min="0"
                  max="60"
                  value={doctorExperience}
                  onChange={(e) => setDoctorExperience(e.target.value)}
                  disabled={isLoading}
                  placeholder="e.g. 10"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <p className="text-[11px] text-cyan-300/80 leading-relaxed pt-1">
              Notice: Doctor accounts require administrative credential approval before clinical privileges are granted. A permanent Doctor ID (prefix D) will be generated upon submission.
            </p>
          </div>
        )}

        {/* --- STAFF-SPECIFIC FIELDS --- */}
        {accountType === 'staff' && (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-emerald-500/30 space-y-3.5 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <HeartPulse size={15} />
              <span>Nursing & Ward Operations Information</span>
            </div>

            {/* Department */}
            <div>
              <label htmlFor="reg-staff-dept" className="block text-xs font-medium text-slate-300 mb-1.5">
                Department <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Building2 size={16} />
                </div>
                <input
                  id="reg-staff-dept"
                  type="text"
                  value={staffDepartment}
                  onChange={(e) => {
                    setStaffDepartment(e.target.value);
                    if (fieldErrors.staffDepartment) setFieldErrors((prev) => ({ ...prev, staffDepartment: '' }));
                  }}
                  disabled={isLoading}
                  placeholder="e.g. Inpatient Ward 4B & Clinical Triage"
                  className={`w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border ${
                    fieldErrors.staffDepartment ? 'border-rose-500' : 'border-slate-800'
                  } text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500`}
                />
              </div>
              {fieldErrors.staffDepartment && (
                <p className="mt-1 text-xs text-rose-400">{fieldErrors.staffDepartment}</p>
              )}
            </div>

            {/* Designation & Years of Experience in 2 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-staff-desig" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Designation <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Briefcase size={14} />
                  </div>
                  <input
                    id="reg-staff-desig"
                    type="text"
                    value={designation}
                    onChange={(e) => {
                      setDesignation(e.target.value);
                      if (fieldErrors.designation) setFieldErrors((prev) => ({ ...prev, designation: '' }));
                    }}
                    disabled={isLoading}
                    placeholder="e.g. Registered Nurse (RN)"
                    className={`w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border ${
                      fieldErrors.designation ? 'border-rose-500' : 'border-slate-800'
                    } text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500`}
                  />
                </div>
                {fieldErrors.designation && (
                  <p className="mt-1 text-xs text-rose-400">{fieldErrors.designation}</p>
                )}
              </div>

              <div>
                <label htmlFor="reg-staff-exp" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Years of Experience <span className="text-slate-500 text-[10px]">(optional)</span>
                </label>
                <input
                  id="reg-staff-exp"
                  type="number"
                  min="0"
                  max="50"
                  value={staffExperience}
                  onChange={(e) => setStaffExperience(e.target.value)}
                  disabled={isLoading}
                  placeholder="e.g. 4"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <p className="text-[11px] text-emerald-300/80 leading-relaxed pt-1">
              Notice: Staff accounts must be verified and approved by Nursing Operations before operational permissions are granted. A permanent Staff ID (prefix S) will be generated upon submission.
            </p>
          </div>
        )}

        {/* Create Password (All Roles) */}
        <div>
          <label htmlFor="reg-password" className="block text-xs font-medium text-slate-300 mb-1.5">
            Create Password <span className="text-teal-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Lock size={16} />
            </div>
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }));
              }}
              disabled={isLoading}
              placeholder="At least 8 characters with numbers"
              className={`w-full pl-10 pr-11 py-2.5 rounded-xl bg-slate-900/90 border ${
                fieldErrors.password ? 'border-rose-500' : 'border-slate-800'
              } text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="mt-1 text-xs text-rose-400 flex items-center gap-1">
              <AlertCircle size={12} />
              <span>{fieldErrors.password}</span>
            </p>
          )}
          {password && <PasswordStrengthIndicator password={password} />}
        </div>

        {/* Confirm Password (All Roles) */}
        <div>
          <label htmlFor="reg-confirm-password" className="block text-xs font-medium text-slate-300 mb-1.5">
            Confirm Password <span className="text-teal-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Lock size={16} />
            </div>
            <input
              id="reg-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
              }}
              disabled={isLoading}
              placeholder="Re-enter password to confirm"
              className={`w-full pl-10 pr-11 py-2.5 rounded-xl bg-slate-900/90 border ${
                fieldErrors.confirmPassword ? 'border-rose-500' : 'border-slate-800'
              } text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {fieldErrors.confirmPassword && (
            <p className="mt-1 text-xs text-rose-400 flex items-center gap-1">
              <AlertCircle size={12} />
              <span>{fieldErrors.confirmPassword}</span>
            </p>
          )}
        </div>

        {/* Privacy Notice and Consent Checkbox (Patient, Doctor, Staff) */}
        <div className="pt-1">
          <label className="flex items-start gap-2.5 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => {
                setAcceptTerms(e.target.checked);
                if (fieldErrors.acceptTerms) setFieldErrors((prev) => ({ ...prev, acceptTerms: '' }));
              }}
              disabled={isLoading}
              className="mt-0.5 rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-teal-500 h-4 w-4 shrink-0"
            />
            <span className="leading-relaxed">
              I consent to the{' '}
              <span className="text-teal-400 font-medium">MediAI Healthcare Data Governance</span>, Terms of Service, and acknowledge HIPAA-compliant record management.
            </span>
          </label>
          {fieldErrors.acceptTerms && (
            <p className="mt-1 text-xs text-rose-400 flex items-center gap-1">
              <AlertCircle size={12} />
              <span>{fieldErrors.acceptTerms}</span>
            </p>
          )}
        </div>

        {/* Dynamic Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full relative group flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-300 hover:from-teal-300 hover:via-cyan-300 hover:to-teal-200 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer shadow-md"
          >
            {isLoading ? (
              <>
                <Loader2 size={17} className="animate-spin text-slate-950" />
                <span>Processing registration...</span>
              </>
            ) : (
              <>
                <span>{getSubmitButtonLabel()}</span>
                <ArrowRight
                  size={16}
                  className="text-slate-950 group-hover:translate-x-0.5 transition-transform"
                />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Footer navigation */}
      <div className="mt-8 pt-6 border-t border-slate-800/80 text-center text-xs text-slate-400">
        <span>Already have an account? </span>
        <button
          type="button"
          onClick={() => onNavigate('login', accountType)}
          className="text-teal-400 hover:text-teal-300 font-semibold transition-colors cursor-pointer"
        >
          Sign in here
        </button>
      </div>
    </div>
  );
};
