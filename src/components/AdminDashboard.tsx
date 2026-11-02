/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Users,
  Activity,
  LogOut,
  TrendingUp,
  Clock,
  Star,
  Send,
  Bell,
  CheckCircle2,
  Search,
  Filter,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  UserCheck,
  History,
  Database,
  ArrowRight,
  AlertCircle,
  Loader2,
  Calendar,
  CalendarDays,
  BarChart3,
  PieChart,
  Stethoscope,
  Layers,
  Link2,
  Unlink,
  AlertTriangle,
  Grid,
  List,
} from 'lucide-react';
import { AuthUser, HospitalRole } from '../types/auth';
import { AiHospitalAssistantLauncher } from './AiHospitalAssistantLauncher';
import {
  adminService,
  AdminUserRecord,
  AdminAuditLog,
  AdminDashboardDateStats,
  RosterDoctorItem,
  RosterStaffItem,
  AdminDateRosterResponse,
  AdminFeedbackAnalyticsResponse,
  FeedbackItem,
} from '../services/adminService';

interface AdminDashboardProps {
  user?: AuthUser | null;
  onLogout: () => void;
  onRoleSwitch?: (role: HospitalRole) => void;
}

interface ExecutiveMetrics {
  bedOccupancyRate: number;
  avgWaitTimeMinutes: number;
  totalActivePatients: number;
  totalPhysicians: number;
  totalClinicalStaff: number;
  patientSatisfactionScore: number;
  monthlyDischarges: number;
  emergencyThroughputRatio: number;
}

interface DepartmentCapacity {
  id: string;
  name: string;
  totalBeds: number;
  occupiedBeds: number;
  rate: number;
  doctorsOnDuty: number;
  status: string;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  department: string;
  shift: string;
  duty: string;
  patients: number;
}

interface FeedbackSummary {
  id: string;
  patient: string;
  doctor: string;
  department: string;
  rating: number;
  waitRating: number;
  comments: string;
  date: string;
}

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

