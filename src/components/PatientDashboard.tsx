/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Building2,
  Stethoscope,
  FileText,
  Pill,
  HeartPulse,
  Bell,
  LogOut,
  Plus,
  CheckCircle2,
  AlertCircle,
  User,
  ShieldCheck,
  RefreshCw,
  Eye,
  X,
  Activity,
  Layers,
  Sparkles,
  Phone,
  Droplet,
  Star,
  MessageSquare,
  Send,
  MapPin,
  Briefcase,
  ThumbsUp,
  Users,
} from 'lucide-react';
import {
  PatientDashboardData,
  AppointmentRecord,
  EncounterRecord,
  LabResultRecord,
  PrescriptionRecord,
  FeedbackRecord,
  NotificationItem,
  DoctorInfo,
} from '../types/patient';
import { patientService } from '../services/patientService';
import { authService } from '../services/authService';
import { HospitalRole, AuthUser } from '../types/auth';
import { AppointmentBookingWizard } from './AppointmentBookingWizard';
import { AiHospitalAssistant } from './AiHospitalAssistant';
import { AiHospitalAssistantLauncher } from './AiHospitalAssistantLauncher';
import { AiHospitalAssistantLogo } from './AiHospitalAssistantLogo';
import { aiChatService } from '../services/aiChatService';

