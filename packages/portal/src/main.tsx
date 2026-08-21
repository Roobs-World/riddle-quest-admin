import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {resetDevelopmentFirstRunState} from "./developmentFirstRun";
import {FatalErrorBoundary} from "./FatalErrorBoundary";
import {PlatformEntry} from "#platform-entry";
import "./styles.css";
import {installButtonAnalytics, installGlobalErrorAnalytics, trackScreen} from "./analytics/googleAnalytics";
import {initializeBrowserSentryFromEnvironment} from "./observability/sentryEnvironment";

initializeBrowserSentryFromEnvironment();

if (import.meta.env.DEV) {
  resetDevelopmentFirstRunState(window.localStorage, window.sessionStorage);
}

installButtonAnalytics();
installGlobalErrorAnalytics();
trackScreen("startup");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FatalErrorBoundary>
      <PlatformEntry />
    </FatalErrorBoundary>
  </StrictMode>,
);
