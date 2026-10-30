/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  Search,
  Bed,
  Check,
  Filter,
  TrendingUp,
  BarChart2,
  X,
  Timer,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Phone,
  MapPin,
  RefreshCw,
  Droplet,
  Layers,
  Users,
  Plus,
  ClipboardList,
  CheckSquare,
  Briefcase,
  UserCheck,
} from 'lucide-react';
import { AuthUser } from '../types/auth';
import { AiHospitalAssistantLauncher } from './AiHospitalAssistantLauncher';

interface DoctorDashboardProps {
  user?: AuthUser | null;
  onLogout: () => void;
}

interface AppointmentItem {
  appointment_id: string;
  patient_id: string;
  patient_name: string;
  patient_age?: number | null;
  patient_gender?: string | null;
  patient_blood_group?: string | null;
  patient_city?: string | null;
  patient_phone?: string | null;
  date: string;
  time: string;
  type: string;
  room: string;
  status: string;
  duration_minutes?: number | null;
  chief_complaint: string;
  notes: string;
}

interface InpatientItem {
  bed: string;
  room?: string;
  bed_id?: string;
  encounter_id?: string;
  patient_name: string;
  patient_id: string;
  age: number;
  gender?: string;
  diagnosis: string;
  encounter_date?: string;
  encounter_type?: string;
  day_of_stay: number;
  acuity: string;
  vitals: string;
  plan: string;
  assigned_staff?: {
    assignment_id?: string;
    staff_id?: string;
    staff_name?: string;
    staff_role?: string;
    department?: string;
    priority?: string;
    status?: string;
    notes?: string;
  } | null;
}

interface LabItem {
  lab_id: string;
  patient_id: string;
  patient_name: string;
  test: string;
  category?: string;
  test_date?: string;
  result: string;
  status: string;
  signed: boolean;
}

interface StatusDistributionItem {
  status: string;
  count: number;
  percentage: number;
}

interface TrendItem {
  period: string;
  total: number;
  completed: number;
  scheduled: number;
  cancelled: number;
}

