import type {ReactElement} from "react";
import {FatalErrorBoundary} from "../FatalErrorBoundary";
import {
  configureAnalytics,
  resetAnalyticsForTests,
  setAnalyticsCollectionEnabled,
} from "../analytics/googleAnalytics";
import {captureBrowserException} from "../observability/sentry";

jest.mock("../observability/sentry", () => ({captureBrowserException: jest.fn()}));

describe("FatalErrorBoundary", () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    resetAnalyticsForTests();
    Object.defineProperty(globalThis, "window", {configurable: true, value: originalWindow});
    jest.restoreAllMocks();
  });

  it("renders its children before an error occurs", () => {
    const boundary = new FatalErrorBoundary({children: "game"});
    expect(boundary.render()).toBe("game");
  });

  it("derives error state and reports component failures", () => {
    const error = new Error("render failed");
    expect(FatalErrorBoundary.getDerivedStateFromError(error)).toEqual({error});
    const report = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const analytics = jest.fn();
    setAnalyticsCollectionEnabled(true);
    configureAnalytics(analytics);
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
    const reload = jest.fn();
    Object.defineProperty(globalThis, "window", {configurable: true, value: {location: {reload}}});
    const boundary = new FatalErrorBoundary({children: "game"});
    boundary.state = {error: new Error("offline")};

    const fallback = boundary.render() as ReactElement<{children: ReactElement<{children: ReactElement[]}>}>;
    const panel = fallback.props.children;
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
