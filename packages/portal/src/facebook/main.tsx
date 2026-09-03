import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {installButtonAnalytics, installGlobalErrorAnalytics, trackScreen} from "../analytics/events";
import {resetDevelopmentFirstRunState} from "../developmentFirstRun";
import {FatalErrorBoundary} from "../FatalErrorBoundary";
import {initializeBrowserSentryFromEnvironment} from "../observability/sentryEnvironment";
import {FacebookPlatformEntry} from "./FacebookPlatformEntry";
import "../styles.css";

initializeBrowserSentryFromEnvironment();

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
