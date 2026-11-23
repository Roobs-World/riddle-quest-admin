import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {createYouTubeSdkPort} from "./sdk";
import {YouTubePlayableApp} from "../../../../src/gameplay/components/local/LocalGameApp";
import "../../../../src/gameplay/styles/local-game.css";
/** Provides root behavior. */
const root = document.getElementById("root");
if (!root) throw new Error("youtube-root-missing");
/** Provides sdk behavior. */
const sdk = createYouTubeSdkPort();
createRoot(root).render(
  <StrictMode>
    <YouTubePlayableApp sdk={sdk} />
  </StrictMode>,
);
