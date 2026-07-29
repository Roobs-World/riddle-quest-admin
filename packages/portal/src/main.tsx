import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {FatalErrorBoundary} from "./FatalErrorBoundary";
import {JestPlayApp} from "./jest/JestPlayApp";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FatalErrorBoundary>
      <JestPlayApp />
    </FatalErrorBoundary>
  </StrictMode>,
);
