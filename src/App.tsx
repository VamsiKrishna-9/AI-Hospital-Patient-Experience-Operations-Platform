/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { HospitalRole, ScreenState } from './types/auth';
import { LeftBrandPanel } from './components/LeftBrandPanel';
import { LoginScreen } from './components/LoginScreen';
import { SignupScreen } from './components/SignupScreen';
import { ForgotPasswordScreen } from './components/ForgotPasswordScreen';
import { ChangePasswordScreen } from './components/ChangePasswordScreen';
import { PatientDashboard } from './components/PatientDashboard';
import { DemoModeBanner } from './components/DemoModeBanner';
import { patientService } from './services/patientService';

export default function App() {
  const [screen, setScreen] = useState<ScreenState>(() => {
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
    extra?: { patientId?: string; tempToken?: string }
  ) => {
    if (role) {
      setSelectedRole(role);
    }
    if (newScreen === 'change-password' && extra?.patientId) {
      setChangePasswordData({
        patientId: extra.patientId,
        tempToken: extra.tempToken,
      });
    }
    setScreen(newScreen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    setScreen('login');
    setSelectedRole('patient');
    setChangePasswordData(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // If in Patient Dashboard view, render the dedicated dashboard
  if (screen === 'patient-dashboard') {
    return <PatientDashboard onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500/30 selection:text-teal-200">
      {/* Top Prototype Banner */}
      <DemoModeBanner />

      {/* Main Split Screen Container */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-[calc(100vh-41px)] w-full relative">
        {/* Left Side: Brand, Healthcare AI Graphic, Medallion Architecture Badges */}
        <div className="w-full lg:w-1/2 xl:w-5/12 flex-shrink-0">
          <LeftBrandPanel />
        </div>

        {/* Right Side: Active Authentication Form (Login / Signup / Forgot Password) */}
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
