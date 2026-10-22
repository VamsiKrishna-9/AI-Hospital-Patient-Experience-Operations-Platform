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
  Building,
  KeyRound,
  ShieldCheck,
  Stethoscope,
  IdCard,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import {
  HospitalRole,
  ScreenState,
  SignupFormData,
  AuthResponse,
} from '../types/auth';
import {
  ROLES_CONFIG,
  MEDICAL_SPECIALIZATIONS,
  HOSPITAL_DEPARTMENTS,
} from '../data/roles';
import { RoleSelector } from './RoleSelector';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { authService } from '../services/authService';
import {
  calculatePasswordStrength,
  isValidEmail,
  isValidPhone,
  isValidDateOfBirth,
} from '../utils/validation';

interface SignupScreenProps {
  onNavigate: (screen: ScreenState, role?: HospitalRole) => void;
  selectedRole: HospitalRole;
  onRoleChange: (role: HospitalRole) => void;
}

export const SignupScreen: React.FC<SignupScreenProps> = ({
  onNavigate,
  selectedRole,
  onRoleChange,
}) => {
  // Shared fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Role-specific fields
  // Patient
  const [dateOfBirth, setDateOfBirth] = useState('');

  // Doctor
  const [specialization, setSpecialization] = useState(MEDICAL_SPECIALIZATIONS[0]);
  const [medicalRegNumber, setMedicalRegNumber] = useState('');
  const [doctorInviteCode, setDoctorInviteCode] = useState('');

  // Staff
  const [staffId, setStaffId] = useState('');
  const [department, setDepartment] = useState(HOSPITAL_DEPARTMENTS[0]);
  const [staffInviteCode, setStaffInviteCode] = useState('');

  // Admin
  const [adminInviteCode, setAdminInviteCode] = useState('');

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authResult, setAuthResult] = useState<AuthResponse | null>(null);

  const handleRoleSelect = (role: HospitalRole) => {
    onRoleChange(role);
    setError(null);
    setAuthResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAuthResult(null);

    // Shared Validations
    if (!fullName.trim()) {
      setError('Please provide your full legal name.');
      return;
    }

    if (selectedRole === 'admin') {
      if (!email.trim()) {
        setError('Official administrator institutional email is required.');
        return;
      }
      if (!isValidEmail(email)) {
        setError('Please provide a valid institutional email format.');
        return;
      }
      if (!adminInviteCode.trim()) {
        setError('Administrator registration requires an authorized governance invitation code. Unrestricted public admin access is strictly prohibited.');
        return;
      }
    } else {
      if (!email.trim() || !isValidEmail(email)) {
        setError('Please provide a valid email address.');
        return;
      }
      if (!phone.trim() || !isValidPhone(phone)) {
        setError('Please provide a valid contact phone number.');
        return;
      }
    }

    // Role Specific Validations
    if (selectedRole === 'patient') {
      const dobCheck = isValidDateOfBirth(dateOfBirth);
      if (!dobCheck.valid) {
        setError(dobCheck.message || 'Please provide a valid date of birth.');
        return;
      }
    } else if (selectedRole === 'doctor') {
      if (!specialization) {
        setError('Please select your medical specialization.');
        return;
      }
      if (!medicalRegNumber.trim()) {
        setError('Medical registration license number (NPI / GMC) is required for physician credential verification.');
        return;
      }
      if (!doctorInviteCode.trim()) {
        setError('Hospital physician invitation code is required.');
        return;
      }
    } else if (selectedRole === 'staff') {
      if (!staffId.trim()) {
        setError('Hospital Staff ID is required.');
        return;
      }
      if (!department) {
        setError('Please select your clinical department.');
        return;
      }
      if (!staffInviteCode.trim()) {
        setError('Hospital unit invitation code is required.');
        return;
      }
    }

    // Password Validations
    const strength = calculatePasswordStrength(password);
    if (strength.score < 2 || password.length < 8) {
      setError('Password does not meet minimum security requirements (at least 8 characters with mixed case and numbers).');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    if (!acceptTerms) {
      setError('You must review and consent to the MediAI Data Governance and Terms of Service to proceed.');
      return;
    }

    setIsLoading(true);

    try {
      let payload: SignupFormData;

      if (selectedRole === 'patient') {
        payload = {
          role: 'patient',
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          dateOfBirth,
          password,
          confirmPassword,
          acceptTerms,
        };
      } else if (selectedRole === 'doctor') {
        payload = {
          role: 'doctor',
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          specialization,
          medicalRegNumber: medicalRegNumber.trim(),
          hospitalInviteCode: doctorInviteCode.trim(),
          password,
          confirmPassword,
          acceptTerms,
        };
      } else if (selectedRole === 'staff') {
        payload = {
          role: 'staff',
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          staffId: staffId.trim(),
          department,
          hospitalInviteCode: staffInviteCode.trim(),
          password,
          confirmPassword,
          acceptTerms,
        };
      } else {
        payload = {
          role: 'admin',
          fullName: fullName.trim(),
          officialEmail: email.trim(),
          adminInviteCode: adminInviteCode.trim(),
          password,
          confirmPassword,
          acceptTerms,
        };
      }

      const response = await authService.signup(payload);
      setAuthResult(response);

      if (!response.success) {
        setError(response.message);
      }
    } catch {
      setError('An error occurred during account registration dispatch.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center min-h-full py-8 px-6 sm:px-10 lg:px-14 max-w-xl mx-auto w-full">
      {/* Header */}
      <div className="mb-5 space-y-1.5">
        <span className="text-xs font-semibold text-teal-400 tracking-wider uppercase">
          New Account Registration
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Join MediAI Platform
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Create credentials tailored for your specific healthcare responsibilities.
        </p>
      </div>

      {/* Role Selection */}
      <div className="mb-5">
        <RoleSelector
          selectedRole={selectedRole}
          onSelectRole={handleRoleSelect}
          variant="compact"
          disabled={isLoading}
        />
      </div>

      {/* Special Security Advisory for Administrator Role */}
      {selectedRole === 'admin' && (
        <div className="mb-4 p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2.5">
          <ShieldAlert size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-amber-100">
              Restricted Administrator Governance
            </span>
            <p className="text-[11px] text-amber-300/90 leading-relaxed">
              Institutional security protocol: Admin accounts require an authorized verification key issued by Hospital Governance. Public self-registration without a key is blocked.
            </p>
            <p className="text-[10px] text-slate-400">
              Contact your Hospital Governance officer or IT Security Director for authorization credentials.
            </p>
          </div>
        </div>
      )}

      {/* Success Feedback Banner */}
      {authResult && authResult.success && (
        <div className="mb-5 p-4 rounded-xl bg-teal-950/70 border border-teal-500/50 text-xs text-teal-200 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} className="text-teal-400 shrink-0 mt-0.5" />
            <div className="space-y-2 w-full">
              <div>
                <p className="font-semibold text-teal-100 text-sm">
                  Registration Complete — {ROLES_CONFIG[selectedRole].title} Portal
                </p>
                <p className="text-[12px] text-teal-300/90 leading-relaxed mt-0.5">
                  {authResult.message || `Welcome to MediAI. Your registration for ${fullName || 'your account'} has been submitted.`}
                </p>
              </div>

              {(authResult.patientId || authResult.user?.patient_id) && (
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-teal-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Your Official Patient ID</span>
                    <span className="text-sm font-mono font-bold text-teal-300">{authResult.patientId || authResult.user?.patient_id}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Save for login</span>
                </div>
              )}

              {authResult.requiresEmailConfirmation ? (
                <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-200 text-[11px]">
                  <strong>Action Required:</strong> A verification link has been sent to your email. Please verify your email before logging in.
                </div>
              ) : (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => onNavigate('login', selectedRole)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-400 text-slate-950 font-semibold text-xs hover:bg-teal-300 transition-colors cursor-pointer"
                  >
                    <span>Proceed to Sign In</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 animate-in fade-in duration-200 flex items-start gap-2.5"
        >
          <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{error}</div>
        </div>
      )}

      {/* Dynamic Role-Based Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
        {/* Full Name (All Roles) */}
        <div>
          <label htmlFor="reg-fullname" className="block text-xs font-medium text-slate-300 mb-1">
            Full Name {selectedRole === 'doctor' && '(with credentials, e.g. Dr. Jane Smith, MD)'}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <User size={15} />
            </div>
            <input
              id="reg-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isLoading}
              placeholder={
                selectedRole === 'patient'
                  ? 'Eleanor Vance'
                  : selectedRole === 'doctor'
                  ? 'Dr. Marcus Chen, MD'
                  : selectedRole === 'staff'
                  ? 'Sarah Jenkins, RN'
                  : 'Hospital Director Robert Hayes'
              }
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Email Field (All Roles) */}
        <div>
          <label htmlFor="reg-email" className="block text-xs font-medium text-slate-300 mb-1">
            {selectedRole === 'admin' ? 'Institutional Administrator Email' : 'Email Address'}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Mail size={15} />
            </div>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              placeholder={
                selectedRole === 'admin'
                  ? 'admin.director@medicare.mediai.health'
                  : 'user@hospital.mediai.health'
              }
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Phone Field (Patient, Doctor, Staff) */}
        {selectedRole !== 'admin' && (
          <div>
            <label htmlFor="reg-phone" className="block text-xs font-medium text-slate-300 mb-1">
              Contact Phone Number
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Phone size={15} />
              </div>
              <input
                id="reg-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isLoading}
                placeholder="+1 (555) 000-0000"
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
        )}

        {/* ROLE SPECIFIC: PATIENT -> Date of Birth */}
        {selectedRole === 'patient' && (
          <div>
            <label htmlFor="reg-dob" className="block text-xs font-medium text-slate-300 mb-1">
              Date of Birth (Required for Medical Record Matching)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Calendar size={15} />
              </div>
              <input
                id="reg-dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                disabled={isLoading}
                max={new Date().toISOString().split('T')[0]}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 [color-scheme:dark]"
              />
            </div>
          </div>
        )}

        {/* ROLE SPECIFIC: DOCTOR -> Specialization, Medical Reg Number, Hospital Invite Code */}
        {selectedRole === 'doctor' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-specialization" className="block text-xs font-medium text-slate-300 mb-1">
                  Clinical Specialization
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Stethoscope size={15} />
                  </div>
                  <select
                    id="reg-specialization"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  >
                    {MEDICAL_SPECIALIZATIONS.map((spec) => (
                      <option key={spec} value={spec} className="bg-slate-900 text-white">
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="reg-med-reg" className="block text-xs font-medium text-slate-300 mb-1">
                  Medical Registration No.
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <IdCard size={15} />
                  </div>
                  <input
                    id="reg-med-reg"
                    type="text"
                    value={medicalRegNumber}
                    onChange={(e) => setMedicalRegNumber(e.target.value)}
                    disabled={isLoading}
                    placeholder="e.g. NPI-10492817"
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="reg-doc-invite" className="block text-xs font-medium text-slate-300">
                  Hospital Physician Invitation Code
                </label>
                <span className="text-[10px] text-slate-500">Issued by Hospital Credentialing</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound size={15} />
                </div>
                <input
                  id="reg-doc-invite"
                  type="text"
                  value={doctorInviteCode}
                  onChange={(e) => setDoctorInviteCode(e.target.value)}
                  disabled={isLoading}
                  placeholder="Enter authorized hospital invitation code"
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-xs font-mono uppercase focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>
          </>
        )}

        {/* ROLE SPECIFIC: STAFF -> Staff ID, Department, Hospital Invite Code */}
        {selectedRole === 'staff' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-staff-id" className="block text-xs font-medium text-slate-300 mb-1">
                  Hospital Staff ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <IdCard size={15} />
                  </div>
                  <input
                    id="reg-staff-id"
                    type="text"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    disabled={isLoading}
                    placeholder="e.g. STF-8842-NUR"
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-department" className="block text-xs font-medium text-slate-300 mb-1">
                  Hospital Department
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Building size={15} />
                  </div>
                  <select
                    id="reg-department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  >
                    {HOSPITAL_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept} className="bg-slate-900 text-white">
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="reg-staff-invite" className="block text-xs font-medium text-slate-300">
                  Unit Authorization Code
                </label>
                <span className="text-[10px] text-slate-500">Issued by Department Head</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound size={15} />
                </div>
                <input
                  id="reg-staff-invite"
                  type="text"
                  value={staffInviteCode}
                  onChange={(e) => setStaffInviteCode(e.target.value)}
                  disabled={isLoading}
                  placeholder="Enter hospital unit supervisor code"
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-xs font-mono uppercase focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
              </div>
            </div>
          </>
        )}

        {/* ROLE SPECIFIC: ADMIN -> Administrator Invitation Code */}
        {selectedRole === 'admin' && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="reg-admin-invite" className="block text-xs font-medium text-amber-200">
                Governance Authorization Key (Mandatory)
              </label>
              <span className="text-[10px] text-amber-400/70">Confidential Key Required</span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-amber-500">
                <ShieldCheck size={15} />
              </div>
              <input
                id="reg-admin-invite"
                type="text"
                value={adminInviteCode}
                onChange={(e) => setAdminInviteCode(e.target.value)}
                disabled={isLoading}
                placeholder="Enter institutional governance authorization key"
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-amber-600/50 text-amber-100 placeholder-slate-600 text-xs font-mono tracking-wider uppercase focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
            </div>
          </div>
        )}

        {/* Password & Confirm Password (All Roles) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label htmlFor="reg-password" className="block text-xs font-medium text-slate-300 mb-1">
              Create Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock size={15} />
              </div>
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                placeholder="Min. 8 characters"
                className="w-full pl-10 pr-10 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="reg-confirm-password" className="block text-xs font-medium text-slate-300 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock size={15} />
              </div>
              <input
                id="reg-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                placeholder="Re-enter password"
                className="w-full pl-10 pr-10 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Password Strength Indicator */}
        <PasswordStrengthIndicator password={password} showRequirements={true} />

        {/* Terms of Service & Privacy Consent */}
        <div className="pt-2">
          <label className="flex items-start gap-2.5 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              disabled={isLoading}
              className="mt-0.5 rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-teal-500 h-4 w-4 shrink-0"
            />
            <span className="leading-snug text-[11px]">
              I confirm accurate information and consent to MediAI's{' '}
              <span className="text-teal-300 hover:underline">HIPAA Privacy Notice</span>,{' '}
              <span className="text-teal-300 hover:underline">Clinical Data Governance Policy</span>, and{' '}
              <span className="text-teal-300 hover:underline">Role-Based Auditing Terms</span>.
            </span>
          </label>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full group flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-300 hover:from-teal-300 hover:via-cyan-300 hover:to-teal-200 active:scale-[0.99] transition-all duration-150 shadow-lg shadow-teal-500/25 hover:shadow-teal-500/35 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin text-slate-950" />
                <span>Validating & Registering...</span>
              </>
            ) : (
              <>
                <span>Complete {ROLES_CONFIG[selectedRole].title} Registration</span>
                <ArrowRight size={16} className="text-slate-950 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Navigation back to Login */}
      <div className="mt-6 pt-5 border-t border-slate-800/80 text-center text-xs text-slate-400">
        <span>Already have an authorized account? </span>
        <button
          type="button"
          onClick={() => onNavigate('login', selectedRole)}
          className="font-semibold text-teal-400 hover:text-teal-300 transition-colors ml-1 cursor-pointer"
        >
          Sign in to your portal
        </button>
      </div>
    </div>
  );
};
