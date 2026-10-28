/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { HospitalRole, ScreenState, AuthUser } from './types/auth';
import { LeftBrandPanel } from './components/LeftBrandPanel';
import { LoginScreen } from './components/LoginScreen';
import { SignupScreen } from './components/SignupScreen';
import { ForgotPasswordScreen } from './components/ForgotPasswordScreen';
import { ChangePasswordScreen } from './components/ChangePasswordScreen';
import { PatientDashboard } from './components/PatientDashboard';
import { DoctorDashboard } from './components/DoctorDashboard';
import { StaffDashboard } from './components/StaffDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { patientService } from './services/patientService';
import { authService } from './services/authService';

export default function App() {
  const [activeUser, setActiveUser] = useState<AuthUser | null>(() => {
    return authService.getActiveUser();
  });

  const [screen, setScreen] = useState<ScreenState>(() => {
    const user = authService.getActiveUser();
    if (user && user.role) {
      if (user.role === 'doctor') return 'doctor-dashboard';
      if (user.role === 'staff') return 'staff-dashboard';
      if (user.role === 'admin') return 'admin-dashboard';
      return 'patient-dashboard';
    }
    return patientService.isAuthenticated() ? 'patient-dashboard' : 'login';
  });

  const [selectedRole, setSelectedRole] = useState<HospitalRole>('patient');
  const [changePasswordData, setChangePasswordData] = useState<{
    patientId: string;
    tempToken?: string;
  } | null>(null);

  const handleNavigate = (
    newScreen: ScreenState,
    role?: HospitalRole,
    extra?: { patientId?: string; tempToken?: string; user?: AuthUser }
  ) => {
    const assignedRole = extra?.user?.role || role || activeUser?.role;
    if (assignedRole) {
      setSelectedRole(assignedRole);
    }
    if (extra?.user) {
      setActiveUser(extra.user);
    }
    if (newScreen === 'change-password' && extra?.patientId) {
      setChangePasswordData({
        patientId: extra.patientId,
        tempToken: extra.tempToken,
      });
    }
    // Strict Single-Role Access: lock dashboard view strictly to authenticated user role
    if (assignedRole && newScreen.endsWith('-dashboard')) {
      if (assignedRole === 'doctor') {
        setScreen('doctor-dashboard');
      } else if (assignedRole === 'staff') {
        setScreen('staff-dashboard');
      } else if (assignedRole === 'admin') {
        setScreen('admin-dashboard');
      } else {
        setScreen('patient-dashboard');
      }
    } else {
      setScreen(newScreen);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    authService.clearSession();
    patientService.clearSession();
    setActiveUser(null);
    setScreen('login');
    setSelectedRole('patient');
    setChangePasswordData(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Enforce single-role confinement across the session lifecycle
  useEffect(() => {
    if (activeUser?.role && screen.endsWith('-dashboard')) {
      const roleToScreen: Record<HospitalRole, ScreenState> = {
        doctor: 'doctor-dashboard',
        staff: 'staff-dashboard',
        admin: 'admin-dashboard',
        patient: 'patient-dashboard',
      };
      const authorizedScreen = roleToScreen[activeUser.role];
      if (authorizedScreen && screen !== authorizedScreen) {
        setScreen(authorizedScreen);
      }
    }
  }, [activeUser, screen]);

  // Render dedicated role-specific operational dashboards (no cross-role switching permitted)
  if (screen === 'patient-dashboard') {
    return <PatientDashboard user={activeUser} onLogout={handleLogout} />;
  }

  if (screen === 'doctor-dashboard') {
    return <DoctorDashboard user={activeUser} onLogout={handleLogout} />;
  }

  if (screen === 'staff-dashboard') {
    return <StaffDashboard user={activeUser} onLogout={handleLogout} />;
  }

  if (screen === 'admin-dashboard') {
    return <AdminDashboard user={activeUser} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500/30 selection:text-teal-200">
      {/* Main Split Screen Container */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-screen w-full relative">
        {/* Left Side: Brand, Healthcare AI Graphic, Medallion Architecture Badges */}
        <div className="w-full lg:w-1/2 xl:w-5/12 flex-shrink-0">
          <LeftBrandPanel />
        </div>

        {/* Right Side: Active Authentication Form (Common Login / Signup / Forgot Password) */}
        <div className="w-full lg:w-1/2 xl:w-7/12 flex-1 flex flex-col justify-center bg-slate-950/95 relative overflow-y-auto">
          {/* Subtle background glow */}
          <div className="pointer-events-none absolute top-0 right-0 w-80 h-80 rounded-full bg-teal-500/5 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-10 w-80 h-80 rounded-full bg-violet-600/5 blur-3xl" />

          {screen === 'login' && (
            <LoginScreen
              onNavigate={handleNavigate}
              selectedRole={selectedRole}
              onRoleChange={setSelectedRole}
            />
          )}

          {screen === 'signup' && (
            <SignupScreen
              onNavigate={handleNavigate}
              selectedRole={selectedRole}
              onRoleChange={setSelectedRole}
            />
          )}

          {screen === 'forgot-password' && (
            <ForgotPasswordScreen
              onNavigate={handleNavigate}
              selectedRole={selectedRole}
              onRoleChange={setSelectedRole}
            />
          )}

          {screen === 'change-password' && (
            <ChangePasswordScreen
              patientId={changePasswordData?.patientId || ''}
              tempToken={changePasswordData?.tempToken}
              onSuccess={() => {
                setChangePasswordData(null);
                setScreen('patient-dashboard');
              }}
              onCancel={() => {
                setChangePasswordData(null);
                setScreen('login');
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}
