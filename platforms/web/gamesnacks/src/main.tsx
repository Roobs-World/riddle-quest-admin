import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {YouTubePlayableApp} from "../../../../src/web/playable/YouTubePlayableApp";
import "../../../../src/web/playable/styles.css";
import {createGameSnacksSdkPort} from "./GameSnacksSdkPort";
/** Provides root behavior. */
const root = document.getElementById("root");
if (!root) throw new Error("gamesnacks-root-missing");

createRoot(root).render(
  <StrictMode>
    <YouTubePlayableApp sdk={createGameSnacksSdkPort()} />
  </StrictMode>,
);
