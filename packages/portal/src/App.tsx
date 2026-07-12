import {lazy, Suspense} from "react";
import type {ReactNode} from "react";

const AdminApp = lazy(() => import("./AdminApp").then((module) => ({default: module.AdminApp})));
const GameFrameApp = lazy(() => import("./play/GameFrameApp").then((module) => ({default: module.GameFrameApp})));
const PerformanceDashboardApp = lazy(() => import("./PerformanceDashboardApp").then((module) => ({default: module.PerformanceDashboardApp})));
const PlayHostApp = lazy(() => import("./play/PlayHostApp").then((module) => ({default: module.PlayHostApp})));

const BASE_PATH = "/riddle-quest";

const normalizePath = (path: string): string => {
  if (path.startsWith(BASE_PATH)) {
    return path.slice(BASE_PATH.length) || "/";
  }
  return path || "/";
};

export function App() {
  const route = normalizePath(window.location.pathname);

  if (route.startsWith("/play/game")) {
    return <RouteSuspense><GameFrameApp /></RouteSuspense>;
  }

  if (route.startsWith("/play")) {
    return <RouteSuspense><PlayHostApp /></RouteSuspense>;
  }

  if (route.startsWith("/performance")) {
    return <RouteSuspense><PerformanceDashboardApp /></RouteSuspense>;
  }

  if (route.startsWith("/admin") || route === "/") {
    return <RouteSuspense><AdminApp /></RouteSuspense>;
  }

  return (
    <main className="route-missing">
      <div>
        <h1>Qwordly</h1>
        <p>The requested portal route was not found.</p>
        <a href={`${BASE_PATH}/play/`}>Open Riddle Quest</a>
      </div>
    </main>
  );
}

function RouteSuspense({children}: {children: ReactNode}) {
  return (
    <Suspense fallback={<main className="route-loading">Loading...</main>}>
      {children}
    </Suspense>
  );
}
