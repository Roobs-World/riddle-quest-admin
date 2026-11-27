import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {configureAnalyticsContext, installButtonAnalytics, installGlobalErrorAnalytics, trackScreen} from "../../../../src/observability/analytics/events";
import {resetDevelopmentFirstRunState} from "../../../../src/app/startup/developmentFirstRun";
import {FatalErrorBoundary} from "../../../../src/app/components/recovery/FatalErrorBoundary";
import {initializeBrowserSentryFromEnvironment} from "../../../../src/observability/sentryEnvironment";
import {FacebookPlatformEntry} from "./FacebookPlatformEntry";
import "../../../../src/app/styles/game.css";

void initializeBrowserSentryFromEnvironment();

if (import.meta.env.DEV) {
  resetDevelopmentFirstRunState();
}

configureAnalyticsContext({platform: "facebook", screen_class: "RiddleQuestWeb"});
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
