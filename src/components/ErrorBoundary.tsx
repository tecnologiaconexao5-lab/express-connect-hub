import React, { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[GLOBAL ERROR BOUNDARY] Captured uncaught React error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              Algo inesperado aconteceu
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              A aplicação encontrou um erro inesperado. Clique abaixo para reiniciar o sistema de forma segura.
            </p>
            {this.state.error?.message && (
              <div className="bg-red-50 rounded-lg p-3 text-left mb-6 font-mono text-xs text-red-700 overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
            <Button 
              onClick={this.handleReset}
              className="w-full bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl gap-2 font-semibold"
            >
              <RefreshCw className="w-4 h-4" />
              Recarregar Sistema
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
