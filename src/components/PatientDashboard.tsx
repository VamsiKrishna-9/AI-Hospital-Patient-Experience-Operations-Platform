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
  ChevronRight,
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
} from 'lucide-react';
import {
  PatientDashboardData,
  AppointmentRecord,
  EncounterRecord,
  LabResultRecord,
  PrescriptionRecord,
  FeedbackRecord,
  NotificationItem,
} from '../types/patient';
import { patientService } from '../services/patientService';
import { authService } from '../services/authService';
import { HospitalRole, AuthUser } from '../types/auth';
import { AppointmentBookingWizard } from './AppointmentBookingWizard';

interface PatientDashboardProps {
  user?: AuthUser | null;
  onLogout: () => void;
  onRoleSwitch?: (role: HospitalRole) => void;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({ user, onLogout, onRoleSwitch }) => {
  const [dashboardData, setDashboardData] = useState<PatientDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'encounters' | 'labs' | 'prescriptions' | 'feedback'>('overview');

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
    const res = await patientService.getDashboardData();
    if (res.success && res.data) {
      setDashboardData(res.data);
      setNotifications(res.data.notifications || []);
      if (res.data.completedEncounters.length > 0 && !feedbackDoctorId) {
        setFeedbackDoctorId(res.data.completedEncounters[0].doctor_id);
      }
    } else {
      setError(res.message || 'Failed to load patient records.');
    }
    setIsLoading(false);
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
      setSuccessToast('Thank you! Your feedback has been recorded in silver_feedback.');
      fetchDashboard();
      setTimeout(() => setSuccessToast(null), 5000);
    } else {
      alert(res.message || 'Failed to submit feedback.');
    }
  };

  const handleLogout = async () => {
    await patientService.logout();
    onLogout();
  };

  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

  const markAllNotifsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="min-h-screen bg-[#F5F8FA] text-[#172B4D] font-sans selection:bg-[#059669]/20 selection:text-[#047857]">
      {/* Top Patient Portal Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#DCE5EC] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand mark */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#059669] to-[#0D9488] flex items-center justify-center text-white shadow-md shadow-[#059669]/20">
              <HeartPulse size={22} className="animate-pulse text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-[#172B4D] tracking-tight">
                Medi<span className="text-[#059669]">AI</span>
              </span>
              <span className="ml-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#ECFDF5] text-[#047857] border border-emerald-200/60">
                Patient Portal
              </span>
            </div>
          </div>

          {/* Right actions: Backend status, Notifications, Profile & Logout */}
          <div className="flex items-center gap-3">
            {/* Database Engine Status Pill */}
            {dashboardData?.backendStatus && (
              <div
                className={`hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border shadow-xs ${
                  dashboardData.backendStatus.connected || dashboardData.backendStatus.isLiveMySQL
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
                title={dashboardData.backendStatus.schema}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    dashboardData.backendStatus.connected || dashboardData.backendStatus.isLiveMySQL ? 'bg-[#059669]' : 'bg-slate-400'
                  }`}
                />
                <span className="font-bold text-[11px]">
                  {dashboardData.backendStatus.connected || dashboardData.backendStatus.isLiveMySQL
                    ? dashboardData.backendStatus.engine || 'Database: Connected'
                    : 'Database: Pending Configuration'}
                </span>
              </div>
            )}

            {/* Notifications Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                aria-label="Patient notifications"
                className="relative p-2 rounded-xl text-[#526581] hover:text-[#172B4D] bg-white hover:bg-[#ECFDF5] border border-[#DCE5EC] hover:border-emerald-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]"
              >
                <Bell size={19} />
                {unreadNotifsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                    {unreadNotifsCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-[#DCE5EC] shadow-2xl p-4 text-xs z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-3 border-b border-[#DCE5EC] mb-3">
                    <span className="font-bold text-sm text-[#172B4D]">Clinical Notifications</span>
                    <button
                      type="button"
                      onClick={markAllNotifsRead}
                      className="text-[#047857] hover:text-[#059669] text-xs font-bold cursor-pointer transition-colors"
                    >
                      Mark all as read
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {notifications.length === 0 ? (
                      <p className="text-center py-6 text-[#526581]">No notifications at this time.</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3 rounded-xl border transition-all ${
                            n.read
                              ? 'bg-white border-[#DCE5EC] text-[#526581]'
                              : 'bg-[#ECFDF5] border-emerald-200 text-[#172B4D]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs text-[#172B4D]">{n.title}</span>
                            <span className="text-[10px] text-[#64748B]">{n.timestamp}</span>
                          </div>
                          <p className="text-xs text-[#334155] leading-relaxed font-normal">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Patient Profile Pill */}
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-[#DCE5EC]">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#047857] border border-emerald-200 flex items-center justify-center font-bold text-xs">
                {user?.name?.charAt(0) || dashboardData?.patient?.first_name?.charAt(0) || dashboardData?.patient?.name?.charAt(0) || 'P'}
              </div>
              <div className="text-left text-xs">
                <span className="font-bold text-[#172B4D] block truncate max-w-[120px]">
                  {user?.name || dashboardData?.patient?.name || `${dashboardData?.patient?.first_name || ''} ${dashboardData?.patient?.last_name || ''}`.trim() || 'Patient'}
                </span>
                <span className="text-[#526581] font-mono text-[10px] block">
                  {user?.patient_id || dashboardData?.patient?.patient_id || user?.email}
                </span>
              </div>
            </div>

            {/* Institutional Patient Role Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
              <span>Role: Patient</span>
            </div>

            {/* Logout button */}
            <button
              type="button"
              onClick={handleLogout}
              title="Sign Out of Patient Portal"
              className="p-2 rounded-xl text-[#526581] hover:text-rose-600 bg-white hover:bg-rose-50 border border-[#DCE5EC] hover:border-rose-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <LogOut size={19} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Success Feedback Alert Toast */}
        {successToast && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between text-xs sm:text-sm shadow-md animate-in slide-in-from-top duration-200">
            <div className="flex items-center gap-2.5 font-bold">
              <CheckCircle2 size={18} className="text-[#059669] shrink-0" />
              <span>{successToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessToast(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Global Error Notice */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center justify-between text-xs sm:text-sm shadow-sm">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={fetchDashboard}
              className="px-3.5 py-1.5 rounded-xl bg-white border border-rose-300 font-bold text-rose-700 hover:bg-rose-100 transition-colors shadow-xs"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && !dashboardData && (
          <div className="space-y-6 animate-pulse">
            <div className="h-36 rounded-3xl bg-emerald-100/50" />
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              <div className="h-24 rounded-2xl bg-slate-200/70" />
              <div className="h-24 rounded-2xl bg-slate-200/70" />
              <div className="h-24 rounded-2xl bg-slate-200/70" />
              <div className="h-24 rounded-2xl bg-slate-200/70" />
              <div className="h-24 rounded-2xl bg-slate-200/70" />
            </div>
            <div className="h-64 rounded-3xl bg-slate-200/50" />
          </div>
        )}

        {/* Loaded Dashboard Content */}
        {dashboardData && (
          <>
            {/* 1. Personalized Welcome Header Banner */}
            <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-[#059669] via-[#0D9488] to-[#047857] text-white shadow-xl shadow-emerald-950/10 border border-emerald-700/20 overflow-hidden">
              <div className="pointer-events-none absolute -right-20 -top-20 w-80 h-80 rounded-full bg-white/10 blur-2xl" />

              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2.5">
                  <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold text-white border border-white/25 shadow-xs">
                    <span>Patient MRN: {dashboardData.patient.patient_id}</span>
                    <span className="opacity-70">·</span>
                    <span>Blood Group: {dashboardData.patient.blood_group || 'O+'}</span>
                    {dashboardData.patient.age && (
                      <>
                        <span className="opacity-70">·</span>
                        <span>Age: {dashboardData.patient.age} yrs</span>
                      </>
                    )}
                    {dashboardData.patient.gender && (
                      <>
                        <span className="opacity-70">·</span>
                        <span>{dashboardData.patient.gender}</span>
                      </>
                    )}
                    {dashboardData.patient.city && (
                      <>
                        <span className="opacity-70">·</span>
                        <span className="flex items-center gap-1">
                          <MapPin size={11} /> {dashboardData.patient.city}
                        </span>
                      </>
                    )}
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                    Good day, {dashboardData.patient.name || `${dashboardData.patient.first_name} ${dashboardData.patient.last_name}`}
                  </h1>

                  <p className="text-xs sm:text-sm text-emerald-50 max-w-xl leading-relaxed font-normal">
                    Primary Physician:{' '}
                    <strong className="text-white font-bold">
                      {dashboardData.patient.primary_doctor_name || 'Dr. Marcus Chen, MD'}
                    </strong>
                    . Your care timeline, hospital encounters, diagnostics, and patient experience reviews are synchronized with the hospital database.
                  </p>
                </div>

                {/* CTAs */}
                <div className="shrink-0 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFeedbackModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/30 backdrop-blur-md transition-all cursor-pointer"
                  >
                    <MessageSquare size={16} />
                    <span>Share Experience</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsBookingOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-[#047857] hover:bg-[#ECFDF5] font-extrabold text-sm shadow-lg shadow-black/15 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <Plus size={18} className="text-[#059669]" />
                    <span>Book New Appointment</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Key Metrics Snapshot Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
              <div
                onClick={() => setActiveTab('appointments')}
                className="p-4 sm:p-5 rounded-2xl bg-white border border-[#DCE5EC] shadow-sm hover:shadow-md hover:border-[#059669]/60 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#526581] uppercase tracking-wider">Upcoming</span>
                  <div className="p-2 rounded-xl bg-[#ECFDF5] text-[#059669] group-hover:scale-110 transition-transform">
                    <Calendar size={17} />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-[#172B4D]">
                    {dashboardData.upcomingAppointments.length}
                  </span>
                  <span className="text-[10px] text-[#047857] font-bold bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-emerald-200">
                    Visits
                  </span>
                </div>
              </div>

              <div
                onClick={() => setActiveTab('encounters')}
                className="p-4 sm:p-5 rounded-2xl bg-white border border-[#DCE5EC] shadow-sm hover:shadow-md hover:border-cyan-400 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#526581] uppercase tracking-wider">Encounters</span>
                  <div className="p-2 rounded-xl bg-cyan-50 text-cyan-700 group-hover:scale-110 transition-transform">
                    <Stethoscope size={17} />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-[#172B4D]">
                    {dashboardData.completedEncounters.length}
                  </span>
                  <span className="text-[10px] text-cyan-800 font-bold bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200">
                    Past
                  </span>
                </div>
              </div>

              <div
                onClick={() => setActiveTab('labs')}
                className="p-4 sm:p-5 rounded-2xl bg-white border border-[#DCE5EC] shadow-sm hover:shadow-md hover:border-emerald-400 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#526581] uppercase tracking-wider">Lab Reports</span>
                  <div className="p-2 rounded-xl bg-[#ECFDF5] text-[#047857] group-hover:scale-110 transition-transform">
                    <FileText size={17} />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-[#172B4D]">
                    {dashboardData.labReports.length}
                  </span>
                  <span className="text-[10px] text-[#047857] font-bold bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-emerald-200">
                    Ready
                  </span>
                </div>
              </div>

              <div
                onClick={() => setActiveTab('prescriptions')}
                className="p-4 sm:p-5 rounded-2xl bg-white border border-[#DCE5EC] shadow-sm hover:shadow-md hover:border-purple-400 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#526581] uppercase tracking-wider">Prescriptions</span>
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-700 group-hover:scale-110 transition-transform">
                    <Pill size={17} />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-[#172B4D]">
                    {dashboardData.prescriptions.length}
                  </span>
                  <span className="text-[10px] text-purple-800 font-bold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    Active
                  </span>
                </div>
              </div>

              <div
                onClick={() => setActiveTab('feedback')}
                className="col-span-2 sm:col-span-1 p-4 sm:p-5 rounded-2xl bg-white border border-[#DCE5EC] shadow-sm hover:shadow-md hover:border-amber-400 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#526581] uppercase tracking-wider">Care Reviews</span>
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-700 group-hover:scale-110 transition-transform">
                    <Star size={17} />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-[#172B4D]">
                    {dashboardData.feedbackList?.length || 0}
                  </span>
                  <span className="text-[10px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Logged
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Navigation Tabs with High-Contrast Active & Inactive Styling */}
            <div className="flex items-center gap-2 overflow-x-auto border-b-2 border-[#DCE5EC] pb-2 pt-1" role="tablist">
              {[
                { id: 'overview', label: 'Overview & Next Visits' },
                { id: 'appointments', label: `Appointments (${dashboardData.upcomingAppointments.length})` },
                { id: 'encounters', label: `Recent Visits (${dashboardData.completedEncounters.length})` },
                { id: 'labs', label: `Lab Results (${dashboardData.labReports.length})` },
                { id: 'prescriptions', label: `Prescriptions (${dashboardData.prescriptions.length})` },
                { id: 'feedback', label: `Care Feedback (${dashboardData.feedbackList?.length || 0})` },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`relative px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2 ${
                      isActive
                        ? 'bg-[#059669] text-[#FFFFFF] shadow-md after:content-[""] after:absolute after:-bottom-[10px] after:left-3 after:right-3 after:h-[3px] after:bg-[#059669] after:rounded-full'
                        : 'bg-white text-[#526581] border border-[#DCE5EC] hover:text-[#047857] hover:bg-[#ECFDF5] hover:border-emerald-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* TAB: OVERVIEW & UPCOMING APPOINTMENTS */}
            {(activeTab === 'overview' || activeTab === 'appointments') && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h2 className="text-base sm:text-lg font-bold text-[#172B4D]">
                      Upcoming Scheduled Appointments
                    </h2>
                    <p className="text-xs text-[#526581]">
                      Authoritative schedule synchronized with <code className="text-[#047857] font-mono">silver_appointments</code>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBookingOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-[#047857] border border-[#DCE5EC] hover:bg-[#ECFDF5] hover:border-emerald-300 text-xs font-bold transition-all shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]"
                  >
                    <Plus size={14} className="text-[#059669]" />
                    <span>Book New Visit</span>
                  </button>
                </div>

                {dashboardData.upcomingAppointments.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-white border border-[#DCE5EC] shadow-sm text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-[#F5F8FA] text-[#526581] mx-auto flex items-center justify-center border border-[#DCE5EC]">
                      <Calendar size={24} />
                    </div>
                    <h3 className="text-sm font-bold text-[#172B4D]">No Upcoming Appointments</h3>
                    <p className="text-xs text-[#526581] max-w-sm mx-auto leading-relaxed">
                      You do not have any appointments scheduled currently. Use the button below to reserve a consultation with your doctor.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsBookingOpen(true)}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#059669] to-[#0D9488] hover:from-[#047857] hover:to-[#059669] text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
                    >
                      Schedule Appointment Now
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dashboardData.upcomingAppointments.map((apt) => (
                      <div
                        key={apt.appointment_id}
                        className="p-5 rounded-2xl bg-white border border-[#DCE5EC] shadow-sm hover:shadow-md transition-all space-y-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] text-[#059669] flex items-center justify-center font-bold">
                              <Stethoscope size={20} />
                            </div>
                            <div>
                              <h3 className="font-bold text-sm text-[#172B4D]">{apt.doctor_name}</h3>
                              <span className="text-xs text-[#526581]">{apt.specialty || apt.specialization || apt.department_name}</span>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#ECFDF5] text-[#047857] border border-emerald-200">
                            {apt.status}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-[#F5F8FA] border border-[#DCE5EC] grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-2 text-[#334155]">
                            <Calendar size={14} className="text-[#059669] shrink-0" />
                            <span className="font-semibold">{apt.appointment_date}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[#334155]">
                            <Clock size={14} className="text-[#0D9488] shrink-0" />
                            <span className="font-semibold">{apt.appointment_time}</span>
                          </div>
                          <div className="col-span-2 flex items-center gap-2 text-[#526581] pt-1 border-t border-[#DCE5EC]">
                            <Building2 size={14} className="text-[#526581] shrink-0" />
                            <span className="truncate">{apt.branch_name || apt.department_name || 'Hospital Medical Pavilion'}</span>
                          </div>
                        </div>

                        {apt.reason && (
                          <p className="text-xs text-[#334155] leading-relaxed italic bg-white p-2 rounded-lg border border-[#DCE5EC]/70">
                            "{apt.reason}"
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-[#DCE5EC] text-xs">
                          <span className="font-mono text-[11px] text-[#64748B]">ID: {apt.appointment_id}</span>
                          <button
                            type="button"
                            onClick={() => handleCancelAppointment(apt.appointment_id)}
                            className="text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer transition-colors"
                          >
                            Cancel Appointment
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: RECENT ENCOUNTERS / VISITS */}
            {activeTab === 'encounters' && (
              <div className="space-y-4">
                <div className="space-y-0.5">
                  <h2 className="text-base sm:text-lg font-bold text-[#172B4D]">
                    Past Clinical Encounters & Visits
                  </h2>
                  <p className="text-xs text-[#526581]">
                    Authoritative clinical records retrieved from <code className="text-[#047857] font-mono">silver_encounters</code>.
                  </p>
                </div>

                {dashboardData.completedEncounters.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-white border border-[#DCE5EC] shadow-sm text-center text-[#526581] text-xs">
                    No past clinical encounters registered in hospital records.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboardData.completedEncounters.map((enc) => (
                      <div
                        key={enc.encounter_id}
                        className="p-5 rounded-2xl bg-white border border-[#DCE5EC] shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 max-w-2xl">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                              {enc.visit_type || enc.appointment_type || 'Outpatient Visit'}
                            </span>
                            <span className="text-xs font-semibold text-[#526581]">
                              {enc.encounter_date}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-[#172B4D]">
                            {enc.diagnosis || enc.primary_diagnosis || 'Clinical Follow-up'}
                          </h3>
                          <p className="text-xs text-[#334155] leading-relaxed line-clamp-2">
                            {enc.clinical_notes}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-[#526581] pt-1">
                            <span>Physician: <strong className="text-[#172B4D] font-semibold">{enc.doctor_name}</strong></span>
                            <span>Specialty: <strong className="text-[#047857] font-semibold">{enc.specialty || enc.department_name}</strong></span>
                            {enc.treatment_type && (
                              <span>Treatment: <strong className="text-[#172B4D] font-semibold">{enc.treatment_type}</strong></span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-3 self-end md:self-center">
                          <button
                            type="button"
                            onClick={() => setSelectedEncounter(enc)}
                            className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-white text-[#047857] border border-[#DCE5EC] hover:bg-[#ECFDF5] hover:border-emerald-300 text-xs font-bold transition-all shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]"
                          >
                            <Eye size={14} className="text-[#059669]" />
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
                  <h2 className="text-base sm:text-lg font-bold text-[#172B4D]">
                    Laboratory & Diagnostic Results
                  </h2>
                  <p className="text-xs text-[#526581]">
                    Synchronized laboratory records from <code className="text-[#047857] font-mono">silver_lab_results</code>.
                  </p>
                </div>

                {dashboardData.labReports.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-white border border-[#DCE5EC] shadow-sm text-center text-[#526581] text-xs">
                    No diagnostic lab reports available for this patient ID.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dashboardData.labReports.map((lab) => (
                      <div
                        key={lab.lab_id}
                        className="p-5 rounded-2xl bg-white border border-[#DCE5EC] shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[10px] font-bold text-[#526581] uppercase tracking-wider">
                              {lab.category || lab.test_category || 'Clinical Test'}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                lab.status === 'Normal' || lab.status === 'Ready'
                                  ? 'bg-[#ECFDF5] text-[#047857] border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {lab.status}
                            </span>
                          </div>

                          <h3 className="font-bold text-sm text-[#172B4D] leading-snug">
                            {lab.test_name}
                          </h3>

                          <div className="p-3 rounded-xl bg-[#F5F8FA] border border-[#DCE5EC] space-y-1">
                            <span className="text-[10px] text-[#526581] font-bold block uppercase tracking-wider">Findings / Values</span>
                            <span className="font-mono text-xs text-[#172B4D] font-bold block truncate">
                              {lab.value || lab.result_value} {lab.unit || ''}
                            </span>
                          </div>

                          <div className="text-xs text-[#526581] flex items-center justify-between">
                            <span>Test Date:</span>
                            <strong className="text-[#172B4D] font-semibold">{lab.test_date || lab.result_date}</strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedLabReport(lab)}
                          className="w-full py-2.5 rounded-xl bg-white text-[#047857] border border-[#DCE5EC] hover:bg-[#ECFDF5] hover:border-emerald-300 text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]"
                        >
                          <Eye size={14} className="text-[#059669]" />
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
                  <h2 className="text-base sm:text-lg font-bold text-[#172B4D]">
                    Active Medications & Prescriptions
                  </h2>
                  <p className="text-xs text-[#526581]">
                    Pharmacy and medication ledger from <code className="text-[#047857] font-mono">silver_prescriptions</code>.
                  </p>
                </div>

                {dashboardData.prescriptions.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-white border border-[#DCE5EC] shadow-sm text-center text-[#526581] text-xs">
                    No active prescriptions recorded in patient chart.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dashboardData.prescriptions.map((rx) => (
                      <div
                        key={rx.prescription_id}
                        className="p-5 rounded-2xl bg-white border border-[#DCE5EC] shadow-sm hover:shadow-md transition-all space-y-3.5"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                              <Pill size={20} />
                            </div>
                            <div>
                              <h3 className="font-bold text-sm text-[#172B4D]">{rx.medication_name || rx.medicine_name}</h3>
                              <span className="text-xs text-[#059669] font-bold">{rx.dosage}</span>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
                            {rx.status || rx.prescription_status}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-[#F5F8FA] border border-[#DCE5EC] space-y-2 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[#526581]">Frequency:</span>
                            <span className="font-semibold text-[#172B4D] text-right">{rx.frequency}</span>
                          </div>
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[#526581]">Duration:</span>
                            <span className="font-semibold text-[#172B4D] text-right">{rx.duration || `${rx.duration_days} Days`}</span>
                          </div>
                          {rx.instructions && (
                            <div className="pt-2 border-t border-[#DCE5EC] text-[#334155] leading-relaxed">
                              <span className="text-[#526581] font-bold block mb-0.5">Instructions:</span>
                              <p className="font-normal">{rx.instructions}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-[#526581] pt-1">
                          <span>Refills Remaining: <strong className="text-[#059669] font-bold">{rx.refills_left ?? rx.refill_allowed ?? 1}</strong></span>
                          <span>Prescribed: <strong className="text-[#172B4D] font-semibold">{rx.prescribed_date || rx.prescription_date}</strong></span>
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
                    <h2 className="text-base sm:text-lg font-bold text-[#172B4D]">
                      Patient Care Experience & Hospital Reviews
                    </h2>
                    <p className="text-xs text-[#526581]">
                      Authoritative feedback ledger synchronized with <code className="text-[#047857] font-mono">silver_feedback</code>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFeedbackModalOpen(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#059669] to-[#0D9488] hover:from-[#047857] hover:to-[#059669] text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
                  >
                    <Plus size={16} />
                    <span>Submit New Care Review</span>
                  </button>
                </div>

                {/* Rating Overview Summary Box */}
                <div className="p-6 rounded-3xl bg-white border border-[#DCE5EC] shadow-sm">
                  <h3 className="text-xs font-bold text-[#526581] uppercase tracking-wider mb-4">
                    Clinical Performance Feedback Dimensions
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-[#F5F8FA] border border-[#DCE5EC] space-y-1">
                      <span className="text-[11px] font-bold text-[#526581] block">Overall Care Rating</span>
                      <div className="flex items-center gap-1.5 text-[#172B4D] font-extrabold text-xl">
                        <Star size={18} className="fill-amber-400 text-amber-500" />
                        <span>4.9 / 5.0</span>
                      </div>
                      <span className="text-[10px] text-[#047857] font-bold block">Patient Satisfaction</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#F5F8FA] border border-[#DCE5EC] space-y-1">
                      <span className="text-[11px] font-bold text-[#526581] block">Doctor Attentiveness</span>
                      <div className="flex items-center gap-1.5 text-[#172B4D] font-extrabold text-xl">
                        <Star size={18} className="fill-emerald-400 text-emerald-600" />
                        <span>5.0 / 5.0</span>
                      </div>
                      <span className="text-[10px] text-[#047857] font-bold block">Exemplary Care</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#F5F8FA] border border-[#DCE5EC] space-y-1">
                      <span className="text-[11px] font-bold text-[#526581] block">Staff Courtesy</span>
                      <div className="flex items-center gap-1.5 text-[#172B4D] font-extrabold text-xl">
                        <Star size={18} className="fill-cyan-400 text-cyan-600" />
                        <span>4.8 / 5.0</span>
                      </div>
                      <span className="text-[10px] text-cyan-800 font-bold block">Friendly Admissions</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#F5F8FA] border border-[#DCE5EC] space-y-1">
                      <span className="text-[11px] font-bold text-[#526581] block">Cleanliness & Hygiene</span>
                      <div className="flex items-center gap-1.5 text-[#172B4D] font-extrabold text-xl">
                        <Star size={18} className="fill-purple-400 text-purple-600" />
                        <span>5.0 / 5.0</span>
                      </div>
                      <span className="text-[10px] text-purple-800 font-bold block">Sanitized Facilities</span>
                    </div>
                  </div>
                </div>

                {/* Feedback List */}
                {(!dashboardData.feedbackList || dashboardData.feedbackList.length === 0) ? (
                  <div className="p-8 rounded-3xl bg-white border border-[#DCE5EC] shadow-sm text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-[#F5F8FA] text-[#526581] mx-auto flex items-center justify-center border border-[#DCE5EC]">
                      <MessageSquare size={24} />
                    </div>
                    <h3 className="text-sm font-bold text-[#172B4D]">No Care Reviews Submitted Yet</h3>
                    <p className="text-xs text-[#526581] max-w-sm mx-auto leading-relaxed">
                      Share your experience regarding consultations, clinical staff, wait time, or facility cleanliness.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsFeedbackModalOpen(true)}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#059669] to-[#0D9488] text-white text-xs font-bold shadow-md cursor-pointer"
                    >
                      Write First Review
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dashboardData.feedbackList.map((fb) => (
                      <div
                        key={fb.feedback_id}
                        className="p-5 sm:p-6 rounded-2xl bg-white border border-[#DCE5EC] shadow-sm hover:shadow-md transition-all space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DCE5EC]">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                              <Star size={20} className="fill-amber-400 text-amber-500" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-[#172B4D]">
                                {fb.doctor_name || 'Hospital Clinical Team'}
                              </h4>
                              <span className="text-xs text-[#526581]">
                                Visit Review Date: <strong className="text-[#172B4D]">{fb.feedback_date}</strong>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-amber-500">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  size={16}
                                  className={i < fb.rating ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}
                                />
                              ))}
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#047857] border border-emerald-200">
                              {fb.sentiment || 'Positive'}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs sm:text-sm text-[#334155] leading-relaxed font-normal bg-[#F5F8FA] p-3.5 rounded-xl border border-[#DCE5EC]">
                          "{fb.comments}"
                        </p>

                        {/* Breakdown pills */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-[#526581]">
                          {fb.doctor_rating && (
                            <div className="p-2 rounded-lg bg-white border border-[#DCE5EC]">
                              <span>Doctor: <strong className="text-[#172B4D]">{fb.doctor_rating}/5</strong></span>
                            </div>
                          )}
                          {fb.staff_rating && (
                            <div className="p-2 rounded-lg bg-white border border-[#DCE5EC]">
                              <span>Staff: <strong className="text-[#172B4D]">{fb.staff_rating}/5</strong></span>
                            </div>
                          )}
                          {fb.waiting_time_rating && (
                            <div className="p-2 rounded-lg bg-white border border-[#DCE5EC]">
                              <span>Wait Time: <strong className="text-[#172B4D]">{fb.waiting_time_rating}/5</strong></span>
                            </div>
                          )}
                          {fb.facility_rating && (
                            <div className="p-2 rounded-lg bg-white border border-[#DCE5EC]">
                              <span>Facility: <strong className="text-[#172B4D]">{fb.facility_rating}/5</strong></span>
                            </div>
                          )}
                        </div>

                        {fb.resolution_notes && (
                          <div className="p-3 rounded-xl bg-[#ECFDF5] border border-emerald-200 text-[#047857] text-xs space-y-0.5">
                            <span className="font-bold block text-[10px] uppercase tracking-wider">Hospital Care Operations Note:</span>
                            <p className="text-[#334155] font-normal">{fb.resolution_notes}</p>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-2 border-t border-[#DCE5EC]">
                          <span>Feedback ID: <code className="font-mono text-[#526581]">{fb.feedback_id}</code></span>
                          <span>Channel: {fb.feedback_channel || 'Patient Portal'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl space-y-5 border border-[#DCE5EC] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE5EC]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#059669] flex items-center justify-center">
                  <Star size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#172B4D]">Submit Care Experience Review</h3>
                  <p className="text-[11px] text-[#526581]">Stored directly into <code className="text-[#047857] font-mono">silver_feedback</code></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFeedbackModalOpen(false)}
                className="p-1.5 text-[#526581] hover:text-[#172B4D] hover:bg-[#F5F8FA] rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitFeedback} className="space-y-4 text-xs">
              {/* Doctor Selection */}
              <div>
                <label className="block text-[11px] font-bold text-[#172B4D] uppercase tracking-wider mb-1.5">
                  Select Physician or Department
                </label>
                <select
                  value={feedbackDoctorId}
                  onChange={(e) => setFeedbackDoctorId(e.target.value)}
                  className="w-full p-3 rounded-xl bg-white border border-[#DCE5EC] text-[#172B4D] font-medium focus:outline-none focus:ring-2 focus:ring-[#059669]"
                >
                  <option value="DOC-101">Dr. Marcus Chen, MD - Cardiology</option>
                  <option value="DOC-102">Dr. Sarah Al-Mansoor, MD - General Medicine</option>
                  <option value="DOC-103">Dr. James Thorne, MD - Orthopedics</option>
                  <option value="DOC-104">Dr. Emily Watson, MD - Pediatrics</option>
                  <option value="DOC-105">Dr. Robert Hayes, MD - Neurology</option>
                  <option value="DOC-106">Dr. Priya Sharma, MD - General Medicine</option>
                </select>
              </div>

              {/* Star Rating */}
              <div>
                <label className="block text-[11px] font-bold text-[#172B4D] uppercase tracking-wider mb-1.5">
                  Overall Care Rating: <strong className="text-[#059669]">{feedbackRating} / 5 Stars</strong>
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
                        className={star <= feedbackRating ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-ratings sliders */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#F5F8FA] border border-[#DCE5EC]">
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-[#334155] mb-1">
                    <span>Doctor Rating</span>
                    <span className="font-bold text-[#059669]">{feedbackDoctorRating}/5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={feedbackDoctorRating}
                    onChange={(e) => setFeedbackDoctorRating(Number(e.target.value))}
                    className="w-full accent-[#059669] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-[#334155] mb-1">
                    <span>Nursing & Staff</span>
                    <span className="font-bold text-[#059669]">{feedbackStaffRating}/5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={feedbackStaffRating}
                    onChange={(e) => setFeedbackStaffRating(Number(e.target.value))}
                    className="w-full accent-[#059669] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-[#334155] mb-1">
                    <span>Wait Time</span>
                    <span className="font-bold text-[#059669]">{feedbackWaitRating}/5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={feedbackWaitRating}
                    onChange={(e) => setFeedbackWaitRating(Number(e.target.value))}
                    className="w-full accent-[#059669] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-[#334155] mb-1">
                    <span>Cleanliness</span>
                    <span className="font-bold text-[#059669]">{feedbackCleanlinessRating}/5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={feedbackCleanlinessRating}
                    onChange={(e) => setFeedbackCleanlinessRating(Number(e.target.value))}
                    className="w-full accent-[#059669] cursor-pointer"
                  />
                </div>
              </div>

              {/* Comments Textarea */}
              <div>
                <label className="block text-[11px] font-bold text-[#172B4D] uppercase tracking-wider mb-1.5">
                  Detailed Experience & Recommendations
                </label>
                <textarea
                  rows={4}
                  required
                  value={feedbackComments}
                  onChange={(e) => setFeedbackComments(e.target.value)}
                  placeholder="Describe your consultation, clinical communication, and facility impression..."
                  className="w-full p-3.5 rounded-xl bg-white border border-[#DCE5EC] text-[#172B4D] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#059669] resize-none leading-relaxed font-normal"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFeedbackModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-[#DCE5EC] text-[#526581] font-bold hover:bg-[#F5F8FA] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFeedback}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#059669] to-[#0D9488] hover:from-[#047857] hover:to-[#059669] text-white font-bold shadow-md shadow-emerald-700/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl space-y-4 border border-[#DCE5EC]">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE5EC]">
              <div>
                <span className="text-[11px] uppercase font-bold text-[#047857] tracking-wider">
                  {selectedLabReport.category || selectedLabReport.test_category}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-[#172B4D]">
                  {selectedLabReport.test_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLabReport(null)}
                className="p-2 text-[#526581] hover:text-[#172B4D] hover:bg-[#F5F8FA] rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#F5F8FA] border border-[#DCE5EC] space-y-1">
                <span className="text-[#526581] text-[11px] font-bold block">Test Results / Values</span>
                <span className="font-mono text-base text-[#172B4D] font-extrabold block">
                  {selectedLabReport.value || selectedLabReport.result_value} {selectedLabReport.unit || ''}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F5F8FA] border border-[#DCE5EC] space-y-1">
                <span className="text-[#526581] text-[11px] font-bold block">Standard Reference Range</span>
                <span className="text-[#172B4D] font-medium">{selectedLabReport.reference_range}</span>
              </div>

              {selectedLabReport.summary && (
                <div className="p-3.5 rounded-xl bg-[#ECFDF5] border border-emerald-200 text-[#334155] space-y-1">
                  <span className="text-[#047857] text-[11px] font-bold block uppercase tracking-wider">Pathologist Clinical Interpretation</span>
                  <p className="leading-relaxed font-normal">{selectedLabReport.summary}</p>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-[#526581] pt-2 border-t border-[#DCE5EC]">
                <span>Collected: <strong className="text-[#172B4D] font-semibold">{selectedLabReport.collected_date || selectedLabReport.test_date}</strong></span>
                <span>Finalized: <strong className="text-[#172B4D] font-semibold">{selectedLabReport.result_date || selectedLabReport.test_date}</strong></span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedLabReport(null)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#059669] to-[#0D9488] hover:from-[#047857] hover:to-[#059669] text-white font-bold text-xs shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl space-y-4 border border-[#DCE5EC]">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE5EC]">
              <div>
                <span className="text-[11px] uppercase font-bold text-[#047857] tracking-wider">
                  {selectedEncounter.visit_type || selectedEncounter.appointment_type}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-[#172B4D]">
                  {selectedEncounter.doctor_name} ({selectedEncounter.specialty || selectedEncounter.department_name})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEncounter(null)}
                className="p-2 text-[#526581] hover:text-[#172B4D] hover:bg-[#F5F8FA] rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#F5F8FA] border border-[#DCE5EC] space-y-1">
                <span className="text-[#526581] text-[11px] font-bold block uppercase tracking-wider">Primary Clinical Diagnosis</span>
                <span className="font-bold text-sm text-[#172B4D] block">{selectedEncounter.diagnosis || selectedEncounter.primary_diagnosis}</span>
              </div>

              {selectedEncounter.symptoms && (
                <div className="p-3 rounded-xl bg-[#F5F8FA] border border-[#DCE5EC] text-[#334155]">
                  <span className="text-[#526581] font-bold block text-[11px] uppercase">Presented Symptoms:</span>
                  <p className="mt-0.5">{selectedEncounter.symptoms}</p>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-[#ECFDF5] border border-emerald-200 text-[#334155] space-y-1">
                <span className="text-[#047857] text-[11px] font-bold block uppercase tracking-wider">Physician Clinical Notes</span>
                <p className="leading-relaxed text-xs font-normal">{selectedEncounter.clinical_notes}</p>
              </div>

              {selectedEncounter.treatment_type && (
                <div className="p-3 rounded-xl bg-[#F5F8FA] border border-[#DCE5EC] flex items-center justify-between text-xs">
                  <span className="text-[#526581]">Treatment Regimen:</span>
                  <strong className="text-[#172B4D] font-bold">{selectedEncounter.treatment_type}</strong>
                </div>
              )}

              {selectedEncounter.follow_up_date && (
                <div className="p-3 rounded-xl bg-[#F5F8FA] border border-[#DCE5EC] text-[#172B4D] flex items-center justify-between text-xs font-medium">
                  <span className="text-[#526581]">Recommended Follow-up Visit:</span>
                  <strong className="text-[#047857] font-bold">{selectedEncounter.follow_up_date}</strong>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedEncounter(null)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#059669] to-[#0D9488] hover:from-[#047857] hover:to-[#059669] text-white font-bold text-xs shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
            >
              Close Encounter Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
