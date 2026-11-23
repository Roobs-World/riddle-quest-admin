import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {createYouTubeSdkPort} from "./sdk";
import {YouTubePlayableApp} from "../../../../src/web/playable/YouTubePlayableApp";
import "../../../../src/web/playable/styles.css";
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
