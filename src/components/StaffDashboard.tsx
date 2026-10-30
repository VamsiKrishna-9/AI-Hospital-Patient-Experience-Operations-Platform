/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  HeartPulse,
  Bed,
  Users,
  Activity,
  LogOut,
  Clock,
  AlertCircle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  Thermometer,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
  ClipboardList,
  Building,
  Check,
  X,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { AuthUser, HospitalRole } from '../types/auth';
import { AiHospitalAssistantLauncher } from './AiHospitalAssistantLauncher';

interface StaffDashboardProps {
  user?: AuthUser | null;
  onLogout: () => void;
  onRoleSwitch?: (role: HospitalRole) => void;
}

interface WardBedItem {
  id: string;
  room: string;
  bed: string;
  floor: string;
  wing: string;
  status: 'Occupied' | 'Available' | 'Cleaning' | 'Reserved' | 'Maintenance';
  patientId?: string | null;
  patientName?: string | null;
  admissionType?: string | null;
  patient: string;
  doctor: string;
  staff: string;
  admissionDate?: string | null;
  admissionInfo: string;
  condition: string;
  oxygen: string;
}

interface StaffAssignmentItem {
  assignmentId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  room: string;
  bed: string;
  task: string;
  instructions: string;
  assignmentDate: string;
  startTime: string;
  dueTime: string;
  priority: string;
  status: string;
  createdAt: string;
}

interface TriageQueueItem {
  ticket: string;
  patient: string;
  age: number;
  arrival: string;
  acuity: string;
  complaint: string;
  status: string;
  assignedBed: string;
}

interface VitalsTaskItem {
  task_id: string;
  patient_id?: string;
  patient: string;
  room: string;
  due: string;
  parameter: string;
  status: string;
}

