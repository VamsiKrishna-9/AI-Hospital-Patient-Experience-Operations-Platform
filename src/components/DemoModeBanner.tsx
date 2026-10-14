/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Shield } from 'lucide-react';

export const DemoModeBanner: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-teal-500/20 px-4 py-2 text-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400" />
          </span>
          <span className="font-semibold text-teal-300 tracking-wide text-[11px]">
            INTERACTIVE PREVIEW:
          </span>
          <span className="text-slate-300 text-[11px]">
            Explore the MediAI patient, physician, staff, and administrator portals.
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-slate-400 text-[11px]">
          <Shield size={12} className="text-teal-400" />
          <span>Care Portal Prototype</span>
        </div>
      </div>
    </div>
  );
};
