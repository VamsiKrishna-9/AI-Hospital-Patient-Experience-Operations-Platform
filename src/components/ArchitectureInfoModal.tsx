/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Database, Server, BarChart3, ShieldCheck, Check, Layers } from 'lucide-react';
import { BRONZE_TABLES } from '../types/auth';
import { API_CONFIG } from '../services/apiConfig';

interface ArchitectureInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureInfoModal: React.FC<ArchitectureInfoModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="arch-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-8 text-slate-100">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close architecture modal"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-teal-950/80 border border-teal-500/40 text-teal-400">
            <Layers size={22} />
          </div>
          <div>
            <h2 id="arch-title" className="text-xl font-bold text-white">
              MediAI Architecture & Backend Roadmap
            </h2>
            <p className="text-xs text-slate-400">
              Future Integration Specs: Python FastAPI · MySQL hospital_db Medallion · Power BI
            </p>
          </div>
        </div>

        {/* Current State Notice */}
        <div className="mb-6 p-3.5 rounded-xl bg-teal-950/40 border border-teal-500/30 text-xs text-teal-200 flex items-start gap-3">
          <ShieldCheck size={18} className="text-teal-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-semibold text-teal-100">Standalone Client Demo Mode Active: </strong>
            All four role flows (Patient, Doctor, Staff, Admin) validate strictly on the frontend and are wired to dispatch to the service layer. No real backend, database, or Power BI connection is claimed.
          </div>
        </div>

        {/* Section 1: Python FastAPI Layer */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Server size={16} className="text-cyan-400" />
            <span>1. Python FastAPI Service Contracts</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            All browser requests are decoupled from database engines. Secure JWT/OAuth tokens with Argon2 password hashing will be serviced by the following endpoints:
          </p>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
            <div className="text-teal-400">POST {API_CONFIG.endpoints.login} <span className="text-slate-500 font-sans"># Role-based credentials verification</span></div>
            <div className="text-cyan-400">POST {API_CONFIG.endpoints.registerPatient} <span className="text-slate-500 font-sans"># Ingestion to bronze_patients</span></div>
            <div className="text-cyan-400">POST {API_CONFIG.endpoints.registerDoctor} <span className="text-slate-500 font-sans"># Ingestion to bronze_doctors (verified)</span></div>
            <div className="text-cyan-400">POST {API_CONFIG.endpoints.registerStaff} <span className="text-slate-500 font-sans"># Ingestion to bronze_staff</span></div>
            <div className="text-cyan-400">POST {API_CONFIG.endpoints.registerAdmin} <span className="text-slate-500 font-sans"># Ingestion with invite governance</span></div>
            <div className="text-violet-400">POST {API_CONFIG.endpoints.forgotPassword} <span className="text-slate-500 font-sans"># Secure OTP reset flow</span></div>
          </div>
        </div>

        {/* Section 2: MySQL hospital_db Medallion Architecture */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Database size={16} className="text-teal-400" />
            <span>2. Preserved MySQL Medallion Bronze Tables (`hospital_db`)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            The target database is MySQL <code className="text-teal-300 font-mono">hospital_db</code>. Existing Bronze tables are cataloged and preserved intact:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {BRONZE_TABLES.map((table) => (
              <div
                key={table}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 font-mono"
              >
                <Check size={12} className="text-emerald-400 shrink-0" />
                <span>{table}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 italic">
            * Browser NEVER connects directly to MySQL. Ingestion and ETL pipelines transform Bronze to Silver (cleansed models) and Gold (aggregated metrics).
          </p>
        </div>

        {/* Section 3: Power BI Analytics */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <BarChart3 size={16} className="text-violet-400" />
            <span>3. Microsoft Power BI Integration (Future Phase)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Executive hospital analytics and patient satisfaction metrics will connect via Power BI DirectQuery reading the Gold layer views (<code className="text-violet-300 font-mono">gold_hospital_operations_kpis</code>). No Power BI dashboards are enabled in this current auth phase.
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors cursor-pointer"
          >
            Understood & Close
          </button>
        </div>
      </div>
    </div>
  );
};
