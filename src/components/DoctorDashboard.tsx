/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  FileText,
  Activity,
  LogOut,
  Pill,
  ChevronRight,
  Search,
  Sparkles,
  ClipboardList,
  Bed,
  Check,
  Send,
} from 'lucide-react';
import { AuthUser, HospitalRole } from '../types/auth';

interface DoctorDashboardProps {
  user?: AuthUser | null;
  onLogout: () => void;
  onRoleSwitch?: (role: HospitalRole) => void;
}

interface AppointmentItem {
  appointment_id: string;
  patient_id: string;
  patient_name: string;
  time: string;
  type: string;
  room: string;
  status: string;
  chief_complaint: string;
  notes: string;
}

interface InpatientItem {
  bed: string;
  patient_name: string;
  patient_id: string;
  age: number;
  diagnosis: string;
  day_of_stay: number;
  acuity: string;
  vitals: string;
  plan: string;
}

interface LabItem {
  lab_id: string;
  patient_id: string;
  patient_name: string;
  test: string;
  result: string;
  status: string;
  signed: boolean;
}

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'inpatients' | 'labs'>('schedule');
  const [schedule, setSchedule] = useState<AppointmentItem[]>([]);
  const [inpatients, setInpatients] = useState<InpatientItem[]>([]);
  const [labs, setLabs] = useState<LabItem[]>([]);
  const [doctorProfile, setDoctorProfile] = useState<any>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Clinical encounter note draft
  const [encounterNote, setEncounterNote] = useState('');
  const [prescriptionNote, setPrescriptionNote] = useState('');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    async function loadDoctorData() {
      try {
        const token = sessionStorage.getItem('mediai_patient_auth_token');
        const res = await fetch('/api/doctor/overview', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (data.success) {
          setDoctorProfile(data.doctor || null);
          setSchedule(data.schedule || []);
          setInpatients(data.inpatientRounds || []);
          setLabs(data.pendingLabs || []);
          if (data.schedule?.length > 0) {
            setSelectedAppointment(data.schedule[0]);
            setEncounterNote(data.schedule[0].notes || '');
          }
        }
      } catch (err) {
        console.error('Failed to load doctor overview', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadDoctorData();
  }, []);

  const handleSelectAppointment = (apt: AppointmentItem) => {
    setSelectedAppointment(apt);
    setEncounterNote(apt.notes || '');
    setPrescriptionNote('');
    setSaveSuccessNotice(null);
  };

  const handleSaveEncounter = async () => {
    if (!selectedAppointment) return;
    try {
      const token = sessionStorage.getItem('mediai_patient_auth_token');
      await fetch('/api/doctor/encounter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          appointmentId: selectedAppointment.appointment_id,
          patientId: selectedAppointment.patient_id,
          notes: encounterNote,
          prescription: prescriptionNote,
        }),
      });

      setSchedule((prev) =>
        prev.map((item) =>
          item.appointment_id === selectedAppointment.appointment_id
            ? { ...item, status: 'Completed', notes: encounterNote }
            : item
        )
      );

      setSelectedAppointment((prev) => (prev ? { ...prev, status: 'Completed', notes: encounterNote } : null));
      setSaveSuccessNotice('Encounter note signed & updated in electronic medical record.');
      setTimeout(() => setSaveSuccessNotice(null), 4000);
    } catch {
      // ignore
    }
  };

  const handleSignLab = async (labId: string) => {
    try {
      const token = sessionStorage.getItem('mediai_patient_auth_token');
      await fetch('/api/doctor/sign-lab', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ labId }),
      });

      setLabs((prev) =>
        prev.map((item) => (item.lab_id === labId ? { ...item, signed: true } : item))
      );
    } catch {
      // ignore
    }
  };

  const filteredSchedule = schedule.filter((apt) => {
    const matchesSearch =
      apt.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.patient_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.chief_complaint.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || apt.status.toLowerCase() === filterStatus.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  const completedCount = schedule.filter((s) => s.status === 'Completed').length;
  const pendingLabsCount = labs.filter((l) => !l.signed).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500/30 selection:text-teal-200">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Stethoscope size={18} />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white whitespace-nowrap">
                MediAI <span className="text-teal-400 font-normal">· Clinical Portal</span>
              </div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap">
                Cardiovascular Specialty Institute
              </div>
            </div>
          </div>

          {/* Zone 2: Navigation Links / Workspace Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'schedule'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Today's Schedule ({schedule.length})
            </button>
            <button
              onClick={() => setActiveTab('inpatients')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'inpatients'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Inpatient Rounds ({inpatients.length})
            </button>
            <button
              onClick={() => setActiveTab('labs')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'labs'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Pending Labs {pendingLabsCount > 0 && `(${pendingLabsCount})`}
            </button>
          </nav>

          {/* Zone 3: Primary Action & Profile */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <div className="hidden sm:block text-right">
              <div className="text-xs font-medium text-white">{user?.name || 'Dr. Marcus Vance, MD'}</div>
              <div className="text-[10px] text-slate-400 font-mono">ID: {user?.doctor_id || 'DOC-7721'}</div>
            </div>
            {/* Institutional Verified Role Badge (Single-Role Enforced for Security) */}
            <div
              className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-xs font-medium text-slate-200 shrink-0 select-none shadow-xs"
              title="Verified Institutional Role: Attending Physician"
            >
              <Stethoscope size={14} className="text-cyan-400 shrink-0" />
              <span className="text-slate-400 hidden sm:inline">Role:</span>
              <span className="text-cyan-300 font-bold">Doctor</span>
            </div>

            <button
              onClick={onLogout}
              className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Sign Out to Common Login"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Clinical Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Today's Consultations</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white font-mono tabular-nums">{schedule.length}</span>
              <span className="text-xs text-teal-400 font-mono tabular-nums">
                {completedCount} completed
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Inpatient Census</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white font-mono tabular-nums">{inpatients.length}</span>
              <span className="text-xs text-slate-400">Cardiology Ward</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Pending Lab Sign-offs</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-amber-400 font-mono tabular-nums">{pendingLabsCount}</span>
              <span className="text-xs text-amber-400/80">Action required</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Avg Consultation Time</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white font-mono tabular-nums">24 <span className="text-xs font-sans text-slate-400">min</span></span>
              <span className="text-xs text-teal-400">On schedule</span>
            </div>
          </div>
        </section>

        {/* Success toast */}
        {saveSuccessNotice && (
          <div className="p-3.5 rounded-xl bg-teal-950/60 border border-teal-500/40 text-xs text-teal-200 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-teal-400 shrink-0" />
            <span>{saveSuccessNotice}</span>
          </div>
        )}

        {/* Tab 1: Schedule & Encounter Note authoring */}
        {activeTab === 'schedule' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Schedule list */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search patient, ID, or complaint..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-xs rounded-xl px-2.5 py-2 text-slate-300 focus:outline-none focus:border-teal-500"
                >
                  <option value="all">All Status</option>
                  <option value="waiting">Waiting</option>
                  <option value="in-progress">In-Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="space-y-2.5">
                {filteredSchedule.map((apt) => {
                  const isSelected = selectedAppointment?.appointment_id === apt.appointment_id;
                  const isCompleted = apt.status === 'Completed';
                  const isInProgress = apt.status === 'In-Progress';

                  return (
                    <div
                      key={apt.appointment_id}
                      onClick={() => handleSelectAppointment(apt)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 border-teal-500/50 ring-1 ring-teal-500/30'
                          : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono tabular-nums text-teal-400 font-semibold">
                            {apt.time}
                          </span>
                          <span className="text-xs text-slate-500">·</span>
                          <span className="text-xs font-medium text-white">{apt.patient_name}</span>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${
                            isCompleted
                              ? 'bg-slate-800 text-slate-400'
                              : isInProgress
                              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                              : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          }`}
                        >
                          {apt.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 line-clamp-1 mb-1">
                        {apt.chief_complaint}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-mono">{apt.patient_id}</span>
                        <span>{apt.room}</span>
                      </div>
                    </div>
                  );
                })}

                {filteredSchedule.length === 0 && (
                  <div className="text-center py-10 text-xs text-slate-500">
                    No matching appointments found.
                  </div>
                )}
              </div>
            </div>

            {/* Right: Selected Encounter & Chart Drawer */}
            <div className="lg:col-span-7 bg-slate-900/60 rounded-xl border border-slate-800/80 p-5 space-y-5">
              {selectedAppointment ? (
                <>
                  <div className="border-b border-slate-800 pb-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-lg font-bold text-white">{selectedAppointment.patient_name}</h2>
                        <span className="text-xs font-mono text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                          {selectedAppointment.patient_id}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        <span>{selectedAppointment.type}</span>
                        <span className="mx-1.5">·</span>
                        <span className="font-mono">{selectedAppointment.time}</span>
                        <span className="mx-1.5">·</span>
                        <span>{selectedAppointment.room}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-slate-500 block">Appointment ID</span>
                      <span className="text-xs font-mono text-slate-300">{selectedAppointment.appointment_id}</span>
                    </div>
                  </div>

                  {/* Chief Complaint Callout */}
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Chief Complaint & Triage Presentation
                    </span>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {selectedAppointment.chief_complaint}
                    </p>
                  </div>

                  {/* Clinical Encounter Documentation */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-300">
                      Physician Encounter Notes & Objective Findings
                    </label>
                    <textarea
                      rows={5}
                      value={encounterNote}
                      onChange={(e) => setEncounterNote(e.target.value)}
                      placeholder="Document physical examination findings, heart sounds, ECG rhythm interpretation, and treatment plan..."
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 font-sans leading-relaxed"
                    />
                  </div>

                  {/* Prescription Order Form */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Pill size={14} className="text-teal-400" />
                      <span>E-Prescription & In-Hospital Pharmacy Order</span>
                    </label>
                    <input
                      type="text"
                      value={prescriptionNote}
                      onChange={(e) => setPrescriptionNote(e.target.value)}
                      placeholder="e.g. Atorvastatin 20mg PO QHS (30-day supply) / Lisinopril 10mg daily"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                    <span className="text-[11px] text-slate-500">
                      Signed as {doctorProfile?.name || user?.name || 'Dr. Physician'} ({doctorProfile?.license || doctorProfile?.doctor_id || 'Staff'})
                    </span>
                    <button
                      onClick={handleSaveEncounter}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-all cursor-pointer"
                    >
                      <Check size={14} />
                      <span>Sign & Finalize Encounter</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-16 text-xs text-slate-500">
                  Select an appointment on the left to review records or document consultation notes.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Inpatient Rounds */}
        {activeTab === 'inpatients' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Cardiovascular Inpatient Unit</h3>
                <p className="text-xs text-slate-400">Active telemetry beds assigned to your service today.</p>
              </div>
              <span className="text-xs font-mono text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-lg border border-teal-500/20">
                {inpatients.length} Inpatients
              </span>
            </div>

            {inpatients.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs">
                No active inpatient admissions currently assigned to your clinical service.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inpatients.map((patient) => (
                  <div key={patient.bed} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-teal-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            {patient.bed}
                          </span>
                          <h4 className="text-sm font-bold text-white">{patient.patient_name}</h4>
                          <span className="text-xs text-slate-500">({patient.age}y)</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">ID: {patient.patient_id} · Day of stay: {patient.day_of_stay}</div>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                          patient.acuity === 'Stable'
                            ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        }`}
                      >
                        {patient.acuity}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 uppercase block mb-0.5">Primary Diagnosis</span>
                      {patient.diagnosis}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                      <span>{patient.vitals}</span>
                    </div>

                    <div className="text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                      <span className="text-[10px] text-teal-400 block font-medium mb-0.5">Care Plan</span>
                      {patient.plan}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Pending Labs */}
        {activeTab === 'labs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Laboratory Orders & Telemetry Approvals</h3>
                <p className="text-xs text-slate-400">Review critical diagnostics and apply physician sign-off.</p>
              </div>
            </div>

            {labs.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs">
                No diagnostic laboratory results pending physician review at this time.
              </div>
            ) : (
              <div className="space-y-3">
                {labs.map((lab) => (
                  <div
                    key={lab.lab_id}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-400">{lab.lab_id}</span>
                        <span className="text-xs font-bold text-white">{lab.patient_name}</span>
                        <span className="text-[11px] font-mono text-teal-400">({lab.patient_id})</span>
                      </div>
                      <div className="text-xs text-slate-300 font-medium">{lab.test}</div>
                      <div className="text-xs text-slate-400 font-mono">{lab.result}</div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-teal-400 font-mono">{lab.status}</span>
                      {lab.signed ? (
                        <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg font-mono">
                          <Check size={14} className="text-teal-400" /> Signed
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSignLab(lab.lab_id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors cursor-pointer"
                        >
                          Sign Off Lab
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
