import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {PlatformEntry} from "./RedditPlatformEntry";
import "../styles.css";

/** Provides root behavior. */
const root = document.getElementById("root");
if (!root) throw new Error("reddit-root-missing");

createRoot(root).render(
  <StrictMode>
    <PlatformEntry />
  </StrictMode>,
);
