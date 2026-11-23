import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {installButtonAnalytics, installGlobalErrorAnalytics, trackScreen} from "../../../../packages/web-game/src/analytics/events";
import {resetDevelopmentFirstRunState} from "../../../../packages/web-game/src/developmentFirstRun";
import {FatalErrorBoundary} from "../../../../packages/web-game/src/FatalErrorBoundary";
import {initializeBrowserSentryFromEnvironment} from "../../../../packages/web-game/src/observability/sentryEnvironment";
import {JestPlayApp} from "./JestPlayApp";
import "../../../../packages/web-game/src/styles.css";
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
