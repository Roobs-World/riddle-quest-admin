import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {YouTubePlayableApp} from "../../../../src/gameplay/components/local/LocalGameApp";
import "../../../../src/gameplay/styles/local-game.css";
import {createGameSnacksSdkPort} from "./GameSnacksSdkPort";
/** Provides root behavior. */
const root = document.getElementById("root");
if (!root) throw new Error("gamesnacks-root-missing");

createRoot(root).render(
  <StrictMode>
    <YouTubePlayableApp sdk={createGameSnacksSdkPort()} />
  </StrictMode>,
);
