import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {resetDevelopmentFirstRunState} from "./developmentFirstRun";
import {FatalErrorBoundary} from "./FatalErrorBoundary";
import {JestPlayApp} from "./jest/JestPlayApp";
import "./styles.css";

if (import.meta.env.DEV) {
  resetDevelopmentFirstRunState(window.localStorage, window.sessionStorage);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FatalErrorBoundary>
      <JestPlayApp />
    </FatalErrorBoundary>
  </StrictMode>,
);
