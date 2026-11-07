import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { reportError } from "../lib/monitoring";

interface Props {
  children: ReactNode;
  /** When this changes (e.g. the route), a shown error is cleared. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

// Catches render errors so one broken page shows a recovery screen instead of
// unmounting the whole app into a blank page.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, { componentStack: info.componentStack });
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive-soft">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </span>
        <h1 className="mt-5 text-2xl font-bold text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          An unexpected error stopped this page from loading. Reloading usually
          fixes it — if it keeps happening, please let us know.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button onClick={() => window.location.reload()} className="btn-primary">
            <RotateCw className="h-4 w-4" />
            Reload page
          </button>
          <a href="/" className="btn-outline">
            Back to the shop
          </a>
        </div>
      </div>
    );
  }
}