interface DoctorStats {
  totalAppointments: number;
  todayAppointments: number;
  completedConsultations: number;
  scheduledAppointments: number;
  inProgressAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  avgConsultationMinutes: number;
  inpatientCensus: number;
  pendingLabApprovals: number;
  avgWaitTimeMinutes: number;
  statusDistribution: StatusDistributionItem[];
  monthlyTrend: TrendItem[];
  weeklyTrend: TrendItem[];
  dailyTrend: TrendItem[];
}

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'inpatients' | 'labs' | 'assignments'>('schedule');
  const [schedule, setSchedule] = useState<AppointmentItem[]>([]);
  const [inpatients, setInpatients] = useState<InpatientItem[]>([]);
  const [labs, setLabs] = useState<LabItem[]>([]);
  const [stats, setStats] = useState<DoctorStats | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<any>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [trendView, setTrendView] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [selectedTrendPeriod, setSelectedTrendPeriod] = useState<string | null>(null);
  const [hoveredTrendItem, setHoveredTrendItem] = useState<TrendItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clinical encounter note draft
  const [encounterNote, setEncounterNote] = useState('');
  const [prescriptionNote, setPrescriptionNote] = useState('');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  const [isSavingEncounter, setIsSavingEncounter] = useState(false);

  // Staff Assignment Workflow State
  const [patientAssignments, setPatientAssignments] = useState<any[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [allDoctorAssignments, setAllDoctorAssignments] = useState<any[]>([]);
  const [isLoadingAllAssignments, setIsLoadingAllAssignments] = useState(false);
  const [staffCandidates, setStaffCandidates] = useState<any[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedAssignType, setSelectedAssignType] = useState('Nurse Check');
  const [selectedPriority, setSelectedPriority] = useState('Normal');
  const [assignmentInstructions, setAssignmentInstructions] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);
  const [assignmentSuccessNotice, setAssignmentSuccessNotice] = useState<string | null>(null);

  // Inpatient Bed & Staff Assignment State
  const [wardBeds, setWardBeds] = useState<any[]>([]);
  const [isLoadingWardBeds, setIsLoadingWardBeds] = useState(false);
  const [assigningInpatient, setAssigningInpatient] = useState<InpatientItem | null>(null);
  const [inpatientSelectedBedId, setInpatientSelectedBedId] = useState<string>('');
  const [inpatientSelectedStaffId, setInpatientSelectedStaffId] = useState<string>('');
  const [inpatientAssignType, setInpatientAssignType] = useState('Inpatient Bedside Care');
  const [inpatientPriority, setInpatientPriority] = useState<'Normal' | 'Urgent' | 'Critical'>('Normal');
  const [inpatientOrders, setInpatientOrders] = useState('');
  const [inpatientBedFilter, setInpatientBedFilter] = useState<'all' | 'available'>('available');
  const [inpatientStaffRoleFilter, setInpatientStaffRoleFilter] = useState('all');
  const [inpatientStaffSearch, setInpatientStaffSearch] = useState('');
  const [isSubmittingInpatientAssignment, setIsSubmittingInpatientAssignment] = useState(false);
  const [inpatientAssignSuccess, setInpatientAssignSuccess] = useState<string | null>(null);
  const [inpatientAssignError, setInpatientAssignError] = useState<string | null>(null);

  const loadWardBeds = async () => {
    setIsLoadingWardBeds(true);
    try {
      const token = sessionStorage.getItem('mediai_patient_auth_token');
      const res = await fetch('/api/doctor/ward-beds', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setWardBeds(data.wardBeds || []);
      }
    } catch (err) {
      console.warn('Failed to load ward beds', err);
    } finally {
      setIsLoadingWardBeds(false);
    }
  };

  const openInpatientAssignModal = (patient: InpatientItem) => {
    setAssigningInpatient(patient);
    setInpatientAssignError(null);
    setInpatientAssignSuccess(null);
    setInpatientOrders(patient.plan || 'Telemetry rhythm monitoring and regular vital sign checks.');
    setInpatientPriority(patient.acuity === 'Guarded' ? 'Urgent' : 'Normal');
    setInpatientAssignType('Inpatient Bedside Care');

    // Pre-select bed
    if (patient.bed_id) {
      setInpatientSelectedBedId(patient.bed_id);
    } else {
      const matchingBed = wardBeds.find(
        (b) => (b.room && patient.bed.includes(b.room)) || (b.bed && patient.bed.includes(b.bed))
      );
      if (matchingBed) {
        setInpatientSelectedBedId(matchingBed.id);
      } else {
        const firstAvailable = wardBeds.find((b) => b.status === 'Available');
        setInpatientSelectedBedId(firstAvailable?.id || 'BED-401');
      }
    }

    // Pre-select staff member
    if (patient.assigned_staff?.staff_id) {
      setInpatientSelectedStaffId(patient.assigned_staff.staff_id);
    } else if (staffCandidates.length > 0) {
      setInpatientSelectedStaffId(staffCandidates[0].staff_id);
    }

    loadWardBeds();
    loadStaffCandidates();
  };

  const handleConfirmInpatientAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningInpatient || !inpatientSelectedStaffId || !inpatientSelectedBedId) {
      setInpatientAssignError('Please select both a hospital ward bed and a healthcare staff member.');
      return;
    }

    setIsSubmittingInpatientAssignment(true);
    setInpatientAssignError(null);
    setInpatientAssignSuccess(null);

    try {
      const token = sessionStorage.getItem('mediai_patient_auth_token');
      const selectedBedObj = wardBeds.find((b) => b.id === inpatientSelectedBedId);
      const res = await fetch('/api/doctor/assign-staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          patientId: assigningInpatient.patient_id,
          staffId: inpatientSelectedStaffId,
          bedId: inpatientSelectedBedId,
          room: selectedBedObj?.room || undefined,
          assignmentType: inpatientAssignType,
          priority: inpatientPriority,
          notes: inpatientOrders,
          encounterId: assigningInpatient.encounter_id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to assign staff and bed to patient.');
      }

      setInpatientAssignSuccess(data.message || 'Staff member and hospital ward bed successfully assigned.');

      // Update local inpatients state immediately
      const assignedBedLabel = selectedBedObj ? `${selectedBedObj.room} · ${selectedBedObj.bed}` : assigningInpatient.bed;
      setInpatients((prev) =>
        prev.map((p) => {
          if (p.patient_id === assigningInpatient.patient_id) {
            return {
              ...p,
              bed: assignedBedLabel,
              room: selectedBedObj?.room,
              bed_id: inpatientSelectedBedId,
              assigned_staff: {
                staff_id: data.assignment.staff_id,
                staff_name: data.assignment.staff_name,
                staff_role: data.assignment.staff_role,
                department: data.assignment.department,
                priority: data.assignment.priority,
                status: data.assignment.assignment_status,
                notes: data.assignment.notes,
              },
            };
          }
          return p;
        })
      );

      // Refresh ward beds and assignments in background
      loadWardBeds();
      loadAllDoctorAssignments();

      // Close modal smoothly after brief success display
      setTimeout(() => {
        setAssigningInpatient(null);
        setInpatientAssignSuccess(null);
      }, 1500);
    } catch (err: any) {
      setInpatientAssignError(err.message || 'Failed to submit staff and bed assignment.');
    } finally {
      setIsSubmittingInpatientAssignment(false);
    }
  };

  const loadPatientAssignments = async (patientId: string) => {
    setIsLoadingAssignments(true);
    try {
      const token = sessionStorage.getItem('mediai_patient_auth_token');
      const res = await fetch(`/api/doctor/patient-assignments/${encodeURIComponent(patientId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setPatientAssignments(data.assignments || []);
      }
    } catch (err) {
      console.warn('Failed to load patient assignments', err);
    } finally {
      setIsLoadingAssignments(false);
    }
  };

  const loadAllDoctorAssignments = async () => {
    setIsLoadingAllAssignments(true);
    try {
      const token = sessionStorage.getItem('mediai_patient_auth_token');
      const res = await fetch('/api/doctor/patient-assignments/all', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setAllDoctorAssignments(data.assignments || []);
      }
    } catch (err) {
      console.warn('Failed to load all doctor assignments', err);
    } finally {
      setIsLoadingAllAssignments(false);
    }
  };

  const loadStaffCandidates = async () => {
    try {
      const token = sessionStorage.getItem('mediai_patient_auth_token');
      const res = await fetch('/api/doctor/staff-candidates', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setStaffCandidates(data.candidates || []);
        if (data.candidates?.length > 0 && !selectedStaffId) {
          setSelectedStaffId(data.candidates[0].staff_id);
        }
      }
    } catch (err) {
      console.warn('Failed to load staff candidates', err);
    }
  };

  const loadDoctorData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

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
        setStats(data.stats || null);

        // Auto-select first appointment if nothing selected
        if (data.schedule && data.schedule.length > 0) {
          setSelectedAppointment((prev) => {
            if (prev) {
              const stillExists = data.schedule.find((s: AppointmentItem) => s.appointment_id === prev.appointment_id);
              if (stillExists) return stillExists;
            }
            return data.schedule[0];
          });
          setEncounterNote((prev) => prev || data.schedule[0].notes || '');
        }
      } else {
        setError(data.message || 'Failed to load doctor clinical records.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to hospital clinical services.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDoctorData();
    loadStaffCandidates();
    loadAllDoctorAssignments();
    loadWardBeds();
  }, []);

  useEffect(() => {
    if (selectedAppointment?.patient_id) {
      loadPatientAssignments(selectedAppointment.patient_id);
    }
  }, [selectedAppointment?.patient_id]);

  const handleSelectAppointment = (apt: AppointmentItem) => {
    setSelectedAppointment(apt);
    setEncounterNote(apt.notes || '');
    setPrescriptionNote('');
    setSaveSuccessNotice(null);
    setAssignmentSuccessNotice(null);
  };

  const handleAssignStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment || !selectedStaffId) return;

    setIsSubmittingAssignment(true);
    try {
      const token = sessionStorage.getItem('mediai_patient_auth_token');
      const res = await fetch('/api/doctor/assign-staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          patientId: selectedAppointment.patient_id,
          staffId: selectedStaffId,
          assignmentType: selectedAssignType,
          priority: selectedPriority,
          notes: assignmentInstructions,
          appointmentId: selectedAppointment.appointment_id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAssignmentSuccessNotice(data.message || 'Staff member assigned successfully.');
        setIsAssignModalOpen(false);
        setAssignmentInstructions('');
        loadPatientAssignments(selectedAppointment.patient_id);
        loadAllDoctorAssignments();
        setTimeout(() => setAssignmentSuccessNotice(null), 4500);
      } else {
        alert(data.error || 'Failed to assign staff.');
      }
    } catch (err: any) {
      alert(`Failed to assign staff: ${err?.message || 'Network error'}`);
    } finally {
      setIsSubmittingAssignment(false);
    }
  };

  const handleSaveEncounter = async () => {
    if (!selectedAppointment) return;
    setIsSavingEncounter(true);

    try {
      const token = sessionStorage.getItem('mediai_patient_auth_token');
      const res = await fetch('/api/doctor/encounter', {
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

      const resData = await res.json();
      if (resData.success) {
        setSchedule((prev) =>
          prev.map((item) =>
            item.appointment_id === selectedAppointment.appointment_id
              ? { ...item, status: 'Completed', notes: encounterNote }
              : item
          )
        );

        setSelectedAppointment((prev) => (prev ? { ...prev, status: 'Completed', notes: encounterNote } : null));
        setSaveSuccessNotice('Encounter signed and updated in electronic medical record.');
        setTimeout(() => setSaveSuccessNotice(null), 4000);
        // Refresh statistics silently
        loadDoctorData(true);
      } else {
        alert(resData.message || 'Failed to sign encounter.');
      }
    } catch (err: any) {
      alert(`Error saving encounter: ${err.message || 'Connection error'}`);
    } finally {
      setIsSavingEncounter(false);
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
        prev.map((item) => (item.lab_id === labId ? { ...item, signed: true, status: 'Signed' } : item))
      );
      loadDoctorData(true);
    } catch {
      // ignore
    }
  };

  // Filter schedule based on search term, status filter (from dropdown or chart bar), and trend period
  const filteredSchedule = useMemo(() => {
    return schedule.filter((apt) => {
      // 1. Search filter
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        apt.patient_name.toLowerCase().includes(term) ||
        apt.patient_id.toLowerCase().includes(term) ||
        apt.chief_complaint.toLowerCase().includes(term) ||
        apt.room.toLowerCase().includes(term) ||
        (apt.patient_city && apt.patient_city.toLowerCase().includes(term));

      // 2. Status filter
      const matchesStatus =
        filterStatus === 'all' ||
        apt.status.toLowerCase() === filterStatus.toLowerCase();

      // 3. Trend period filter
      let matchesPeriod = true;
      if (selectedTrendPeriod) {
        if (trendView === 'monthly') {
          matchesPeriod = apt.date.startsWith(selectedTrendPeriod);
        } else if (trendView === 'daily') {
          matchesPeriod = apt.date === selectedTrendPeriod;
        } else if (trendView === 'weekly') {
          // Check week match
          const d = new Date(apt.date);
          const startOfYear = new Date(d.getFullYear(), 0, 1);
          const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
          const weekKey = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
          matchesPeriod = weekKey === selectedTrendPeriod;
        }
      }

      return matchesSearch && matchesStatus && matchesPeriod;
    });
  }, [schedule, searchTerm, filterStatus, selectedTrendPeriod, trendView]);

  // Active trend series based on toggle
  const activeTrendData: TrendItem[] = useMemo(() => {
    if (!stats) return [];
    if (trendView === 'daily') return stats.dailyTrend || [];
    if (trendView === 'weekly') return stats.weeklyTrend || [];
    return stats.monthlyTrend || [];
  }, [stats, trendView]);

  // Max value for SVG trend chart scaling
  const maxTrendVal = useMemo(() => {
    if (activeTrendData.length === 0) return 10;
    const max = Math.max(...activeTrendData.map((d) => d.total));
    return max > 0 ? max : 10;
  }, [activeTrendData]);

  // Filtered ward beds for inpatient assignment modal
  const filteredWardBeds = useMemo(() => {
    if (inpatientBedFilter === 'available') {
      return wardBeds.filter((b) => b.status === 'Available' || b.id === inpatientSelectedBedId);
    }
    return wardBeds;
  }, [wardBeds, inpatientBedFilter, inpatientSelectedBedId]);

  // Filtered staff candidates for inpatient assignment modal
  const filteredInpatientStaff = useMemo(() => {
    return staffCandidates.filter((s) => {
      const matchesRole =
        inpatientStaffRoleFilter === 'all' ||
        s.role.toLowerCase().includes(inpatientStaffRoleFilter.toLowerCase()) ||
        s.department.toLowerCase().includes(inpatientStaffRoleFilter.toLowerCase());
      const term = inpatientStaffSearch.toLowerCase().trim();
      const matchesSearch =
        !term ||
        s.staff_name.toLowerCase().includes(term) ||
        s.staff_id.toLowerCase().includes(term) ||
        s.role.toLowerCase().includes(term) ||
        s.department.toLowerCase().includes(term);
      return matchesRole && matchesSearch;
    });
  }, [staffCandidates, inpatientStaffRoleFilter, inpatientStaffSearch]);

  // Status color mapper
  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'completed') return { text: 'text-teal-400', bg: 'bg-teal-500/15', border: 'border-teal-500/30', fill: '#14b8a6' };
    if (s === 'scheduled' || s === 'confirmed') return { text: 'text-sky-400', bg: 'bg-sky-500/15', border: 'border-sky-500/30', fill: '#0284c7' };
    if (s === 'in-progress') return { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', fill: '#f59e0b' };
    if (s === 'no show') return { text: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/30', fill: '#8b5cf6' };
    if (s === 'cancelled') return { text: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/30', fill: '#ef4444' };
    return { text: 'text-slate-400', bg: 'bg-slate-800', border: 'border-slate-700', fill: '#64748b' };
  };

  const handleStatusFilterClick = (statusName: string) => {
    if (filterStatus.toLowerCase() === statusName.toLowerCase()) {
      setFilterStatus('all');
    } else {
      setFilterStatus(statusName);
    }
  };

  const handleTrendPeriodClick = (period: string) => {
    if (selectedTrendPeriod === period) {
      setSelectedTrendPeriod(null);
    } else {
      setSelectedTrendPeriod(period);
    }
  };

  const clearAllFilters = () => {
    setFilterStatus('all');
    setSelectedTrendPeriod(null);
    setSearchTerm('');
  };

  const isAnyFilterActive = filterStatus !== 'all' || selectedTrendPeriod !== null || searchTerm.trim().length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500/30 selection:text-teal-200">
      {/* Top Clinical Portal Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Wordmark & Specialty */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-sm shadow-teal-500/10">
              <Stethoscope size={18} />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white whitespace-nowrap">
                MediAI <span className="text-teal-400 font-semibold">· Clinical Portal</span>
              </div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap">
                {doctorProfile?.department || 'Cardiovascular Specialty Institute'}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'schedule'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Consultations & Schedule ({schedule.length})
            </button>
            <button
              onClick={() => setActiveTab('inpatients')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'inpatients'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Inpatient Rounds ({inpatients.length})
            </button>
            <button
              onClick={() => setActiveTab('labs')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'labs'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Diagnostic Labs {stats?.pendingLabApprovals ? `(${stats.pendingLabApprovals})` : ''}
            </button>
            <button
              onClick={() => {
                setActiveTab('assignments');
                loadAllDoctorAssignments();
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'assignments'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Staff Assignments {allDoctorAssignments.length > 0 ? `(${allDoctorAssignments.length})` : ''}
            </button>
          </nav>

          {/* Doctor Profile, Refresh & Sign Out */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => loadDoctorData(true)}
              disabled={isRefreshing}
              title="Refresh live clinical data"
              className="p-2 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-teal-300 transition-colors cursor-pointer"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-teal-400' : ''} />
            </button>

            <div className="hidden sm:block text-right">
              <div className="text-xs font-medium text-white truncate max-w-[160px]">
                {doctorProfile?.name || user?.name || 'Dr. Physician'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {doctorProfile?.doctor_id || user?.doctor_id || 'DOC-MED'}
              </div>
            </div>

            {/* Verified Institutional Role Badge */}
            <div
              className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg border border-teal-500/30 bg-teal-950/40 text-xs font-medium text-slate-200 shrink-0 select-none shadow-xs"
              title="Verified Role: Attending Physician"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
              <span className="text-slate-400 hidden sm:inline">Role:</span>
              <span className="text-teal-300 font-semibold">Doctor</span>
            </div>

            <button
              onClick={onLogout}
              className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Sign Out of Doctor Workspace"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Clinical Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Loading Skeleton */}
        {isLoading && (
          <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-3">
            <RefreshCw size={24} className="animate-spin text-teal-400 mx-auto" />
            <p className="text-xs text-slate-400">Loading authenticated clinical records and Power BI analytics...</p>
          </div>
        )}

        {/* Error Notice */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-3">
            <AlertCircle size={18} className="text-rose-400 shrink-0" />
            <div className="flex-1">
              <span className="font-semibold block">Clinical Synchronization Alert</span>
              <p className="text-slate-300">{error}</p>
            </div>
            <button
              onClick={() => loadDoctorData()}
              className="px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-medium cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Success toast */}
        {saveSuccessNotice && (
          <div className="p-3.5 rounded-xl bg-teal-950/60 border border-teal-500/40 text-xs text-teal-200 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-teal-400 shrink-0" />
            <span>{saveSuccessNotice}</span>
          </div>
        )}

        {/* Modern Power BI-Inspired KPI Metric Cards */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* KPI 1: Today's Appointments */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Today's Visits</span>
              <Calendar size={14} className="text-teal-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono tabular-nums">
              {stats?.todayAppointments ?? 0}
            </div>
            <div className="text-[11px] text-teal-400 mt-1 flex items-center gap-1 truncate font-mono">
              <span>{stats?.scheduledAppointments ?? 0}</span>
              <span className="text-slate-500 font-sans">scheduled in queue</span>
            </div>
          </div>

          {/* KPI 2: Completed Consultations */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Completed</span>
              <CheckCircle2 size={14} className="text-teal-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono tabular-nums">
              {stats?.completedConsultations ?? 0}
            </div>
            <div className="text-[11px] text-teal-400 mt-1 flex items-center gap-1 truncate font-mono">
              <span>
                {Math.round(((stats?.completedConsultations ?? 0) / (stats?.totalAppointments || 1)) * 100)}%
              </span>
              <span className="text-slate-500 font-sans">completion rate</span>
            </div>
          </div>

          {/* KPI 3: Avg Consultation Duration */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Consult Duration</span>
              <Timer size={14} className="text-teal-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono tabular-nums">
              {stats?.avgConsultationMinutes ? `${stats.avgConsultationMinutes}` : '26'}{' '}
              <span className="text-xs font-normal text-slate-400 font-sans">min</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              Electronic Chart Average
            </div>
          </div>

          {/* KPI 4: Inpatient Census */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Inpatient Census</span>
              <Bed size={14} className="text-teal-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono tabular-nums">
              {stats?.inpatientCensus ?? inpatients.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              Active Telemetry Beds
            </div>
          </div>

          {/* KPI 5: Pending Lab Sign-offs */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Pending Labs</span>
              <FileText size={14} className="text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400 font-mono tabular-nums">
              {stats?.pendingLabApprovals ?? labs.filter((l) => !l.signed).length}
            </div>
            <div className="text-[11px] text-amber-400/80 mt-1 truncate">
              {(stats?.pendingLabApprovals || 0) > 0 ? 'Requires Sign-Off' : 'All Verified'}
            </div>
          </div>
        </section>

        {/* Power BI Interactive Analytics Row: Appointment Trend & Status Distribution Charts */}
        {activeTab === 'schedule' && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Chart 1: Interactive Appointment Trend Chart (Daily / Weekly / Monthly views) */}
            <div className="lg:col-span-7 bg-slate-900/70 rounded-2xl border border-slate-800/80 p-5 flex flex-col justify-between shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-teal-400" />
                    <h3 className="text-sm font-bold text-white tracking-tight">Appointment Volume & Completion Trend</h3>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Select any period to filter the patient list below.
                  </p>
                </div>

                {/* Granularity Controls */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setTrendView('daily');
                      setSelectedTrendPeriod(null);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                      trendView === 'daily'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTrendView('weekly');
                      setSelectedTrendPeriod(null);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                      trendView === 'weekly'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTrendView('monthly');
                      setSelectedTrendPeriod(null);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                      trendView === 'monthly'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Monthly
                  </button>
                </div>
              </div>

              {/* Chart Canvas Area */}
              <div className="pt-4 flex-1 flex flex-col justify-end">
                {activeTrendData.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    No historical trend series recorded yet for this view.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Trend SVG Visualizer */}
                    <div className="relative h-44 w-full flex items-end gap-1.5 sm:gap-2 px-1 pt-6">
                      {activeTrendData.map((item) => {
                        const heightPct = Math.max(8, Math.round((item.total / maxTrendVal) * 100));
                        const completedPct = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;
                        const isSelected = selectedTrendPeriod === item.period;

                        return (
                          <div
                            key={item.period}
                            onClick={() => handleTrendPeriodClick(item.period)}
                            onMouseEnter={() => setHoveredTrendItem(item)}
                            onMouseLeave={() => setHoveredTrendItem(null)}
                            className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer relative"
                          >
                            {/* Bar Stack */}
                            <div
                              style={{ height: `${heightPct}%` }}
                              className={`w-full rounded-t-md transition-all flex flex-col justify-end overflow-hidden ${
                                isSelected
                                  ? 'ring-2 ring-teal-400 bg-teal-500/30'
                                  : 'bg-slate-800/80 hover:bg-slate-800 group-hover:scale-y-[1.02]'
                              }`}
                            >
                              {/* Completed portion (teal) */}
                              <div
                                style={{ height: `${completedPct}%` }}
                                className="w-full bg-gradient-to-t from-teal-600 to-teal-400/90 transition-all"
                              />
                            </div>

                            {/* Label */}
                            <span className="text-[10px] text-slate-400 font-mono mt-2 truncate w-full text-center">
                              {trendView === 'monthly'
                                ? item.period.slice(5) // MM
                                : trendView === 'daily'
                                ? item.period.slice(5) // MM-DD
                                : item.period.split('-')[1]}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Chart Legend & Selected Period Indicator */}
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm bg-teal-400 inline-block" />
                          <span>Completed Consultations</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm bg-slate-700 inline-block" />
                          <span>Scheduled / Other</span>
                        </div>
                      </div>

                      {hoveredTrendItem && (
                        <div className="text-teal-300 font-mono text-[11px]">
                          {hoveredTrendItem.period}: {hoveredTrendItem.total} visits ({hoveredTrendItem.completed} completed)
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Chart 2: Horizontal Bar Chart showing Appointment Status Distribution */}
            <div className="lg:col-span-5 bg-slate-900/70 rounded-2xl border border-slate-800/80 p-5 flex flex-col justify-between shadow-xs">
              <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <BarChart2 size={16} className="text-teal-400" />
                    <h3 className="text-sm font-bold text-white tracking-tight">Status Distribution</h3>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click any status to filter the appointment queue.
                  </p>
                </div>
                {filterStatus !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setFilterStatus('all')}
                    className="text-[11px] text-teal-400 hover:text-teal-300 font-medium cursor-pointer"
                  >
                    Reset Filter
                  </button>
                )}
              </div>

              {/* Horizontal Bars */}
              <div className="pt-3 space-y-2.5 flex-1 flex flex-col justify-center">
                {(!stats?.statusDistribution || stats.statusDistribution.length === 0) ? (
                  <div className="text-center py-8 text-xs text-slate-500">
                    No status distribution available.
                  </div>
                ) : (
                  stats.statusDistribution.map((item) => {
                    const isSelected = filterStatus.toLowerCase() === item.status.toLowerCase();
                    const color = getStatusColor(item.status);

                    return (
                      <div
                        key={item.status}
                        onClick={() => handleStatusFilterClick(item.status)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-800/90 border-teal-500/60 ring-1 ring-teal-500/40 shadow-xs'
                            : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: color.fill }}
                            />
                            <span className="font-medium text-slate-200">{item.status}</span>
                          </div>
                          <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                            {item.count} <span className="text-slate-500">({item.percentage}%)</span>
                          </span>
                        </div>

                        {/* Bar */}
                        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                          <div
                            style={{
                              width: `${item.percentage}%`,
                              backgroundColor: color.fill,
                            }}
                            className="h-full rounded-full transition-all duration-300"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        )}

        {/* Tab 1: Enhanced Schedule Queue & Clinical Encounter Documentation */}
        {activeTab === 'schedule' && (
          <section className="space-y-4">
            {/* Active Filter Bar if filtered */}
            {isAnyFilterActive && (
              <div className="p-3 rounded-xl bg-teal-950/40 border border-teal-500/30 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-teal-400 font-semibold flex items-center gap-1">
                    <Filter size={13} /> Active Filters:
                  </span>
                  {filterStatus !== 'all' && (
                    <span className="px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-200 border border-teal-500/30 text-[11px] font-mono">
                      Status: {filterStatus}
                    </span>
                  )}
                  {selectedTrendPeriod && (
                    <span className="px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-200 border border-teal-500/30 text-[11px] font-mono">
                      Period: {selectedTrendPeriod}
                    </span>
                  )}
                  {searchTerm && (
                    <span className="px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-200 border border-teal-500/30 text-[11px]">
                      Search: "{searchTerm}"
                    </span>
                  )}
                  <span className="text-slate-400 text-[11px]">
                    · Showing {filteredSchedule.length} of {schedule.length} visits
                  </span>
                </div>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 text-[11px] text-teal-300 hover:text-white font-medium cursor-pointer"
                >
                  <X size={13} /> Clear all filters
                </button>
              </div>
            )}

            {/* Split Viewport: Patient Queue on Left, Encounter Notes & Chart on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Patient Queue (5 cols on lg) */}
              <div className="lg:col-span-5 space-y-3.5">
                {/* Search & Quick Status Filter Strip */}
                <div className="flex items-center justify-between gap-2.5">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-3 text-slate-500" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search patient, MRN, complaint, city..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
                    />
                  </div>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-slate-900 border border-slate-800 text-xs rounded-xl px-2.5 py-2 text-slate-300 focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="all">All Statuses ({schedule.length})</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="in-progress">In-Progress</option>
                    <option value="completed">Completed</option>
                    <option value="no show">No Show</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Queue Cards List */}
                <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
                  {filteredSchedule.map((apt) => {
                    const isSelected = selectedAppointment?.appointment_id === apt.appointment_id;
                    const statusColor = getStatusColor(apt.status);

                    return (
                      <div
                        key={apt.appointment_id}
                        onClick={() => handleSelectAppointment(apt)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 border-teal-500/70 ring-2 ring-teal-500/30 shadow-md'
                            : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                        }`}
                      >
                        {/* Header: Time, Patient Name & Status */}
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono tabular-nums text-teal-400 font-semibold">
                              {apt.time}
                            </span>
                            <span className="text-xs text-slate-600">·</span>
                            <span className="text-xs font-bold text-white tracking-tight">
                              {apt.patient_name}
                            </span>
                            {apt.patient_age && (
                              <span className="text-[11px] text-slate-400">
                                ({apt.patient_age}y{apt.patient_gender ? `, ${apt.patient_gender.charAt(0)}` : ''})
                              </span>
                            )}
                          </div>

                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-mono border ${statusColor.text} ${statusColor.bg} ${statusColor.border}`}
                          >
                            {apt.status}
                          </span>
                        </div>

                        {/* Chief complaint preview */}
                        <div className="text-xs text-slate-400 line-clamp-1 mb-2 font-normal">
                          {apt.chief_complaint}
                        </div>

                        {/* Footer: MRN, Date, Room, Duration */}
                        <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/60 pt-1.5 font-mono">
                          <span className="text-teal-400/90">{apt.patient_id}</span>
                          <div className="flex items-center gap-2">
                            <span>{apt.date}</span>
                            <span>·</span>
                            <span>{apt.room}</span>
                            {apt.duration_minutes && (
                              <>
                                <span>·</span>
                                <span className="text-teal-400">{apt.duration_minutes}m</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {filteredSchedule.length === 0 && (
                    <div className="text-center py-12 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-500 space-y-2">
                      <p>No appointments match the selected criteria.</p>
                      {isAnyFilterActive && (
                        <button
                          type="button"
                          onClick={clearAllFilters}
                          className="text-teal-400 hover:underline cursor-pointer"
                        >
                          Clear active filters
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Selected Patient Clinical Consultation Panel (7 cols on lg) */}
              <div className="lg:col-span-7 bg-slate-900/70 rounded-2xl border border-slate-800/80 p-5 space-y-5 shadow-xs">
                {selectedAppointment ? (
                  <>
                    {/* Patient Header Banner */}
                    <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <h2 className="text-lg font-bold text-white tracking-tight">
                            {selectedAppointment.patient_name}
                          </h2>
                          <span className="text-xs font-mono text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20 font-semibold">
                            {selectedAppointment.patient_id}
                          </span>
                          {selectedAppointment.patient_blood_group && (
                            <span className="text-[10px] text-rose-300 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 flex items-center gap-1 font-mono">
                              <Droplet size={10} className="text-rose-400" />
                              {selectedAppointment.patient_blood_group}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                          <span>{selectedAppointment.type}</span>
                          <span>·</span>
                          <span className="font-mono">{selectedAppointment.date} at {selectedAppointment.time}</span>
                          <span>·</span>
                          <span>{selectedAppointment.room}</span>
                          {selectedAppointment.patient_city && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <MapPin size={11} className="text-slate-500" />
                                {selectedAppointment.patient_city}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <span className="text-[11px] text-slate-500 block">Appointment ID</span>
                        <span className="text-xs font-mono text-slate-300">{selectedAppointment.appointment_id}</span>
                        <div className="mt-1">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-mono border ${getStatusColor(selectedAppointment.status).text} ${getStatusColor(selectedAppointment.status).bg} ${getStatusColor(selectedAppointment.status).border}`}
                          >
                            {selectedAppointment.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Chief Complaint & Triage Presentation Callout */}
                    <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                        Chief Complaint & Triage Presentation
                      </span>
                      <p className="text-xs text-slate-200 leading-relaxed font-sans">
                        {selectedAppointment.chief_complaint || 'Regular clinical consultation.'}
                      </p>
                    </div>

                    {/* Assigned Clinical Care Team & Delegated Staff Tasks */}
                    <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800/90 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users size={15} className="text-teal-400" />
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                            Assigned Care Team & Delegated Staff
                          </h4>
                          <span className="text-[10px] font-mono text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                            {patientAssignments.length}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsAssignModalOpen((prev) => !prev)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 transition-all cursor-pointer shadow-2xs"
                        >
                          <Plus size={13} />
                          <span>{isAssignModalOpen ? 'Close Form' : 'Assign Staff'}</span>
                        </button>
                      </div>

                      {assignmentSuccessNotice && (
                        <div className="p-2.5 rounded-lg bg-teal-950/60 border border-teal-500/30 text-teal-300 text-xs flex items-center gap-2 animate-fadeIn">
                          <CheckCircle2 size={14} className="text-teal-400 shrink-0" />
                          <span>{assignmentSuccessNotice}</span>
                        </div>
                      )}

                      {/* Staff Assignment Drawer / Form */}
                      {isAssignModalOpen && (
                        <form onSubmit={handleAssignStaff} className="p-3.5 rounded-xl bg-slate-900 border border-teal-500/30 space-y-3 animate-fadeIn">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              <Briefcase size={13} className="text-teal-400" />
                              Delegate Clinical or Ward Task
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Patient: {selectedAppointment.patient_name} ({selectedAppointment.patient_id})
                            </span>
                          </div>

                          {/* Filter by Department and Role */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                                Filter by Department
                              </label>
                              <select
                                value={deptFilter}
                                onChange={(e) => setDeptFilter(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-sans"
                              >
                                <option value="all">All Departments ({staffCandidates.length} staff)</option>
                                <option value="Emergency">Emergency</option>
                                <option value="Gastroenterology">Gastroenterology</option>
                                <option value="Pulmonology">Pulmonology</option>
                                <option value="Cardiology">Cardiology</option>
                                <option value="General Ward">General Ward / Inpatient</option>
                                <option value="Pathology">Pathology / Labs</option>
                                <option value="Radiology">Radiology</option>
                                <option value="Pharmacy">Pharmacy</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                                Filter by Role
                              </label>
                              <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-sans"
                              >
                                <option value="all">All Clinical Roles</option>
                                <option value="Nurse">Nurses (Staff / Head / Senior)</option>
                                <option value="Ward Coordinator">Ward Coordinators</option>
                                <option value="Patient Care">Patient Care Assistants</option>
                                <option value="Emergency Care">Emergency Care Assistants</option>
                                <option value="Technician">Technicians (Lab / CT / X-Ray)</option>
                                <option value="Pharmacist">Pharmacists</option>
                              </select>
                            </div>
                          </div>

                          {/* Staff Selection Dropdown */}
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                              Select Available Staff Member *
                            </label>
                            <select
                              value={selectedStaffId}
                              onChange={(e) => setSelectedStaffId(e.target.value)}
                              required
                              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-teal-500/40 text-xs text-white focus:outline-none focus:border-teal-400 font-sans"
                            >
                              {staffCandidates
                                .filter((s) => {
                                  const matchDept = deptFilter === 'all' || (s.department && s.department.toLowerCase().includes(deptFilter.toLowerCase()));
                                  const matchRole = roleFilter === 'all' || (s.role && s.role.toLowerCase().includes(roleFilter.toLowerCase()));
                                  return matchDept && matchRole;
                                })
                                .slice(0, 40)
                                .map((s) => (
                                  <option key={s.staff_id} value={s.staff_id}>
                                    {s.staff_name} — {s.role} ({s.department || 'Ward'}{s.shift ? ` · ${s.shift}` : ''}) [{s.staff_id}]
                                  </option>
                                ))}
                            </select>
                          </div>

                          {/* Assignment Type & Priority */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                                Assignment Type *
                              </label>
                              <select
                                value={selectedAssignType}
                                onChange={(e) => setSelectedAssignType(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-teal-500 font-sans"
                              >
                                <option value="Nurse Check">Nurse Check & Vitals</option>
                                <option value="Medication Administration">Medication Administration</option>
                                <option value="Ward Monitoring">Ward Monitoring & Rounds</option>
                                <option value="Discharge Assistance">Discharge Assistance</option>
                                <option value="Sample Collection">Diagnostic Sample Collection</option>
                                <option value="Doctor Assistance">Doctor Procedural Assistance</option>
                                <option value="Patient Assistance">Patient Care & Ambulation</option>
                                <option value="Emergency Support">Emergency Support</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                                Priority Level *
                              </label>
                              <select
                                value={selectedPriority}
                                onChange={(e) => setSelectedPriority(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-teal-500 font-sans"
                              >
                                <option value="Normal">Normal</option>
                                <option value="High">High</option>
                                <option value="Urgent">Urgent</option>
                                <option value="Critical">Critical</option>
                              </select>
                            </div>
                          </div>

                          {/* Directives / Instructions */}
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                              Clinical Instructions & Directives
                            </label>
                            <textarea
                              rows={2}
                              value={assignmentInstructions}
                              onChange={(e) => setAssignmentInstructions(e.target.value)}
                              placeholder="e.g. Check blood pressure every 2 hours, monitor telemetry, assist patient with post-consultation ambulation..."
                              className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 font-sans"
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                            <button
                              type="button"
                              onClick={() => setIsAssignModalOpen(false)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isSubmittingAssignment || !selectedStaffId}
                              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-all cursor-pointer disabled:opacity-50"
                            >
                              {isSubmittingAssignment ? (
                                <>
                                  <RefreshCw size={12} className="animate-spin" />
                                  <span>Assigning...</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck size={13} />
                                  <span>Confirm Staff Assignment</span>
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Existing Assignments for Patient */}
                      {isLoadingAssignments ? (
                        <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                          <RefreshCw size={12} className="animate-spin text-teal-400" />
                          <span>Checking patient care team in database...</span>
                        </div>
                      ) : patientAssignments.length === 0 ? (
                        <div className="py-3 px-3.5 rounded-lg bg-slate-900/50 border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                          <span>No hospital staff currently assigned to this patient.</span>
                          <span className="text-[10px] text-teal-400/80">Click 'Assign Staff' above to delegate.</span>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {patientAssignments.map((asn) => {
                            const isUrgent = asn.priority === 'Urgent' || asn.priority === 'Critical';
                            return (
                              <div
                                key={asn.assignment_id}
                                className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                              >
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-white truncate">{asn.staff_name}</span>
                                    <span className="text-[10px] text-teal-300 font-mono bg-teal-500/10 px-1.5 py-0.2 rounded border border-teal-500/20">
                                      {asn.staff_role}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      {asn.department}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-300">
                                    <strong className="text-teal-400">{asn.assignment_type}</strong>
                                    {asn.notes && <span className="text-slate-400"> — {asn.notes}</span>}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    Assigned: {asn.assignment_date} {asn.start_time ? `at ${asn.start_time.slice(0, 5)}` : ''} · ID: {asn.assignment_id}
                                  </div>
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
                                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                        : asn.assignment_status === 'In Progress'
                                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                        : 'bg-teal-500/10 text-teal-300 border-teal-500/20'
                                    }`}
                                  >
                                    {asn.assignment_status}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Clinical Encounter Documentation */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
                        <span>Physician Encounter Notes & Objective Findings</span>
                        <span className="text-[10px] text-slate-500 font-normal">Stored in silver_encounters</span>
                      </label>
                      <textarea
                        rows={5}
                        value={encounterNote}
                        onChange={(e) => setEncounterNote(e.target.value)}
                        placeholder="Document physical examination findings, cardiovascular sounds, ECG rhythm interpretation, clinical assessment, and treatment plan..."
                        className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 font-sans leading-relaxed transition-colors"
                      />
                    </div>

                    {/* Prescription Order Form */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Pill size={14} className="text-teal-400" />
                          <span>E-Prescription & In-Hospital Pharmacy Order</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal">Stored in silver_prescriptions</span>
                      </label>
                      <input
                        type="text"
                        value={prescriptionNote}
                        onChange={(e) => setPrescriptionNote(e.target.value)}
                        placeholder="e.g. Atorvastatin 20mg PO QHS (30-day supply) / Lisinopril 10mg daily"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
                      />
                    </div>

                    {/* Action Bar */}
                    <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-800">
                      <span className="text-[11px] text-slate-500">
                        Signed as {doctorProfile?.name || user?.name || 'Dr. Attending Physician'} ({doctorProfile?.license || doctorProfile?.doctor_id || 'Staff'})
                      </span>

                      <button
                        type="button"
                        onClick={handleSaveEncounter}
                        disabled={isSavingEncounter}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-all cursor-pointer shadow-sm hover:shadow-teal-500/20 disabled:opacity-50"
                      >
                        {isSavingEncounter ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Signing & Syncing...</span>
                          </>
                        ) : (
                          <>
                            <Check size={14} />
                            <span>Sign & Finalize Encounter</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-20 text-xs text-slate-500 space-y-2">
                    <User size={24} className="mx-auto text-slate-600" />
                    <p>Select an appointment from the queue to view records or document consultation notes.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Tab 2: Inpatient Rounds */}
        {activeTab === 'inpatients' && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <Bed size={16} className="text-teal-400" />
                  <span>Cardiovascular Inpatient Unit & Bed Management</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Authoritative telemetry beds, physician rounds, and bedside staff assignments from <code className="text-teal-400 font-mono">silver_encounters</code> and <code className="text-teal-400 font-mono">silver_staff_assignment</code>.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-lg border border-teal-500/20 font-semibold">
                  {inpatients.length} Inpatients
                </span>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-semibold">
                  {wardBeds.filter((b) => b.status === 'Available').length} Beds Free
                </span>
                <button
                  type="button"
                  onClick={() => {
                    loadDoctorData(true);
                    loadWardBeds();
                    loadAllDoctorAssignments();
                  }}
                  disabled={isLoadingWardBeds}
                  className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Reload ward and inpatient data"
                >
                  <RefreshCw size={13} className={isLoadingWardBeds ? 'animate-spin text-teal-400' : ''} />
                </button>
              </div>
            </div>

            {inpatients.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs">
                No active inpatient admissions currently assigned to your clinical service.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inpatients.map((patient, idx) => {
                  const hasAssignedStaff = !!patient.assigned_staff?.staff_name;
                  const cardKey = patient.encounter_id || `inpatient-${patient.patient_id}-${patient.bed_id || idx}`;
                  return (
                    <div
                      key={cardKey}
                      className="p-4.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all space-y-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold text-teal-300 bg-slate-950 px-2.5 py-1 rounded border border-teal-500/30 flex items-center gap-1.5">
                              <Bed size={13} className="text-teal-400" />
                              <span>{patient.bed}</span>
                            </span>
                            <h4 className="text-sm font-bold text-white">{patient.patient_name}</h4>
                            <span className="text-xs text-slate-500">({patient.age}y {patient.gender || ''})</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 font-mono">
                            MRN: {patient.patient_id} · Day of stay: {patient.day_of_stay}
                            {patient.room && <span className="text-slate-500"> · {patient.room}</span>}
                          </div>
                        </div>

                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono shrink-0 ${
                            patient.acuity === 'Stable'
                              ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                              : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          }`}
                        >
                          {patient.acuity}
                        </span>
                      </div>

                      <div className="text-xs text-slate-300 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80">
                        <span className="text-[10px] text-slate-500 uppercase block mb-0.5 font-semibold">Primary Diagnosis</span>
                        {patient.diagnosis}
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                        <span>{patient.vitals}</span>
                        {patient.encounter_date && <span>Admitted: {patient.encounter_date}</span>}
                      </div>

                      <div className="text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                        <span className="text-[10px] text-teal-400 block font-semibold mb-0.5">Care Plan</span>
                        {patient.plan}
                      </div>

                      {/* Real Staff Assignment & Room/Bed Card */}
                      {hasAssignedStaff && patient.assigned_staff ? (
                        <div className="p-3 rounded-lg bg-slate-950/90 border border-teal-500/30 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[10px] text-teal-400 font-mono uppercase font-semibold flex items-center gap-1.5">
                              <UserCheck size={13} className="text-teal-400" />
                              <span>Assigned Bedside Care</span>
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                                patient.assigned_staff.priority === 'Urgent' || patient.assigned_staff.priority === 'Critical'
                                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                                  : 'bg-teal-500/10 text-teal-300 border-teal-500/20'
                              }`}
                            >
                              {patient.assigned_staff.priority || 'Normal'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-xs font-bold text-white">{patient.assigned_staff.staff_name}</div>
                              <div className="text-[11px] text-slate-400">
                                {patient.assigned_staff.staff_role} · {patient.assigned_staff.department}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => openInpatientAssignModal(patient)}
                              className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-teal-500/40 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                            >
                              <Bed size={12} />
                              <span>Change Bed / Staff</span>
                            </button>
                          </div>

                          {patient.assigned_staff.notes && (
                            <div className="text-[11px] text-slate-300 font-sans border-t border-slate-800/80 pt-1.5 line-clamp-2">
                              <span className="text-slate-500 font-mono text-[10px]">Orders: </span>
                              {patient.assigned_staff.notes}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-slate-950/60 border border-dashed border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="text-xs text-slate-400 flex items-center gap-2">
                            <AlertCircle size={14} className="text-slate-500 shrink-0" />
                            <span>No dedicated bedside staff assigned to this inpatient.</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => openInpatientAssignModal(patient)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors cursor-pointer flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
                          >
                            <UserCheck size={13} />
                            <span>Assign Staff & Bed</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Tab 3: Diagnostic Labs */}
        {activeTab === 'labs' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Laboratory Orders & Telemetry Approvals</h3>
                <p className="text-xs text-slate-400">Review critical diagnostics and apply physician electronic sign-off.</p>
              </div>
            </div>

            {labs.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs">
                No diagnostic laboratory results pending physician review at this time.
              </div>
            ) : (
              <div className="space-y-3">
                {labs.map((lab) => (
                  <div
                    key={lab.lab_id}
                    className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-400">{lab.lab_id}</span>
                        <span className="text-xs font-bold text-white">{lab.patient_name}</span>
                        <span className="text-[11px] font-mono text-teal-400">({lab.patient_id})</span>
                        {lab.test_date && (
                          <span className="text-[10px] text-slate-500 font-mono">· {lab.test_date}</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-300 font-medium">
                        {lab.test} <span className="text-[11px] text-slate-500 font-normal">({lab.category || 'Clinical Pathology'})</span>
                      </div>
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
                          type="button"
                          onClick={() => handleSignLab(lab.lab_id)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors cursor-pointer"
                        >
                          Sign Off Lab
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab 4: Patient Staff Assignments & Delegated Orders */}
        {activeTab === 'assignments' && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <Users size={16} className="text-teal-400" />
                  <span>Physician Delegated Staff Assignments</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Authoritative institutional tracking of nursing, ward, and clinical support assignments from <code className="text-teal-400 font-mono">silver_staff_assignment</code>.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-lg border border-teal-500/20 font-semibold">
                  {allDoctorAssignments.length} Total Assignments
                </span>
                <button
                  type="button"
                  onClick={loadAllDoctorAssignments}
                  disabled={isLoadingAllAssignments}
                  className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Reload assignments"
                >
                  <RefreshCw size={13} className={isLoadingAllAssignments ? 'animate-spin text-teal-400' : ''} />
                </button>
              </div>
            </div>

            {isLoadingAllAssignments ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin text-teal-400" />
                <span>Loading live staff assignments from Supabase...</span>
              </div>
            ) : allDoctorAssignments.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs">
                No staff assignments currently recorded for your service. Select an appointment in Consultations to assign nursing or clinical support.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {allDoctorAssignments.map((asn) => {
                  const isUrgent = asn.priority === 'Urgent' || asn.priority === 'Critical';
                  return (
                    <div
                      key={asn.assignment_id}
                      className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-teal-500/40 transition-all space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-white">{asn.patient_name}</span>
                            <span className="text-[10px] font-mono text-teal-400 bg-teal-500/10 px-1.5 py-0.2 rounded border border-teal-500/20">
                              {asn.patient_id}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            ASN: {asn.assignment_id} · {asn.assignment_date}
                          </div>
                        </div>

                        <div className="text-right shrink-0 space-y-1">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-mono border block ${
                              isUrgent
                                ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {asn.priority || 'Normal'}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-mono border block ${
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
                      </div>

                      <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 text-[11px]">Assigned Staff:</span>
                          <span className="text-teal-300 font-semibold">{asn.staff_name}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-mono">Role & Dept:</span>
                          <span className="text-slate-300">{asn.staff_role} ({asn.department})</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-mono">Service Type:</span>
                          <span className="text-white font-medium">{asn.assignment_type}</span>
                        </div>
                      </div>

                      {asn.notes && (
                        <div className="text-xs text-slate-300 bg-slate-950/40 p-2 rounded-lg border border-slate-800/60 leading-relaxed font-sans">
                          <span className="text-[10px] text-slate-500 font-mono uppercase block mb-0.5">Clinical Directives:</span>
                          {asn.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Inpatient Bed & Staff Assignment Modal */}
      {assigningInpatient && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                  <Bed size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Assign Staff to Inpatient Bed</h3>
                  <p className="text-xs text-slate-400">Assign a hospital ward bed and dedicated clinical staff member for this patient.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssigningInpatient(null)}
                className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleConfirmInpatientAssignment} className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Patient Context Banner */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{assigningInpatient.patient_name}</span>
                    <span className="text-xs font-mono text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                      {assigningInpatient.patient_id}
                    </span>
                    <span className="text-xs text-slate-400">({assigningInpatient.age}y {assigningInpatient.gender || ''})</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    <span className="text-slate-500">Diagnosis: </span>
                    <span className="text-slate-300">{assigningInpatient.diagnosis}</span>
                  </div>
                </div>
                <div className="text-right sm:text-right shrink-0">
                  <div className="text-[10px] text-slate-500 uppercase font-mono">Current Location</div>
                  <div className="text-xs font-mono text-teal-300 font-semibold">{assigningInpatient.bed}</div>
                </div>
              </div>

              {/* Step 1: Hospital Ward Bed Selection */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Bed size={14} className="text-teal-400" />
                    <span>1. Select Hospital Ward Bed</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setInpatientBedFilter('available')}
                      className={`px-2 py-0.5 rounded font-mono transition-colors cursor-pointer ${
                        inpatientBedFilter === 'available'
                          ? 'bg-teal-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Available ({wardBeds.filter((b) => b.status === 'Available').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setInpatientBedFilter('all')}
                      className={`px-2 py-0.5 rounded font-mono transition-colors cursor-pointer ${
                        inpatientBedFilter === 'all'
                          ? 'bg-teal-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      All Beds ({wardBeds.length || 12})
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-44 overflow-y-auto p-1 border border-slate-800/80 rounded-xl bg-slate-950/50">
                  {filteredWardBeds.map((bed) => {
                    const isSelected = inpatientSelectedBedId === bed.id;
                    const isCurrentPatientBed = bed.patient_id === assigningInpatient.patient_id || bed.id === assigningInpatient.bed_id;
                    const isAvailable = bed.status === 'Available';
                    const isOccupied = bed.status === 'Occupied';
                    return (
                      <button
                        key={bed.id}
                        type="button"
                        onClick={() => setInpatientSelectedBedId(bed.id)}
                        className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer relative ${
                          isSelected
                            ? 'border-teal-400 bg-teal-500/15 shadow-sm'
                            : isCurrentPatientBed
                            ? 'border-teal-500/40 bg-slate-900/90'
                            : isAvailable
                            ? 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                            : 'border-slate-800/60 bg-slate-900/30 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white font-mono">{bed.room}</span>
                          {isSelected && <Check size={12} className="text-teal-400" />}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">{bed.bed || bed.id}</div>
                        <div className="text-[10px] text-slate-500 mt-1">{bed.wing}</div>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold ${
                              isAvailable
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : isOccupied
                                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {isCurrentPatientBed ? 'Current' : bed.status}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Clinical Staff Selection */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Users size={14} className="text-teal-400" />
                    <span>2. Select Healthcare Staff Member</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <div className="relative">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={inpatientStaffSearch}
                        onChange={(e) => setInpatientStaffSearch(e.target.value)}
                        placeholder="Search staff name..."
                        className="pl-7 pr-2.5 py-1 text-xs rounded-lg border border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Role Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                  {['all', 'Nurse', 'Specialist', 'Therapist', 'Tech'].map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setInpatientStaffRoleFilter(role)}
                      className={`px-2 py-0.5 rounded-full border transition-colors cursor-pointer shrink-0 ${
                        inpatientStaffRoleFilter === role
                          ? 'border-teal-500 bg-teal-500/15 text-teal-300 font-semibold'
                          : 'border-slate-800 text-slate-400 hover:text-white bg-slate-950'
                      }`}
                    >
                      {role === 'all' ? 'All Roles' : role}
                    </button>
                  ))}
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 p-1 border border-slate-800/80 rounded-xl bg-slate-950/50">
                  {filteredInpatientStaff.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500">
                      No staff members match the selected criteria.
                    </div>
                  ) : (
                    filteredInpatientStaff.map((staff) => {
                      const isSelected = inpatientSelectedStaffId === staff.staff_id;
                      return (
                        <button
                          key={staff.staff_id}
                          type="button"
                          onClick={() => setInpatientSelectedStaffId(staff.staff_id)}
                          className={`w-full p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'border-teal-400 bg-teal-500/15'
                              : 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-300 font-bold text-xs shrink-0">
                              {staff.staff_name.charAt(0)}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                <span>{staff.staff_name}</span>
                                <span className="text-[10px] font-mono text-slate-400">({staff.staff_id})</span>
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {staff.role} · <span className="text-teal-400">{staff.department}</span>
                                {staff.shift && <span className="text-slate-500"> · Shift: {staff.shift}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            {isSelected ? (
                              <div className="w-5 h-5 rounded-full bg-teal-500 text-slate-950 flex items-center justify-center">
                                <Check size={12} strokeWidth={3} />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border border-slate-700" />
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Step 3: Orders, Priority & Clinical Directives */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <ClipboardList size={14} className="text-teal-400" />
                  <span>3. Assignment Protocol & Physician Directives</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-mono">Assignment Type</label>
                    <select
                      value={inpatientAssignType}
                      onChange={(e) => setInpatientAssignType(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-800 bg-slate-950 text-white focus:outline-none focus:border-teal-500 cursor-pointer"
                    >
                      <option value="Inpatient Bedside Care">Inpatient Bedside Care</option>
                      <option value="Cardiac Telemetry Surveillance">Cardiac Telemetry Surveillance</option>
                      <option value="Post-Procedure Acute Recovery">Post-Procedure Acute Recovery</option>
                      <option value="Medication Administration & Vitals">Medication Administration & Vitals</option>
                      <option value="Respiratory Therapy Protocol">Respiratory Therapy Protocol</option>
                      <option value="Physical Rehabilitation Assistance">Physical Rehabilitation Assistance</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-mono">Clinical Priority</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['Normal', 'Urgent', 'Critical'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setInpatientPriority(p)}
                          className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer text-center ${
                            inpatientPriority === p
                              ? p === 'Critical'
                                ? 'border-rose-500 bg-rose-500/20 text-rose-300 font-bold'
                                : p === 'Urgent'
                                ? 'border-amber-500 bg-amber-500/20 text-amber-300 font-bold'
                                : 'border-teal-500 bg-teal-500/20 text-teal-300 font-bold'
                              : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1 font-mono">Physician Orders & Instructions</label>
                  <textarea
                    rows={2}
                    value={inpatientOrders}
                    onChange={(e) => setInpatientOrders(e.target.value)}
                    placeholder="Enter clinical instructions for this bedside assignment..."
                    className="w-full p-2.5 text-xs rounded-lg border border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Status / Feedback */}
              {inpatientAssignError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{inpatientAssignError}</span>
                </div>
              )}

              {inpatientAssignSuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>{inpatientAssignSuccess}</span>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAssigningInpatient(null)}
                  disabled={isSubmittingInpatientAssignment}
                  className="px-4 py-2 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInpatientAssignment || !inpatientSelectedBedId || !inpatientSelectedStaffId}
                  className="px-5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {isSubmittingInpatientAssignment ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Saving Assignment...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck size={14} />
                      <span>Confirm Bed & Staff Assignment</span>
                    </>
                  )}
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
