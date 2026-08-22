import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {installButtonAnalytics, installGlobalErrorAnalytics, trackScreen} from "../analytics/events";
import {resetDevelopmentFirstRunState} from "../developmentFirstRun";
import {FatalErrorBoundary} from "../FatalErrorBoundary";
import {initializeBrowserSentryFromEnvironment} from "../observability/sentryEnvironment";
import {JestPlayApp} from "./JestPlayApp";
import "../styles.css";

initializeBrowserSentryFromEnvironment();

if (import.meta.env.DEV) {
  resetDevelopmentFirstRunState(window.localStorage, window.sessionStorage);
}

installButtonAnalytics();
installGlobalErrorAnalytics();
trackScreen("startup");

/** Resolves the Jest application mount point. */
const root = document.getElementById("root");
if (!root) throw new Error("jest-root-missing");

createRoot(root).render(
  <StrictMode>
    <FatalErrorBoundary>
      <JestPlayApp />
    </FatalErrorBoundary>
  </StrictMode>,
);
