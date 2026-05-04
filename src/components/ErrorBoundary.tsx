import React from 'react';

type ErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string | null;
};

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: null
  };

  public static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : 'Unexpected application error.';
    return { hasError: true, errorMessage: message };
  }

  public componentDidCatch(error: unknown, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] App crashed:', error, errorInfo);
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white px-6 py-16 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
          <div className="mx-auto max-w-2xl rounded-3xl border border-zinc-200 bg-zinc-50 p-8 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Something went wrong</p>
            <h1 className="mt-4 text-3xl font-black tracking-tight">We hit an unexpected error</h1>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
              Please refresh this page. If the issue continues, try again in a moment.
            </p>
            {this.state.errorMessage && (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                {this.state.errorMessage}
              </p>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white"
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
