import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {installButtonAnalytics, installGlobalErrorAnalytics, trackScreen} from "../../../../src/web/analytics/events";
import {resetDevelopmentFirstRunState} from "../../../../src/web/developmentFirstRun";
import {FatalErrorBoundary} from "../../../../src/web/FatalErrorBoundary";
import {initializeBrowserSentryFromEnvironment} from "../../../../src/web/observability/sentryEnvironment";
import {FacebookPlatformEntry} from "./FacebookPlatformEntry";
import "../../../../src/web/styles.css";

void initializeBrowserSentryFromEnvironment();

if (import.meta.env.DEV) {
  resetDevelopmentFirstRunState();
}

installButtonAnalytics();
installGlobalErrorAnalytics();
trackScreen("startup");

/** Resolves the Facebook application mount point. */
const root = document.getElementById("root");
if (!root) throw new Error("facebook-root-missing");

createRoot(root).render(
  <StrictMode>
    <FatalErrorBoundary>
      <FacebookPlatformEntry />
    </FatalErrorBoundary>
  </StrictMode>,
);
