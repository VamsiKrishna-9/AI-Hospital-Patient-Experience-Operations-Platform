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
} from 'lucide-react';
import {
  PatientDashboardData,
  AppointmentRecord,
  EncounterRecord,
  LabResultRecord,
  PrescriptionRecord,
  NotificationItem,
} from '../types/patient';
import { patientService } from '../services/patientService';
import { AppointmentBookingWizard } from './AppointmentBookingWizard';

interface PatientDashboardProps {
  onLogout: () => void;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({ onLogout }) => {
  const [dashboardData, setDashboardData] = useState<PatientDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'encounters' | 'labs' | 'prescriptions'>('overview');

  // Booking Wizard modal
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  // Notifications dropdown
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Selected item modal for detailed view
  const [selectedLabReport, setSelectedLabReport] = useState<LabResultRecord | null>(null);
  const [selectedEncounter, setSelectedEncounter] = useState<EncounterRecord | null>(null);

  // Success toast for newly booked appointment
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setIsLoading(true);
    setError(null);
    const res = await patientService.getDashboardData();
    if (res.success && res.data) {
      setDashboardData(res.data);
      setNotifications(res.data.notifications || []);
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

  const handleLogout = async () => {
    await patientService.logout();
    onLogout();
  };

  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

  const markAllNotifsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/20 to-sky-50/30 text-slate-800 font-sans selection:bg-emerald-500/20">
      {/* Top Patient Portal Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-emerald-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand mark */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <HeartPulse size={22} className="animate-pulse" />
            </div>
            <div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">
                Medi<span className="text-emerald-600">AI</span>
              </span>
              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                Patient Portal
              </span>
            </div>
          </div>

          {/* Right actions: Backend status, Notifications, Profile & Logout */}
          <div className="flex items-center gap-3">
            {/* Live Database status pill */}
            {dashboardData?.backendStatus && (
              <div
                className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200"
                title={dashboardData.backendStatus.schema}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    dashboardData.backendStatus.isLiveMySQL ? 'bg-emerald-500' : 'bg-teal-500'
                  }`}
                />
                <span>{dashboardData.backendStatus.engine}</span>
              </div>
            )}

            {/* Notifications Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                aria-label="Patient notifications"
                className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Bell size={19} />
                {unreadNotifsCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {unreadNotifsCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-xl p-4 text-xs z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <span className="font-bold text-slate-900">Clinical Notifications</span>
                    <button
                      type="button"
                      onClick={markAllNotifsRead}
                      className="text-emerald-700 hover:text-emerald-800 text-[11px] font-medium cursor-pointer"
                    >
                      Mark all as read
                    </button>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-slate-400 py-4 text-center">No new notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-2.5 rounded-xl transition-colors ${
                            n.read ? 'bg-slate-50' : 'bg-emerald-50/70 border-l-2 border-emerald-500'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">{n.title}</span>
                            <span className="text-[10px] text-slate-400">{n.timestamp}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Logout CTA */}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Toast Alert */}
        {successToast && (
          <div className="p-4 rounded-2xl bg-emerald-600 text-white shadow-lg flex items-center justify-between animate-in slide-in-from-top-3 duration-200">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium">
              <CheckCircle2 size={18} />
              <span>{successToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessToast(null)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={fetchDashboard}
              className="px-3 py-1 rounded-lg bg-rose-100 font-semibold hover:bg-rose-200 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && !dashboardData && (
          <div className="space-y-6 animate-pulse">
            <div className="h-32 rounded-3xl bg-emerald-100/40" />
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="h-24 rounded-2xl bg-slate-200/60" />
              <div className="h-24 rounded-2xl bg-slate-200/60" />
              <div className="h-24 rounded-2xl bg-slate-200/60" />
              <div className="h-24 rounded-2xl bg-slate-200/60" />
            </div>
            <div className="h-64 rounded-3xl bg-slate-200/50" />
          </div>
        )}

        {/* Loaded Dashboard Content */}
        {dashboardData && (
          <>
            {/* 1. Personalized Welcome Header Banner */}
            <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white shadow-xl shadow-emerald-900/10 overflow-hidden">
              {/* Background ambient accents */}
              <div className="pointer-events-none absolute -right-20 -top-20 w-80 h-80 rounded-full bg-white/10 blur-2xl" />

              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-emerald-100 border border-white/20">
                    <span>Patient MRN: {dashboardData.patient.patient_id}</span>
                    <span className="opacity-60">·</span>
                    <span>Blood Group: {dashboardData.patient.blood_group || 'O+'}</span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    Good day, {dashboardData.patient.first_name} {dashboardData.patient.last_name}
                  </h1>

                  <p className="text-xs sm:text-sm text-emerald-50/90 max-w-xl leading-relaxed">
                    Primary Physician:{' '}
                    <strong className="text-white">
                      {dashboardData.patient.primary_doctor_name || 'Dr. Marcus Chen, MD'}
                    </strong>
                    . Your care timeline, scheduled appointments, and clinical diagnostics are synchronized in real time.
                  </p>
                </div>

                {/* Prominent Book Appointment CTA Button */}
                <div className="shrink-0 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => setIsBookingOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-sm shadow-lg shadow-black/10 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  >
                    <Plus size={18} className="text-emerald-600" />
                    <span>Book New Appointment</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Key Metrics Snapshot Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                onClick={() => setActiveTab('appointments')}
                className="p-4 rounded-2xl bg-white border border-emerald-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Upcoming Visits</span>
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
                    <Calendar size={18} />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-slate-900">
                    {dashboardData.upcomingAppointments.length}
                  </span>
                  <span className="text-xs text-emerald-600 font-medium">Scheduled</span>
                </div>
              </div>

              <div
                onClick={() => setActiveTab('encounters')}
                className="p-4 rounded-2xl bg-white border border-cyan-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Past Encounters</span>
                  <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600 group-hover:scale-110 transition-transform">
                    <Stethoscope size={18} />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-slate-900">
                    {dashboardData.completedEncounters.length}
                  </span>
                  <span className="text-xs text-cyan-600 font-medium">Completed</span>
                </div>
              </div>

              <div
                onClick={() => setActiveTab('labs')}
                className="p-4 rounded-2xl bg-white border border-teal-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lab Reports</span>
                  <div className="p-2 rounded-xl bg-teal-50 text-teal-600 group-hover:scale-110 transition-transform">
                    <FileText size={18} />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-slate-900">
                    {dashboardData.labReports.length}
                  </span>
                  <span className="text-xs text-teal-600 font-medium">Available</span>
                </div>
              </div>

              <div
                onClick={() => setActiveTab('prescriptions')}
                className="p-4 rounded-2xl bg-white border border-violet-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Prescriptions</span>
                  <div className="p-2 rounded-xl bg-violet-50 text-violet-600 group-hover:scale-110 transition-transform">
                    <Pill size={18} />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-slate-900">
                    {dashboardData.prescriptions.length}
                  </span>
                  <span className="text-xs text-violet-600 font-medium">Active</span>
                </div>
              </div>
            </div>

            {/* 3. Navigation Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                Overview &amp; Next Visits
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('appointments')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'appointments'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                Appointments ({dashboardData.upcomingAppointments.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('encounters')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'encounters'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                Recent Visits ({dashboardData.completedEncounters.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('labs')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'labs'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                Lab Results ({dashboardData.labReports.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('prescriptions')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'prescriptions'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                Prescriptions ({dashboardData.prescriptions.length})
              </button>
            </div>

            {/* TAB CONTENT */}

            {/* TAB: OVERVIEW & UPCOMING APPOINTMENTS */}
            {(activeTab === 'overview' || activeTab === 'appointments') && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      Upcoming Scheduled Appointments
                    </h2>
                    <p className="text-xs text-slate-500">
                      View and manage your confirmed hospital consultations.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBookingOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Book New Visit</span>
                  </button>
                </div>

                {dashboardData.upcomingAppointments.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                      <Calendar size={24} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">No Upcoming Appointments</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      You do not have any appointments scheduled currently. Use the button below to reserve a consultation with your doctor.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsBookingOpen(true)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-sm hover:bg-emerald-500 transition-colors"
                    >
                      Book an Appointment Now
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dashboardData.upcomingAppointments.map((apt) => (
                      <div
                        key={apt.appointment_id}
                        className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-3.5"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                              {apt.doctor_name.replace('Dr. ', '').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 leading-snug">
                                {apt.doctor_name}
                              </h3>
                              <p className="text-xs text-emerald-700 font-medium">{apt.specialty}</p>
                            </div>
                          </div>

                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            {apt.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 text-xs text-slate-600">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-emerald-600 shrink-0" />
                            <span>{apt.appointment_date}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-emerald-600 shrink-0" />
                            <span>{apt.appointment_time}</span>
                          </div>
                          <div className="flex items-center gap-2 col-span-2 text-[11px] text-slate-500">
                            <Building2 size={13} className="text-slate-400 shrink-0" />
                            <span className="truncate">{apt.branch_name}</span>
                          </div>
                        </div>

                        {apt.reason && (
                          <p className="text-xs text-slate-500 italic line-clamp-2">
                            Reason: "{apt.reason}"
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <span className="text-[11px] text-slate-400 font-mono">
                            Ref: {apt.appointment_id}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCancelAppointment(apt.appointment_id)}
                            className="text-xs text-rose-600 hover:text-rose-800 font-medium hover:underline cursor-pointer"
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

            {/* TAB: COMPLETED ENCOUNTERS / RECENT VISITS */}
            {(activeTab === 'overview' || activeTab === 'encounters') && (
              <div className="space-y-4 pt-4">
                <div className="space-y-0.5">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Recent Hospital Visits &amp; Encounters
                  </h2>
                  <p className="text-xs text-slate-500">
                    Clinical documentation and discharge notes from past consultations.
                  </p>
                </div>

                {dashboardData.completedEncounters.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center text-slate-400 text-xs">
                    No completed encounter records found.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboardData.completedEncounters.map((enc) => (
                      <div
                        key={enc.encounter_id}
                        className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 transition-all space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900">
                                {enc.visit_type}
                              </span>
                              <span className="text-xs text-slate-400">· {enc.encounter_date}</span>
                            </div>
                            <p className="text-xs text-slate-600">
                              Attending: <strong>{enc.doctor_name}</strong> ({enc.specialty})
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedEncounter(enc)}
                            className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold hover:text-emerald-900 cursor-pointer"
                          >
                            <Eye size={14} />
                            <span>Read Clinical Notes</span>
                          </button>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                          <span className="font-semibold text-slate-700">Diagnosis:</span>
                          <p className="text-slate-600 leading-relaxed">{enc.diagnosis}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: AVAILABLE LAB REPORTS */}
            {(activeTab === 'overview' || activeTab === 'labs') && (
              <div className="space-y-4 pt-4">
                <div className="space-y-0.5">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Available Laboratory Reports
                  </h2>
                  <p className="text-xs text-slate-500">
                    Clinical chemistry, metabolic diagnostics, and serology tests.
                  </p>
                </div>

                {dashboardData.labReports.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center text-slate-400 text-xs">
                    No lab reports on record.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {dashboardData.labReports.map((lab) => (
                      <div
                        key={lab.lab_id}
                        className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between gap-3 hover:border-emerald-300 transition-all"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[10px] uppercase font-bold text-slate-400">
                              {lab.category}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              {lab.status}
                            </span>
                          </div>

                          <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                            {lab.test_name}
                          </h3>

                          <div className="p-2.5 rounded-xl bg-slate-50 text-[11px] text-slate-600 space-y-1">
                            <div className="text-slate-400 text-[10px]">Findings:</div>
                            <div className="font-mono text-slate-800 font-medium line-clamp-2">
                              {lab.value}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                          <span className="text-[11px] text-slate-400">{lab.result_date}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedLabReport(lab)}
                            className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:text-emerald-900 text-xs cursor-pointer"
                          >
                            <span>View Summary</span>
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: ACTIVE PRESCRIPTIONS */}
            {(activeTab === 'overview' || activeTab === 'prescriptions') && (
              <div className="space-y-4 pt-4">
                <div className="space-y-0.5">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Active Prescriptions &amp; Medications
                  </h2>
                  <p className="text-xs text-slate-500">
                    Current medications, dosage instructions, and refill allowances.
                  </p>
                </div>

                {dashboardData.prescriptions.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center text-slate-400 text-xs">
                    No active prescriptions recorded.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {dashboardData.prescriptions.map((rx) => (
                      <div
                        key={rx.prescription_id}
                        className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-violet-100 text-violet-700">
                              <Pill size={18} />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-900">
                                {rx.medication_name}
                              </h3>
                              <p className="text-xs text-slate-500">{rx.dosage}</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            {rx.status}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 text-xs text-slate-600 space-y-1.5">
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase">Directions</span>
                            <span className="font-medium text-slate-800">{rx.frequency}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Instructions: {rx.instructions}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
                          <span>Refills Left: <strong className="text-slate-700">{rx.refills_left}</strong></span>
                          <span>Prescribed by {rx.doctor_name}</span>
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

      {/* Appointment Booking Wizard Modal */}
      <AppointmentBookingWizard
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        onSuccess={handleBookingSuccess}
      />

      {/* Lab Report Detail Modal */}
      {selectedLabReport && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-700">
                  {selectedLabReport.category}
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedLabReport.test_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLabReport(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 space-y-1">
                <span className="text-slate-400 text-[10px] block">Test Results / Values</span>
                <span className="font-mono text-slate-900 font-bold block">{selectedLabReport.value}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 space-y-1">
                <span className="text-slate-400 text-[10px] block">Standard Reference Range</span>
                <span className="text-slate-700">{selectedLabReport.reference_range}</span>
              </div>

              {selectedLabReport.summary && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-900 space-y-1">
                  <span className="text-emerald-700 text-[10px] font-bold block">Pathologist Clinical Interpretation</span>
                  <p className="leading-relaxed">{selectedLabReport.summary}</p>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                <span>Collected: {selectedLabReport.collected_date}</span>
                <span>Finalized: {selectedLabReport.result_date}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedLabReport(null)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-700">
                  {selectedEncounter.visit_type}
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedEncounter.doctor_name} ({selectedEncounter.specialty})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEncounter(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 space-y-1">
                <span className="text-slate-400 text-[10px] block">Primary Clinical Diagnosis</span>
                <span className="font-semibold text-slate-900 block">{selectedEncounter.diagnosis}</span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 text-slate-700 space-y-1">
                <span className="text-emerald-800 text-[10px] font-bold block">Physician Clinical Notes</span>
                <p className="leading-relaxed text-[11px]">{selectedEncounter.clinical_notes}</p>
              </div>

              {selectedEncounter.follow_up_date && (
                <div className="p-2.5 rounded-xl bg-teal-50 text-teal-900 flex items-center justify-between text-xs">
                  <span>Recommended Follow-up Visit:</span>
                  <strong>{selectedEncounter.follow_up_date}</strong>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedEncounter(null)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              Close Encounter Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
