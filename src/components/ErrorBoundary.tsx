/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[MediAI ErrorBoundary] Uncaught error caught:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F8FA] flex items-center justify-center p-4 font-sans text-[#172B4D]">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl border border-[#DCE5EC] text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <AlertCircle size={32} />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-extrabold text-[#172B4D]">Application Rendering Exception</h1>
              <p className="text-xs text-[#526581] leading-relaxed">
                An unexpected error occurred while rendering the clinical dashboard. Your session remains secure.
              </p>
              {this.state.error?.message && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px] text-rose-700 text-left overflow-x-auto mt-2">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-3 rounded-xl bg-white text-[#526581] border border-[#DCE5EC] hover:bg-slate-50 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Home size={15} />
                <span>Return</span>
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-3 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs shadow-md shadow-[#059669]/25 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw size={15} />
                <span>Reload Application</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
