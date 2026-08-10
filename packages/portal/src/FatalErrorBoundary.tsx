import {Component, type ErrorInfo, type ReactNode} from "react";
import {trackEvent} from "./analytics/googleAnalytics";

/** Provides fatal error boundary behavior. */
export class FatalErrorBoundary extends Component<{children: ReactNode}, {error: Error | null}> {
  /** Stores state. */
  override state = {error: null as Error | null};
  /** Gets derived state from error. */
  static getDerivedStateFromError(error: Error) { return {error}; }
  /** Provides component did catch behavior. */
  override componentDidCatch(error: Error, info: ErrorInfo) {
    trackEvent("client_error", {error_kind: "react_render"});
    console.error("[riddle-quest] fatal render error", error.message, info.componentStack);
  }
  /** Provides render behavior. */
  override render() {
    if (this.state.error) return <main className="route-missing"><div role="alert"><h1>Riddle Quest stopped unexpectedly</h1><button onClick={() => window.location.reload()}>Retry</button></div></main>;
    return this.props.children;
  }
}
