/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Stethoscope,
  UserCheck,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Star,
  MapPin,
  Award,
  Loader2,
  AlertCircle,
  FileText,
  X,
} from 'lucide-react';
import {
  HospitalBranch,
  DoctorInfo,
  AppointmentRecord,
  BookingWizardState,
} from '../types/patient';
import { patientService } from '../services/patientService';

interface AppointmentBookingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (appointment: AppointmentRecord) => void;
  defaultSpecialty?: string;
}

export const AppointmentBookingWizard: React.FC<AppointmentBookingWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultSpecialty,
}) => {
  const [wizardState, setWizardState] = useState<BookingWizardState>({
    step: 1,
    branchId: '',
    branchName: '',
    specialty: defaultSpecialty || '',
    doctor: null,
    date: '',
    timeSlot: '',
    reason: '',
  });

  // Data fetching states
  const [branches, setBranches] = useState<HospitalBranch[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [doctors, setDoctors] = useState<DoctorInfo[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<{ time: string; isAvailable: boolean }[]>([]);

  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isLoadingSpecialties, setIsLoadingSpecialties] = useState(false);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Load branches & specialties on open
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsLoadingBranches(true);
      patientService.getBranches().then((res) => {
        setBranches(res);
        setIsLoadingBranches(false);
      });

      setIsLoadingSpecialties(true);
      patientService.getSpecialties().then((res) => {
        setSpecialties(res);
        setIsLoadingSpecialties(false);
      });
    }
  }, [isOpen]);

  // Load doctors when branch or specialty changes
  useEffect(() => {
    if (wizardState.branchId && wizardState.specialty) {
      setIsLoadingDoctors(true);
      patientService.getDoctors(wizardState.branchId, wizardState.specialty).then((docs) => {
        setDoctors(docs);
        setIsLoadingDoctors(false);
      });
    }
  }, [wizardState.branchId, wizardState.specialty]);

  // Load availability slots when doctor and date are selected
  useEffect(() => {
    if (wizardState.doctor && wizardState.date) {
      setIsLoadingSlots(true);
      patientService
        .getAvailability(wizardState.doctor.doctor_id, wizardState.date)
        .then((slots) => {
          setAvailabilitySlots(slots);
          setIsLoadingSlots(false);
        });
    }
  }, [wizardState.doctor, wizardState.date]);

  if (!isOpen) return null;

  // Step Navigators
  const canGoNext = () => {
    switch (wizardState.step) {
      case 1:
        return Boolean(wizardState.branchId);
      case 2:
        return Boolean(wizardState.specialty);
      case 3:
      case 4:
        return Boolean(wizardState.doctor);
      case 5:
        return Boolean(wizardState.date);
      case 6:
        return Boolean(wizardState.timeSlot);
      case 7:
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    setError(null);
    if (canGoNext() && wizardState.step < 7) {
      setWizardState((prev) => ({ ...prev, step: prev.step + 1 }));
    }
  };

  const prevStep = () => {
    setError(null);
    if (wizardState.step > 1) {
      setWizardState((prev) => ({ ...prev, step: prev.step - 1 }));
    }
  };

  // Generate calendar days for Step 5 (next 14 business days, skipping past and Sundays)
  const generateAvailableDates = () => {
    const dates: { dateStr: string; displayDay: string; displayDate: string; isAvailable: boolean }[] = [];
    const now = new Date();

    for (let i = 1; i <= 21; i++) {
      const d = new Date();
      d.setDate(now.getDate() + i);

      // Skip Sundays (0 = Sunday)
      const dayOfWeek = d.getDay();
      const isSunday = dayOfWeek === 0;

      const dateStr = d.toISOString().split('T')[0];
      const displayDay = d.toLocaleDateString('en-US', { weekday: 'short' });
      const displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      dates.push({
        dateStr,
        displayDay,
        displayDate,
        isAvailable: !isSunday,
      });

      if (dates.length >= 14) break;
    }

    return dates;
  };

  const handleConfirmBooking = async () => {
    if (!wizardState.doctor || !wizardState.date || !wizardState.timeSlot) {
      setError('Please complete all booking steps.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await patientService.bookAppointment({
        doctorId: wizardState.doctor.doctor_id,
        branchId: wizardState.branchId,
        appointmentDate: wizardState.date,
        appointmentTime: wizardState.timeSlot,
        date: wizardState.date,
        timeSlot: wizardState.timeSlot,
        reason: wizardState.reason || undefined,
      });

      if (res.success && res.appointment) {
        onSuccess(res.appointment);
        onClose();
      } else {
        setError(res.message || 'Failed to reserve appointment.');
      }
    } catch {
      setError('An unexpected error occurred while confirming your visit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepsList = [
    { num: 1, label: 'Branch' },
    { num: 2, label: 'Specialty' },
    { num: 3, label: 'Doctor' },
    { num: 4, label: 'Profile' },
    { num: 5, label: 'Date' },
    { num: 6, label: 'Time' },
    { num: 7, label: 'Review' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-slate-900 text-slate-100 shadow-2xl border border-slate-800 overflow-hidden">
        {/* Header with Step Progress Bar */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                Appointment Booking Wizard
              </span>
            </div>
            <h2 id="wizard-title" className="text-lg sm:text-xl font-bold text-white">
              {wizardState.step === 1 && 'Step 1: Select Hospital Branch'}
              {wizardState.step === 2 && 'Step 2: Choose Clinical Specialty'}
              {wizardState.step === 3 && 'Step 3: Select Your Doctor'}
              {wizardState.step === 4 && 'Step 4: Doctor Credentials & Ratings'}
              {wizardState.step === 5 && 'Step 5: Select Appointment Date'}
              {wizardState.step === 6 && 'Step 6: Available Time Slots'}
              {wizardState.step === 7 && 'Step 7: Review & Confirm Visit'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close booking wizard"
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator Badges */}
        <div className="px-6 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between overflow-x-auto gap-2">
          {stepsList.map((s) => {
            const isCurrent = wizardState.step === s.num;
            const isDone = wizardState.step > s.num;
            return (
              <div
                key={s.num}
                className={`flex items-center gap-1.5 text-xs font-semibold shrink-0 transition-colors ${
                  isCurrent
                    ? 'text-teal-300 font-bold'
                    : isDone
                    ? 'text-teal-400'
                    : 'text-slate-500'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    isCurrent
                      ? 'bg-teal-500 text-slate-950 shadow-sm ring-2 ring-teal-500/30'
                      : isDone
                      ? 'bg-teal-950/60 text-teal-300 border border-teal-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isDone ? '✓' : s.num}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Modal Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-medium">
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dynamic Wizard Body Content */}
        <div className="p-6 overflow-y-auto flex-1 min-h-[300px]">
          {/* STEP 1: SELECT HOSPITAL BRANCH */}
          {wizardState.step === 1 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400 font-medium">
                Choose the nearest or preferred hospital campus for your clinical consultation:
              </p>

              {isLoadingBranches ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                  <Loader2 size={24} className="animate-spin text-teal-400" />
                  <span className="text-xs">Loading hospital branches...</span>
                </div>
              ) : branches.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs space-y-2">
                  <p>No hospital branches currently configured.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {branches.map((b) => {
                    const isSelected = wizardState.branchId === b.branch_id;
                    return (
                      <div
                        key={b.branch_id}
                        onClick={() =>
                          setWizardState((prev) => ({
                            ...prev,
                            branchId: b.branch_id,
                            branchName: b.name,
                          }))
                        }
                        className={`p-4 rounded-2xl border text-left cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'border-teal-500 bg-teal-950/40 shadow-md ring-2 ring-teal-500/30'
                            : 'border-slate-800 bg-slate-950/80 hover:border-slate-700 hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2.5 rounded-xl shrink-0 ${
                              isSelected ? 'bg-teal-500 text-slate-950 font-bold' : 'bg-slate-900 text-teal-400 border border-slate-800'
                            }`}
                          >
                            <Building2 size={18} />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-bold text-white leading-snug">
                              {b.name}
                            </h4>
                            <p className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                              <MapPin size={12} className="text-slate-400 shrink-0" />
                              <span>{b.address}, {b.city}</span>
                            </p>
                            <p className="text-xs text-teal-400 font-semibold">
                              Hours: {b.working_hours}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: SELECT MEDICAL SPECIALTY */}
          {wizardState.step === 2 && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex items-center justify-between font-medium">
                <span>Selected Branch: <strong className="text-teal-400 font-bold">{wizardState.branchName}</strong></span>
                <button
                  type="button"
                  onClick={() => setWizardState((prev) => ({ ...prev, step: 1 }))}
                  className="text-xs text-teal-400 hover:text-teal-300 underline font-bold cursor-pointer"
                >
                  Change
                </button>
              </div>

              <p className="text-xs text-slate-400 font-medium">
                Select the clinical department or specialty required for your care:
              </p>

              {isLoadingSpecialties ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                  <Loader2 size={24} className="animate-spin text-teal-400" />
                  <span className="text-xs">Loading clinical specialties...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {specialties.map((spec) => {
                    const isSelected = wizardState.specialty === spec;
                    return (
                      <button
                        key={spec}
                        type="button"
                        onClick={() =>
                          setWizardState((prev) => ({
                            ...prev,
                            specialty: spec,
                            doctor: null, // Reset doctor when specialty changes
                          }))
                        }
                        className={`p-3.5 rounded-2xl border text-center transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-2 ${
                          isSelected
                            ? 'border-teal-500 bg-teal-950/40 text-teal-300 font-bold shadow-sm ring-2 ring-teal-500/30'
                            : 'border-slate-800 bg-slate-950/80 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60 font-semibold'
                        }`}
                      >
                        <div
                          className={`p-2.5 rounded-xl ${
                            isSelected ? 'bg-teal-500 text-slate-950' : 'bg-slate-900 text-teal-400 border border-slate-800'
                          }`}
                        >
                          <Stethoscope size={18} />
                        </div>
                        <span className="text-xs">{spec}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: BROWSE DOCTORS */}
          {wizardState.step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span>
                  <strong className="text-white font-bold">{wizardState.specialty}</strong> at {wizardState.branchName}
                </span>
                <span className="text-teal-400 font-bold">{doctors.length} Doctors Available</span>
              </div>

              {isLoadingDoctors ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                  <Loader2 size={24} className="animate-spin text-teal-400" />
                  <span className="text-xs">Finding available specialists...</span>
                </div>
              ) : doctors.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs space-y-2">
                  <p>No doctors currently found for this specialty at this specific branch.</p>
                  <button
                    type="button"
                    onClick={() => setWizardState((prev) => ({ ...prev, step: 2 }))}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-teal-300 font-bold hover:bg-slate-750"
                  >
                    Select Another Specialty
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {doctors.map((doc) => {
                    const isSelected = wizardState.doctor?.doctor_id === doc.doctor_id;
                    return (
                      <div
                        key={doc.doctor_id}
                        onClick={() =>
                          setWizardState((prev) => ({
                            ...prev,
                            doctor: doc,
                          }))
                        }
                        className={`p-4 rounded-2xl border text-left cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'border-teal-500 bg-teal-950/40 shadow-md ring-2 ring-teal-500/30'
                            : 'border-slate-800 bg-slate-950/80 hover:border-slate-700 hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-teal-500 to-cyan-600 text-slate-950 flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                            {doc.name.replace('Dr. ', '').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="space-y-1 flex-1">
                            <h4 className="text-sm font-bold text-white leading-tight">
                              {doc.name}
                            </h4>
                            <p className="text-xs text-teal-400 font-bold">{doc.specialty}</p>
                            <p className="text-xs text-slate-400 line-clamp-1 font-medium">{doc.qualification}</p>

                            <div className="flex items-center justify-between pt-1.5 border-t border-slate-800 text-xs">
                              <span className="text-slate-300">
                                Experience: <strong className="text-white font-bold">{doc.experience_years} yrs</strong>
                              </span>
                              {doc.rating && (
                                <span className="flex items-center gap-1 text-amber-400 font-bold">
                                  <Star size={13} className="fill-amber-400 text-amber-500" />
                                  <span>{doc.rating}</span>
                                  <span className="text-slate-500 text-[11px] font-normal">({doc.rating_count})</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: DOCTOR PROFILE & RELIABLE FEEDBACK DATA */}
          {wizardState.step === 4 && wizardState.doctor && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-slate-950 flex items-center justify-center font-bold text-xl shadow-md shrink-0">
                    {wizardState.doctor.name.replace('Dr. ', '').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base sm:text-lg font-bold text-white">
                        {wizardState.doctor.name}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-teal-950/60 text-teal-300 text-xs font-bold border border-teal-500/30">
                        {wizardState.doctor.specialty}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-semibold">
                      {wizardState.doctor.qualification}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                      <Building2 size={13} className="text-teal-400 shrink-0" />
                      <span>{wizardState.branchName}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800 text-xs">
                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 shadow-xs">
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-bold">Clinical Experience</span>
                    <span className="text-sm font-extrabold text-white mt-0.5 block">{wizardState.doctor.experience_years} Years</span>
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 shadow-xs">
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-bold">Patient Rating</span>
                    {wizardState.doctor.rating ? (
                      <span className="text-sm font-extrabold text-white flex items-center gap-1 mt-0.5">
                        <Star size={13} className="fill-amber-400 text-amber-500" />
                        <span>{wizardState.doctor.rating} / 5.0</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 italic mt-0.5 block">No feedback yet</span>
                    )}
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 col-span-2 sm:col-span-1 shadow-xs">
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-bold">Consultation Fee</span>
                    <span className="text-sm font-extrabold text-teal-400 mt-0.5 block">${wizardState.doctor.consultation_fee}</span>
                  </div>
                </div>
              </div>

              {/* Physician Practice Summary */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
                <span className="font-bold text-white flex items-center gap-1.5 text-xs">
                  <Award size={15} className="text-teal-400" />
                  Physician Credentials & Consultation Practice
                </span>
                <p className="text-slate-300 leading-relaxed text-xs font-normal">
                  Board-certified specialist practicing in {wizardState.doctor.specialty} at {wizardState.branchName}. Consultations include clinical evaluation, diagnostic examination, and personalized care planning.
                </p>
                <div className="text-xs text-slate-400 font-medium">
                  Credentials: {wizardState.doctor.qualification}
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: SELECT DATE */}
          {wizardState.step === 5 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span>Selecting date for <strong className="text-white font-bold">{wizardState.doctor?.name}</strong></span>
                <span className="text-teal-400 font-bold">Valid Booking Dates</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {generateAvailableDates().map((item) => {
                  const isSelected = wizardState.date === item.dateStr;
                  return (
                    <button
                      key={item.dateStr}
                      type="button"
                      disabled={!item.isAvailable}
                      onClick={() =>
                        setWizardState((prev) => ({
                          ...prev,
                          date: item.dateStr,
                          timeSlot: '', // reset time slot on date change
                        }))
                      }
                      className={`p-3 rounded-2xl border text-center transition-all duration-150 cursor-pointer ${
                        !item.isAvailable
                          ? 'opacity-30 bg-slate-950 border-slate-800 text-slate-600 cursor-not-allowed'
                          : isSelected
                          ? 'border-teal-500 bg-teal-500 text-slate-950 shadow-md font-bold'
                          : 'border-slate-800 bg-slate-950/80 hover:border-slate-700 hover:bg-slate-800/40 text-slate-200 font-semibold'
                      }`}
                    >
                      <span className="text-[11px] block uppercase font-bold">
                        {item.displayDay}
                      </span>
                      <span className="text-sm font-extrabold block my-1">
                        {item.displayDate.split(' ')[1]}
                      </span>
                      <span className="text-[11px] block opacity-85 font-medium">
                        {item.displayDate.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {wizardState.date && (
                <div className="p-3.5 rounded-xl bg-teal-950/30 border border-teal-500/30 text-xs text-slate-200 flex items-center justify-between font-medium">
                  <span>Selected Date: <strong className="text-teal-300 font-bold">{wizardState.date}</strong></span>
                  <span className="text-teal-400 font-bold">Ready for slot selection</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 6: AVAILABLE APPOINTMENT TIMES (Validated against backend) */}
          {wizardState.step === 6 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span>
                  Date: <strong className="text-white font-bold">{wizardState.date}</strong> with {wizardState.doctor?.name}
                </span>
                <span className="text-teal-400 font-bold">Live Conflict Checked</span>
              </div>

              {isLoadingSlots ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                  <Loader2 size={24} className="animate-spin text-teal-400" />
                  <span className="text-xs">Validating doctor clinic schedule...</span>
                </div>
              ) : availabilitySlots.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs space-y-2">
                  <p>No appointment slots available for this date.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {availabilitySlots.map((slot) => {
                    const isSelected = wizardState.timeSlot === slot.time;
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.isAvailable}
                        onClick={() =>
                          setWizardState((prev) => ({
                            ...prev,
                            timeSlot: slot.time,
                          }))
                        }
                        className={`p-3 rounded-xl border text-center transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 ${
                          !slot.isAvailable
                            ? 'opacity-30 bg-slate-950 border-slate-800 cursor-not-allowed line-through text-slate-600'
                            : isSelected
                            ? 'border-teal-500 bg-teal-500 text-slate-950 shadow-md font-bold'
                            : 'border-slate-800 bg-slate-950/80 hover:border-slate-700 hover:bg-slate-800/40 text-slate-200 font-semibold'
                        }`}
                      >
                        <Clock size={13} className={isSelected ? 'text-slate-950' : 'text-slate-400'} />
                        <span className="text-xs">{slot.time}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <p className="text-xs text-slate-500 italic">
                * Strikethrough slots indicate existing patient bookings or clinical rounds.
              </p>
            </div>
          )}

          {/* STEP 7: REVIEW AND CONFIRM */}
          {wizardState.step === 7 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[11px] text-teal-400 font-bold uppercase tracking-wider">
                      Appointment Summary
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      {wizardState.doctor?.name}
                    </h3>
                    <p className="text-xs text-slate-300 font-semibold">{wizardState.specialty}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-400 block">Consultation Fee</span>
                    <span className="text-lg font-extrabold text-teal-400">
                      ${wizardState.doctor?.consultation_fee}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-bold">Hospital Location</span>
                    <span className="font-bold text-white block mt-0.5">{wizardState.branchName}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-bold">Scheduled Date &amp; Time</span>
                    <span className="font-bold text-teal-400 block mt-0.5">
                      {wizardState.date} at {wizardState.timeSlot}
                    </span>
                  </div>
                </div>

                <div>
                  <label htmlFor="booking-reason" className="block text-xs font-bold text-slate-300 mb-1.5">
                    Primary Reason for Visit / Symptoms (Optional)
                  </label>
                  <input
                    id="booking-reason"
                    type="text"
                    value={wizardState.reason}
                    onChange={(e) =>
                      setWizardState((prev) => ({ ...prev, reason: e.target.value }))
                    }
                    placeholder="e.g. Quarterly check-up, blood pressure review, or follow-up consultation"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-800 bg-slate-900 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 placeholder-slate-500"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-teal-950/30 border border-teal-500/30 text-xs text-slate-300 flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-teal-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  Upon confirmation, this booking is registered directly into the official hospital appointment schedule.
                  You can reschedule or cancel anytime up to 24 hours prior.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            disabled={wizardState.step === 1 || isSubmitting}
            onClick={prevStep}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-750 hover:text-white transition-colors disabled:opacity-40 cursor-pointer shadow-xs"
          >
            <ArrowLeft size={14} />
            <span>Previous Step</span>
          </button>

          {wizardState.step < 7 ? (
            <button
              type="button"
              disabled={!canGoNext()}
              onClick={nextStep}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-teal-500 hover:bg-teal-400 transition-all shadow-md shadow-teal-500/20 disabled:opacity-40 cursor-pointer"
            >
              <span>Continue</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmBooking}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-extrabold text-slate-950 bg-teal-500 hover:bg-teal-400 transition-all shadow-lg shadow-teal-500/30 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin text-slate-950" />
                  <span>Registering Appointment...</span>
                </>
              ) : (
                <>
                  <span>Confirm &amp; Book Appointment</span>
                  <CheckCircle2 size={16} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
