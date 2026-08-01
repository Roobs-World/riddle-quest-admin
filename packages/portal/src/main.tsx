import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {resetDevelopmentFirstRunState} from "./developmentFirstRun";
import {FatalErrorBoundary} from "./FatalErrorBoundary";
import {JestPlayApp} from "./jest/JestPlayApp";
import "./styles.css";
import {installButtonAnalytics, trackScreen} from "./analytics/googleAnalytics";
import {initializeGoogleAnalytics} from "./analytics/firebaseAnalytics";

if (import.meta.env.DEV) {
  resetDevelopmentFirstRunState(window.localStorage, window.sessionStorage);
}

installButtonAnalytics();
initializeGoogleAnalytics();
trackScreen("startup");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FatalErrorBoundary>
      <JestPlayApp />
    </FatalErrorBoundary>
  </StrictMode>,
);
