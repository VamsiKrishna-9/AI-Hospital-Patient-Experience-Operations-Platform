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
  RefreshCw,
  UserCheck,
  History,
  Database,
  ArrowRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { AuthUser, HospitalRole } from '../types/auth';
import { adminService, AdminUserRecord, AdminAuditLog } from '../services/adminService';

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

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, onRoleSwitch }) => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'departments' | 'roster' | 'users' | 'feedback'>('metrics');
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [metrics, setMetrics] = useState<ExecutiveMetrics | null>(null);
  const [departments, setDepartments] = useState<DepartmentCapacity[]>([]);
  const [roster, setRoster] = useState<StaffMember[]>([]);
  const [feedback, setFeedback] = useState<FeedbackSummary[]>([]);
  const [searchRoster, setSearchRoster] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');

  // User Governance & Role Management State
  const [usersList, setUsersList] = useState<AdminUserRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | HospitalRole>('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [selectedRoleChanges, setSelectedRoleChanges] = useState<Record<string, HospitalRole>>({});
  const [roleChangeReason, setRoleChangeReason] = useState<string>('');

  // Broadcast announcement state
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState('Normal');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadUsersAndAuditLogs = async () => {
    setIsLoadingUsers(true);
    try {
      const [usersRes, auditRes] = await Promise.all([
        adminService.fetchUsers(),
        adminService.fetchAuditLogs(),
      ]);
      if (usersRes.success) {
        setUsersList(usersRes.users);
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
      (u.patient_id && u.patient_id.toLowerCase().includes(term)) ||
      (u.doctor_id && u.doctor_id.toLowerCase().includes(term)) ||
      (u.staff_id && u.staff_id.toLowerCase().includes(term));
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500/30 selection:text-teal-200">
      {/* Top Bar Contract: 3 zones */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-3">
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
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab('metrics')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'metrics'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Executive Metrics
            </button>
            <button
              onClick={() => setActiveTab('departments')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'departments'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Department Capacities ({departments.length})
            </button>
            <button
              onClick={() => setActiveTab('roster')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'roster'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Staff Roster ({roster.length})
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'feedback'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Patient Feedback ({feedback.length})
            </button>
          </nav>

          {/* Zone 3: Primary Action & Profile */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsBroadcastModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors cursor-pointer"
            >
              <Bell size={14} />
              <span>Broadcast</span>
            </button>
            <div className="hidden sm:block text-right">
              <div className="text-xs font-medium text-white">{user?.name || 'Arthur Sterling, MHA'}</div>
              <div className="text-[10px] text-slate-400 font-mono">COO & Governance</div>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Switch hospital workspace"
              >
                <span className="text-slate-500 hidden sm:inline">Role:</span>
                <span className="text-indigo-400 font-bold">Admin</span>
                <ChevronRight size={13} className={`transform transition-transform text-slate-500 ${isRoleMenuOpen ? 'rotate-90' : ''}`} />
              </button>

              {isRoleMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-1.5 z-50 text-xs">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">
                    Switch Workspace
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRoleMenuOpen(false);
                      onRoleSwitch?.('patient');
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Patient Portal</span>
                    <span className="text-[10px] text-teal-400 font-mono">Care</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRoleMenuOpen(false);
                      onRoleSwitch?.('doctor');
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Doctor Workspace</span>
                    <span className="text-[10px] text-cyan-400 font-mono">Clinical</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRoleMenuOpen(false);
                      onRoleSwitch?.('staff');
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Staff / Ward 4B</span>
                    <span className="text-[10px] text-emerald-400 font-mono">Ops</span>
                  </button>
                  <div className="w-full text-left px-2.5 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-300 font-bold flex items-center justify-between">
                    <span>Admin Governance</span>
                    <CheckCircle2 size={13} className="text-indigo-400" />
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">System Bed Occupancy</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white font-mono tabular-nums">
                {metrics ? `${metrics.bedOccupancyRate}%` : '—'}
              </span>
              <span className="text-xs text-teal-400 font-mono">Nominal Range</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Avg Emergency Triage Time</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white font-mono tabular-nums">
                {metrics ? `${metrics.avgWaitTimeMinutes}` : '—'} <span className="text-xs font-sans text-slate-400">min</span>
              </span>
              <span className="text-xs text-teal-400">Target &lt; 20m</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Active Patient Registry</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white font-mono tabular-nums">
                {metrics ? metrics.totalActivePatients.toLocaleString() : '—'}
              </span>
              <span className="text-xs text-slate-400">Database Verified</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Patient Satisfaction</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-amber-400 font-mono tabular-nums">
                {metrics ? `${metrics.patientSatisfactionScore}` : '—'} <span className="text-xs font-sans text-slate-400">/ 5.0</span>
              </span>
              <span className="text-xs text-amber-400/80 font-mono">Verified Feedback</span>
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

        {/* Tab 1: Executive Metrics Overview */}
        {activeTab === 'metrics' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Department summary list */}
            <div className="lg:col-span-8 bg-slate-900/60 rounded-xl border border-slate-800/80 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Clinical Service Capacity Breakdown</h3>
                  <p className="text-xs text-slate-400">Real-time bed utilization across specialized medical departments.</p>
                </div>
                <span className="text-xs text-teal-400 font-mono">6 Clinical Units</span>
              </div>

              <div className="space-y-3.5">
                {departments.map((dept) => (
                  <div key={dept.id} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-white">{dept.name}</span>
                        <span className="text-slate-500 text-[11px] ml-2">ID: {dept.id}</span>
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
            <div className="lg:col-span-4 bg-slate-900/60 rounded-xl border border-slate-800/80 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-3">
                Workforce & Governance Ratios
              </h3>

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
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setIsBroadcastModalOpen(true)}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send size={14} />
                  <span>Send Operations Broadcast</span>
                </button>
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

        {/* Tab 3: Staff Roster */}
        {activeTab === 'roster' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={14} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  value={searchRoster}
                  onChange={(e) => setSearchRoster(e.target.value)}
                  placeholder="Search staff by name, role, or ID..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-teal-500"
              >
                <option value="all">All Departments</option>
                <option value="Cardiology">Cardiology</option>
                <option value="Internal Medicine">Internal Medicine</option>
                <option value="Emergency">Emergency</option>
                <option value="Intensive Care">Intensive Care</option>
                <option value="Ward 4B">Ward 4B</option>
                <option value="Pharmacy">Pharmacy</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredRoster.map((st) => (
                <div key={st.id} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-teal-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {st.id}
                      </span>
                      <h4 className="text-sm font-bold text-white">{st.name}</h4>
                    </div>
                    <div className="text-xs text-slate-300">{st.role} · {st.department}</div>
                    <div className="text-[11px] text-slate-400">Shift: {st.shift} · Active Patients: {st.patients}</div>
                  </div>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                      st.duty === 'On Duty'
                        ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                        : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                    }`}
                  >
                    {st.duty}
                  </span>
                </div>
              ))}
            </div>
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
                  <span className="text-xs text-teal-400 font-mono bg-teal-950/80 px-2 py-0.5 rounded border border-teal-500/30">
                    Live Database Sync
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Authorize privilege transitions across hospital roles. Role modifications immediately commit to Supabase PostgreSQL <code className="text-slate-300 font-mono">app_users</code> and record in executive audit logs.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={loadUsersAndAuditLogs}
                  disabled={isLoadingUsers}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-60"
                  title="Refresh user accounts from database"
                >
                  <RefreshCw size={13} className={isLoadingUsers ? 'animate-spin text-teal-400' : 'text-slate-400'} />
                  <span>Refresh DB</span>
                </button>
              </div>
            </div>

            {/* Filter Bar: Search, Role Selector, and Audit Note */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
              {/* Search input */}
              <div className="lg:col-span-5 relative">
                <Search size={14} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  placeholder="Search by name, email, or ID (e.g. P182162, DOC-7721)..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>

              {/* Role filter buttons */}
              <div className="lg:col-span-4 flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 overflow-x-auto">
                {(['all', 'patient', 'doctor', 'staff', 'admin'] as const).map((r) => (
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
                    {r === 'all' ? `All (${usersList.length})` : `${r}s`}
                  </button>
                ))}
              </div>

              {/* Audit reason input */}
              <div className="lg:col-span-3">
                <input
                  type="text"
                  value={roleChangeReason}
                  onChange={(e) => setRoleChangeReason(e.target.value)}
                  placeholder="Governance note / justification..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Accounts Directory Table */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Participant / Account</th>
                      <th className="py-3 px-4">Identifier</th>
                      <th className="py-3 px-4">Current Role</th>
                      <th className="py-3 px-4">Database Source</th>
                      <th className="py-3 px-4 text-right">Role Privilege Mutation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {isLoadingUsers && usersList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          <Loader2 size={18} className="animate-spin inline mr-2 text-teal-400" />
                          Querying authoritative user registry...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          No registered accounts found matching your query.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
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

                            <td className="py-3 px-4 font-mono text-[11px]">
                              {u.patient_id ? (
                                <span className="text-teal-400 font-bold">{u.patient_id}</span>
                              ) : u.doctor_id ? (
                                <span className="text-cyan-400 font-bold">{u.doctor_id}</span>
                              ) : u.staff_id ? (
                                <span className="text-emerald-400 font-bold">{u.staff_id}</span>
                              ) : (
                                <span className="text-slate-500 italic">None</span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 font-medium">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    u.role === 'admin'
                                      ? 'bg-indigo-400'
                                      : u.role === 'doctor'
                                      ? 'bg-cyan-400'
                                      : u.role === 'staff'
                                      ? 'bg-emerald-400'
                                      : 'bg-teal-400'
                                  }`}
                                />
                                <span className="capitalize text-slate-200">{u.role}</span>
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                                <Database size={11} className="text-slate-500" />
                                {u.source || 'Supabase PostgreSQL'}
                              </span>
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
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

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
                  Database Action Log
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

        {/* Tab 4: Patient Feedback & Experience */}
        {activeTab === 'feedback' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Patient Experience Ratings & Care Feedback</h3>
                <p className="text-xs text-slate-400">Verified patient satisfaction reviews from silver_feedback.</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-amber-400 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
                <Star size={13} fill="currentColor" />
                <span>4.88 Average Rating</span>
              </div>
            </div>

            <div className="space-y-3.5">
              {feedback.map((fb) => (
                <div key={fb.id} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{fb.patient}</span>
                      <span className="text-xs text-slate-500">·</span>
                      <span className="text-xs text-slate-300">Physician: {fb.doctor} ({fb.department})</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">{fb.date}</span>
                  </div>

                  <p className="text-xs text-slate-300 italic bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                    "{fb.comments}"
                  </p>

                  <div className="flex items-center gap-4 text-xs font-mono text-amber-400">
                    <span>Overall: {fb.rating} / 5</span>
                    <span>Wait Time: {fb.waitRating} / 5</span>
                  </div>
                </div>
              ))}
            </div>
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
    </div>
  );
};
