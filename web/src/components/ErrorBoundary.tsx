import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Stale-chunk after a new deploy: auto-reload once to fetch the new bundle.
    const isStaleChunk =
      error.message.includes("Failed to fetch dynamically imported module") ||
      error.message.includes("Importing a module script failed");
    if (isStaleChunk) {
      const reloadKey = "eb_chunk_reload";
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, "1");
        window.location.reload();
        // Return non-error state so nothing renders before the reload fires.
        return { hasError: false, error: null };
      }
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Unhandled error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-stone-50 p-6">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100">
              <span className="text-2xl">⚠️</span>
            </div>
            <h1 className="text-lg font-black text-stone-950">Algo deu errado</h1>
            <p className="mt-2 text-sm text-stone-500">
              Ocorreu um erro inesperado. Recarregue a página para continuar.
            </p>
            {this.state.error && (
              <p className="mt-3 rounded-lg bg-stone-100 px-3 py-2 text-xs font-mono text-stone-600 text-left break-all">
                {this.state.error.message}
              </p>
            )}
            <button
              type="button"
              className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-600 transition-colors"
              onClick={() => window.location.reload()}
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
