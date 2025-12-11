import React, { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-200 p-6 text-center">
          <div className="bg-slate-800 p-8 rounded-lg border border-red-500/50 shadow-2xl max-w-md">
              <h1 className="text-3xl font-bold text-red-500 mb-4">Systemfel</h1>
              <p className="mb-6 text-slate-400">Ett oväntat fel inträffade i applikationen. Vi ber om ursäkt.</p>
              
              <div className="bg-black/50 p-4 rounded text-left font-mono text-xs text-red-300 mb-6 overflow-auto max-h-32">
                  {this.state.error?.toString()}
              </div>

              <button 
                onClick={() => window.location.reload()} 
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors w-full"
              >
                Starta om appen
              </button>
          </div>
        </div>
      );
    }

    return this.props.children || null;
  }
}

export default ErrorBoundary;