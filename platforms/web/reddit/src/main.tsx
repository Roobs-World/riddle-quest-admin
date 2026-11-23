import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import "./localeNamespace";
import {RedditPlatformEntry} from "./RedditPlatformEntry";
import "../../../../packages/web-game/src/styles.css";

/** Provides root behavior. */
const root = document.getElementById("root");
if (!root) throw new Error("reddit-root-missing");

createRoot(root).render(
  <StrictMode>
    <RedditPlatformEntry />
  </StrictMode>,
);