export const StaffDashboard: React.FC<StaffDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'beds' | 'assignments' | 'triage' | 'vitals'>('beds');
  const [beds, setBeds] = useState<WardBedItem[]>([]);
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignmentItem[]>([]);
  const [triageQueue, setTriageQueue] = useState<TriageQueueItem[]>([]);
  const [vitalsTasks, setVitalsTasks] = useState<VitalsTaskItem[]>([]);
  const [patientsList, setPatientsList] = useState<any[]>([]);
  const [doctorsList, setDoctorsList] = useState<any[]>([]);
  const [selectedBed, setSelectedBed] = useState<WardBedItem | null>(null);

  // Search & Filters for Room Inventory
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWing, setFilterWing] = useState('all');
  const [filterFloor, setFilterFloor] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Room Operation Modal State
  const [isRoomOpModalOpen, setIsRoomOpModalOpen] = useState(false);
  const [roomOpType, setRoomOpType] = useState<'Occupied' | 'Available' | 'Cleaning' | 'Reserved' | 'Maintenance'>('Occupied');
  const [opPatientId, setOpPatientId] = useState('');
  const [opDoctorId, setOpDoctorId] = useState('');
  const [opAdmissionInfo, setOpAdmissionInfo] = useState('');
  const [opCleaningType, setOpCleaningType] = useState('Terminal Sanitization');
  const [opRemarks, setOpRemarks] = useState('');
  const [opMaintenanceIssue, setOpMaintenanceIssue] = useState('');

  // Vitals entry modal state
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);
  const [vitalsPatient, setVitalsPatient] = useState('');
  const [vitalsPatientId, setVitalsPatientId] = useState('');
  const [bpSystolic, setBpSystolic] = useState('120');
  const [bpDiastolic, setBpDiastolic] = useState('80');
  const [heartRate, setHeartRate] = useState('72');
  const [temperature, setTemperature] = useState('37.0');
  const [spo2, setSpo2] = useState('98');
  function getTodayKolkata(): string {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }

  function adjustDate(dateStr: string, days: number): string {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, d));
      dateObj.setUTCDate(dateObj.getUTCDate() + days);
      return dateObj.toISOString().split('T')[0];
    } catch {
      return dateStr;
    }
  }

  function formatDisplayDate(dateStr: string): string {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, d));
      return dateObj.toLocaleDateString('en-US', {
        timeZone: 'UTC',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  const [selectedDate, setSelectedDate] = useState<string>(getTodayKolkata);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [schemaNotice, setSchemaNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Interactive Calendar Popover State matching Admin Dashboard
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarViewYear, setCalendarViewYear] = useState(() => {
    const parts = getTodayKolkata().split('-');
    return Number(parts[0]) || 2026;
  });
  const [calendarViewMonth, setCalendarViewMonth] = useState(() => {
    const parts = getTodayKolkata().split('-');
    return (Number(parts[1]) - 1) || 9;
  });
  const calendarDropdownRef = React.useRef<HTMLDivElement>(null);
  const dateInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      const [y, m] = selectedDate.split('-').map(Number);
      setCalendarViewYear(y);
      setCalendarViewMonth(m - 1);
    }
  }, [selectedDate]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        calendarDropdownRef.current &&
        !calendarDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCalendarOpen(false);
      }
    }
    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isCalendarOpen]);

  const loadStaffData = async (dateStr = selectedDate) => {
    setIsLoading(true);
    try {
      const token = sessionStorage.getItem('mediai_patient_auth_token');
      const res = await fetch(`/api/staff/overview?date=${dateStr}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setBeds(data.wardBeds || []);
        setStaffAssignments(data.staffAssignments || []);
        setTriageQueue(data.triageQueue || []);
        setVitalsTasks(data.vitalsTasks || []);
        setPatientsList(data.patientsList || []);
        setDoctorsList(data.doctorsList || []);
        if (data.schemaNotice?.message) {
          setSchemaNotice(data.schemaNotice.message);
        } else {
          setSchemaNotice(null);
        }
        if (data.wardBeds?.length > 0 && (!selectedBed || !data.wardBeds.some((b: any) => b.id === selectedBed.id))) {
          setSelectedBed(data.wardBeds[0]);
        } else if (!data.wardBeds || data.wardBeds.length === 0) {
          setSelectedBed(null);
        }
      }
    } catch (err) {
      console.error('Failed to load staff overview', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStaffData(selectedDate);
  }, [selectedDate]);

  const handleOpenRoomOpModal = (type: 'Occupied' | 'Available' | 'Cleaning' | 'Reserved' | 'Maintenance') => {
    if (!selectedBed) return;
    setRoomOpType(type);
    setOpPatientId(selectedBed.patientId || (patientsList[0]?.patient_id ?? ''));
    setOpDoctorId(doctorsList[0]?.doctor_id ?? '');
    setOpAdmissionInfo(selectedBed.admissionInfo || '');
    setOpRemarks('');
    setOpMaintenanceIssue('');
    setIsRoomOpModalOpen(true);
  };

  const handleExecuteRoomOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBed) return;
    try {
      const token = sessionStorage.getItem('mediai_patient_auth_token');
      const res = await fetch('/api/staff/rooms/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          targetDate: selectedDate,
          roomId: selectedBed.id,
          status: roomOpType,
          patientId: opPatientId,
          doctorId: opDoctorId,
          admissionInfo: opAdmissionInfo,
          cleaningDetails: { type: opCleaningType, remarks: opRemarks },
          maintenanceDetails: { issue: opMaintenanceIssue },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBeds((prev) =>
          prev.map((b) => (b.id === selectedBed.id ? { ...b, status: roomOpType, admissionInfo: opAdmissionInfo || b.admissionInfo } : b))
        );
        setSelectedBed((prev) => (prev ? { ...prev, status: roomOpType } : null));
        setToastMessage(`Room ${selectedBed.room} status updated to ${roomOpType}.`);
        setIsRoomOpModalOpen(false);
        setTimeout(() => setToastMessage(null), 3500);
      }
    } catch (err) {
      console.error('Failed to update room status', err);
    }
  };

  const handleUpdateAssignmentStatus = async (assignmentId: string, newStatus: string) => {
    try {
      const token = sessionStorage.getItem('mediai_patient_auth_token');
      await fetch('/api/staff/assignments/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ assignmentId, status: newStatus }),
      });
      setStaffAssignments((prev) =>
        prev.map((a) => (a.assignmentId === assignmentId ? { ...a, status: newStatus } : a))
      );
      setToastMessage(`Assignment status updated to ${newStatus}.`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      // ignore
    }
  };

  const handleLogVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = sessionStorage.getItem('mediai_patient_auth_token');
      await fetch('/api/staff/log-vitals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          patientId: vitalsPatientId || undefined,
          patientName: vitalsPatient,
          bp: `${bpSystolic}/${bpDiastolic}`,
          hr: heartRate,
          temp: temperature,
          spo2,
        }),
      });

      setToastMessage(`Vitals recorded successfully: BP ${bpSystolic}/${bpDiastolic}, HR ${heartRate} bpm, SpO2 ${spo2}%.`);
      setIsVitalsModalOpen(false);
      setTimeout(() => setToastMessage(null), 3500);
    } catch {
      // ignore
    }
  };

  const filteredBeds = beds.filter((b) => {
    const matchesSearch =
      b.room.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.patient.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.condition.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesWing = filterWing === 'all' || b.wing.toLowerCase().includes(filterWing.toLowerCase());
    const matchesFloor = filterFloor === 'all' || b.floor.toLowerCase().includes(filterFloor.toLowerCase());
    const matchesStatus = filterStatus === 'all' || b.status.toLowerCase() === filterStatus.toLowerCase();
    return matchesSearch && matchesWing && matchesFloor && matchesStatus;
  });

  const occupiedCount = beds.filter((b) => b.status === 'Occupied').length;
  const availableCount = beds.filter((b) => b.status === 'Available').length;
  const cleaningCount = beds.filter((b) => b.status === 'Cleaning').length;
  const reservedCount = beds.filter((b) => b.status === 'Reserved').length;
  const maintenanceCount = beds.filter((b) => b.status === 'Maintenance').length;
  const myActiveAssignmentsCount = staffAssignments.filter((a) => a.status !== 'Completed' && a.status !== 'Cancelled').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500/30 selection:text-teal-200">
      {/* Top Bar Contract */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <HeartPulse size={18} />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white whitespace-nowrap">
                MediAI <span className="text-teal-400 font-normal">· Ward Operations</span>
              </div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap">
                Inpatient Ward 4B & Clinical Triage
              </div>
            </div>
          </div>

          {/* Zone 2: Navigation Links / Workspace Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab('beds')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'beds'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Room Inventory ({beds.length})
            </button>
            <button
              onClick={() => setActiveTab('assignments')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'assignments'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              My Assignments ({staffAssignments.length})
            </button>
            <button
              onClick={() => setActiveTab('triage')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'triage'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Triage Intake ({triageQueue.length})
            </button>
            <button
              onClick={() => setActiveTab('vitals')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'vitals'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Scheduled Vitals ({vitalsTasks.length})
            </button>
          </nav>

          {/* Zone 3: Primary Action & Profile */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              onClick={() => loadStaffData()}
              className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Refresh staff operations data"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin text-teal-400' : 'text-slate-400'} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <div className="hidden sm:block text-right">
              <div className="text-xs font-medium text-white">{user?.name || user?.email || 'Authenticated Staff'}</div>
              <div className="text-[10px] text-slate-400 font-mono">{user?.staff_id || 'Staff Portal'}</div>
            </div>
            {/* Institutional Verified Role Badge */}
            <div
              className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg border border-emerald-500/30 bg-emerald-950/40 text-xs font-medium text-slate-200 shrink-0 select-none shadow-xs"
              title="Verified Institutional Role: Ward & Triage Staff"
            >
              <HeartPulse size={14} className="text-emerald-400 shrink-0" />
              <span className="text-slate-400 hidden sm:inline">Role:</span>
              <span className="text-emerald-300 font-bold">Staff</span>
            </div>

            <button
              onClick={onLogout}
              className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Staff Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Prominent Shared Date Control Bar matching Admin Dashboard */}
        <section className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg backdrop-blur-md">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Title & Timezone Indicator */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                    Staff Ward & Clinical Operations
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-teal-500/10 text-teal-300 border border-teal-500/30">
                    <Clock className="w-3 h-3" />
                    Asia/Kolkata (IST)
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Filtered Date: <span className="text-teal-300 font-medium">{formatDisplayDate(selectedDate)}</span>
                  {isLoading && <span className="ml-2 text-slate-500 italic">Refreshing database metrics...</span>}
                </p>
              </div>
            </div>

            {/* Date Controls & Quick Jump Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedDate(getTodayKolkata())}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  selectedDate === getTodayKolkata()
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                    : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
                title="View Today's Operations (Asia/Kolkata)"
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => setSelectedDate('2026-09-30')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  selectedDate === '2026-09-30'
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                    : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
                title="Jump to latest operational date with full clinical records"
              >
                Latest Operations (Sep 30, 2026)
              </button>

              <div
                ref={calendarDropdownRef}
                className="relative flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors"
              >
                {/* Previous Day Button */}
                <button
                  type="button"
                  onClick={() => setSelectedDate(adjustDate(selectedDate, -1))}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Previous Day"
                  aria-label="Previous Day"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Calendar Trigger Button */}
                <button
                  type="button"
                  onClick={() => setIsCalendarOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg hover:bg-slate-800/80 transition-colors text-xs font-mono text-white cursor-pointer select-none group"
                  title="Open Calendar to select or jump directly to a date"
                >
                  <Calendar className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold">{selectedDate}</span>
                  <span className="hidden sm:inline-flex items-center text-[10px] text-teal-300 font-sans font-medium bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/30 group-hover:bg-teal-500/20">
                    Calendar
                  </span>
                </button>

                {/* Hidden native date input with ref for browser showPicker support */}
                <input
                  ref={dateInputRef}
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                      setIsCalendarOpen(false);
                    }
                  }}
                  className="absolute opacity-0 pointer-events-none w-0 h-0"
                  tabIndex={-1}
                  aria-hidden="true"
                />

                {/* Next Day Button */}
                <button
                  type="button"
                  onClick={() => setSelectedDate(adjustDate(selectedDate, 1))}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Next Day"
                  aria-label="Next Day"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Interactive Calendar Dropdown Popover */}
                {isCalendarOpen && (
                  <div className="absolute top-full mt-2 right-0 sm:left-0 z-50 w-72 sm:w-80 p-4 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl backdrop-blur-2xl ring-1 ring-teal-500/30 animate-in fade-in zoom-in-95 duration-150">
                    {/* Header: Month / Year Controls */}
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          if (calendarViewMonth === 0) {
                            setCalendarViewMonth(11);
                            setCalendarViewYear((y) => y - 1);
                          } else {
                            setCalendarViewMonth((m) => m - 1);
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Previous Month"
                        aria-label="Previous Month"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                        <span>
                          {[
                            'January',
                            'February',
                            'March',
                            'April',
                            'May',
                            'June',
                            'July',
                            'August',
                            'September',
                            'October',
                            'November',
                            'December',
                          ][calendarViewMonth]}
                        </span>
                        <select
                          value={calendarViewYear}
                          onChange={(e) => setCalendarViewYear(Number(e.target.value))}
                          className="bg-slate-950 text-teal-300 font-mono text-xs px-1.5 py-0.5 rounded border border-slate-800 focus:outline-none cursor-pointer"
                        >
                          {[2023, 2024, 2025, 2026, 2027].map((y) => (
                            <option key={y} value={y} className="bg-slate-900 text-white">
                              {y}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (calendarViewMonth === 11) {
                            setCalendarViewMonth(0);
                            setCalendarViewYear((y) => y + 1);
                          } else {
                            setCalendarViewMonth((m) => m + 1);
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Next Month"
                        aria-label="Next Month"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Weekday Row */}
                    <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400 mb-1">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                        <div key={d} className="py-1">
                          {d}
                        </div>
                      ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-1 text-center text-xs">
                      {(() => {
                        const daysInMonth = new Date(calendarViewYear, calendarViewMonth + 1, 0).getDate();
                        const firstDayOfWeek = new Date(calendarViewYear, calendarViewMonth, 1).getDay();
                        const prevMonthDays = new Date(calendarViewYear, calendarViewMonth, 0).getDate();

                        const leadingDays = Array.from({ length: firstDayOfWeek }).map((_, i) => ({
                          dayNum: prevMonthDays - firstDayOfWeek + 1 + i,
                          isCurrentMonth: false,
                        }));

                        const currentDays = Array.from({ length: daysInMonth }).map((_, i) => ({
                          dayNum: i + 1,
                          isCurrentMonth: true,
                        }));

                        const totalCells = Math.ceil((leadingDays.length + currentDays.length) / 7) * 7;
                        const trailingCount = totalCells - (leadingDays.length + currentDays.length);
                        const trailingDays = Array.from({ length: trailingCount }).map((_, i) => ({
                          dayNum: i + 1,
                          isCurrentMonth: false,
                        }));

                        const allDays = [...leadingDays, ...currentDays, ...trailingDays];

                        return allDays.map((dObj, idx) => {
                          let cellDateStr = '';
                          if (dObj.isCurrentMonth) {
                            const mStr = String(calendarViewMonth + 1).padStart(2, '0');
                            const dayStr = String(dObj.dayNum).padStart(2, '0');
                            cellDateStr = `${calendarViewYear}-${mStr}-${dayStr}`;
                          }
                          const isSelected = cellDateStr === selectedDate;
                          const isToday = cellDateStr === getTodayKolkata();

                          return (
                            <button
                              key={idx}
                              type="button"
                              disabled={!dObj.isCurrentMonth}
                              onClick={() => {
                                if (dObj.isCurrentMonth && cellDateStr) {
                                  setSelectedDate(cellDateStr);
                                  setIsCalendarOpen(false);
                                }
                              }}
                              className={`py-1.5 rounded-lg font-mono transition-all cursor-pointer ${
                                !dObj.isCurrentMonth
                                  ? 'text-slate-600 cursor-not-allowed opacity-40'
                                  : isSelected
                                  ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20'
                                  : isToday
                                  ? 'border border-teal-500/50 text-teal-300 font-semibold bg-teal-500/10'
                                  : 'text-slate-200 hover:bg-slate-800'
                              }`}
                            >
                              {dObj.dayNum}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Live Metrics KPI Strip */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block mb-1">Total Beds</span>
            <span className="text-xl font-bold text-white font-mono">{beds.length}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block mb-1">Occupied Beds</span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold text-rose-400 font-mono">{occupiedCount}</span>
              <span className="text-[10px] text-slate-400 font-mono">{Math.round((occupiedCount / (beds.length || 1)) * 100)}%</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block mb-1">Available Beds</span>
            <span className="text-xl font-bold text-teal-400 font-mono">{availableCount}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block mb-1">Under Cleaning</span>
            <span className="text-xl font-bold text-amber-400 font-mono">{cleaningCount}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block mb-1">Reserved / Maint.</span>
            <span className="text-xl font-bold text-indigo-300 font-mono">{reservedCount + maintenanceCount}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block mb-1">My Assignments</span>
            <span className="text-xl font-bold text-cyan-400 font-mono">{myActiveAssignmentsCount}</span>
          </div>
        </section>

        {/* Toast alert */}
        {toastMessage && (
          <div className="p-3.5 rounded-xl bg-teal-950/60 border border-teal-500/40 text-xs text-teal-200 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-teal-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}


        {/* Tab 1: Complete Room Inventory & Bed Management */}
        {activeTab === 'beds' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Room Inventory Grid */}
            <div className="lg:col-span-8 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div className="relative sm:col-span-2">
                  <Search size={14} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search room number, patient, or condition..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <select
                  value={filterWing}
                  onChange={(e) => setFilterWing(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-xs rounded-xl px-2.5 py-2 text-slate-300 focus:outline-none focus:border-teal-500"
                >
                  <option value="all">All Wings / Pavilions</option>
                  <option value="West Wing">West Wing</option>
                  <option value="North Pavilion">North Pavilion</option>
                  <option value="CCU">Cardiac Care (CCU)</option>
                  <option value="Emergency">Emergency & Trauma</option>
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-xs rounded-xl px-2.5 py-2 text-slate-300 focus:outline-none focus:border-teal-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="Occupied">Occupied</option>
                  <option value="Available">Available</option>
                  <option value="Cleaning">Cleaning</option>
                  <option value="Reserved">Reserved</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>

              {filteredBeds.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs space-y-2">
                  <Bed size={28} className="mx-auto text-teal-400 opacity-80" />
                  <p className="font-semibold text-white">No room inventory records found for the selected date.</p>
                  <p className="text-slate-500 max-w-md mx-auto">
                    Room and inpatient bed records (silver_rooms / silver_admissions) are not provisioned in the canonical Supabase schema.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredBeds.map((bed) => {
                    const isSelected = selectedBed?.id === bed.id;
                    const isOccupied = bed.status === 'Occupied';
                    const isAvailable = bed.status === 'Available';
                    const isCleaning = bed.status === 'Cleaning';
                    const isReserved = bed.status === 'Reserved';
                    const isMaintenance = bed.status === 'Maintenance';

                    return (
                      <div
                        key={bed.id}
                        onClick={() => setSelectedBed(bed)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-slate-900 border-teal-500 ring-1 ring-teal-500/40 shadow-md'
                            : 'bg-slate-900/50 border-slate-800 hover:bg-slate-900 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-white font-mono">{bed.room}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                              isOccupied
                                ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                                : isAvailable
                                ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                                : isCleaning
                                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                : isReserved
                                ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                                : 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                            }`}
                          >
                            {bed.status}
                          </span>
                        </div>

                        <div className="space-y-0.5 mb-1">
                          {isOccupied ? (
                            <>
                              <div className="text-xs font-bold text-white truncate">{bed.patientName || 'Patient information unavailable'}</div>
                              <div className="text-[10px] text-teal-300 font-mono truncate">
                                Patient ID: {bed.patientId || 'N/A'} | {bed.admissionType || 'Inpatient'}
                              </div>
                            </>
                          ) : isAvailable ? (
                            <div className="text-[11px] text-teal-400 font-medium">Ready for Patient</div>
                          ) : (
                            <div className="text-[11px] text-slate-300 font-medium truncate">{bed.condition}</div>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-800/60">
                          <span className="truncate pr-1">{bed.wing}</span>
                          <Bed size={12} className={isOccupied ? 'text-rose-400 shrink-0' : 'text-teal-400 shrink-0'} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Room Detail & Interactive Operations Card */}
            <div className="lg:col-span-4 bg-slate-900/60 rounded-xl border border-slate-800/80 p-5 space-y-4">
              {selectedBed ? (
                <>
                  <div className="border-b border-slate-800 pb-3 flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">{selectedBed.room} ({selectedBed.bed})</h3>
                      <div className="text-xs text-slate-400">{selectedBed.wing} · Floor: {selectedBed.floor}</div>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-md font-mono ${
                        selectedBed.status === 'Occupied'
                          ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                          : selectedBed.status === 'Available'
                          ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                          : selectedBed.status === 'Cleaning'
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                      }`}
                    >
                      {selectedBed.status}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block mb-1">Assigned Patient & Info</span>
                      <div className="text-white font-semibold p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                        {selectedBed.status === 'Occupied' ? (
                          <>
                            <div className="text-sm font-bold text-white">{selectedBed.patientName || selectedBed.patient || 'Patient information unavailable'}</div>
                            <div className="text-[11px] text-teal-300 font-mono">
                              Patient ID: {selectedBed.patientId || 'N/A'} | Type: {selectedBed.admissionType || 'Inpatient'}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Admission Time: {selectedBed.admissionDate || 'N/A'}
                            </div>
                          </>
                        ) : selectedBed.status === 'Available' ? (
                          <>
                            <div className="text-sm font-semibold text-teal-400">Ready for Patient Admission</div>
                            <div className="text-[11px] text-slate-400">No active inpatient assigned on this date.</div>
                          </>
                        ) : selectedBed.status === 'Cleaning' ? (
                          <>
                            <div className="text-sm font-semibold text-amber-300">Sanitization in Progress</div>
                            <div className="text-[11px] text-slate-400">{selectedBed.admissionInfo || 'Terminal UV & linen turnover'}</div>
                          </>
                        ) : selectedBed.status === 'Reserved' ? (
                          <>
                            <div className="text-sm font-semibold text-cyan-300">Reserved Bed</div>
                            <div className="text-[11px] text-slate-400">{selectedBed.admissionInfo || 'Reserved for incoming clinical transfer'}</div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-semibold text-purple-300">Maintenance & Repair</div>
                            <div className="text-[11px] text-slate-400">{selectedBed.admissionInfo || 'Facility work order active'}</div>
                          </>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block mb-1">Attending Physician</span>
                      <div className="text-slate-300 p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-medium">
                        {selectedBed.doctor}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Assigned Nurse</span>
                        <span className="text-slate-200">{selectedBed.staff}</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Oxygen Port</span>
                        <span className="text-slate-200">{selectedBed.oxygen}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Interactive Room Operations
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleOpenRoomOpModal('Available')}
                        className="p-2 rounded-lg text-xs font-semibold bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 transition-colors cursor-pointer"
                      >
                        Set Available
                      </button>
                      <button
                        onClick={() => handleOpenRoomOpModal('Cleaning')}
                        className="p-2 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
                      >
                        Set Cleaning
                      </button>
                      <button
                        onClick={() => handleOpenRoomOpModal('Reserved')}
                        className="p-2 rounded-lg text-xs font-semibold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 transition-colors cursor-pointer"
                      >
                        Set Reserved
                      </button>
                      <button
                        onClick={() => handleOpenRoomOpModal('Occupied')}
                        className="p-2 rounded-lg text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                      >
                        Set Occupied
                      </button>
                      <button
                        onClick={() => handleOpenRoomOpModal('Maintenance')}
                        className="col-span-2 p-2 rounded-lg text-xs font-semibold bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 transition-colors cursor-pointer"
                      >
                        Report Maintenance Issue
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-xs text-slate-500 space-y-2">
                  <Bed size={24} className="mx-auto text-slate-600" />
                  <div className="font-medium text-slate-400">No Room Selected</div>
                  <div className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Active room records will appear here when room and admission data is provisioned in the database.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Doctor-to-Staff Assignments */}
        {activeTab === 'assignments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Doctor-Assigned Inpatient Care Tasks</h3>
                <p className="text-xs text-slate-400">Directly synchronized with Doctor Dashboard care assignments for your profile.</p>
              </div>
              <span className="text-xs font-mono text-cyan-300 bg-cyan-500/10 px-3 py-1 rounded-lg border border-cyan-500/20">
                {staffAssignments.length} Assigned Tasks
              </span>
            </div>

            {staffAssignments.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs space-y-2">
                <ClipboardList size={28} className="mx-auto text-teal-400 opacity-80" />
                <p className="font-semibold text-white">No assignments found for the selected date.</p>
                <p className="text-slate-500">Only verified clinical assignments belonging to your authenticated staff profile appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {staffAssignments.map((a) => (
                  <div key={a.assignmentId} className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div>
                        <div className="text-xs font-bold text-white">{a.patientName} <span className="text-slate-500 font-mono">({a.patientId})</span></div>
                        <div className="text-[11px] text-teal-300 mt-0.5">Doctor: {a.doctorName} ({a.specialty})</div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                        a.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' :
                        a.status === 'In Progress' ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30' :
                        'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                      }`}>
                        {a.status}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-300">
                      <div><strong className="text-slate-400">Room / Bed:</strong> {a.room} · {a.bed}</div>
                      <div><strong className="text-slate-400">Task:</strong> {a.task}</div>
                      <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 italic text-slate-300 text-[11px]">
                        "{a.instructions}"
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
                      <span>Due: {a.dueTime} ({a.assignmentDate})</span>
                      <div className="flex items-center gap-1.5">
                        {a.status !== 'In Progress' && a.status !== 'Completed' && (
                          <button
                            onClick={() => handleUpdateAssignmentStatus(a.assignmentId, 'In Progress')}
                            className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[10px] font-semibold cursor-pointer"
                          >
                            Start
                          </button>
                        )}
                        {a.status !== 'Completed' && (
                          <button
                            onClick={() => handleUpdateAssignmentStatus(a.assignmentId, 'Completed')}
                            className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold cursor-pointer"
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Triage Intake */}
        {activeTab === 'triage' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Emergency Department & Triage Queue</h3>
                <p className="text-xs text-slate-400">Incoming arrivals scored by emergency severity acuity.</p>
              </div>
            </div>

            {triageQueue.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs space-y-2">
                <ShieldAlert size={28} className="mx-auto text-teal-400 opacity-80" />
                <p className="font-semibold text-white">No triage intake records found for the selected date.</p>
                <p className="text-slate-500 max-w-md mx-auto">
                  Emergency triage intake schema (silver_triage) is not provisioned in Supabase PostgreSQL.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {triageQueue.map((t) => (
                  <div
                    key={t.ticket}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-teal-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {t.ticket}
                        </span>
                        <span className="text-sm font-bold text-white">{t.patient}</span>
                        <span className="text-xs text-slate-500">({t.age}y)</span>
                        <span className="text-xs text-slate-400 font-mono">· {t.arrival}</span>
                      </div>
                      <div className="text-xs text-slate-300">{t.complaint}</div>
                      <div className="text-[11px] text-slate-500">Target Station: {t.status} · Bed: {t.assignedBed}</div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs px-2.5 py-1 rounded font-mono ${
                          t.acuity.includes('Emergent')
                            ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        }`}
                      >
                        {t.acuity}
                      </span>
                      <button
                        onClick={() => {
                          setVitalsPatient(`${t.patient} (${t.ticket})`);
                          setVitalsPatientId(t.ticket);
                          setIsVitalsModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors cursor-pointer"
                      >
                        Intake Vitals
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Scheduled Vitals */}
        {activeTab === 'vitals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Inpatient Scheduled Vitals Queue</h3>
                <p className="text-xs text-slate-400">Regular 4-hour monitoring interval tasks across Ward 4B.</p>
              </div>
            </div>

            {vitalsTasks.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs space-y-2">
                <HeartPulse size={28} className="mx-auto text-teal-400 opacity-80" />
                <p className="font-semibold text-white">No scheduled vitals tasks found for the selected date.</p>
                <p className="text-slate-500 max-w-md mx-auto">
                  Inpatient vitals monitoring schedule schema (silver_vitals) is not provisioned in Supabase PostgreSQL.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {vitalsTasks.map((task) => (
                  <div
                    key={task.task_id}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-teal-400 font-bold">{task.room}</span>
                        <span className="text-xs font-bold text-white">{task.patient}</span>
                        <span className="text-[11px] text-slate-400">· Due: {task.due}</span>
                      </div>
                      <div className="text-xs text-slate-300">{task.parameter}</div>
                    </div>

                    <button
                      onClick={() => {
                        setVitalsPatient(`${task.patient} (${task.room})`);
                        setVitalsPatientId(task.patient_id || '');
                        setIsVitalsModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors cursor-pointer"
                    >
                      Log Now
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Interactive Room Operation Modal */}
      {isRoomOpModalOpen && selectedBed && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Room Operation: Set {roomOpType}</h3>
                <span className="text-xs text-teal-400">{selectedBed.room} ({selectedBed.wing})</span>
              </div>
              <button
                onClick={() => setIsRoomOpModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleExecuteRoomOperation} className="space-y-4">
              {roomOpType === 'Occupied' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Select Patient</label>
                    <select
                      value={opPatientId}
                      onChange={(e) => setOpPatientId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      required
                    >
                      <option value="">Select admitted or registered patient...</option>
                      {patientsList.map((p) => (
                        <option key={p.patient_id} value={p.patient_id}>
                          {p.name} ({p.patient_id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Attending Physician</label>
                    <select
                      value={opDoctorId}
                      onChange={(e) => setOpDoctorId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      required
                    >
                      <option value="">Select attending doctor...</option>
                      {doctorsList.map((d) => (
                        <option key={d.doctor_id} value={d.doctor_id}>
                          {d.doctor_name} ({d.specialty})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Admission Indication / Details</label>
                    <input
                      type="text"
                      value={opAdmissionInfo}
                      onChange={(e) => setOpAdmissionInfo(e.target.value)}
                      placeholder="e.g. Admitted for post-op observation & telemetry"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      required
                    />
                  </div>
                </>
              )}

              {roomOpType === 'Cleaning' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Cleaning Protocol</label>
                    <select
                      value={opCleaningType}
                      onChange={(e) => setOpCleaningType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    >
                      <option value="Terminal Sanitization">Terminal UV Sanitization & Scrub</option>
                      <option value="Standard Turnaround">Standard Discharge Turnaround</option>
                      <option value="Deep Hazmat Clean">Deep Infection Control Scrub</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Sanitization Remarks</label>
                    <input
                      type="text"
                      value={opRemarks}
                      onChange={(e) => setOpRemarks(e.target.value)}
                      placeholder="e.g. Linens replaced, air scrubbers active..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                  </div>
                </>
              )}

              {roomOpType === 'Reserved' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Reservation / Incoming Notes</label>
                    <input
                      type="text"
                      value={opAdmissionInfo}
                      onChange={(e) => setOpAdmissionInfo(e.target.value)}
                      placeholder="e.g. Reserved for incoming transfer from Emergency Dept at 14:00"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      required
                    />
                  </div>
                </>
              )}

              {roomOpType === 'Maintenance' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Maintenance Issue Description</label>
                    <input
                      type="text"
                      value={opMaintenanceIssue}
                      onChange={(e) => setOpMaintenanceIssue(e.target.value)}
                      placeholder="e.g. Oxygen flow meter valve repair needed"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      required
                    />
                  </div>
                </>
              )}

              {roomOpType === 'Available' && (
                <p className="text-xs text-slate-300">
                  Confirm patient discharge/transfer and bed readiness for new admissions.
                </p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRoomOpModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 cursor-pointer"
                >
                  Confirm Room Operation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Vitals Modal */}
      {isVitalsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Record Clinical Vitals</h3>
                <span className="text-xs text-teal-400">{vitalsPatient}</span>
              </div>
              <button
                onClick={() => setIsVitalsModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleLogVitals} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Blood Pressure (mmHg)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={bpSystolic}
                    onChange={(e) => setBpSystolic(e.target.value)}
                    placeholder="Systolic (120)"
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    required
                  />
                  <input
                    type="number"
                    value={bpDiastolic}
                    onChange={(e) => setBpDiastolic(e.target.value)}
                    placeholder="Diastolic (80)"
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Pulse (bpm)
                  </label>
                  <input
                    type="number"
                    value={heartRate}
                    onChange={(e) => setHeartRate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Temp (°C)
                  </label>
                  <input
                    type="text"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    SpO2 (%)
                  </label>
                  <input
                    type="number"
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsVitalsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 cursor-pointer"
                >
                  Save Vitals Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating AI Hospital Assistant Launcher */}
      <AiHospitalAssistantLauncher user={user} />
    </div>
  );
};
