import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {installButtonAnalytics, installGlobalErrorAnalytics, trackScreen} from "../../../../packages/web-game/src/analytics/events";
import {resetDevelopmentFirstRunState} from "../../../../packages/web-game/src/developmentFirstRun";
import {FatalErrorBoundary} from "../../../../packages/web-game/src/FatalErrorBoundary";
import {initializeBrowserSentryFromEnvironment} from "../../../../packages/web-game/src/observability/sentryEnvironment";
import {FacebookPlatformEntry} from "./FacebookPlatformEntry";
import "../../../../packages/web-game/src/styles.css";

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
