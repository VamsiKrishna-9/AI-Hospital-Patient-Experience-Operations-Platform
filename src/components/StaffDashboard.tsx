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
  Stethoscope,
  UserCheck,
  Briefcase,
  Check,
} from 'lucide-react';
import { AuthUser } from '../types/auth';
import { AiHospitalAssistantLauncher } from './AiHospitalAssistantLauncher';

interface StaffDashboardProps {
  user?: AuthUser | null;
  onLogout: () => void;
}

interface WardBedItem {
  id: string;
  room: string;
  wing: string;
  status: 'Occupied' | 'Available' | 'Cleaning' | 'Reserved';
  patient: string;
  condition: string;
  nurse: string;
  oxygen: string;
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
  patient: string;
  room: string;
  due: string;
  parameter: string;
  status: string;
}

interface DoctorAssignedPatientItem {
  assignment_id: string;
  staff_id: string;
  staff_name: string;
  staff_role: string;
  patient_id: string;
  patient_name: string;
  patient_age: number;
  patient_gender: string;
  patient_phone?: string;
  doctor_id: string;
  doctor_name: string;
  doctor_specialty: string;
  assignment_type: string;
  assignment_date: string;
  start_time: string;
  end_time: string;
  priority: string;
  assignment_status: string;
  notes: string;
}

