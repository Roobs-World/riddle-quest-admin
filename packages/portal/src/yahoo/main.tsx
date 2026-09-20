import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {FatalErrorBoundary} from "../FatalErrorBoundary";
import {YahooPlatformEntry} from "./YahooPlatformEntry";
import "../styles.css";

/** Provides root behavior. */
const root = document.getElementById("root");
if (!root) throw new Error("yahoo-root-missing");

createRoot(root).render(
  <StrictMode>
    <FatalErrorBoundary>
      <YahooPlatformEntry />
    </FatalErrorBoundary>
  </StrictMode>,
);
