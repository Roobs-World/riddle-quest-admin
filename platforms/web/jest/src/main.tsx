import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {installButtonAnalytics, installGlobalErrorAnalytics, trackScreen} from "../../../../src/web/analytics/events";
import {resetDevelopmentFirstRunState} from "../../../../src/web/developmentFirstRun";
import {FatalErrorBoundary} from "../../../../src/web/FatalErrorBoundary";
import {initializeBrowserSentryFromEnvironment} from "../../../../src/web/observability/sentryEnvironment";
import {JestPlayApp} from "./JestPlayApp";
import "../../../../src/web/styles.css";
import "./styles.css";

void initializeBrowserSentryFromEnvironment();

if (import.meta.env.DEV) {
  resetDevelopmentFirstRunState();
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