interface PatientDashboardProps {
  user?: AuthUser | null;
  onLogout: () => void;
  onRoleSwitch?: (role: HospitalRole) => void;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({ user, onLogout, onRoleSwitch }) => {
  const [dashboardData, setDashboardData] = useState<PatientDashboardData | null>(null);
  const [availableDoctors, setAvailableDoctors] = useState<DoctorInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'care-team' | 'encounters' | 'labs' | 'prescriptions' | 'feedback' | 'ai-assistant'>('overview');

  // AI Chatbot visibility & preference state
  const [chatbotEnabled, setChatbotEnabled] = useState<boolean>(() => aiChatService.isChatbotEnabled());

  useEffect(() => {
    aiChatService.fetchServerPreferences().then((pref) => {
      setChatbotEnabled(pref.chatbotEnabled);
    });
  }, []);

  const handleRemoveChatbot = () => {
    setChatbotEnabled(false);
    if (activeTab === 'ai-assistant') {
      setActiveTab('overview');
    }
    setSuccessToast('AI Hospital Assistant has been removed from your account. You can restore it from settings at any time.');
    setTimeout(() => setSuccessToast(null), 6000);
  };

  const handleRestoreChatbot = async () => {
    await aiChatService.setChatbotEnabled(true);
    setChatbotEnabled(true);
    setSuccessToast('AI Hospital Assistant has been restored to your interface.');
    setTimeout(() => setSuccessToast(null), 5000);
  };

  // Booking Wizard modal
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  // Notifications dropdown
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Selected item modal for detailed view
  const [selectedLabReport, setSelectedLabReport] = useState<LabResultRecord | null>(null);
  const [selectedEncounter, setSelectedEncounter] = useState<EncounterRecord | null>(null);

  // Feedback form modal
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackDoctorId, setFeedbackDoctorId] = useState('');
  const [feedbackDoctorRating, setFeedbackDoctorRating] = useState(5);
  const [feedbackStaffRating, setFeedbackStaffRating] = useState(5);
  const [feedbackWaitRating, setFeedbackWaitRating] = useState(4);
  const [feedbackFacilityRating, setFeedbackFacilityRating] = useState(5);
  const [feedbackCleanlinessRating, setFeedbackCleanlinessRating] = useState(5);
  const [feedbackCommRating, setFeedbackCommRating] = useState(5);
  const [feedbackComments, setFeedbackComments] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Success toast for notifications
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [res, docs] = await Promise.all([
        patientService.getDashboardData(),
        patientService.getDoctors(),
      ]);
      if (res.success && res.data) {
        setDashboardData(res.data);
        setNotifications(res.data.notifications || []);
        if (res.data.completedEncounters.length > 0 && !feedbackDoctorId) {
          setFeedbackDoctorId(res.data.completedEncounters[0].doctor_id);
        }
      } else {
        setError(res.message || 'Failed to load patient records.');
      }
      if (docs && docs.length > 0) {
        setAvailableDoctors(docs);
        if (!feedbackDoctorId) {
          setFeedbackDoctorId(docs[0].doctor_id);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to hospital records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleBookingSuccess = (newApt: AppointmentRecord) => {
    setSuccessToast(`Appointment with ${newApt.doctor_name} on ${newApt.appointment_date} confirmed!`);
    fetchDashboard();
    setTimeout(() => setSuccessToast(null), 6000);
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (confirm('Are you sure you wish to cancel this appointment?')) {
      const ok = await patientService.cancelAppointment(appointmentId);
      if (ok) {
        setSuccessToast('Appointment was successfully cancelled.');
        fetchDashboard();
        setTimeout(() => setSuccessToast(null), 4000);
      }
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackComments.trim()) {
      alert('Please provide your feedback comments.');
      return;
    }

    setIsSubmittingFeedback(true);
    const res = await patientService.submitFeedback({
      doctorId: feedbackDoctorId || undefined,
      rating: feedbackRating,
      doctorRating: feedbackDoctorRating,
      staffRating: feedbackStaffRating,
      waitingTimeRating: feedbackWaitRating,
      facilityRating: feedbackFacilityRating,
      cleanlinessRating: feedbackCleanlinessRating,
      communicationRating: feedbackCommRating,
      comments: feedbackComments,
    });

    setIsSubmittingFeedback(false);

    if (res.success) {
      setIsFeedbackModalOpen(false);
      setFeedbackComments('');
      setSuccessToast('Thank you! Your feedback has been recorded in the hospital care ledger.');
      fetchDashboard();
      setTimeout(() => setSuccessToast(null), 5000);
    } else {
      alert(res.message || 'Failed to submit feedback.');
    }
  };

  const handleLogout = async () => {
    setDashboardData(null);
    setNotifications([]);
    setAvailableDoctors([]);
    authService.clearSession();
    patientService.clearSession();
    await patientService.logout();
    onLogout();
  };

  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

  const markAllNotifsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-teal-500/30 selection:text-teal-200 flex flex-col">
      {/* Top Patient Portal Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand mark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-sm shadow-teal-500/10">
              <HeartPulse size={19} className="animate-pulse text-teal-400" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white whitespace-nowrap">
                MediAI <span className="text-teal-400 font-semibold">· Patient Portal</span>
              </div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap">
                {dashboardData?.patient?.primary_doctor_name ? `Primary Care: ${dashboardData.patient.primary_doctor_name}` : 'Comprehensive Patient Health Portal'}
              </div>
            </div>
          </div>

          {/* Right actions: Notifications, Profile, Role badge & Logout */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Notifications Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                aria-label="Patient notifications"
                className="relative p-2 rounded-lg text-slate-400 hover:text-teal-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
              >
                <Bell size={16} />
                {unreadNotifsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                    {unreadNotifsCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-4 text-xs z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                    <span className="font-bold text-sm text-white">Clinical Notifications</span>
                    <button
                      type="button"
                      onClick={markAllNotifsRead}
                      className="text-teal-400 hover:text-teal-300 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Mark all as read
                    </button>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {notifications.length === 0 ? (
                      <p className="text-center py-6 text-slate-500">No notifications at this time.</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3 rounded-xl border transition-all ${
                            n.read
                              ? 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                              : 'bg-teal-950/40 border-teal-500/30 text-teal-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs text-white">{n.title}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{n.timestamp}</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed font-normal">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Patient Profile Pill */}
            <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-slate-800">
              <div className="w-8 h-8 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                {user?.name?.charAt(0) || dashboardData?.patient?.first_name?.charAt(0) || dashboardData?.patient?.name?.charAt(0) || 'P'}
              </div>
              <div className="text-left text-xs">
                <span className="font-semibold text-white block truncate max-w-[130px]">
                  {user?.name || dashboardData?.patient?.name || `${dashboardData?.patient?.first_name || ''} ${dashboardData?.patient?.last_name || ''}`.trim() || 'Patient'}
                </span>
                <span className="text-slate-400 font-mono text-[10px] block">
                  {user?.patient_id || dashboardData?.patient?.patient_id || user?.email}
                </span>
              </div>
            </div>

            {/* Verified Patient Role Badge */}
            <div
              className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg border border-teal-500/30 bg-teal-950/40 text-xs font-medium text-slate-200 shrink-0 select-none shadow-xs"
              title="Verified Role: Patient"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
              <span className="text-slate-400 hidden sm:inline">Role:</span>
              <span className="text-teal-300 font-semibold">Patient</span>
            </div>

            {/* AI Assistant Quick Navigation or Restore Pill */}
            {chatbotEnabled ? (
              <button
                type="button"
                onClick={() => setActiveTab('ai-assistant')}
                title="Open AI Hospital Assistant Workspace"
                className={`hidden md:inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  activeTab === 'ai-assistant'
                    ? 'bg-teal-500/25 text-teal-300 border-teal-500/40 shadow-xs'
                    : 'bg-slate-900 text-slate-300 hover:text-white border-slate-800 hover:bg-slate-800'
                }`}
              >
                <AiHospitalAssistantLogo size={14} showText={false} />
                <span>AI Assistant</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRestoreChatbot}
                title="Restore AI Hospital Assistant"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-xs font-semibold transition-all cursor-pointer shadow-xs"
              >
                <Plus size={13} className="text-teal-400" />
                <span>Restore AI</span>
              </button>
            )}

            {/* Logout button */}
            <button
              type="button"
              onClick={handleLogout}
              title="Sign Out of Patient Portal"
              className="p-2 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1 w-full">
        {/* Success Feedback Alert Toast */}
        {successToast && (
          <div className="p-3.5 rounded-xl bg-teal-950/60 border border-teal-500/40 text-xs text-teal-200 flex items-center justify-between shadow-xs animate-in slide-in-from-top duration-200">
            <div className="flex items-center gap-2.5 font-medium">
              <CheckCircle2 size={16} className="text-teal-400 shrink-0" />
              <span>{successToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessToast(null)}
              className="text-teal-400 hover:text-teal-200 font-semibold text-xs cursor-pointer ml-3"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Global Error Notice */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={18} className="text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={fetchDashboard}
              className="px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-medium cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && !dashboardData && (
          <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-3">
            <RefreshCw size={24} className="animate-spin text-teal-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading authenticated clinical records and health history...</p>
          </div>
        )}

        {/* Loaded Dashboard Content */}
        {dashboardData && (
          <>
            {/* 1. Personalized Welcome Header Banner */}
            <div className="relative rounded-2xl p-6 sm:p-7 bg-gradient-to-r from-slate-900/95 via-slate-900/85 to-teal-950/40 border border-teal-500/20 text-white shadow-xs overflow-hidden">
              <div className="pointer-events-none absolute -right-20 -top-20 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl" />

              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-3">
                  <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-xs font-mono text-teal-300 border border-teal-500/30 shadow-xs">
                    <span>MRN: {dashboardData.patient.patient_id}</span>
                    {dashboardData.patient.blood_group && (
                      <>
                        <span className="text-slate-600">·</span>
                        <span className="flex items-center gap-1 text-rose-300">
                          <Droplet size={10} className="text-rose-400" />
                          {dashboardData.patient.blood_group}
                        </span>
                      </>
                    )}
                    {dashboardData.patient.age && (
                      <>
                        <span className="text-slate-600">·</span>
                        <span>{dashboardData.patient.age}y</span>
                      </>
                    )}
                    {dashboardData.patient.gender && dashboardData.patient.gender !== 'Not specified' && (
                      <>
                        <span className="text-slate-600">·</span>
                        <span>{dashboardData.patient.gender}</span>
                      </>
                    )}
                    {dashboardData.patient.city && (
                      <>
                        <span className="text-slate-600">·</span>
                        <span className="flex items-center gap-1 text-slate-300">
                          <MapPin size={11} className="text-slate-400" /> {dashboardData.patient.city}
                        </span>
                      </>
                    )}
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    Good day, {dashboardData.patient.name || user?.name || `${dashboardData.patient.first_name || ''} ${dashboardData.patient.last_name || ''}`.trim() || 'Patient'}
                  </h1>

                  <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                    {dashboardData.patient.primary_doctor_name ? (
                      <>
                        Primary Attending Physician:{' '}
                        <strong className="text-teal-300 font-semibold">
                          {dashboardData.patient.primary_doctor_name}
                        </strong>
                        . Your clinical records, appointments, and care history are synchronized directly with hospital databases.
                      </>
                    ) : (
                      <>
                        No primary physician assigned yet. Schedule an appointment below to connect with an attending specialist.
                      </>
                    )}
                  </p>
                </div>

                {/* CTAs */}
                <div className="shrink-0 flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsFeedbackModalOpen(true)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-medium text-xs border border-slate-800 transition-all cursor-pointer"
                  >
                    <MessageSquare size={14} className="text-teal-400" />
                    <span>Share Experience</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsBookingOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-xs hover:shadow-teal-500/20 transition-all cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>Book New Visit</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Key Metrics Snapshot Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <div
                onClick={() => setActiveTab('appointments')}
                className="p-3.5 sm:p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Upcoming Visits</span>
                  <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 group-hover:scale-110 transition-transform">
                    <Calendar size={14} />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white font-mono tabular-nums">
                    {dashboardData.upcomingAppointments.length}
                  </span>
                  <span className="text-[10px] text-teal-300 font-mono bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                    Active
                  </span>
                </div>
              </div>

              <div
                onClick={() => setActiveTab('encounters')}
                className="p-3.5 sm:p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Past Visits</span>
                  <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 group-hover:scale-110 transition-transform">
                    <Stethoscope size={14} />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white font-mono tabular-nums">
                    {dashboardData.completedEncounters.length}
                  </span>
                  <span className="text-[10px] text-teal-300 font-mono bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                    Encounters
                  </span>
                </div>
              </div>

              <div
                onClick={() => setActiveTab('labs')}
                className="p-3.5 sm:p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Lab Reports</span>
                  <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 group-hover:scale-110 transition-transform">
                    <FileText size={14} />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white font-mono tabular-nums">
                    {dashboardData.labReports.length}
                  </span>
                  <span className="text-[10px] text-teal-300 font-mono bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                    Verified
                  </span>
                </div>
              </div>

              <div
                onClick={() => setActiveTab('prescriptions')}
                className="p-3.5 sm:p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Prescriptions</span>
                  <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 group-hover:scale-110 transition-transform">
                    <Pill size={14} />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white font-mono tabular-nums">
                    {dashboardData.prescriptions.length}
                  </span>
                  <span className="text-[10px] text-teal-300 font-mono bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                    Active
                  </span>
                </div>
              </div>

              <div
                onClick={() => setActiveTab('feedback')}
                className="col-span-2 sm:col-span-1 p-3.5 sm:p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Care Reviews</span>
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform">
                    <Star size={14} />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white font-mono tabular-nums">
                    {dashboardData.feedbackList?.length || 0}
                  </span>
                  <span className="text-[10px] text-amber-300 font-mono bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    Logged
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Navigation Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto bg-slate-950/80 p-1.5 rounded-xl border border-slate-800" role="tablist">
              {[
                { id: 'overview', label: 'Overview & Next Visits', icon: Calendar },
                { id: 'appointments', label: `Appointments (${dashboardData.upcomingAppointments.length})`, icon: Clock },
                { id: 'care-team', label: `Assigned Care Team (${dashboardData.assignedStaff?.length || 0})`, icon: Users },
                { id: 'encounters', label: `Past Visits (${dashboardData.completedEncounters.length})`, icon: Stethoscope },
                { id: 'labs', label: `Lab Results (${dashboardData.labReports.length})`, icon: FileText },
                { id: 'prescriptions', label: `Prescriptions (${dashboardData.prescriptions.length})`, icon: Pill },
                { id: 'feedback', label: `Care Feedback (${dashboardData.feedbackList?.length || 0})`, icon: Star },
                ...(chatbotEnabled
                  ? [{ id: 'ai-assistant', label: 'AI Hospital Assistant', isAi: true }]
                  : []),
              ].map((tab: any) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                    }`}
                  >
                    {tab.isAi ? (
                      <AiHospitalAssistantLogo size={14} showText={false} />
                    ) : Icon ? (
                      <Icon size={13} className={isActive ? 'text-teal-400' : 'text-slate-400'} />
                    ) : null}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB: OVERVIEW & UPCOMING APPOINTMENTS */}
            {(activeTab === 'overview' || activeTab === 'appointments') && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                      Upcoming Scheduled Appointments
                    </h2>
                    <p className="text-xs text-slate-400">
                      Authoritative schedule synchronized with clinical hospital records.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBookingOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-500/15 text-teal-300 border border-teal-500/30 hover:bg-teal-500/25 text-xs font-semibold transition-all shadow-xs cursor-pointer"
                  >
                    <Plus size={14} className="text-teal-400" />
                    <span>Book New Visit</span>
                  </button>
                </div>

                {dashboardData.upcomingAppointments.length === 0 ? (
                  <div className="p-8 sm:p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-900 text-slate-500 mx-auto flex items-center justify-center border border-slate-800">
                      <Calendar size={22} className="text-teal-400" />
                    </div>
                    <h3 className="text-sm font-bold text-white">You have no upcoming appointments.</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                      You do not have any appointments scheduled currently. Use the button below to reserve a consultation with your doctor.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsBookingOpen(true)}
                      className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold shadow-xs hover:shadow-teal-500/20 transition-all cursor-pointer"
                    >
                      Schedule Appointment Now
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dashboardData.upcomingAppointments.map((apt) => (
                      <div
                        key={apt.appointment_id}
                        className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all space-y-3.5 shadow-xs"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center font-bold shrink-0">
                              <Stethoscope size={18} />
                            </div>
                            <div>
                              <h3 className="font-bold text-sm text-white">{apt.doctor_name}</h3>
                              <span className="text-xs text-slate-400">{apt.specialty || apt.specialization || apt.department_name}</span>
                            </div>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-teal-500/15 text-teal-300 border border-teal-500/30">
                            {apt.status}
                          </span>
                        </div>

                        <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 grid grid-cols-2 gap-2 text-xs text-slate-300 font-mono">
                          <div className="flex items-center gap-2">
                            <Calendar size={13} className="text-teal-400 shrink-0" />
                            <span>{apt.appointment_date}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock size={13} className="text-teal-400 shrink-0" />
                            <span>{apt.appointment_time}</span>
                          </div>
                          <div className="col-span-2 flex items-center gap-2 text-slate-400 pt-1.5 border-t border-slate-800 font-sans">
                            <Building2 size={13} className="text-slate-500 shrink-0" />
                            <span className="truncate">{apt.branch_name || apt.department_name || 'Hospital Medical Pavilion'}</span>
                          </div>
                        </div>

                        {apt.reason && (
                          <p className="text-xs text-slate-300 leading-relaxed italic bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                            "{apt.reason}"
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                          <span className="font-mono text-[11px] text-slate-500">ID: {apt.appointment_id}</span>
                          <button
                            type="button"
                            onClick={() => handleCancelAppointment(apt.appointment_id)}
                            className="text-rose-400 hover:text-rose-300 font-medium hover:underline cursor-pointer transition-colors"
                          >
                            Cancel Appointment
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Overview Care Team Snapshot */}
                {activeTab === 'overview' && dashboardData.assignedStaff && dashboardData.assignedStaff.length > 0 && (
                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                          <Users size={15} className="text-teal-400" />
                          <span>Assigned Hospital Care Team & Clinical Staff</span>
                        </h3>
                        <p className="text-xs text-slate-400">
                          Assigned by your attending physician for personalized care and monitoring.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('care-team')}
                        className="text-xs font-semibold text-teal-400 hover:text-teal-300 hover:underline cursor-pointer"
                      >
                        View Details ({dashboardData.assignedStaff.length})
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {dashboardData.assignedStaff.slice(0, 3).map((stf) => (
                        <div
                          key={stf.assignment_id}
                          className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 hover:border-slate-700 transition-colors shadow-xs"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-white">{stf.staff_name}</h4>
                              <span className="text-[11px] text-teal-400 font-medium block">{stf.staff_role}</span>
                              <span className="text-[10px] text-slate-400">{stf.department}</span>
                            </div>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${
                                stf.assignment_status === 'Completed'
                                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                  : stf.assignment_status === 'In Progress'
                                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                  : 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                              }`}
                            >
                              {stf.assignment_status}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 border-t border-slate-800 pt-1.5 font-medium">
                            {stf.assignment_type}
                            {stf.notes && <span className="text-slate-400 block font-normal text-[10px] mt-0.5">{stf.notes}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: ASSIGNED CARE TEAM & STAFF */}
            {activeTab === 'care-team' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <Users size={18} className="text-teal-400" />
                      <span>My Assigned Care Team & Hospital Staff</span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Clinical nurses, ward coordinators, and healthcare specialists assigned by your physician in <code className="text-teal-400 font-mono">silver_staff_assignment</code>.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-semibold text-teal-300 bg-teal-500/10 px-2.5 py-1 rounded-lg border border-teal-500/20">
                    {dashboardData.assignedStaff?.length || 0} Assigned Staff
                  </span>
                </div>

                {!dashboardData.assignedStaff || dashboardData.assignedStaff.length === 0 ? (
                  <div className="p-8 sm:p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2">
                    <Users size={28} className="mx-auto text-slate-600" />
                    <h3 className="text-sm font-bold text-white">No Clinical Staff Assigned Yet</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      No specific hospital staff members have been delegated to your chart at this time. Dedicated care specialists are assigned during hospital consultations and inpatient admissions.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dashboardData.assignedStaff.map((asn) => {
                      const isUrgent = asn.priority === 'Urgent' || asn.priority === 'Critical';
                      return (
                        <div
                          key={asn.assignment_id}
                          className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all space-y-3 shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                            <div>
                              <h4 className="text-sm font-bold text-white">{asn.staff_name}</h4>
                              <span className="text-xs text-teal-400 font-semibold block">{asn.staff_role}</span>
                              <span className="text-[11px] text-slate-400">{asn.department}</span>
                            </div>
                            <div className="text-right shrink-0 space-y-1">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-md font-mono border block ${
                                  isUrgent
                                    ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                                }`}
                              >
                                {asn.priority || 'Normal'}
                              </span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-md font-mono border block ${
                                  asn.assignment_status === 'Completed'
                                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                    : asn.assignment_status === 'In Progress'
                                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                    : 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                                }`}
                              >
                                {asn.assignment_status}
                              </span>
                            </div>
                          </div>

                          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs text-slate-300">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 text-[11px]">Assigned by:</span>
                              <span className="text-white font-semibold">{asn.doctor_name || 'Attending Physician'}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Service:</span>
                              <span className="text-teal-400 font-semibold">{asn.assignment_type}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Date & Time:</span>
                              <span className="text-slate-300 font-mono">{asn.assignment_date} {asn.start_time ? `at ${asn.start_time.slice(0, 5)}` : ''}</span>
                            </div>
                          </div>

                          {asn.notes && (
                            <div className="p-2.5 rounded-lg bg-teal-950/40 border border-teal-500/30 text-xs text-teal-200 leading-relaxed font-sans">
                              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block mb-0.5">Care Instructions:</span>
                              {asn.notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB: RECENT ENCOUNTERS / VISITS */}
            {activeTab === 'encounters' && (
              <div className="space-y-4">
                <div className="space-y-0.5">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Past Clinical Encounters & Visits
                  </h2>
                  <p className="text-xs text-slate-400">
                    Authoritative clinical records retrieved from hospital encounters.
                  </p>
                </div>

                {dashboardData.completedEncounters.length === 0 ? (
                  <div className="p-8 sm:p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-slate-500 text-xs">
                    No past clinical encounters registered in hospital records.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboardData.completedEncounters.map((enc) => (
                      <div
                        key={enc.encounter_id}
                        className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
                      >
                        <div className="space-y-1.5 max-w-2xl">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-teal-500/15 text-teal-300 border border-teal-500/30">
                              {enc.visit_type || enc.appointment_type || 'Outpatient Visit'}
                            </span>
                            <span className="text-xs font-mono text-slate-400">
                              {enc.encounter_date}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-white">
                            {enc.diagnosis || enc.primary_diagnosis || 'Clinical Follow-up'}
                          </h3>
                          <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                            {enc.clinical_notes}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                            <span>Physician: <strong className="text-white font-semibold">{enc.doctor_name}</strong></span>
                            <span>Specialty: <strong className="text-teal-400 font-semibold">{enc.specialty || enc.department_name}</strong></span>
                            {enc.treatment_type && (
                              <span>Treatment: <strong className="text-white font-semibold">{enc.treatment_type}</strong></span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-3 self-end md:self-center">
                          <button
                            type="button"
                            onClick={() => setSelectedEncounter(enc)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-500/15 text-teal-300 border border-teal-500/30 hover:bg-teal-500/25 text-xs font-semibold transition-all shadow-xs cursor-pointer"
                          >
                            <Eye size={13} className="text-teal-400" />
                            <span>View Clinical Notes</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: LAB RESULTS */}
            {activeTab === 'labs' && (
              <div className="space-y-4">
                <div className="space-y-0.5">
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    Laboratory & Diagnostic Results
                  </h2>
                  <p className="text-xs text-slate-400">
                    Synchronized laboratory records from clinical diagnostic systems.
                  </p>
                </div>

                {dashboardData.labReports.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
                    <div className="w-12 h-12 rounded-xl bg-slate-950/80 text-teal-400 mx-auto flex items-center justify-center border border-slate-800">
                      <FileText size={22} />
                    </div>
                    <h3 className="text-sm font-bold text-white">No lab reports available.</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Diagnostic pathology panels and laboratory reports ordered by your physician will appear here once processed.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dashboardData.labReports.map((lab) => (
                      <div
                        key={lab.lab_id}
                        className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 shadow-md transition-all flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {lab.category || lab.test_category || 'Clinical Test'}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                lab.status === 'Normal' || lab.status === 'Ready'
                                  ? 'bg-teal-950/40 text-teal-300 border-teal-500/30'
                                  : 'bg-amber-950/40 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {lab.status}
                            </span>
                          </div>

                          <h3 className="font-bold text-sm text-white leading-snug">
                            {lab.test_name}
                          </h3>

                          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Findings / Values</span>
                            <span className="font-mono text-sm text-teal-300 font-bold block truncate">
                              {lab.value || lab.result_value} {lab.unit || ''}
                            </span>
                          </div>

                          <div className="text-xs text-slate-400 flex items-center justify-between">
                            <span>Test Date:</span>
                            <strong className="text-slate-200 font-semibold">{lab.test_date || lab.result_date}</strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedLabReport(lab)}
                          className="w-full py-2.5 rounded-xl bg-teal-500/10 text-teal-300 border border-teal-500/30 hover:bg-teal-500/20 text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                        >
                          <Eye size={14} className="text-teal-400" />
                          <span>View Full Lab Summary</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: PRESCRIPTIONS */}
            {activeTab === 'prescriptions' && (
              <div className="space-y-4">
                <div className="space-y-0.5">
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    Active Medications & Prescriptions
                  </h2>
                  <p className="text-xs text-slate-400">
                    Pharmacy and medication ledger from clinical pharmacy records.
                  </p>
                </div>

                {dashboardData.prescriptions.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
                    <div className="w-12 h-12 rounded-xl bg-slate-950/80 text-teal-400 mx-auto flex items-center justify-center border border-slate-800">
                      <Pill size={22} />
                    </div>
                    <h3 className="text-sm font-bold text-white">No prescriptions available.</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Active medications and outpatient prescription regimens prescribed by hospital staff will be listed here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dashboardData.prescriptions.map((rx) => (
                      <div
                        key={rx.prescription_id}
                        className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 shadow-md transition-all space-y-3.5"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-teal-950/50 text-teal-300 border border-teal-500/30 flex items-center justify-center font-bold">
                              <Pill size={20} />
                            </div>
                            <div>
                              <h3 className="font-bold text-sm text-white">{rx.medication_name || rx.medicine_name}</h3>
                              <span className="text-xs text-teal-400 font-bold">{rx.dosage}</span>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-teal-950/40 text-teal-300 border border-teal-500/30">
                            {rx.status || rx.prescription_status}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-slate-400">Frequency:</span>
                            <span className="font-semibold text-slate-200 text-right">{rx.frequency}</span>
                          </div>
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-slate-400">Duration:</span>
                            <span className="font-semibold text-slate-200 text-right">{rx.duration || `${rx.duration_days} Days`}</span>
                          </div>
                          {rx.instructions && (
                            <div className="pt-2 border-t border-slate-800 text-slate-300 leading-relaxed">
                              <span className="text-slate-400 font-bold block mb-0.5">Instructions:</span>
                              <p className="font-normal text-slate-300">{rx.instructions}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                          <span>Refills Remaining: <strong className="text-teal-400 font-bold">{rx.refills_left ?? rx.refill_allowed ?? 1}</strong></span>
                          <span>Prescribed: <strong className="text-slate-200 font-semibold">{rx.prescribed_date || rx.prescription_date}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: CARE FEEDBACK & REVIEWS */}
            {activeTab === 'feedback' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h2 className="text-base sm:text-lg font-bold text-white">
                      Patient Care Experience & Hospital Reviews
                    </h2>
                    <p className="text-xs text-slate-400">
                      Authoritative feedback ledger synchronized with hospital quality registry.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFeedbackModalOpen(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold shadow-lg shadow-teal-500/20 transition-all cursor-pointer"
                  >
                    <Plus size={16} />
                    <span>Submit New Care Review</span>
                  </button>
                </div>

                {/* Rating Overview Summary Box */}
                {(() => {
                  const feedbackItems = dashboardData.feedbackList || [];
                  const validOverall = feedbackItems.filter((f) => typeof f.rating === 'number' && f.rating > 0);
                  const avgOverall = validOverall.length > 0
                    ? (validOverall.reduce((sum, f) => sum + f.rating, 0) / validOverall.length).toFixed(1)
                    : null;

                  const validDoctor = feedbackItems.filter((f) => typeof f.doctor_rating === 'number' && f.doctor_rating > 0);
                  const avgDoctor = validDoctor.length > 0
                    ? (validDoctor.reduce((sum, f) => sum + f.doctor_rating!, 0) / validDoctor.length).toFixed(1)
                    : null;

                  const validStaff = feedbackItems.filter((f) => {
                    const r = f.staff_rating ?? f.staff_behavior_rating;
                    return typeof r === 'number' && r > 0;
                  });
                  const avgStaff = validStaff.length > 0
                    ? (validStaff.reduce((sum, f) => sum + (f.staff_rating ?? f.staff_behavior_rating)!, 0) / validStaff.length).toFixed(1)
                    : null;

                  const validClean = feedbackItems.filter((f) => typeof f.cleanliness_rating === 'number' && f.cleanliness_rating > 0);
                  const avgClean = validClean.length > 0
                    ? (validClean.reduce((sum, f) => sum + f.cleanliness_rating!, 0) / validClean.length).toFixed(1)
                    : null;

                  return (
                    <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                        Clinical Performance Feedback Dimensions
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                          <span className="text-[11px] font-bold text-slate-400 block">Overall Care Rating</span>
                          <div className="flex items-center gap-1.5 text-white font-extrabold text-xl">
                            <Star size={18} className="fill-amber-400 text-amber-500" />
                            <span>{avgOverall ? `${avgOverall} / 5.0` : '—'}</span>
                          </div>
                          <span className="text-[10px] text-teal-400 font-bold block">
                            {avgOverall ? `${validOverall.length} review${validOverall.length === 1 ? '' : 's'}` : 'No reviews logged'}
                          </span>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                          <span className="text-[11px] font-bold text-slate-400 block">Doctor Attentiveness</span>
                          <div className="flex items-center gap-1.5 text-white font-extrabold text-xl">
                            <Star size={18} className="fill-teal-400 text-teal-400" />
                            <span>{avgDoctor ? `${avgDoctor} / 5.0` : '—'}</span>
                          </div>
                          <span className="text-[10px] text-teal-400 font-bold block">
                            {avgDoctor ? `${validDoctor.length} rated` : 'No reviews logged'}
                          </span>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                          <span className="text-[11px] font-bold text-slate-400 block">Staff Courtesy</span>
                          <div className="flex items-center gap-1.5 text-white font-extrabold text-xl">
                            <Star size={18} className="fill-cyan-400 text-cyan-400" />
                            <span>{avgStaff ? `${avgStaff} / 5.0` : '—'}</span>
                          </div>
                          <span className="text-[10px] text-cyan-400 font-bold block">
                            {avgStaff ? `${validStaff.length} rated` : 'No reviews logged'}
                          </span>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                          <span className="text-[11px] font-bold text-slate-400 block">Cleanliness & Hygiene</span>
                          <div className="flex items-center gap-1.5 text-white font-extrabold text-xl">
                            <Star size={18} className="fill-purple-400 text-purple-400" />
                            <span>{avgClean ? `${avgClean} / 5.0` : '—'}</span>
                          </div>
                          <span className="text-[10px] text-purple-400 font-bold block">
                            {avgClean ? `${validClean.length} rated` : 'No reviews logged'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Feedback List */}
                {(!dashboardData.feedbackList || dashboardData.feedbackList.length === 0) ? (
                  <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-950/80 text-teal-400 mx-auto flex items-center justify-center border border-slate-800">
                      <MessageSquare size={24} />
                    </div>
                    <h3 className="text-sm font-bold text-white">No Care Reviews Submitted Yet</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                      Share your experience regarding consultations, clinical staff, wait time, or facility cleanliness.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsFeedbackModalOpen(true)}
                      className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold shadow-md cursor-pointer"
                    >
                      Write First Review
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dashboardData.feedbackList.map((fb) => (
                      <div
                        key={fb.feedback_id}
                        className="p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 shadow-md transition-all space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-950/40 text-amber-300 border border-amber-500/30 flex items-center justify-center">
                              <Star size={20} className="fill-amber-400 text-amber-500" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-white">
                                {fb.doctor_name || 'Hospital Clinical Team'}
                              </h4>
                              <span className="text-xs text-slate-400">
                                Visit Review Date: <strong className="text-slate-200">{fb.feedback_date}</strong>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-amber-500">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  size={16}
                                  className={i < fb.rating ? 'fill-amber-400 text-amber-500' : 'text-slate-700'}
                                />
                              ))}
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-950/40 text-teal-300 border border-teal-500/30">
                              {fb.sentiment || 'Positive'}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80">
                          "{fb.comments}"
                        </p>

                        {/* Breakdown pills */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-400">
                          {fb.doctor_rating && (
                            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                              <span>Doctor: <strong className="text-teal-300">{fb.doctor_rating}/5</strong></span>
                            </div>
                          )}
                          {fb.staff_rating && (
                            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                              <span>Staff: <strong className="text-teal-300">{fb.staff_rating}/5</strong></span>
                            </div>
                          )}
                          {fb.waiting_time_rating && (
                            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                              <span>Wait Time: <strong className="text-teal-300">{fb.waiting_time_rating}/5</strong></span>
                            </div>
                          )}
                          {fb.facility_rating && (
                            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                              <span>Facility: <strong className="text-teal-300">{fb.facility_rating}/5</strong></span>
                            </div>
                          )}
                        </div>

                        {fb.resolution_notes && (
                          <div className="p-3 rounded-xl bg-teal-950/30 border border-teal-500/30 text-teal-300 text-xs space-y-0.5">
                            <span className="font-bold block text-[10px] uppercase tracking-wider text-teal-400">Hospital Care Operations Note:</span>
                            <p className="text-slate-300 font-normal">{fb.resolution_notes}</p>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800">
                          <span>Feedback ID: <code className="font-mono text-teal-400">{fb.feedback_id}</code></span>
                          <span>Channel: {fb.feedback_channel || 'Patient Portal'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: AI HOSPITAL ASSISTANT (Dedicated Full-Page View) */}
            {activeTab === 'ai-assistant' && chatbotEnabled && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <span>AI Hospital Assistant Workspace</span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-950/50 text-teal-300 border border-teal-500/30">
                        Dedicated View
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Your 24/7 intelligent healthcare companion for clinic operations, scheduling, and verified hospital directories.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('overview')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 text-slate-300 hover:text-white border border-slate-800 hover:bg-slate-800 text-xs font-semibold self-start sm:self-auto cursor-pointer"
                  >
                    <span>Back to Overview</span>
                  </button>
                </div>

                <AiHospitalAssistant
                  user={user}
                  mode="fullpage"
                  onOpenBookingWizard={() => setIsBookingOpen(true)}
                  onNavigateTab={(tab) => setActiveTab(tab as any)}
                  onRemoveChatbot={handleRemoveChatbot}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Interactive Booking Wizard Modal */}
      {isBookingOpen && (
        <AppointmentBookingWizard
          isOpen={isBookingOpen}
          onClose={() => setIsBookingOpen(false)}
          onSuccess={handleBookingSuccess}
        />
      )}

      {/* Submit Care Experience / Feedback Modal */}
      {isFeedbackModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 p-6 sm:p-7 shadow-2xl space-y-5 border border-slate-800 max-h-[90vh] overflow-y-auto text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-950/60 text-teal-300 border border-teal-500/30 flex items-center justify-center">
                  <Star size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Submit Care Experience Review</h3>
                  <p className="text-[11px] text-slate-400">Stored directly into hospital quality registry</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFeedbackModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitFeedback} className="space-y-4 text-xs">
              {/* Doctor Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Select Physician or Department
                </label>
                <select
                  value={feedbackDoctorId}
                  onChange={(e) => setFeedbackDoctorId(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  required
                >
                  <option value="" className="bg-slate-950 text-slate-400">Select an Attending Physician...</option>
                  {availableDoctors.map((doc) => (
                    <option key={doc.doctor_id} value={doc.doctor_id} className="bg-slate-900 text-white">
                      {doc.doctor_name || doc.name} — {doc.specialty || doc.specialization || 'Clinical Specialist'}
                    </option>
                  ))}
                  {availableDoctors.length === 0 && (dashboardData?.completedEncounters || []).map((enc) => (
                    <option key={enc.doctor_id} value={enc.doctor_id} className="bg-slate-900 text-white">
                      {enc.doctor_name} — {enc.specialty || 'Attending Physician'}
                    </option>
                  ))}
                  {availableDoctors.length === 0 && (dashboardData?.completedEncounters || []).length === 0 && (
                    <option value="" disabled className="bg-slate-950 text-slate-500">No hospital physicians found in directory</option>
                  )}
                </select>
              </div>

              {/* Star Rating */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Overall Care Rating: <strong className="text-teal-400">{feedbackRating} / 5 Stars</strong>
                </label>
                <div className="flex items-center gap-2 py-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackRating(star)}
                      className="p-1 cursor-pointer transition-transform hover:scale-110 focus:outline-none"
                    >
                      <Star
                        size={28}
                        className={star <= feedbackRating ? 'fill-amber-400 text-amber-500' : 'text-slate-700'}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-ratings sliders */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80">
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1">
                    <span>Doctor Rating</span>
                    <span className="font-bold text-teal-400">{feedbackDoctorRating}/5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={feedbackDoctorRating}
                    onChange={(e) => setFeedbackDoctorRating(Number(e.target.value))}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1">
                    <span>Nursing & Staff</span>
                    <span className="font-bold text-teal-400">{feedbackStaffRating}/5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={feedbackStaffRating}
                    onChange={(e) => setFeedbackStaffRating(Number(e.target.value))}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1">
                    <span>Wait Time</span>
                    <span className="font-bold text-teal-400">{feedbackWaitRating}/5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={feedbackWaitRating}
                    onChange={(e) => setFeedbackWaitRating(Number(e.target.value))}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1">
                    <span>Cleanliness</span>
                    <span className="font-bold text-teal-400">{feedbackCleanlinessRating}/5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={feedbackCleanlinessRating}
                    onChange={(e) => setFeedbackCleanlinessRating(Number(e.target.value))}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* Comments Textarea */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Detailed Experience & Recommendations
                </label>
                <textarea
                  rows={4}
                  required
                  value={feedbackComments}
                  onChange={(e) => setFeedbackComments(e.target.value)}
                  placeholder="Describe your consultation, clinical communication, and facility impression..."
                  className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 resize-none leading-relaxed font-normal"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFeedbackModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-bold hover:bg-slate-750 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFeedback}
                  className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-lg shadow-teal-500/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send size={14} />
                  <span>{isSubmittingFeedback ? 'Logging Review...' : 'Submit Feedback'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lab Report Detail Modal */}
      {selectedLabReport && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 p-6 sm:p-7 shadow-2xl space-y-4 border border-slate-800 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[11px] uppercase font-bold text-teal-400 tracking-wider">
                  {selectedLabReport.category || selectedLabReport.test_category}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {selectedLabReport.test_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLabReport(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] font-bold block">Test Results / Values</span>
                <span className="font-mono text-base text-teal-300 font-extrabold block">
                  {selectedLabReport.value || selectedLabReport.result_value} {selectedLabReport.unit || ''}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] font-bold block">Standard Reference Range</span>
                <span className="text-slate-200 font-medium">{selectedLabReport.reference_range}</span>
              </div>

              {selectedLabReport.summary && (
                <div className="p-3.5 rounded-xl bg-teal-950/30 border border-teal-500/30 text-slate-200 space-y-1">
                  <span className="text-teal-400 text-[11px] font-bold block uppercase tracking-wider">Pathologist Clinical Interpretation</span>
                  <p className="leading-relaxed font-normal text-slate-300">{selectedLabReport.summary}</p>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                <span>Collected: <strong className="text-slate-200 font-semibold">{selectedLabReport.collected_date || selectedLabReport.test_date}</strong></span>
                <span>Finalized: <strong className="text-slate-200 font-semibold">{selectedLabReport.result_date || selectedLabReport.test_date}</strong></span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedLabReport(null)}
              className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition-all cursor-pointer"
            >
              Close Lab Summary
            </button>
          </div>
        </div>
      )}

      {/* Encounter Detail Modal */}
      {selectedEncounter && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 p-6 sm:p-7 shadow-2xl space-y-4 border border-slate-800 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[11px] uppercase font-bold text-teal-400 tracking-wider">
                  {selectedEncounter.visit_type || selectedEncounter.appointment_type}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {selectedEncounter.doctor_name} ({selectedEncounter.specialty || selectedEncounter.department_name})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEncounter(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] font-bold block uppercase tracking-wider">Primary Clinical Diagnosis</span>
                <span className="font-bold text-sm text-teal-300 block">{selectedEncounter.diagnosis || selectedEncounter.primary_diagnosis}</span>
              </div>

              {selectedEncounter.symptoms && (
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300">
                  <span className="text-slate-400 font-bold block text-[11px] uppercase">Presented Symptoms:</span>
                  <p className="mt-0.5 text-slate-200">{selectedEncounter.symptoms}</p>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-teal-950/30 border border-teal-500/30 text-slate-200 space-y-1">
                <span className="text-teal-400 text-[11px] font-bold block uppercase tracking-wider">Physician Clinical Notes</span>
                <p className="leading-relaxed text-xs font-normal text-slate-300">{selectedEncounter.clinical_notes}</p>
              </div>

              {selectedEncounter.treatment_type && (
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Treatment Regimen:</span>
                  <strong className="text-slate-200 font-bold">{selectedEncounter.treatment_type}</strong>
                </div>
              )}

              {selectedEncounter.follow_up_date && (
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-400">Recommended Follow-up Visit:</span>
                  <strong className="text-teal-400 font-bold">{selectedEncounter.follow_up_date}</strong>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedEncounter(null)}
              className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition-all cursor-pointer"
            >
              Close Encounter Details
            </button>
          </div>
        </div>
      )}

      {/* Floating AI Hospital Assistant Launcher */}
      {chatbotEnabled && (
        <AiHospitalAssistantLauncher
          user={user}
          onOpenBookingWizard={() => setIsBookingOpen(true)}
          onNavigateTab={(tab) => setActiveTab(tab as any)}
          onDisabledStateChange={(enabled) => setChatbotEnabled(enabled)}
        />
      )}
    </div>
  );
};
