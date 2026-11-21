import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert, Copy, Download, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      copied: false
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[GlobalErrorBoundary] Intercepted runtime exception:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  private getErrorReport = (): string => {
    const { error, errorInfo } = this.state;
    return [
      `OM LifeOS Error Report`,
      `Timestamp: ${new Date().toISOString()}`,
      `URL: ${window.location.href}`,
      `UserAgent: ${navigator.userAgent}`,
      `\nError: ${error?.message || String(error)}`,
      error?.stack ? `\nStack:\n${error.stack}` : '',
      errorInfo?.componentStack ? `\nComponent Stack:${errorInfo.componentStack}` : ''
    ].filter(Boolean).join('\n');
  };

  private handleCopyError = (): void => {
    navigator.clipboard.writeText(this.getErrorReport()).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  private handleDownloadReport = (): void => {
    const blob = new Blob([this.getErrorReport()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `om-error-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  private handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 p-4 sm:p-6 select-none font-sans">
          <div className="w-full max-w-lg rounded-3xl border border-red-900/50 bg-slate-900/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            {/* Header Icon */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-950/80 border border-red-700/60 text-red-400 shadow-inner">
              <ShieldAlert className="h-8 w-8 animate-pulse text-red-400" />
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                OM LifeOS - Self Healing Triggered
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                An unexpected runtime error stopped the app. Your data remains in this browser and has not been cleared.
              </p>
            </div>

            {/* Error Detail */}
            {this.state.error && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3 sm:p-4 text-left space-y-1 overflow-hidden">
                <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Error Diagnostics:</span>
                </div>
                <pre className="text-[11px] font-mono text-slate-300 break-words whitespace-pre-wrap max-h-28 overflow-y-auto">
                  {this.state.error.message || String(this.state.error)}
                </pre>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3 items-center justify-center">
              <button
                type="button"
                onClick={this.handleCopyError}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-700 hover:bg-slate-800 px-4 py-3 text-xs sm:text-sm font-bold text-slate-300 transition-all cursor-pointer"
              >
                {this.state.copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                <span>{this.state.copied ? 'Copied!' : 'Copy Error'}</span>
              </button>
              <button
                type="button"
                onClick={this.handleDownloadReport}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-700 hover:bg-slate-800 px-4 py-3 text-xs sm:text-sm font-bold text-slate-300 transition-all cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>Download Report</span>
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Reload System</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
