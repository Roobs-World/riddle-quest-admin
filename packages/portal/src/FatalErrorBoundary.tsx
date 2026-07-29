import {Component, type ErrorInfo, type ReactNode} from "react";

export class FatalErrorBoundary extends Component<{children: ReactNode}, {error: Error | null}> {
  state = {error: null as Error | null};
  static getDerivedStateFromError(error: Error) { return {error}; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("[riddle-quest] fatal render error", error.message, info.componentStack); }
  render() {
    if (this.state.error) return <main className="route-missing"><div><h1>Riddle Quest stopped unexpectedly</h1><p>{this.state.error.message}</p><button onClick={() => window.location.reload()}>Retry</button></div></main>;
    return this.props.children;
  }
}