export const StaffDashboard: React.FC<StaffDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'assigned' | 'beds' | 'triage' | 'vitals'>('assigned');
  const [beds, setBeds] = useState<WardBedItem[]>([]);
  const [triageQueue, setTriageQueue] = useState<TriageQueueItem[]>([]);
  const [vitalsTasks, setVitalsTasks] = useState<VitalsTaskItem[]>([]);
  const [assignedPatients, setAssignedPatients] = useState<DoctorAssignedPatientItem[]>([]);
  const [updatingAssignmentId, setUpdatingAssignmentId] = useState<string | null>(null);
  const [assignmentFilter, setAssignmentFilter] = useState<string>('all');
  const [selectedBed, setSelectedBed] = useState<WardBedItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWing, setFilterWing] = useState('all');

  // Vitals entry modal state
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);
  const [vitalsPatient, setVitalsPatient] = useState('Harold Finch (Room 401)');
  const [bpSystolic, setBpSystolic] = useState('120');
  const [bpDiastolic, setBpDiastolic] = useState('80');
  const [heartRate, setHeartRate] = useState('72');
  const [temperature, setTemperature] = useState('37.0');
  const [spo2, setSpo2] = useState('98');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadStaffData = async () => {
    try {
      const token = sessionStorage.getItem('mediai_patient_auth_token');
      const res = await fetch('/api/staff/overview', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setBeds(data.wardBeds || []);
        setTriageQueue(data.triageQueue || []);
        setVitalsTasks(data.vitalsTasks || []);
        setAssignedPatients(data.assignedPatients || []);
        if (data.wardBeds?.length > 0) {
          setSelectedBed(data.wardBeds[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load staff overview', err);
    }
  };

  useEffect(() => {
    loadStaffData();
  }, []);

  const handleUpdateAssignmentStatus = async (assignmentId: string, newStatus: string, notes?: string) => {
    setUpdatingAssignmentId(assignmentId);
    try {
      const token = sessionStorage.getItem('mediai_patient_auth_token');
      const res = await fetch('/api/staff/assignment-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ assignmentId, status: newStatus, notes }),
      });
      const data = await res.json();
      if (data.success) {
        setAssignedPatients((prev) =>
          prev.map((item) =>
            item.assignment_id === assignmentId ? { ...item, assignment_status: newStatus } : item
          )
        );
        setToastMessage(`Assignment ${assignmentId} updated to ${newStatus}.`);
        setTimeout(() => setToastMessage(null), 3500);
      } else {
        alert(data.error || 'Failed to update assignment status.');
      }
    } catch (err: any) {
      alert(`Error updating assignment: ${err?.message || 'Network error'}`);
    } finally {
      setUpdatingAssignmentId(null);
    }
  };

  const handleUpdateBedStatus = async (newStatus: 'Occupied' | 'Available' | 'Cleaning' | 'Reserved') => {
    if (!selectedBed) return;
    try {
      const token = sessionStorage.getItem('mediai_patient_auth_token');
      await fetch('/api/staff/update-bed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ bedId: selectedBed.id, status: newStatus }),
      });

      setBeds((prev) =>
        prev.map((b) => (b.id === selectedBed.id ? { ...b, status: newStatus } : b))
      );
      setSelectedBed((prev) => (prev ? { ...prev, status: newStatus } : null));
      setToastMessage(`Bed ${selectedBed.room} status updated to ${newStatus}.`);
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
          patientName: vitalsPatient,
          bp: `${bpSystolic}/${bpDiastolic}`,
          hr: heartRate,
          temp: temperature,
          spo2,
        }),
      });

      setToastMessage(`Vitals recorded: BP ${bpSystolic}/${bpDiastolic}, HR ${heartRate} bpm, SpO2 ${spo2}%.`);
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
    return matchesSearch && matchesWing;
  });

  const occupiedCount = beds.filter((b) => b.status === 'Occupied').length;
  const availableCount = beds.filter((b) => b.status === 'Available').length;
  const cleaningCount = beds.filter((b) => b.status === 'Cleaning').length;

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
              onClick={() => setActiveTab('assigned')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'assigned'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Doctor-Assigned Patients ({assignedPatients.length})
            </button>
            <button
              onClick={() => setActiveTab('beds')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'beds'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Bed Management ({beds.length})
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
              onClick={() => setIsVitalsModalOpen(true)}
              className="hidden sm:inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors cursor-pointer shrink-0 shadow-sm"
            >
              <Plus size={14} />
              <span>Record Vitals</span>
            </button>
            <div className="hidden sm:block text-right">
              <div className="text-xs font-medium text-white">{user?.name || 'Sarah Jenkins, RN'}</div>
              <div className="text-[10px] text-slate-400 font-mono">Station 4B Lead</div>
            </div>
            {/* Institutional Verified Role Badge (Single-Role Enforced for Security) */}
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
        {/* KPI Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div
            onClick={() => setActiveTab('assigned')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'assigned'
                ? 'bg-teal-950/50 border-teal-500/50 shadow-xs'
                : 'bg-slate-900/60 border-slate-800/80 hover:border-teal-500/30'
            }`}
          >
            <span className="text-xs text-teal-400 font-semibold block mb-1">Doctor-Assigned</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-teal-300 font-mono tabular-nums">{assignedPatients.length}</span>
              <span className="text-[10px] text-teal-400 font-mono bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20">
                Directives
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Occupied Beds</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white font-mono tabular-nums">{occupiedCount} <span className="text-xs text-slate-500 font-sans">/ {beds.length}</span></span>
              <span className="text-xs text-amber-400 font-mono tabular-nums">
                {Math.round((occupiedCount / (beds.length || 1)) * 100)}% Occ
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Available Ready Beds</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-teal-400 font-mono tabular-nums">{availableCount}</span>
              <span className="text-xs text-slate-400">Prepped</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Under Sanitization</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-300 font-mono tabular-nums">{cleaningCount}</span>
              <span className="text-xs text-slate-400">UV Terminal Clean</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Triage Intake Waiting</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-amber-400 font-mono tabular-nums">{triageQueue.length}</span>
              <span className="text-xs text-amber-400/80">Avg wait: 14m</span>
            </div>
          </div>
        </section>

        {/* Toast alert */}
        {toastMessage && (
          <div className="p-3.5 rounded-xl bg-teal-950/60 border border-teal-500/40 text-xs text-teal-200 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-teal-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Tab 0: Doctor-Assigned Patients Workflow */}
        {activeTab === 'assigned' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <Stethoscope size={16} className="text-teal-400" />
                  <span>Doctor-Assigned Patients & Directives</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Institutional care orders assigned directly by physicians in <code className="text-teal-400 font-mono">silver_staff_assignment</code>.
                </p>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {['all', 'Scheduled', 'In Progress', 'Completed'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setAssignmentFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                      assignmentFilter === st
                        ? 'bg-teal-500 text-slate-950 font-bold shadow-xs'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                    }`}
                  >
                    {st === 'all' ? `All (${assignedPatients.length})` : st}
                  </button>
                ))}
              </div>
            </div>

            {assignedPatients.filter(
              (a) => assignmentFilter === 'all' || a.assignment_status.toLowerCase() === assignmentFilter.toLowerCase()
            ).length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs">
                No patient assignments found matching status '{assignmentFilter}'.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignedPatients
                  .filter(
                    (a) =>
                      assignmentFilter === 'all' ||
                      a.assignment_status.toLowerCase() === assignmentFilter.toLowerCase()
                  )
                  .map((asn) => {
                    const isUrgent = asn.priority === 'Urgent' || asn.priority === 'Critical';
                    const isUpdating = updatingAssignmentId === asn.assignment_id;

                    return (
                      <div
                        key={asn.assignment_id}
                        className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-teal-500/40 transition-all space-y-3 shadow-sm"
                      >
                        {/* Header: Patient & Priority */}
                        <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white">{asn.patient_name}</h4>
                              <span className="text-[10px] font-mono text-teal-400 bg-teal-500/10 px-1.5 py-0.2 rounded border border-teal-500/20">
                                {asn.patient_id}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {asn.patient_age} yrs · {asn.patient_gender} {asn.patient_phone ? `· ${asn.patient_phone}` : ''}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
                                isUrgent
                                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 font-bold'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              {asn.priority || 'Normal'}
                            </span>
                          </div>
                        </div>

                        {/* Physician & Service Info */}
                        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 text-[11px]">Ordering Doctor:</span>
                            <span className="text-teal-300 font-semibold">{asn.doctor_name}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-mono">Specialty:</span>
                            <span className="text-slate-300">{asn.doctor_specialty}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-mono">Service Required:</span>
                            <span className="text-white font-medium">{asn.assignment_type}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-mono">Scheduled:</span>
                            <span className="text-slate-300">{asn.assignment_date} {asn.start_time ? `at ${asn.start_time.slice(0, 5)}` : ''}</span>
                          </div>
                        </div>

                        {/* Directives from Doctor */}
                        <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs text-slate-300 leading-relaxed font-sans">
                          <span className="text-[10px] text-slate-500 font-mono uppercase block mb-0.5">Physician Clinical Directives:</span>
                          {asn.notes || 'Routine clinical monitoring.'}
                        </div>

                        {/* Live Status and Actions */}
                        <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 text-[11px]">Current Status:</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
                                asn.assignment_status === 'Completed'
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                  : asn.assignment_status === 'In Progress'
                                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                  : 'bg-teal-500/10 text-teal-300 border-teal-500/20'
                              }`}
                            >
                              {asn.assignment_status}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {asn.assignment_status === 'Scheduled' && (
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleUpdateAssignmentStatus(asn.assignment_id, 'In Progress')}
                                className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                              >
                                {isUpdating ? <RefreshCw size={12} className="animate-spin" /> : <Clock size={12} />}
                                <span>Start Task</span>
                              </button>
                            )}

                            {asn.assignment_status === 'In Progress' && (
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleUpdateAssignmentStatus(asn.assignment_id, 'Completed')}
                                className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                              >
                                {isUpdating ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                                <span>Mark Completed</span>
                              </button>
                            )}

                            <select
                              value={asn.assignment_status}
                              disabled={isUpdating}
                              onChange={(e) => handleUpdateAssignmentStatus(asn.assignment_id, e.target.value)}
                              className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 focus:outline-none focus:border-teal-500 cursor-pointer font-mono"
                            >
                              <option value="Scheduled">Scheduled</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Completed">Completed</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* Tab 1: Bed Management Grid */}
        {activeTab === 'beds' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Bed Grid */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search room number, patient, or condition..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <select
                  value={filterWing}
                  onChange={(e) => setFilterWing(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-xs rounded-xl px-2.5 py-2 text-slate-300 focus:outline-none focus:border-teal-500"
                >
                  <option value="all">All Wings</option>
                  <option value="west">West Wing</option>
                  <option value="north">North Wing</option>
                </select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredBeds.map((bed) => {
                  const isSelected = selectedBed?.id === bed.id;
                  const isOccupied = bed.status === 'Occupied';
                  const isAvailable = bed.status === 'Available';
                  const isCleaning = bed.status === 'Cleaning';
                  const isReserved = bed.status === 'Reserved';

                  return (
                    <div
                      key={bed.id}
                      onClick={() => setSelectedBed(bed)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 border-teal-500 ring-1 ring-teal-500/40'
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
                              : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                          }`}
                        >
                          {bed.status}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-300 font-medium truncate mb-1">
                        {isOccupied ? bed.patient : isAvailable ? 'Ready for Patient' : bed.condition}
                      </div>

                      <div className="text-[10px] text-slate-500 flex items-center justify-between">
                        <span>{bed.wing}</span>
                        <Bed size={12} className={isOccupied ? 'text-rose-400' : 'text-teal-400'} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Bed Detail & Control Card */}
            <div className="lg:col-span-4 bg-slate-900/60 rounded-xl border border-slate-800/80 p-5 space-y-4">
              {selectedBed ? (
                <>
                  <div className="border-b border-slate-800 pb-3 flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">{selectedBed.room}</h3>
                      <div className="text-xs text-slate-400">{selectedBed.wing} · {selectedBed.id}</div>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-md font-mono ${
                        selectedBed.status === 'Occupied'
                          ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                          : selectedBed.status === 'Available'
                          ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                          : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                      }`}
                    >
                      {selectedBed.status}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block mb-1">Assigned Patient</span>
                      <div className="text-white font-medium p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        {selectedBed.patient !== 'None' ? selectedBed.patient : 'No current patient'}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block mb-1">Clinical Indication / Status</span>
                      <div className="text-slate-300 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        {selectedBed.condition}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Nurse Lead</span>
                        <span className="text-slate-200">{selectedBed.nurse}</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Oxygen Port</span>
                        <span className="text-slate-200">{selectedBed.oxygen}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Rapid Bed State Action
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleUpdateBedStatus('Available')}
                        className="p-2 rounded-lg text-xs font-semibold bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 transition-colors cursor-pointer"
                      >
                        Set Available
                      </button>
                      <button
                        onClick={() => handleUpdateBedStatus('Cleaning')}
                        className="p-2 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
                      >
                        Set Cleaning
                      </button>
                      <button
                        onClick={() => handleUpdateBedStatus('Reserved')}
                        className="p-2 rounded-lg text-xs font-semibold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 transition-colors cursor-pointer"
                      >
                        Set Reserved
                      </button>
                      <button
                        onClick={() => handleUpdateBedStatus('Occupied')}
                        className="p-2 rounded-lg text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                      >
                        Set Occupied
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-10 text-xs text-slate-500">
                  Select a bed from the ward grid to view clinical telemetry and adjust room status.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Triage Intake */}
        {activeTab === 'triage' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Emergency Department & Triage Queue</h3>
                <p className="text-xs text-slate-400">Incoming arrivals scored by emergency severity acuity.</p>
              </div>
            </div>

            {triageQueue.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs">
                No emergent triage intake waiting in the queue at this time.
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

        {/* Tab 3: Scheduled Vitals */}
        {activeTab === 'vitals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Inpatient Scheduled Vitals Queue</h3>
                <p className="text-xs text-slate-400">Regular 4-hour monitoring interval tasks across Ward 4B.</p>
              </div>
            </div>

            {vitalsTasks.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs">
                All scheduled inpatient vitals checks are currently up to date.
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
