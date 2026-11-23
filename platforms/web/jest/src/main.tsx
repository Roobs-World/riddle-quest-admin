import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {installButtonAnalytics, installGlobalErrorAnalytics, trackScreen} from "../../../../src/observability/analytics/events";
import {resetDevelopmentFirstRunState} from "../../../../src/app/startup/developmentFirstRun";
import {FatalErrorBoundary} from "../../../../src/app/components/recovery/FatalErrorBoundary";
import {initializeBrowserSentryFromEnvironment} from "../../../../src/observability/sentryEnvironment";
import {JestPlayApp} from "./JestPlayApp";
import "../../../../src/app/styles/game.css";
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
