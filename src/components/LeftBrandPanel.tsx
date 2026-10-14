/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Calendar,
  HeartPulse,
  MessageSquareHeart,
} from 'lucide-react';
import { PatientJourneyAnimation } from './PatientJourneyAnimation';

export const LeftBrandPanel: React.FC = () => {
  return (
    <div className="relative flex flex-col justify-between h-full p-8 lg:p-12 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-r border-slate-800/80">
      {/* Subtle ambient gradient backdrops */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 -right-24 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/4 w-96 h-96 rounded-full bg-teal-600/10 blur-3xl" />

      {/* Subtle medical dot matrix overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top Header: Brand */}
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          {/* Logo Mark: Medical Symbol with Teal & Cyan Accent */}
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 p-[1.5px] shadow-lg shadow-teal-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <HeartPulse className="w-6 h-6 text-teal-400" />
            </div>
          </div>

          <div>
            <span className="text-2xl font-bold tracking-tight text-white font-sans">
              Medi<span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">AI</span>
            </span>
          </div>
        </div>
      </div>

      {/* Middle Content: Exact Headings, Supporting Copy & Patient Journey Animation */}
      <div className="relative z-10 my-8 lg:my-auto space-y-6">
        <div className="space-y-3">
          {/* Exact Eyebrow Text */}
          <div className="text-xs font-semibold uppercase tracking-widest text-teal-400">
            YOUR CARE JOURNEY, CONNECTED
          </div>

          {/* Exact Main Heading */}
          <h1 className="text-3xl lg:text-4xl xl:text-5xl font-extrabold tracking-tight text-white leading-[1.18]">
            Better Care.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-cyan-300">
              Every Step
            </span>{' '}
            of the Way.
          </h1>

          {/* Exact Supporting Text */}
          <p className="text-sm lg:text-base text-slate-300 leading-relaxed max-w-lg">
            From booking your appointment to meeting your doctor and sharing feedback, enjoy a more connected healthcare experience.
          </p>
        </div>

        {/* 5-Stage Animated Patient Journey */}
        <div className="pt-1">
          <PatientJourneyAnimation />
        </div>

        {/* Exactly Three Simple Benefits with Small Outline Icons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-200">
            <Calendar size={16} className="text-teal-400 shrink-0" />
            <span className="font-medium">Easy Appointment Booking</span>
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-200">
            <HeartPulse size={16} className="text-cyan-400 shrink-0" />
            <span className="font-medium">Connected Care</span>
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-200">
            <MessageSquareHeart size={16} className="text-teal-400 shrink-0" />
            <span className="font-medium">Patient Feedback</span>
          </div>
        </div>
      </div>

      {/* Clean bottom subtle spacer */}
      <div className="relative z-10 pt-4 border-t border-slate-850 flex items-center justify-between text-xs text-slate-400">
        <span className="text-slate-400">Compassionate Healthcare Experience</span>
        <span className="text-slate-400">Patient-First Platform</span>
      </div>
    </div>
  );
};
