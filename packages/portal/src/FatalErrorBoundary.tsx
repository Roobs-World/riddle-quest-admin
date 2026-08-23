import {Component, type ErrorInfo, type ReactNode} from "react";
import {trackEvent} from "./analytics/events";
import {captureBrowserException} from "./observability/browserErrorReporter";
import {tr} from "./play/i18n";

/** Provides fatal error boundary behavior. */
export class FatalErrorBoundary extends Component<{children: ReactNode}, {error: Error | null}> {
  /** Stores state. */
  override state = {error: null as Error | null};
  /** Gets derived state from error. */
  static getDerivedStateFromError(error: Error) { return {error}; }
  /** Provides component did catch behavior. */
  override componentDidCatch(error: Error, info: ErrorInfo) {
    trackEvent("client_error", {error_kind: "react_render"});
    captureBrowserException(error, {componentStack: info.componentStack, errorKind: "react_render"});
    console.error("[riddle-quest] fatal render error", error.message, info.componentStack);
  }
  /** Provides render behavior. */
  override render() {
    if (this.state.error) {
      return (
        <main className="route-missing">
          <div role="alert">
            <h1>{tr("ErrorMessages.FATAL_STARTUP_TITLE")}</h1>
            <p>{tr("ErrorMessages.GENERIC_UNEXPECTED_ERROR")}</p>
            <button onClick={() => window.location.reload()}>{tr("CommonButtons.RETRY")}</button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
