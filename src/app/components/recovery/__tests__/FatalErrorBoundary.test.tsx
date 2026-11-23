import type {ReactElement} from "react";
import {FatalErrorBoundary} from "../FatalErrorBoundary";
import {configureAnalytics, resetAnalyticsForTests, setAnalyticsCollectionEnabled} from "../../../../observability/analytics/events";
import {captureBrowserException} from "../../../../observability/browserErrorReporter";

jest.mock("../../../../observability/browserErrorReporter", () => ({captureBrowserException: jest.fn()}));

describe("FatalErrorBoundary", () => {
  /** Provides original window behavior. */
  const originalWindow = globalThis.window;

  afterEach(() => {
    resetAnalyticsForTests();
    Object.defineProperty(globalThis, "window", {configurable: true, value: originalWindow});
    jest.restoreAllMocks();
  });

  it("renders its children before an error occurs", () => {
    /** Provides boundary behavior. */
    const boundary = new FatalErrorBoundary({children: "game"});
    expect(boundary.render()).toBe("game");
  });

  it("derives error state and reports component failures", () => {
    /** Provides error behavior. */
    const error = new Error("render failed");
    expect(FatalErrorBoundary.getDerivedStateFromError(error)).toEqual({error});
    /** Provides report behavior. */
    const report = jest.spyOn(console, "error").mockImplementation(() => undefined);
    /** Provides analytics behavior. */
    const analytics = jest.fn();
    setAnalyticsCollectionEnabled(true);
    configureAnalytics(analytics);
    /** Provides boundary behavior. */
    const boundary = new FatalErrorBoundary({children: "game"});

    boundary.componentDidCatch(error, {componentStack: "\n at Game", digest: undefined});

    expect(report).toHaveBeenCalledWith("[riddle-quest] fatal render error", "render failed", "\n at Game");
    expect(analytics).toHaveBeenCalledWith("client_error", {error_kind: "react_render"});
    expect(captureBrowserException).toHaveBeenCalledWith(error, {
      componentStack: "\n at Game",
      errorKind: "react_render",
    });
  });

  it("renders a retry action that reloads the page", () => {
    /** Provides reload behavior. */
    const reload = jest.fn();
    Object.defineProperty(globalThis, "window", {configurable: true, value: {location: {reload}}});
    /** Provides boundary behavior. */
    const boundary = new FatalErrorBoundary({children: "game"});
    boundary.state = {error: new Error("offline")};

    /** Provides fallback behavior. */
    const fallback = boundary.render() as ReactElement<{
      /** Stores children. */
      /** Stores children. */
      children: ReactElement<{
        /** Stores children. */
        /** Stores children. */
        children: ReactElement[];
      }>;
    }>;
    /** Provides panel behavior. */
    const panel = fallback.props.children;
    /** Provides children behavior. */
    const children = panel.props.children;
    expect(children[0].props.children).toBe("Startup failed");
    expect(children[1].props.children).toBe("An unexpected error occurred. Please try again.");
    expect(panel.props.role).toBe("alert");
    expect(children).toHaveLength(3);
    expect(children[2].props.children).toBe("Retry");
    children[2].props.onClick();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