const STATUS_CONFIG_MAP: Record<string, { stroke: string; dot: string; text: string; bg: string }> = {
  Completed: { stroke: '#10b981', dot: 'bg-emerald-400', text: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  Scheduled: { stroke: '#06b6d4', dot: 'bg-cyan-400', text: 'text-cyan-300', bg: 'bg-cyan-500/10 border-cyan-500/30' },
  Confirmed: { stroke: '#3b82f6', dot: 'bg-blue-400', text: 'text-blue-300', bg: 'bg-blue-500/10 border-blue-500/30' },
  'In Progress': { stroke: '#a855f7', dot: 'bg-purple-400', text: 'text-purple-300', bg: 'bg-purple-500/10 border-purple-500/30' },
  Cancelled: { stroke: '#f43f5e', dot: 'bg-rose-400', text: 'text-rose-300', bg: 'bg-rose-500/10 border-rose-500/30' },
  'No Show': { stroke: '#f59e0b', dot: 'bg-amber-400', text: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/30' },
};

const DEFAULT_STATUS_CONFIG = {
  stroke: '#94a3b8',
  dot: 'bg-slate-400',
  text: 'text-slate-300',
  bg: 'bg-slate-800/60 border-slate-700/40',
};

interface AppointmentStatusPieChartProps {
  distribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  totalAppointments: number;
}

const AppointmentStatusPieChart: React.FC<AppointmentStatusPieChartProps> = ({
  distribution,
  totalAppointments,
}) => {
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);

  const size = 160;
  const strokeWidth = 24;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  let accumulatedCount = 0;
  const slices = distribution.map((item) => {
    const fraction = totalAppointments > 0 ? item.count / totalAppointments : 0;
    const strokeDasharray = `${fraction * circumference} ${circumference}`;
    const strokeDashoffset = -((accumulatedCount / totalAppointments) * circumference);
    accumulatedCount += item.count;
    const config = STATUS_CONFIG_MAP[item.status] || DEFAULT_STATUS_CONFIG;

    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
      config,
    };
  });

  const activeItem = hoveredStatus ? distribution.find((d) => d.status === hoveredStatus) : null;

  return (
    <div className="space-y-4 pt-1">
      <div className="flex flex-col sm:flex-row items-center gap-5">
        {/* SVG Donut / Pie Chart */}
        <div className="relative shrink-0 flex items-center justify-center p-1">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="transform -rotate-90 select-none overflow-visible"
          >
            {/* Background ring track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#1e293b"
              strokeWidth={strokeWidth}
              className="opacity-40"
            />

            {/* Status Slices */}
            {slices.map((slice) => {
              const isHovered = hoveredStatus === slice.status;
              return (
                <circle
                  key={slice.status}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={slice.config.stroke}
                  strokeWidth={isHovered ? strokeWidth + 6 : strokeWidth}
                  strokeDasharray={slice.strokeDasharray}
                  strokeDashoffset={slice.strokeDashoffset}
                  strokeLinecap="butt"
                  className="transition-all duration-200 cursor-pointer"
                  style={{
                    opacity: hoveredStatus && !isHovered ? 0.35 : 1,
                    filter: isHovered ? 'drop-shadow(0 0 8px rgba(255,255,255,0.35))' : 'none',
                  }}
                  onMouseEnter={() => setHoveredStatus(slice.status)}
                  onMouseLeave={() => setHoveredStatus(null)}
                >
                  <title>{`${slice.status}: ${slice.count} (${slice.percentage}%)`}</title>
                </circle>
              );
            })}
          </svg>

          {/* Center Info in Pie Chart Hole */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center px-2">
            {activeItem ? (
              <>
                <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider truncate max-w-[85px]">
                  {activeItem.status}
                </span>
                <span className="text-xl font-bold font-mono text-white leading-tight">
                  {activeItem.count}
                </span>
                <span className="text-[10px] font-mono font-medium text-teal-400">
                  {activeItem.percentage}%
                </span>
              </>
            ) : (
              <>
                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                  Total
                </span>
                <span className="text-2xl font-bold font-mono text-white leading-tight">
                  {totalAppointments}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  Appts
                </span>
              </>
            )}
          </div>
        </div>

        {/* Status Breakdown Grid with synchronized hover */}
        <div className="flex-1 w-full grid grid-cols-2 gap-2">
          {distribution.map((item) => {
            const isHovered = hoveredStatus === item.status;
            const config = STATUS_CONFIG_MAP[item.status] || DEFAULT_STATUS_CONFIG;

            return (
              <div
                key={item.status}
                onMouseEnter={() => setHoveredStatus(item.status)}
                onMouseLeave={() => setHoveredStatus(null)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isHovered
                    ? `${config.bg} ring-1 ring-white/20 bg-slate-900/90 scale-[1.02]`
                    : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className={`w-2 h-2 rounded-full ${config.dot} shrink-0`} />
                  <span className="truncate font-medium">{item.status}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className={`text-sm font-bold font-mono ${config.text}`}>
                    {item.count}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'departments' | 'roster' | 'users' | 'feedback'>('metrics');
  const [metrics, setMetrics] = useState<ExecutiveMetrics | null>(null);
  const [departments, setDepartments] = useState<DepartmentCapacity[]>([]);
  const [roster, setRoster] = useState<StaffMember[]>([]);
  const [feedback, setFeedback] = useState<FeedbackSummary[]>([]);
  const [searchRoster, setSearchRoster] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');

  // Shared Date-Filtered Analytics State (Hospital Timezone: Asia/Kolkata)
  const [selectedDate, setSelectedDate] = useState<string>(getTodayKolkata);
  const [dateStats, setDateStats] = useState<AdminDashboardDateStats | null>(null);
  const [isLoadingDateStats, setIsLoadingDateStats] = useState<boolean>(true);
  const [dateStatsError, setDateStatsError] = useState<string | null>(null);

  // Interactive Calendar Popover State
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarViewYear, setCalendarViewYear] = useState(() => {
    const parts = (getTodayKolkata()).split('-');
    return Number(parts[0]) || 2026;
  });
  const [calendarViewMonth, setCalendarViewMonth] = useState(() => {
    const parts = (getTodayKolkata()).split('-');
    return (Number(parts[1]) - 1) || 9; // 0-indexed month
  });
  const calendarDropdownRef = React.useRef<HTMLDivElement>(null);
  const dateInputRef = React.useRef<HTMLInputElement>(null);

  // Sync calendar month/year view whenever selectedDate changes
  useEffect(() => {
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      const [y, m] = selectedDate.split('-').map(Number);
      setCalendarViewYear(y);
      setCalendarViewMonth(m - 1);
    }
  }, [selectedDate]);

  // Click outside listener for calendar popover
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

  const loadDateStats = async (date: string) => {
    setIsLoadingDateStats(true);
    setDateStatsError(null);
    try {
      const res = await adminService.fetchDashboardStats(date);
      if (res.success && res.data) {
        setDateStats(res.data);
      } else {
        setDateStatsError(res.message || 'Failed to load date-filtered operations metrics.');
      }
    } catch (err: any) {
      setDateStatsError(err.message || 'Network error fetching date operations data.');
    } finally {
      setIsLoadingDateStats(false);
    }
  };

  // Date-Filtered Workforce & Staff Roster State (Synchronized with selectedDate)
  const [rosterData, setRosterData] = useState<AdminDateRosterResponse | null>(null);
  const [isLoadingRoster, setIsLoadingRoster] = useState<boolean>(true);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [rosterRoleFilter, setRosterRoleFilter] = useState<'all' | 'doctors' | 'staff'>('all');

  const loadDateRoster = async (date: string, dept?: string, search?: string) => {
    setIsLoadingRoster(true);
    setRosterError(null);
    try {
      const res = await adminService.fetchDateRoster(date, dept, search);
      if (res.success && res.data) {
        setRosterData(res.data);
      } else {
        setRosterError(res.message || 'Failed to retrieve date-filtered workforce roster.');
      }
    } catch (err: any) {
      setRosterError(err.message || 'Network error fetching date-filtered workforce roster.');
    } finally {
      setIsLoadingRoster(false);
    }
  };

  useEffect(() => {
    loadDateStats(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDateRoster(selectedDate, selectedDeptFilter, searchRoster);
    }, 200);
    return () => clearTimeout(timer);
  }, [selectedDate, selectedDeptFilter, searchRoster]);

  // Patient Feedback Analytics State (Synchronized with selectedDate)
  const [feedbackAnalytics, setFeedbackAnalytics] = useState<AdminFeedbackAnalyticsResponse | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState<boolean>(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackRatingFilter, setFeedbackRatingFilter] = useState<string>('all');
  const [feedbackCategoryFilter, setFeedbackCategoryFilter] = useState<string>('all');
  const [feedbackSearch, setFeedbackSearch] = useState<string>('');
  const [feedbackSortBy, setFeedbackSortBy] = useState<string>('time_desc');

  const loadFeedbackAnalytics = async (
    date = selectedDate,
    rating = feedbackRatingFilter,
    category = feedbackCategoryFilter,
    search = feedbackSearch,
    sortBy = feedbackSortBy
  ) => {
    setIsLoadingFeedback(true);
    setFeedbackError(null);
    try {
      const res = await adminService.fetchFeedbackAnalytics({
        date,
        rating,
        category,
        search,
        sortBy,
      });
      if (res.success && res.data) {
        setFeedbackAnalytics(res.data);
      } else {
        setFeedbackError(res.message || 'Failed to retrieve patient feedback analytics.');
      }
    } catch (err: any) {
      setFeedbackError(err.message || 'Network error fetching patient feedback analytics.');
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadFeedbackAnalytics(selectedDate, feedbackRatingFilter, feedbackCategoryFilter, feedbackSearch, feedbackSortBy);
    }, 200);
    return () => clearTimeout(timer);
  }, [selectedDate, feedbackRatingFilter, feedbackCategoryFilter, feedbackSearch, feedbackSortBy]);

  // User Governance & Account-to-Employee Mapping State
  const [usersList, setUsersList] = useState<AdminUserRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | HospitalRole>('all');
  const [userDeptFilter, setUserDeptFilter] = useState('all');
  const [userShiftFilter, setUserShiftFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [userViewMode, setUserViewMode] = useState<'grouped' | 'directory'>('grouped');
  const [userDepartmentsList, setUserDepartmentsList] = useState<string[]>([]);
  const [userShiftsList, setUserShiftsList] = useState<string[]>([]);
  const [userGovernanceSummary, setUserGovernanceSummary] = useState<any>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [selectedRoleChanges, setSelectedRoleChanges] = useState<Record<string, HospitalRole>>({});
  const [roleChangeReason, setRoleChangeReason] = useState<string>('');

  // Broadcast announcement state
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState('Normal');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadUsersAndAuditLogs = async (
    date = selectedDate,
    dept = userDeptFilter,
    shift = userShiftFilter,
    status = userStatusFilter,
    search = searchUser
  ) => {
    setIsLoadingUsers(true);
    try {
      const [usersRes, auditRes] = await Promise.all([
        adminService.fetchUsers({
          date,
          department: dept,
          shift,
          status,
          search,
        }),
        adminService.fetchAuditLogs(),
      ]);
      if (usersRes.success) {
        setUsersList(usersRes.users);
        if (usersRes.availableDepartments?.length) {
          setUserDepartmentsList(usersRes.availableDepartments);
        }
        if (usersRes.availableShifts?.length) {
          setUserShiftsList(usersRes.availableShifts);
        }
        if (usersRes.summary) {
          setUserGovernanceSummary(usersRes.summary);
        }
      }
      if (auditRes.success) {
        setAuditLogs(auditRes.auditLogs);
      }
    } catch (err) {
      console.error('Failed to load user accounts directory', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsersAndAuditLogs(selectedDate, userDeptFilter, userShiftFilter, userStatusFilter, searchUser);
    }, 200);
    return () => clearTimeout(timer);
  }, [selectedDate, userDeptFilter, userShiftFilter, userStatusFilter, searchUser]);

  useEffect(() => {
    async function loadAdminData() {
      try {
        const token = sessionStorage.getItem('mediai_patient_auth_token');
        const res = await fetch('/api/admin/overview', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (data.success) {
          setMetrics(data.executiveMetrics || null);
          setDepartments(data.departments || []);
          setRoster(data.staffRoster || []);
          setFeedback(data.patientFeedback || []);
        }
      } catch (err) {
        console.error('Failed to load admin overview', err);
      }
    }
    loadAdminData();
    loadUsersAndAuditLogs();
  }, []);

  const handleApplyRoleChange = async (targetUser: AdminUserRecord) => {
    const userKey = targetUser.id || targetUser.email;
    const targetNewRole = selectedRoleChanges[userKey] || targetUser.role;

    if (targetNewRole === targetUser.role) {
      setToastMessage(`No role change selected for ${targetUser.fullName || targetUser.email}.`);
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    setUpdatingUserId(userKey);
    try {
      const res = await adminService.updateUserRole({
        userId: targetUser.id,
        email: targetUser.email,
        newRole: targetNewRole,
        reason: roleChangeReason.trim() || `Administrative role adjustment by ${user?.name || 'Arthur Sterling, MHA'}`,
      });

      if (res.success) {
        setToastMessage(`Database updated: ${res.message}`);
        setRoleChangeReason('');
        await loadUsersAndAuditLogs();
      } else {
        setToastMessage(`Update failed: ${res.message}`);
      }
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      setToastMessage(`Error updating role: ${err.message || 'Network failure'}`);
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = sessionStorage.getItem('mediai_patient_auth_token');
      await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: broadcastTitle,
          message: broadcastMessage,
          priority: broadcastPriority,
        }),
      });

      setToastMessage(`Broadcast "${broadcastTitle}" dispatched to all hospital clinical units.`);
      setBroadcastTitle('');
      setBroadcastMessage('');
      setIsBroadcastModalOpen(false);
      setTimeout(() => setToastMessage(null), 4000);
    } catch {
      // ignore
    }
  };

  const filteredRoster = roster.filter((staff) => {
    const matchesSearch =
      staff.name.toLowerCase().includes(searchRoster.toLowerCase()) ||
      staff.role.toLowerCase().includes(searchRoster.toLowerCase()) ||
      staff.id.toLowerCase().includes(searchRoster.toLowerCase());
    const matchesDept =
      selectedDeptFilter === 'all' || staff.department.toLowerCase().includes(selectedDeptFilter.toLowerCase());
    return matchesSearch && matchesDept;
  });

  const filteredUsers = usersList.filter((u) => {
    const term = searchUser.toLowerCase().trim();
    const matchesSearch =
      !term ||
      u.fullName.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.id.toLowerCase().includes(term) ||
      (u.patient_id && u.patient_id.toLowerCase().includes(term)) ||
      (u.doctor_id && u.doctor_id.toLowerCase().includes(term)) ||
      (u.staff_id && u.staff_id.toLowerCase().includes(term)) ||
      (u.employeeId && u.employeeId.toLowerCase().includes(term)) ||
      (u.employeeName && u.employeeName.toLowerCase().includes(term)) ||
      (u.department && u.department.toLowerCase().includes(term)) ||
      (u.specialty && u.specialty.toLowerCase().includes(term));
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesDept =
      userDeptFilter === 'all' || (u.department && u.department.toLowerCase().includes(userDeptFilter.toLowerCase()));
    const matchesShift =
      userShiftFilter === 'all' ||
      (userShiftFilter === 'Off Duty'
        ? u.dutyStatus === 'Off Duty'
        : (u.shiftName && u.shiftName.toLowerCase().includes(userShiftFilter.toLowerCase())) ||
          (u.shiftSchedule && u.shiftSchedule.toLowerCase().includes(userShiftFilter.toLowerCase())));
    const matchesStatus = userStatusFilter === 'all' || u.mappingStatus === userStatusFilter;
    return matchesSearch && matchesRole && matchesDept && matchesShift && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500/30 selection:text-teal-200">
      {/* Top Bar Contract: 3 zones */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-4 lg:gap-6 min-w-0">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <ShieldCheck size={18} />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white whitespace-nowrap">
                MediAI <span className="text-teal-400 font-normal">· Hospital Governance</span>
              </div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap">
                Executive Operations & Quality Dashboard
              </div>
            </div>
          </div>

          {/* Zone 2: Navigation Links / Workspace Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 shrink min-w-0 overflow-x-auto">
            <button
              onClick={() => setActiveTab('metrics')}
              className={`px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'metrics'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Executive Metrics
            </button>
            <button
              onClick={() => setActiveTab('departments')}
              className={`px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'departments'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Department Capacities ({departments.length})
            </button>
            <button
              onClick={() => setActiveTab('roster')}
              className={`px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'roster'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Staff Roster ({rosterData?.summary.totalWorkforce ?? roster.length})
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'users'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserCheck size={13} />
              <span>User Governance ({usersList.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('feedback')}
              className={`px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'feedback'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Patient Feedback ({feedback.length})
            </button>
          </nav>

          {/* Zone 3: Primary Action & Profile */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              onClick={() => setIsBroadcastModalOpen(true)}
              className="hidden sm:inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors cursor-pointer shrink-0 shadow-sm"
            >
              <Bell size={14} />
              <span>Broadcast</span>
            </button>
            <div className="hidden xl:block text-right">
              <div className="text-xs font-medium text-white">{user?.name || 'Arthur Sterling, MHA'}</div>
              <div className="text-[10px] text-slate-400 font-mono">COO & Governance</div>
            </div>
            {/* Institutional Verified Role Badge (Single-Role Enforced for Security) */}
            <div
              className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg border border-indigo-500/30 bg-indigo-950/40 text-xs font-medium text-slate-200 shrink-0 select-none shadow-xs"
              title="Verified Institutional Role: Hospital Administrator"
            >
              <ShieldCheck size={14} className="text-indigo-400 shrink-0" />
              <span className="text-slate-400 hidden sm:inline">Role:</span>
              <span className="text-indigo-300 font-bold">Admin</span>
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

      {/* Main Admin Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Prominent Shared Date Control Bar (Phase 1 Date-Filtered Admin Dashboard) */}
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
                    Operations & Clinical Performance
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-teal-500/10 text-teal-300 border border-teal-500/30">
                    <Clock className="w-3 h-3" />
                    Asia/Kolkata (IST)
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Filtered Date: <span className="text-teal-300 font-medium">{formatDisplayDate(selectedDate)}</span>
                  {isLoadingDateStats && <span className="ml-2 text-slate-500 italic">Refreshing database metrics...</span>}
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

                        // Leading days from previous month
                        const leadingDays = Array.from({ length: firstDayOfWeek }).map((_, i) => ({
                          dayNum: prevMonthDays - firstDayOfWeek + 1 + i,
                          isCurrentMonth: false,
                          isPrev: true,
                        }));

                        // Current month days
                        const currentDays = Array.from({ length: daysInMonth }).map((_, i) => ({
                          dayNum: i + 1,
                          isCurrentMonth: true,
                          isPrev: false,
                        }));

                        // Trailing days from next month
                        const trailingCount = (7 - ((firstDayOfWeek + daysInMonth) % 7)) % 7;
                        const trailingDays = Array.from({ length: trailingCount }).map((_, i) => ({
                          dayNum: i + 1,
                          isCurrentMonth: false,
                          isPrev: false,
                        }));

                        const allDays = [...leadingDays, ...currentDays, ...trailingDays];

                        const activeRecordedDates = new Set([
                          '2026-09-30',
                          '2026-09-29',
                          '2026-09-28',
                          '2026-09-27',
                          '2026-09-26',
                          '2026-09-25',
                          '2026-09-24',
                          '2026-09-23',
                          '2026-10-27',
                        ]);

                        return allDays.map((cell, idx) => {
                          if (!cell.isCurrentMonth) {
                            return (
                              <div
                                key={idx}
                                className="py-1.5 text-slate-600 text-[11px] select-none"
                              >
                                {cell.dayNum}
                              </div>
                            );
                          }

                          const mStr = String(calendarViewMonth + 1).padStart(2, '0');
                          const dStr = String(cell.dayNum).padStart(2, '0');
                          const cellDateStr = `${calendarViewYear}-${mStr}-${dStr}`;
                          const isSelected = cellDateStr === selectedDate;
                          const isToday = cellDateStr === getTodayKolkata();
                          const hasData = activeRecordedDates.has(cellDateStr);

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setSelectedDate(cellDateStr);
                                setIsCalendarOpen(false);
                              }}
                              className={`relative py-1.5 rounded-lg font-mono text-xs transition-all cursor-pointer flex flex-col items-center justify-center ${
                                isSelected
                                  ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20'
                                  : isToday
                                  ? 'bg-teal-500/10 text-teal-300 border border-teal-500/40 hover:bg-teal-500/20'
                                  : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                              }`}
                              title={
                                hasData
                                  ? `${cellDateStr} (Verified hospital records)`
                                  : cellDateStr
                              }
                            >
                              <span>{cell.dayNum}</span>
                              {hasData && (
                                <span
                                  className={`w-1 h-1 rounded-full ${
                                    isSelected ? 'bg-slate-950' : 'bg-teal-400'
                                  }`}
                                />
                              )}
                            </button>
                          );
                        });
                      })()}
                    </div>

                    {/* Quick Shortcuts Footer */}
                    <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const today = getTodayKolkata();
                            setSelectedDate(today);
                            setIsCalendarOpen(false);
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors cursor-pointer"
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDate('2026-09-30');
                            setIsCalendarOpen(false);
                          }}
                          className="px-2 py-1 rounded bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 font-medium transition-colors cursor-pointer"
                        >
                          Sep 30 (Latest)
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsCalendarOpen(false)}
                        className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => loadDateStats(selectedDate)}
                disabled={isLoadingDateStats}
                className="p-2 rounded-xl bg-slate-950/90 hover:bg-slate-800 text-slate-300 hover:text-teal-400 border border-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                title="Refresh metrics from Supabase"
                aria-label="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingDateStats ? 'animate-spin text-teal-400' : ''}`} />
              </button>
            </div>
          </div>
        </section>

        {/* Date Error Banner */}
        {dateStatsError && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-between gap-3 text-xs text-rose-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{dateStatsError}</span>
            </div>
            <button
              onClick={() => loadDateStats(selectedDate)}
              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-medium transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty Records Notice Banner */}
        {!isLoadingDateStats && dateStats && !dateStats.meta.hasData && (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                No clinical visits or scheduled appointments are logged for <strong>{formatDisplayDate(selectedDate)}</strong> in the database.
              </span>
            </div>
            <button
              onClick={() => setSelectedDate('2026-09-30')}
              className="px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-200 font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              Switch to Latest Operations (Sep 30, 2026) →
            </button>
          </div>
        )}

        {/* Toast alert */}
        {toastMessage && (
          <div className="p-3.5 rounded-xl bg-teal-950/60 border border-teal-500/40 text-xs text-teal-200 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-teal-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Tab 1: Executive Metrics Overview (Date-Filtered Analytics & Operations) */}
        {activeTab === 'metrics' && (
          <div className="space-y-6">
            {/* KPI Cards Strip (4 Real-Time Metrics for Selected Date) */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* KPI 1: Patient Visits */}
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/90 hover:border-teal-500/40 transition-all shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs text-slate-400 font-medium block">Patient Visits</span>
                    <span className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums mt-1 block">
                      {isLoadingDateStats ? '...' : (dateStats?.kpis.patientVisits.toLocaleString() ?? '—')}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
                    <Activity className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* KPI 2: Doctors on Duty */}
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/90 hover:border-cyan-500/40 transition-all shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs text-slate-400 font-medium block">Doctors on Duty</span>
                    <span className="text-2xl sm:text-3xl font-bold text-cyan-300 font-mono tabular-nums mt-1 block">
                      {isLoadingDateStats ? '...' : (dateStats?.kpis.doctorsOnDuty.toLocaleString() ?? '—')}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* KPI 3: Staff Present */}
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/90 hover:border-indigo-500/40 transition-all shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs text-slate-400 font-medium block">Staff Present</span>
                    <span className="text-2xl sm:text-3xl font-bold text-indigo-300 font-mono tabular-nums mt-1 block">
                      {isLoadingDateStats ? '...' : (dateStats?.kpis.staffPresent.toLocaleString() ?? '—')}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                    <UserCheck className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* KPI 4: Total Appointments */}
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/90 hover:border-emerald-500/40 transition-all shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs text-slate-400 font-medium block">Total Appointments</span>
                    <span className="text-2xl sm:text-3xl font-bold text-emerald-300 font-mono tabular-nums mt-1 block">
                      {isLoadingDateStats ? '...' : (dateStats?.kpis.totalAppointments.toLocaleString() ?? '—')}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </section>

            {/* Visual Analytics Charts Grid */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Chart 1: Appointments by Department (Bar Chart) */}
              <div className="lg:col-span-7 bg-slate-900/70 rounded-2xl border border-slate-800/90 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-teal-400" />
                      Appointments by Department
                    </h3>
                    <p className="text-xs text-slate-400">
                      Distribution across medical specialties for {formatDisplayDate(selectedDate)}
                    </p>
                  </div>
                  <span className="text-xs text-teal-400 font-mono">
                    {dateStats?.appointmentsByDepartment.length || 0} Specialties
                  </span>
                </div>

                {isLoadingDateStats ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
                    <span>Loading department metrics...</span>
                  </div>
                ) : dateStats && dateStats.appointmentsByDepartment.length > 0 ? (
                  <div className="space-y-3 pt-1">
                    {dateStats.appointmentsByDepartment.slice(0, 8).map((dept) => {
                      const maxCount = dateStats.appointmentsByDepartment[0]?.count || 1;
                      const relativeWidth = Math.max(8, Math.round((dept.count / maxCount) * 100));

                      return (
                        <div key={dept.department} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-200 truncate pr-2" title={dept.department}>
                              {dept.department}
                            </span>
                            <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                              <span className="text-teal-300 font-bold">{dept.count} appts</span>
                              <span className="text-slate-500">({dept.percentage}%)</span>
                            </div>
                          </div>
                          {/* Bar */}
                          <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800/80">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-500"
                              style={{ width: `${relativeWidth}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}

                    {dateStats.appointmentsByDepartment.length > 8 && (
                      <p className="text-[11px] text-slate-500 text-center pt-2">
                        + {dateStats.appointmentsByDepartment.length - 8} additional specialties scheduled on this date
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="py-10 text-center text-xs text-slate-400 space-y-1">
                    <p className="font-medium text-slate-300">No appointments scheduled by department for this date</p>
                    <p className="text-slate-500">Select a date with active consultations to view department volume.</p>
                  </div>
                )}
              </div>

              {/* Chart 2: Appointment Status Distribution */}
              <div className="lg:col-span-5 bg-slate-900/70 rounded-2xl border border-slate-800/90 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-cyan-400" />
                      Appointment Status Distribution
                    </h3>
                    <p className="text-xs text-slate-400">
                      Outcome & schedule state on {formatDisplayDate(selectedDate)}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-cyan-400 font-bold">
                    {dateStats?.kpis.totalAppointments || 0} Total
                  </span>
                </div>

                {isLoadingDateStats ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                    <span>Calculating status distribution...</span>
                  </div>
                ) : dateStats && dateStats.kpis.totalAppointments > 0 ? (
                  <AppointmentStatusPieChart
                    distribution={dateStats.appointmentStatusDistribution}
                    totalAppointments={dateStats.kpis.totalAppointments}
                  />
                ) : (
                  <div className="py-10 text-center text-xs text-slate-400 space-y-1">
                    <p className="font-medium text-slate-300">No appointment statuses recorded for this date</p>
                    <p className="text-slate-500">Scheduled consultations will populate completion and attendance breakdown.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Chart 3: 7-Day Patient Visits & Appointments Trend */}
            <section className="bg-slate-900/70 rounded-2xl border border-slate-800/90 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-teal-400" />
                    7-Day Patient Encounters & Appointments Trend
                  </h3>
                  <p className="text-xs text-slate-400">
                    Daily comparative volume ending on {formatDisplayDate(selectedDate)}
                  </p>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-teal-500" />
                    <span className="text-slate-300">Visits (Encounters)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-cyan-400" />
                    <span className="text-slate-300">Appointments</span>
                  </div>
                </div>
              </div>

              {isLoadingDateStats ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
                  <span>Loading 7-day trend history...</span>
                </div>
              ) : dateStats && dateStats.dailyTrend.length > 0 ? (
                <div className="pt-2">
                  {/* Trend Columns */}
                  <div className="grid grid-cols-7 gap-2 sm:gap-3 items-end h-48 sm:h-56 pb-2 border-b border-slate-800">
                    {(() => {
                      const maxDailyValue = Math.max(
                        ...dateStats.dailyTrend.map((d) => Math.max(d.visits, d.appointments)),
                        10
                      );

                      return dateStats.dailyTrend.map((day) => {
                        const isCurrentSelected = day.date === selectedDate;
                        const visitHeight = Math.max(6, Math.round((day.visits / maxDailyValue) * 100));
                        const apptHeight = Math.max(6, Math.round((day.appointments / maxDailyValue) * 100));

                        return (
                          <div
                            key={day.date}
                            onClick={() => setSelectedDate(day.date)}
                            className={`flex flex-col items-center justify-end h-full p-1 sm:p-2 rounded-xl transition-all cursor-pointer ${
                              isCurrentSelected
                                ? 'bg-teal-500/10 border border-teal-500/40 ring-1 ring-teal-500/30'
                                : 'hover:bg-slate-800/40 border border-transparent'
                            }`}
                            title={`Click to filter dashboard to ${day.displayDate}\nVisits: ${day.visits}\nAppointments: ${day.appointments}`}
                          >
                            {/* Bars Container */}
                            <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-32 sm:h-40">
                              {/* Visits Bar */}
                              <div
                                style={{ height: `${visitHeight}%` }}
                                className="w-2 sm:w-3.5 bg-teal-500 rounded-t-sm transition-all duration-300 relative group"
                              >
                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-slate-900 border border-slate-700 text-[10px] font-mono text-teal-300 px-1 py-0.5 rounded shadow pointer-events-none transition-opacity whitespace-nowrap z-10">
                                  {day.visits}
                                </span>
                              </div>

                              {/* Appointments Bar */}
                              <div
                                style={{ height: `${apptHeight}%` }}
                                className="w-2 sm:w-3.5 bg-cyan-400 rounded-t-sm transition-all duration-300 relative group"
                              >
                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-slate-900 border border-slate-700 text-[10px] font-mono text-cyan-300 px-1 py-0.5 rounded shadow pointer-events-none transition-opacity whitespace-nowrap z-10">
                                  {day.appointments}
                                </span>
                              </div>
                            </div>

                            {/* Label */}
                            <div className="mt-2 text-center">
                              <span className={`block text-[11px] font-semibold ${isCurrentSelected ? 'text-teal-300' : 'text-slate-400'}`}>
                                {day.dayOfWeek}
                              </span>
                              <span className="block text-[10px] font-mono text-slate-500">
                                {day.date.split('-').slice(1).join('/')}
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Summary Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-xs text-slate-400">
                    <div className="flex items-center gap-4">
                      <span>
                        7-Day Visits:{' '}
                        <strong className="text-teal-300 font-mono">
                          {dateStats.dailyTrend.reduce((acc, d) => acc + d.visits, 0)}
                        </strong>
                      </span>
                      <span>
                        7-Day Appointments:{' '}
                        <strong className="text-cyan-300 font-mono">
                          {dateStats.dailyTrend.reduce((acc, d) => acc + d.appointments, 0)}
                        </strong>
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 italic">
                      Click any day column to filter dashboard to that date
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-xs text-slate-400 space-y-1">
                  <p className="text-slate-500">Historical encounters will render daily trends when recorded.</p>
                </div>
              )}
            </section>

            {/* Hospital System Capacity & Governance Overview Section */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-teal-400" />
                  Clinical Capacity & System Governance
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time bed utilization across specialized medical departments and workforce governance ratios.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left: Department summary list */}
                <div className="lg:col-span-8 bg-slate-900/60 rounded-2xl border border-slate-800/80 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                        Clinical Service Bed Capacity Breakdown
                      </h4>
                      <p className="text-xs text-slate-400">Unit-level occupancy monitoring across critical hospital wings.</p>
                    </div>
                    <span className="text-xs text-teal-400 font-mono">{departments.length} Clinical Units</span>
                  </div>

                  <div className="space-y-3.5">
                    {departments.map((dept) => (
                      <div key={dept.id} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <span className="font-semibold text-white">{dept.name}</span>
                            <span className="text-slate-500 text-[11px] ml-2 font-mono">ID: {dept.id}</span>
                          </div>
                          <span className="font-mono text-teal-400 font-bold">{dept.rate}%</span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              dept.rate >= 90
                                ? 'bg-rose-400'
                                : dept.rate >= 80
                                ? 'bg-teal-400'
                                : 'bg-cyan-400'
                            }`}
                            style={{ width: `${dept.rate}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>{dept.occupiedBeds} occupied of {dept.totalBeds} total beds</span>
                          <span>{dept.doctorsOnDuty} attending physicians on duty</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Hospital System Governance Snapshot */}
                <div className="lg:col-span-4 bg-slate-900/60 rounded-2xl border border-slate-800/80 p-5 space-y-4">
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider border-b border-slate-800 pb-3">
                    Workforce & Registry Ratios
                  </h4>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">Credentialed Physicians</span>
                      <span className="text-white font-mono font-bold">{metrics ? metrics.totalPhysicians.toLocaleString() : '—'}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">Clinical & Nursing Staff</span>
                      <span className="text-white font-mono font-bold">{metrics ? metrics.totalClinicalStaff.toLocaleString() : '—'}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">Emergency Throughput Ratio</span>
                      <span className="text-teal-400 font-mono font-bold">{metrics ? `${metrics.emergencyThroughputRatio}%` : '—'}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">Monthly Patient Encounters</span>
                      <span className="text-white font-mono font-bold">{metrics ? metrics.monthlyDischarges.toLocaleString() : '—'}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">Active Patient Registry</span>
                      <span className="text-white font-mono font-bold">{metrics ? metrics.totalActivePatients.toLocaleString() : '—'}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">Patient Satisfaction Score</span>
                      <span className="text-amber-400 font-mono font-bold">{metrics ? `${metrics.patientSatisfactionScore} / 5.0` : '—'}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => setIsBroadcastModalOpen(true)}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <Send size={14} />
                      <span>Send Operations Broadcast</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Department Capacities Detailed Table */}
        {activeTab === 'departments' && (
          <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Departmental Bed Registry & Status</h3>
                <p className="text-xs text-slate-400">Detailed overview of capacity thresholds and alert states.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-3">Department Name</th>
                    <th className="px-4 py-3">Dept ID</th>
                    <th className="px-4 py-3 text-right">Occupied Beds</th>
                    <th className="px-4 py-3 text-right">Total Beds</th>
                    <th className="px-4 py-3 text-right">Occupancy %</th>
                    <th className="px-4 py-3 text-right">Physicians</th>
                    <th className="px-4 py-3">Operational Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {departments.map((dept) => (
                    <tr key={dept.id} className="hover:bg-slate-900/80 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{dept.name}</td>
                      <td className="px-4 py-3 font-mono text-slate-400">{dept.id}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-white">{dept.occupiedBeds}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-400">{dept.totalBeds}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-teal-400">{dept.rate}%</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">{dept.doctorsOnDuty}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                            dept.status.includes('High')
                              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                              : 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                          }`}
                        >
                          {dept.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Staff Roster — Date-Filtered Workforce & Clinical Roster */}
        {activeTab === 'roster' && (
          <div className="space-y-6">
            {/* Workforce Summary Banner */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">
                      Hospital Workforce & Clinical Duty Roster
                    </h3>
                    <span className="text-xs text-teal-400 font-mono bg-teal-950/80 px-2 py-0.5 rounded border border-teal-500/30">
                      {formatDisplayDate(selectedDate)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Scheduled physicians and clinical staff synchronized with the operational date in{' '}
                    <span className="text-slate-300 font-medium">Asia/Kolkata</span>.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadDateRoster(selectedDate, selectedDeptFilter, searchRoster)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Refresh roster from database"
                  >
                    <RefreshCw size={14} className={isLoadingRoster ? 'animate-spin text-teal-400' : ''} />
                  </button>
                </div>
              </div>

              {/* KPI Cards Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                      Total Workforce
                    </span>
                    <span className="text-xl font-bold font-mono text-white mt-0.5 block">
                      {rosterData?.summary.totalWorkforce ?? 0}
                    </span>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                    <Users size={16} />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                      Doctors Scheduled
                    </span>
                    <span className="text-xl font-bold font-mono text-teal-300 mt-0.5 block">
                      {rosterData?.summary.totalDoctorsScheduled ?? 0}
                    </span>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                    <Stethoscope size={16} />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                      Clinical Staff Scheduled
                    </span>
                    <span className="text-xl font-bold font-mono text-cyan-300 mt-0.5 block">
                      {rosterData?.summary.totalStaffScheduled ?? 0}
                    </span>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <UserCheck size={16} />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                      Attendance Status
                    </span>
                    <span className="text-xs font-semibold text-amber-300 mt-1 block">
                      Scheduled Status
                    </span>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400" title="Physical attendance is not tracked in the schema">
                    <Clock size={16} />
                  </div>
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search Field */}
              <div className="relative flex-1 max-w-md">
                <Search size={14} className="absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="text"
                  value={searchRoster}
                  onChange={(e) => setSearchRoster(e.target.value)}
                  placeholder="Search by ID, name, role, department, or specialization..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Filter Controls Row */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Role Switcher Tabs */}
                <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setRosterRoleFilter('all')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      rosterRoleFilter === 'all'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({rosterData ? rosterData.doctors.length + rosterData.staff.length : 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRosterRoleFilter('doctors')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      rosterRoleFilter === 'doctors'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Doctors ({rosterData?.doctors.length ?? 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRosterRoleFilter('staff')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      rosterRoleFilter === 'staff'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Staff ({rosterData?.staff.length ?? 0})
                  </button>
                </div>

                {/* Dynamic Department Dropdown */}
                <select
                  value={selectedDeptFilter}
                  onChange={(e) => setSelectedDeptFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-teal-500"
                >
                  <option value="all">All Departments ({rosterData?.departments.length ?? 0})</option>
                  {(rosterData?.departments || []).map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>

                {/* Reset Filters */}
                {(searchRoster || selectedDeptFilter !== 'all' || rosterRoleFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchRoster('');
                      setSelectedDeptFilter('all');
                      setRosterRoleFilter('all');
                    }}
                    className="px-2.5 py-2 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            {/* Loading State */}
            {isLoadingRoster ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-xs text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
                <span>Loading scheduled workforce for {formatDisplayDate(selectedDate)}...</span>
              </div>
            ) : rosterError ? (
              <div className="p-6 rounded-2xl bg-rose-950/20 border border-rose-500/30 text-center space-y-3">
                <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
                <h4 className="text-sm font-bold text-rose-300">Failed to Load Workforce Roster</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">{rosterError}</p>
                <button
                  type="button"
                  onClick={() => loadDateRoster(selectedDate, selectedDeptFilter, searchRoster)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white transition-colors cursor-pointer"
                >
                  Retry Loading Roster
                </button>
              </div>
            ) : rosterData && rosterData.summary.totalWorkforce === 0 ? (
              /* No scheduled records on this date */
              <div className="py-12 px-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto">
                  <Calendar className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">
                  No Scheduled Workforce for {formatDisplayDate(selectedDate)}
                </h4>
                <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
                  No doctor appointments or clinical staff shift assignments were recorded for this calendar date in the{' '}
                  <span className="text-slate-300">Asia/Kolkata</span> timezone.
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDate('2026-09-29')}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 transition-colors cursor-pointer"
                  >
                    View Sep 29, 2026 (Peak Roster: 233 staff & doctors)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDate('2026-09-28')}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                  >
                    View Sep 28, 2026 (188 staff & doctors)
                  </button>
                </div>
              </div>
            ) : (
              /* Content Display */
              <div className="space-y-6">
                {/* Doctors Section */}
                {(rosterRoleFilter === 'all' || rosterRoleFilter === 'doctors') && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <Stethoscope size={16} className="text-teal-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                          Scheduled Physicians & Medical Specialists ({rosterData?.doctors.length ?? 0})
                        </h4>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        Source: Validated Appointments & Duty Assignments
                      </span>
                    </div>

                    {rosterData?.doctors.length === 0 ? (
                      <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
                        No doctors match the selected search or department filter.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {rosterData?.doctors.map((doc) => {
                          const isCompleted = doc.dutyStatus === 'Completed';
                          const isInProgress = doc.dutyStatus === 'In Progress';
                          const isScheduled = doc.dutyStatus === 'Scheduled';

                          return (
                            <div
                              key={doc.id}
                              className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all space-y-3"
                            >
                              {/* Header: ID, Name, Duty Status */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-mono font-bold text-teal-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                      {doc.id}
                                    </span>
                                    <h5 className="text-sm font-bold text-white line-clamp-1">{doc.name}</h5>
                                  </div>
                                  <div className="text-xs text-slate-300 font-medium">
                                    {doc.specialization}
                                  </div>
                                </div>

                                <span
                                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono shrink-0 ${
                                    isCompleted
                                      ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30'
                                      : isInProgress
                                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                                      : isScheduled
                                      ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                                  }`}
                                >
                                  {doc.dutyStatus}
                                </span>
                              </div>

                              {/* Details: Shift & Department */}
                              <div className="space-y-1.5 text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-500">Department:</span>
                                  <span className="text-slate-300 font-medium">{doc.department}</span>
                                </div>

                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-500">Shift / Hours:</span>
                                  <span className="text-teal-300 font-mono">{doc.shift || 'Consultation Shift'}</span>
                                </div>

                                {doc.hospitalBranch && (
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-slate-500">Branch:</span>
                                    <span className="text-slate-400">{doc.hospitalBranch}</span>
                                  </div>
                                )}
                              </div>

                              {/* Work Activity Summary */}
                              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-1.5">
                                  <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 font-mono text-[10px] border border-slate-800">
                                    {doc.consultationCount} Consults
                                  </span>
                                  {doc.assignmentCount > 0 && (
                                    <span className="px-2 py-0.5 rounded bg-slate-950 text-cyan-300 font-mono text-[10px] border border-slate-800">
                                      {doc.assignmentCount} Assignments
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Staff Section */}
                {(rosterRoleFilter === 'all' || rosterRoleFilter === 'staff') && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-cyan-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                          Assigned Clinical & Operational Staff ({rosterData?.staff.length ?? 0})
                        </h4>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        Clinical Shift Assignments
                      </span>
                    </div>

                    {rosterData?.staff.length === 0 ? (
                      <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
                        No clinical staff match the selected search or department filter.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {rosterData?.staff.map((st) => {
                          const isCompleted = st.dutyStatus === 'Completed';
                          const isInProgress = st.dutyStatus === 'In Progress';
                          const isScheduled = st.dutyStatus === 'Scheduled';

                          return (
                            <div
                              key={st.assignmentId}
                              className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all space-y-3"
                            >
                              {/* Header: ID, Name, Duty Status */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-mono font-bold text-cyan-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                      {st.id}
                                    </span>
                                    <h5 className="text-sm font-bold text-white line-clamp-1">{st.name}</h5>
                                  </div>
                                  <div className="text-xs text-slate-300 font-medium">
                                    {st.role} · {st.department}
                                  </div>
                                </div>

                                <span
                                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono shrink-0 ${
                                    isCompleted
                                      ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30'
                                      : isInProgress
                                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                                      : isScheduled
                                      ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                                  }`}
                                >
                                  {st.dutyStatus}
                                </span>
                              </div>

                              {/* Details: Shift Timing and Assignment Type */}
                              <div className="space-y-1.5 text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-500">Shift Hours:</span>
                                  <span className="text-cyan-300 font-mono">
                                    {st.shiftStart && st.shiftEnd
                                      ? `${st.shiftStart} - ${st.shiftEnd}`
                                      : st.shift}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-500">Assignment:</span>
                                  <span className="text-slate-300 font-medium">{st.assignmentType}</span>
                                </div>

                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-500">Shift Type:</span>
                                  <span className="text-slate-400">{st.shiftType}</span>
                                </div>

                                {st.assignedDoctorId && (
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-slate-500">Assisting:</span>
                                    <span className="text-teal-400 font-mono">{st.assignedDoctorId}</span>
                                  </div>
                                )}
                              </div>

                              {/* Footer: Priority & Notes */}
                              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                    st.priority === 'High' || st.priority === 'Urgent'
                                      ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                                      : 'bg-slate-950 text-slate-400 border border-slate-800'
                                  }`}
                                >
                                  Priority: {st.priority}
                                </span>

                                {st.notes ? (
                                  <span className="text-[10px] text-slate-400 truncate max-w-[150px]" title={st.notes}>
                                    {st.notes}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-600">No duty notes</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab: User Governance & Role Management */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Top Toolbar: Title, Info, and Live Refresh */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Platform User Directory & Role Governance</h3>
                  <span className="text-xs text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {formatDisplayDate(selectedDate)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Authorize privilege transitions across hospital roles. Verified employee mappings, department groupings, and shift assignments are synchronized with the selected operational date in <span className="text-slate-300 font-medium">Asia/Kolkata</span>.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => loadUsersAndAuditLogs(selectedDate)}
                  disabled={isLoadingUsers}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-60"
                  title="Refresh user accounts and employee mappings"
                >
                  <RefreshCw size={13} className={isLoadingUsers ? 'animate-spin text-teal-400' : 'text-slate-400'} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Account Mapping & Governance KPI Summary Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Total Platform Accounts
                  </span>
                  <span className="text-xl font-bold font-mono text-white mt-0.5 block">
                    {userGovernanceSummary?.totalUsers ?? usersList.length}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                  <Users size={16} />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Linked Employees
                  </span>
                  <span className="text-xl font-bold font-mono text-emerald-300 mt-0.5 block">
                    {userGovernanceSummary?.linkedCount ?? 0}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400" title="Verified matching hospital workforce records">
                  <Link2 size={16} />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Unlinked / Needs Review
                  </span>
                  <span className="text-xl font-bold font-mono text-amber-300 mt-0.5 block">
                    {(userGovernanceSummary?.unlinkedCount ?? 0) + (userGovernanceSummary?.needsReviewCount ?? 0)}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400" title="Accounts with missing or unverified employee records">
                  <Unlink size={16} />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Active On {selectedDate.split('-').slice(1).join('/')}
                  </span>
                  <span className="text-xl font-bold font-mono text-cyan-300 mt-0.5 block">
                    {userGovernanceSummary?.onDutyOnSelectedDate ?? 0}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400" title="Doctors and staff with scheduled activity on selected date">
                  <Clock size={16} />
                </div>
              </div>
            </div>

            {/* Multi-Tier Filter Controls Bar */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                {/* Search input */}
                <div className="relative flex-1 max-w-md">
                  <Search size={14} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    placeholder="Search by name, email, or employee ID (DOC-, STF-, P-)..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>

                {/* View Mode Toggle: Grouped by Department vs Directory List */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setUserViewMode('grouped')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                      userViewMode === 'grouped'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Grid size={13} />
                    <span>Department Groups</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserViewMode('directory')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                      userViewMode === 'directory'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <List size={13} />
                    <span>Directory Table</span>
                  </button>
                </div>
              </div>

              {/* Filters Row */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {/* Role filter buttons */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto">
                  {(['all', 'doctor', 'staff', 'admin', 'patient'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoleFilter(r)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors capitalize whitespace-nowrap cursor-pointer ${
                        roleFilter === r
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {r === 'all' ? `All Roles (${usersList.length})` : `${r}s`}
                    </button>
                  ))}
                </div>

                {/* Department filter dropdown */}
                <select
                  value={userDeptFilter}
                  onChange={(e) => setUserDeptFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-xs rounded-xl px-3 py-1.5 text-slate-300 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="all">All Departments ({userDepartmentsList.length})</option>
                  {userDepartmentsList.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>

                {/* Shift filter dropdown */}
                <select
                  value={userShiftFilter}
                  onChange={(e) => setUserShiftFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-xs rounded-xl px-3 py-1.5 text-slate-300 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="all">All Shifts</option>
                  {userShiftsList.map((shift) => (
                    <option key={shift} value={shift}>
                      {shift}
                    </option>
                  ))}
                </select>

                {/* Mapping status dropdown */}
                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-xs rounded-xl px-3 py-1.5 text-slate-300 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="all">All Mapping States</option>
                  <option value="Linked">Linked</option>
                  <option value="Unlinked">Unlinked</option>
                  <option value="Needs Review">Needs Review</option>
                  <option value="Administrator">Administrator</option>
                  <option value="Patient">Patient</option>
                </select>

                {/* Audit reason input */}
                <div className="flex-1 min-w-[200px]">
                  <input
                    type="text"
                    value={roleChangeReason}
                    onChange={(e) => setRoleChangeReason(e.target.value)}
                    placeholder="Governance note / role change justification..."
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>

                {/* Reset Filters */}
                {(searchUser || roleFilter !== 'all' || userDeptFilter !== 'all' || userShiftFilter !== 'all' || userStatusFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchUser('');
                      setRoleFilter('all');
                      setUserDeptFilter('all');
                      setUserShiftFilter('all');
                      setUserStatusFilter('all');
                    }}
                    className="px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            {/* User Directory & Department Grouped Content */}
            {isLoadingUsers && usersList.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Loader2 size={24} className="animate-spin mx-auto text-teal-400" />
                <p className="text-xs">Querying authoritative user registry and employee mappings...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-12 px-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">No Matching Accounts Found</h4>
                <p className="text-xs text-slate-400">Try adjusting your department, shift, or search filter.</p>
              </div>
            ) : userViewMode === 'grouped' ? (
              <div className="space-y-6">
                {/* 1. Doctor & Staff Employee Accounts Grouped by Department */}
                {(() => {
                  const employeeUsers = filteredUsers.filter((u) => u.role === 'doctor' || u.role === 'staff');
                  const deptMap: Record<string, AdminUserRecord[]> = {};

                  for (const u of employeeUsers) {
                    const dept = u.department || 'Unassigned Department';
                    if (!deptMap[dept]) deptMap[dept] = [];
                    deptMap[dept].push(u);
                  }

                  const deptKeys = Object.keys(deptMap).sort();

                  return (
                    <div className="space-y-6">
                      {deptKeys.length === 0 && (roleFilter === 'doctor' || roleFilter === 'staff') && (
                        <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
                          No doctor or staff employee records found matching current filters.
                        </div>
                      )}

                      {deptKeys.map((deptName) => {
                        const members = deptMap[deptName];
                        const docCount = members.filter((m) => m.role === 'doctor').length;
                        const staffCount = members.filter((m) => m.role === 'staff').length;

                        return (
                          <div key={deptName} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
                            {/* Department Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                              <div className="flex items-center gap-2.5">
                                <Building2 size={16} className="text-teal-400" />
                                <h4 className="text-sm font-bold text-white tracking-wide">{deptName}</h4>
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-teal-500/10 text-teal-300 border border-teal-500/20">
                                  {members.length} {members.length === 1 ? 'Employee' : 'Employees'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                                <span>{docCount} Physicians</span>
                                <span>·</span>
                                <span>{staffCount} Clinical Staff</span>
                              </div>
                            </div>

                            {/* Employee Cards Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                              {members.map((u) => {
                                const userKey = u.id || u.email;
                                const pendingRole = selectedRoleChanges[userKey] || u.role;
                                const hasPendingChange = pendingRole !== u.role;
                                const isUpdating = updatingUserId === userKey;

                                return (
                                  <div
                                    key={userKey}
                                    className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                                  >
                                    {/* Header Row: User Identity & Mapping State */}
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex items-start gap-2.5">
                                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-teal-300 shrink-0 mt-0.5">
                                          {u.fullName?.charAt(0).toUpperCase() || u.email?.charAt(0).toUpperCase() || 'U'}
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <span className="font-semibold text-white leading-tight">{u.fullName || 'User'}</span>
                                            <span
                                              className={`text-[10px] px-2 py-0.5 rounded-full font-mono capitalize ${
                                                u.role === 'doctor'
                                                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                                                  : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                                              }`}
                                            >
                                              {u.role}
                                            </span>
                                          </div>
                                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">{u.email}</div>
                                        </div>
                                      </div>

                                      {/* Mapping Status Badge */}
                                      <div className="text-right shrink-0">
                                        {u.mappingStatus === 'Linked' ? (
                                          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                                            <Link2 size={11} />
                                            <span>Linked ({u.employeeId})</span>
                                          </span>
                                        ) : u.mappingStatus === 'Needs Review' ? (
                                          <span
                                            className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-mono bg-rose-500/10 text-rose-300 border border-rose-500/30"
                                            title={u.mappingNote}
                                          >
                                            <AlertTriangle size={11} />
                                            <span>Needs Review</span>
                                          </span>
                                        ) : (
                                          <span
                                            className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30"
                                            title={u.mappingNote}
                                          >
                                            <Unlink size={11} />
                                            <span>Unlinked</span>
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Workplace & Shift Details */}
                                    <div className="space-y-1.5 text-xs text-slate-400 pt-2 border-t border-slate-800/70">
                                      <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-slate-500">Employee Profile:</span>
                                        <span className="text-slate-200 font-medium">
                                          {u.employeeName || 'Not Assigned'} {u.specialty ? `· ${u.specialty}` : ''}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-slate-500">Shift Schedule:</span>
                                        <span className="text-teal-300 font-mono">
                                          {u.shiftName || 'Rotational'} · {u.shiftSchedule}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-slate-500">Selected Date Duty:</span>
                                        <span
                                          className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                                            u.dutyStatus === 'Completed'
                                              ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30'
                                              : u.dutyStatus === 'In Progress'
                                              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                                              : u.dutyStatus === 'Scheduled'
                                              ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                                              : 'bg-slate-900 text-slate-400 border border-slate-800'
                                          }`}
                                        >
                                          {u.dutyStatus || 'Off Duty'}
                                        </span>
                                      </div>

                                      {/* Assignment details (preserving multiple assignments accurately) */}
                                      {u.assignments && u.assignments.length > 0 ? (
                                        <div className="pt-1.5 space-y-1">
                                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                                            {u.assignments.length} {u.assignments.length === 1 ? 'Assignment' : 'Assignments'} on {formatDisplayDate(selectedDate)}:
                                          </span>
                                          <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                                            {u.assignments.map((asg, aIdx) => (
                                              <div key={asg.assignmentId || aIdx} className="text-[11px] p-1.5 rounded bg-slate-900/90 border border-slate-800/80 flex items-center justify-between">
                                                <div className="truncate pr-2">
                                                  <span className="text-slate-200 font-medium">{asg.assignmentType}</span>
                                                  {asg.startTime && (
                                                    <span className="text-cyan-400 font-mono ml-1.5">
                                                      {asg.startTime}{asg.endTime ? ` - ${asg.endTime}` : ''}
                                                    </span>
                                                  )}
                                                </div>
                                                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                                  {asg.dutyStatus}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-[10px] text-slate-500 italic">
                                          No clinical appointments or shift assignments on {formatDisplayDate(selectedDate)}.
                                        </div>
                                      )}
                                    </div>

                                    {/* Role Mutation Controls */}
                                    <div className="pt-2 border-t border-slate-800/70 flex items-center justify-between gap-2">
                                      <span className="text-[11px] text-slate-400">Mutate Role Privilege:</span>
                                      <div className="flex items-center gap-2">
                                        <select
                                          value={pendingRole}
                                          onChange={(e) => {
                                            const val = e.target.value as HospitalRole;
                                            setSelectedRoleChanges((prev) => ({
                                              ...prev,
                                              [userKey]: val,
                                            }));
                                          }}
                                          disabled={isUpdating}
                                          className="bg-slate-900 border border-slate-800 text-xs rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer disabled:opacity-60"
                                        >
                                          <option value="patient">Patient</option>
                                          <option value="doctor">Doctor</option>
                                          <option value="staff">Staff</option>
                                          <option value="admin">Platform Admin</option>
                                        </select>

                                        <button
                                          type="button"
                                          onClick={() => handleApplyRoleChange(u)}
                                          disabled={!hasPendingChange || isUpdating}
                                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                                            hasPendingChange
                                              ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-xs'
                                              : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                                          }`}
                                          title={hasPendingChange ? `Change role to ${pendingRole.toUpperCase()} in database` : 'Select a different role to update'}
                                        >
                                          {isUpdating ? (
                                            <>
                                              <Loader2 size={12} className="animate-spin" />
                                              <span>Syncing...</span>
                                            </>
                                          ) : (
                                            <>
                                              <CheckCircle2 size={12} />
                                              <span>Apply</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* 2. Platform Administration Section */}
                {(roleFilter === 'all' || roleFilter === 'admin') && (
                  <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-indigo-400" />
                        <h4 className="text-sm font-bold text-white tracking-wide">
                          Executive Administration & Governance ({filteredUsers.filter((u) => u.role === 'admin').length})
                        </h4>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">Platform Authorizers</span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                      {filteredUsers.filter((u) => u.role === 'admin').map((u) => {
                        const userKey = u.id || u.email;
                        const pendingRole = selectedRoleChanges[userKey] || u.role;
                        const hasPendingChange = pendingRole !== u.role;
                        const isUpdating = updatingUserId === userKey;

                        return (
                          <div key={userKey} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-300 shrink-0">
                                  {u.fullName?.charAt(0).toUpperCase() || 'A'}
                                </div>
                                <div>
                                  <div className="font-semibold text-white leading-tight">{u.fullName}</div>
                                  <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                                </div>
                              </div>
                              <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                                Platform Admin
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/70 flex items-center justify-between">
                              <span className="text-slate-500">Governance Level:</span>
                              <span className="text-slate-200">Full Executive Authorization</span>
                            </div>

                            <div className="pt-2 border-t border-slate-800/70 flex items-center justify-between gap-2">
                              <span className="text-[11px] text-slate-400">Mutate Role:</span>
                              <div className="flex items-center gap-2">
                                <select
                                  value={pendingRole}
                                  onChange={(e) => {
                                    const val = e.target.value as HospitalRole;
                                    setSelectedRoleChanges((prev) => ({
                                      ...prev,
                                      [userKey]: val,
                                    }));
                                  }}
                                  disabled={isUpdating}
                                  className="bg-slate-900 border border-slate-800 text-xs rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-teal-500"
                                >
                                  <option value="patient">Patient</option>
                                  <option value="doctor">Doctor</option>
                                  <option value="staff">Staff</option>
                                  <option value="admin">Platform Admin</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleApplyRoleChange(u)}
                                  disabled={!hasPendingChange || isUpdating}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                                    hasPendingChange
                                      ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-xs cursor-pointer'
                                      : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                                  }`}
                                >
                                  {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                  <span>Apply</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Registered Patients Directory */}
                {(roleFilter === 'all' || roleFilter === 'patient') && (
                  <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-teal-400" />
                        <h4 className="text-sm font-bold text-white tracking-wide">
                          Registered Patient Accounts ({filteredUsers.filter((u) => u.role === 'patient').length})
                        </h4>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">Patient Portal Access</span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                      {filteredUsers.filter((u) => u.role === 'patient').map((u) => {
                        const userKey = u.id || u.email;
                        const pendingRole = selectedRoleChanges[userKey] || u.role;
                        const hasPendingChange = pendingRole !== u.role;
                        const isUpdating = updatingUserId === userKey;

                        return (
                          <div key={userKey} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-teal-950/80 border border-teal-500/30 flex items-center justify-center font-bold text-xs text-teal-300 shrink-0">
                                  {u.fullName?.charAt(0).toUpperCase() || 'P'}
                                </div>
                                <div>
                                  <div className="font-semibold text-white leading-tight">{u.fullName}</div>
                                  <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                                </div>
                              </div>
                              <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono bg-teal-500/10 text-teal-300 border border-teal-500/30">
                                {u.patient_id || 'Patient Account'}
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/70 flex items-center justify-between">
                              <span className="text-slate-500">Portal Access:</span>
                              <span className="text-teal-300 font-medium">Personal Medical Records & Appointments</span>
                            </div>

                            <div className="pt-2 border-t border-slate-800/70 flex items-center justify-between gap-2">
                              <span className="text-[11px] text-slate-400">Mutate Role:</span>
                              <div className="flex items-center gap-2">
                                <select
                                  value={pendingRole}
                                  onChange={(e) => {
                                    const val = e.target.value as HospitalRole;
                                    setSelectedRoleChanges((prev) => ({
                                      ...prev,
                                      [userKey]: val,
                                    }));
                                  }}
                                  disabled={isUpdating}
                                  className="bg-slate-900 border border-slate-800 text-xs rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-teal-500"
                                >
                                  <option value="patient">Patient</option>
                                  <option value="doctor">Doctor</option>
                                  <option value="staff">Staff</option>
                                  <option value="admin">Platform Admin</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleApplyRoleChange(u)}
                                  disabled={!hasPendingChange || isUpdating}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                                    hasPendingChange
                                      ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-xs cursor-pointer'
                                      : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                                  }`}
                                >
                                  {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                  <span>Apply</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Directory Table View (when userViewMode === 'directory') */
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 font-semibold">
                      <tr>
                        <th className="py-3 px-4">Participant Account</th>
                        <th className="py-3 px-4">Role & Mapping State</th>
                        <th className="py-3 px-4">Department & Specialty</th>
                        <th className="py-3 px-4">Shift & Date Duty</th>
                        <th className="py-3 px-4 text-right">Role Privilege Mutation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {filteredUsers.map((u) => {
                        const userKey = u.id || u.email;
                        const pendingRole = selectedRoleChanges[userKey] || u.role;
                        const hasPendingChange = pendingRole !== u.role;
                        const isUpdating = updatingUserId === userKey;

                        return (
                          <tr key={userKey} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-teal-300 shrink-0">
                                  {u.fullName?.charAt(0).toUpperCase() || u.email?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div>
                                  <div className="font-semibold text-white leading-tight">{u.fullName || 'User'}</div>
                                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">{u.email}</div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <div className="space-y-1">
                                <span
                                  className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-mono capitalize ${
                                    u.role === 'admin'
                                      ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                                      : u.role === 'doctor'
                                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                                      : u.role === 'staff'
                                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-teal-500/10 text-teal-300 border border-teal-500/30'
                                  }`}
                                >
                                  {u.role}
                                </span>
                                <div>
                                  {u.mappingStatus === 'Linked' ? (
                                    <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                                      <Link2 size={10} />
                                      {u.employeeId}
                                    </span>
                                  ) : u.mappingStatus === 'Needs Review' ? (
                                    <span className="text-[10px] font-mono text-rose-400 flex items-center gap-1" title={u.mappingNote}>
                                      <AlertTriangle size={10} />
                                      Review
                                    </span>
                                  ) : u.mappingStatus === 'Unlinked' ? (
                                    <span className="text-[10px] font-mono text-amber-400 flex items-center gap-1">
                                      <Unlink size={10} />
                                      Unlinked
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-mono text-slate-400">{u.employeeId || 'N/A'}</span>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <div className="text-white font-medium">{u.department || 'Unassigned'}</div>
                              <div className="text-[11px] text-slate-400">{u.specialty || u.employeeName || '—'}</div>
                            </td>

                            <td className="py-3 px-4">
                              <div className="text-teal-300 font-mono text-[11px]">{u.shiftSchedule || 'Off Duty'}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Status: <span className="text-slate-300 font-medium">{u.dutyStatus}</span>
                                {u.assignmentCount !== undefined && u.assignmentCount > 0 && (
                                  <span className="ml-1 text-cyan-400">({u.assignmentCount} tasks)</span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-2">
                                <select
                                  value={pendingRole}
                                  onChange={(e) => {
                                    const val = e.target.value as HospitalRole;
                                    setSelectedRoleChanges((prev) => ({
                                      ...prev,
                                      [userKey]: val,
                                    }));
                                  }}
                                  disabled={isUpdating}
                                  className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer disabled:opacity-60"
                                >
                                  <option value="patient">Patient</option>
                                  <option value="doctor">Doctor</option>
                                  <option value="staff">Staff</option>
                                  <option value="admin">Platform Admin</option>
                                </select>

                                <button
                                  type="button"
                                  onClick={() => handleApplyRoleChange(u)}
                                  disabled={!hasPendingChange || isUpdating}
                                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                                    hasPendingChange
                                      ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-xs'
                                      : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                                  }`}
                                  title={hasPendingChange ? `Change role to ${pendingRole.toUpperCase()} in database` : 'Select a different role to update'}
                                >
                                  {isUpdating ? (
                                    <>
                                      <Loader2 size={12} className="animate-spin" />
                                      <span>Syncing...</span>
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 size={12} />
                                      <span>Apply</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Executive Role Change Audit Trail */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-teal-400" />
                  <h4 className="text-sm font-bold text-white">Executive Role Governance Audit Trail</h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({auditLogs.length} logged events)
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  Administrative Action Log
                </span>
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No role mutation events recorded.</p>
                ) : (
                  auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{log.targetUserName || log.targetUserEmail}</span>
                          <span className="text-slate-500">·</span>
                          <span className="text-slate-400 font-mono">{log.targetUserEmail}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="capitalize text-rose-300/80 line-through">{log.previousRole}</span>
                          <ArrowRight size={11} className="text-slate-500" />
                          <span className="capitalize text-teal-300 font-bold">{log.newRole}</span>
                          <span className="text-slate-600">|</span>
                          <span className="italic text-slate-300">{log.reason || 'Governance authorization'}</span>
                        </div>
                      </div>

                      <div className="text-right sm:shrink-0 text-[11px]">
                        <div className="text-slate-400 font-mono">
                          {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-[10px] text-teal-400/90 font-mono mt-0.5">
                          Admin: {log.adminName}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Patient Feedback & Experience Analytics */}
        {activeTab === 'feedback' && (
          <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Patient Experience & Feedback Analytics</h3>
                  <span className="text-xs text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {formatDisplayDate(selectedDate)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verified patient feedback submissions linked to the shared operations date in <span className="text-slate-300 font-medium">Asia/Kolkata</span>. Excludes invalid ratings and aggregates authentic scores from <span className="text-slate-300 font-mono">silver_feedback</span>.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => loadFeedbackAnalytics(selectedDate)}
                  disabled={isLoadingFeedback}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-60"
                  title="Refresh patient feedback analytics"
                >
                  <RefreshCw size={13} className={isLoadingFeedback ? 'animate-spin text-teal-400' : 'text-slate-400'} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* 4 Required Metrics Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. Daily Feedback Count */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Daily Feedback ({selectedDate.split('-').slice(1).join('/')})
                  </span>
                  <span className="text-xl font-bold font-mono text-white mt-0.5 block">
                    {feedbackAnalytics?.metrics.dailyFeedbackCount ?? 0}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                  <Star size={16} />
                </div>
              </div>

              {/* 2. Daily Average Rating */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Daily Average Rating
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl font-bold font-mono text-amber-300">
                      {feedbackAnalytics?.metrics.dailyAverageRating !== null && feedbackAnalytics?.metrics.dailyAverageRating !== undefined
                        ? feedbackAnalytics.metrics.dailyAverageRating.toFixed(2)
                        : '—'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({feedbackAnalytics?.metrics.dailyRatingCount ?? 0} ratings)
                    </span>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Star size={16} fill="currentColor" />
                </div>
              </div>

              {/* 3. Overall Feedback Count */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Overall Feedback Count
                  </span>
                  <span className="text-xl font-bold font-mono text-cyan-300 mt-0.5 block">
                    {feedbackAnalytics?.metrics.overallFeedbackCount ?? 0}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400" title="Total feedback records across all available dates">
                  <Database size={16} />
                </div>
              </div>

              {/* 4. Overall Average Rating */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Overall Average Rating
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl font-bold font-mono text-emerald-300">
                      {feedbackAnalytics?.metrics.overallAverageRating !== undefined
                        ? feedbackAnalytics.metrics.overallAverageRating.toFixed(2)
                        : '4.88'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({feedbackAnalytics?.metrics.overallRatingCount ?? 0} total)
                    </span>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400" title="Average of valid numeric ratings across all dates">
                  <TrendingUp size={16} />
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                {/* Search input */}
                <div className="relative flex-1 max-w-md">
                  <Search size={14} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={feedbackSearch}
                    onChange={(e) => setFeedbackSearch(e.target.value)}
                    placeholder="Search by feedback ID, patient name, doctor, or comments..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>

                {/* Sort dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Sort By:</span>
                  <select
                    value={feedbackSortBy}
                    onChange={(e) => setFeedbackSortBy(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-xs rounded-xl px-3 py-1.5 text-slate-300 focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="time_desc">Submission Time (Newest)</option>
                    <option value="time_asc">Submission Time (Oldest)</option>
                    <option value="rating_desc">Rating (High to Low)</option>
                    <option value="rating_asc">Rating (Low to High)</option>
                  </select>
                </div>
              </div>

              {/* Secondary Filters: Rating & Category */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {/* Rating filter */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto">
                  {(['all', '5', '4', '3', '2', '1'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFeedbackRatingFilter(r)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                        feedbackRatingFilter === r
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {r === 'all' ? 'All Ratings' : `${r} Stars`}
                    </button>
                  ))}
                </div>

                {/* Category filter */}
                <select
                  value={feedbackCategoryFilter}
                  onChange={(e) => setFeedbackCategoryFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-xs rounded-xl px-3 py-1.5 text-slate-300 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="all">All Specialties / Categories</option>
                  {(feedbackAnalytics?.categories || []).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                {/* Reset Filters */}
                {(feedbackSearch || feedbackRatingFilter !== 'all' || feedbackCategoryFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setFeedbackSearch('');
                      setFeedbackRatingFilter('all');
                      setFeedbackCategoryFilter('all');
                    }}
                    className="px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            {/* Feedback List / Table */}
            {isLoadingFeedback && !feedbackAnalytics ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Loader2 size={24} className="animate-spin mx-auto text-teal-400" />
                <p className="text-xs">Querying patient feedback analytics for {formatDisplayDate(selectedDate)}...</p>
              </div>
            ) : !feedbackAnalytics || feedbackAnalytics.feedbackList.length === 0 ? (
              <div className="py-16 px-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                  <Star size={20} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">No Patient Feedback on {formatDisplayDate(selectedDate)}</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    No feedback records were submitted on this date matching your current filters. Try selecting a different date from the top header or clearing active filters.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="text-xs font-mono text-slate-400 flex items-center justify-between px-1">
                  <span>Showing {feedbackAnalytics.feedbackList.length} feedback submissions for {formatDisplayDate(selectedDate)}</span>
                  <span>Total Daily: {feedbackAnalytics.totalDailyItems}</span>
                </div>

                <div className="grid grid-cols-1 gap-3.5">
                  {feedbackAnalytics.feedbackList.map((fb: FeedbackItem) => (
                    <div
                      key={fb.id || fb.feedbackId}
                      className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/70 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold font-mono text-amber-300 text-xs shrink-0">
                            {fb.rating}.0
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{fb.patientName}</span>
                              <span className="text-xs text-slate-500 font-mono">({fb.patientId})</span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Attending: <span className="text-slate-300 font-medium">{fb.doctorName}</span> · <span className="text-teal-300">{fb.category}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-[11px] font-mono text-slate-400">
                            {new Date(fb.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                            ID: {fb.feedbackId}
                          </span>
                        </div>
                      </div>

                      {/* Comments */}
                      <p className="text-xs text-slate-300 italic bg-slate-950/80 p-3 rounded-lg border border-slate-800/80 leading-relaxed">
                        "{fb.comments || 'No written comments provided.'}"
                      </p>

                      {/* Sub-ratings / breakdown */}
                      <div className="flex flex-wrap items-center gap-4 text-xs font-mono pt-1 text-slate-400">
                        <div className="flex items-center gap-1.5 text-amber-300">
                          <Star size={12} fill="currentColor" />
                          <span>Overall Rating: {fb.rating}/5</span>
                        </div>
                        {fb.waitTimeRating !== null && fb.waitTimeRating !== undefined && (
                          <span>Wait Time: {fb.waitTimeRating}/5</span>
                        )}
                        {fb.cleanlinessRating !== null && fb.cleanlinessRating !== undefined && (
                          <span>Cleanliness: {fb.cleanlinessRating}/5</span>
                        )}
                        {fb.staffBehaviorRating !== null && fb.staffBehaviorRating !== undefined && (
                          <span>Staff Behavior: {fb.staffBehaviorRating}/5</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Broadcast Announcement Modal */}
      {isBroadcastModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Dispatch Operational Broadcast</h3>
                <span className="text-xs text-slate-400">Sends alert across physician and nursing consoles</span>
              </div>
              <button
                onClick={() => setIsBroadcastModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Advisory Title
                </label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="e.g. ICU Bed Surge Protocol Active"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Priority Level
                </label>
                <select
                  value={broadcastPriority}
                  onChange={(e) => setBroadcastPriority(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                >
                  <option value="Normal">Normal Advisory</option>
                  <option value="Urgent">Urgent Operational Alert</option>
                  <option value="Critical">Critical Clinical Surge</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Advisory Message
                </label>
                <textarea
                  rows={3}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Details for clinical leads, nurse stations, and emergency intake..."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-sans"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBroadcastModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 cursor-pointer"
                >
                  Dispatch Broadcast
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
