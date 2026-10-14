/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  CalendarPlus,
  CheckCircle2,
  Building2,
  Stethoscope,
  Star,
  ChevronRight,
} from 'lucide-react';

interface Stage {
  id: number;
  title: string;
  subtitle: string;
  detail: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  color: string;
  badge: string;
}

const STAGES: Stage[] = [
  {
    id: 0,
    title: 'Book Appointment',
    subtitle: 'Find Care Fast',
    detail: 'A patient selects a trusted doctor, chooses a convenient time slot, and books a visit.',
    icon: CalendarPlus,
    color: 'teal',
    badge: 'Step 1',
  },
  {
    id: 1,
    title: 'Appointment Confirmed',
    subtitle: 'Instant Assurance',
    detail: 'A confirmation card appears with a subtle checkmark animation and arrival details.',
    icon: CheckCircle2,
    color: 'cyan',
    badge: 'Step 2',
  },
  {
    id: 2,
    title: 'Hospital Visit',
    subtitle: 'Welcoming Check-In',
    detail: 'The patient arrives at the hospital and checks in smoothly with zero paperwork delays.',
    icon: Building2,
    color: 'sky',
    badge: 'Step 3',
  },
  {
    id: 3,
    title: 'Consultation',
    subtitle: 'Compassionate Care',
    detail: 'A doctor consults the patient in a calm, friendly, and unhurried clinical setting.',
    icon: Stethoscope,
    color: 'teal',
    badge: 'Step 4',
  },
  {
    id: 4,
    title: 'Share Feedback',
    subtitle: 'Continuous Improvement',
    detail: 'The patient submits a 5-star rating and a short feedback note to celebrate their care.',
    icon: Star,
    color: 'amber',
    badge: 'Step 5',
  },
];

export const PatientJourneyAnimation: React.FC = () => {
  const [activeStage, setActiveStage] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-advance through the 5 stages smoothly
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % STAGES.length);
    }, 3600);

    return () => clearInterval(interval);
  }, [isPaused]);

  const current = STAGES[activeStage];
  const IconComponent = current.icon;

  return (
    <div
      className="relative p-5 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-2xl backdrop-blur-md overflow-hidden transition-all duration-300"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="Patient Journey interactive animation"
    >
      {/* Soft ambient background glow */}
      <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-teal-500/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-cyan-500/10 blur-2xl" />

      {/* Top Header of the journey card */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-teal-300">
            Patient Experience Journey
          </span>
        </div>

        {/* Step dots with clickability */}
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Journey steps">
          {STAGES.map((stage) => {
            const isActive = activeStage === stage.id;
            return (
              <button
                key={stage.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Step ${stage.id + 1}: ${stage.title}`}
                onClick={() => setActiveStage(stage.id)}
                className={`transition-all duration-300 rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                  isActive
                    ? 'w-6 h-2 bg-gradient-to-r from-teal-400 to-cyan-400 shadow-[0_0_10px_rgba(45,212,191,0.5)]'
                    : 'w-2 h-2 bg-slate-700 hover:bg-slate-500'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* 5-Step Connected Pathway Bar */}
      <div className="relative mb-5 pt-1 px-1">
        {/* Pathway track background */}
        <div className="absolute top-1/2 left-4 right-4 h-0.5 -translate-y-1/2 bg-slate-800" />

        {/* Animated glowing progress pathway */}
        <div
          className="absolute top-1/2 left-4 h-0.5 -translate-y-1/2 bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-300 transition-all duration-700 ease-out shadow-[0_0_8px_rgba(45,212,191,0.6)]"
          style={{
            width: `calc(${(activeStage / (STAGES.length - 1)) * 100}% - 16px)`,
          }}
        />

        {/* Five Stage Node Buttons */}
        <div className="relative flex items-center justify-between z-10">
          {STAGES.map((stage) => {
            const isActive = activeStage === stage.id;
            const isCompleted = activeStage > stage.id;
            const StageIcon = stage.icon;

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setActiveStage(stage.id)}
                title={`${stage.badge}: ${stage.title}`}
                className={`group relative flex flex-col items-center justify-center cursor-pointer transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded-xl p-1`}
              >
                <div
                  className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-br from-teal-400 to-cyan-500 text-slate-950 scale-110 shadow-[0_0_18px_rgba(20,184,166,0.5)] ring-2 ring-white/30'
                      : isCompleted
                      ? 'bg-slate-800 text-teal-300 border border-teal-500/40'
                      : 'bg-slate-900 text-slate-500 border border-slate-800 group-hover:text-slate-300 group-hover:border-slate-700'
                  }`}
                >
                  <StageIcon size={16} className={isActive ? 'animate-pulse' : ''} />
                </div>

                <span
                  className={`mt-1.5 text-[10px] font-medium tracking-tight hidden sm:block transition-colors ${
                    isActive ? 'text-teal-300 font-semibold' : 'text-slate-500 group-hover:text-slate-400'
                  }`}
                >
                  {stage.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Featured Stage Detail Card (Animated Transition) */}
      <div className="relative p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 shadow-inner overflow-hidden">
        {/* Subtle accent border line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-teal-400/60 to-transparent" />

        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-teal-950/60 border border-teal-500/30 text-teal-300 shrink-0 mt-0.5 shadow-sm">
            <IconComponent size={20} className="text-teal-300 animate-pulse" />
          </div>

          <div className="space-y-1 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                <span>{current.title}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20 font-normal">
                  {current.badge}
                </span>
              </h3>
              <span className="text-[11px] text-cyan-400 font-medium">
                {current.subtitle}
              </span>
            </div>

            <p className="text-xs text-slate-300/90 leading-relaxed">
              {current.detail}
            </p>
          </div>
        </div>

        {/* Bottom subtle progress hint */}
        <div className="mt-3 pt-2.5 border-t border-slate-850 flex items-center justify-between text-[11px] text-slate-400">
          <span className="text-[10px] text-slate-400">
            Hover to pause · Step {activeStage + 1} of 5
          </span>
          <button
            type="button"
            onClick={() => setActiveStage((prev) => (prev + 1) % STAGES.length)}
            className="inline-flex items-center gap-0.5 text-teal-400 hover:text-teal-300 text-[11px] font-medium transition-colors cursor-pointer"
          >
            <span>Next Stage</span>
            <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};
