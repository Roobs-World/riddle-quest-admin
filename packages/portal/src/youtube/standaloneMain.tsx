import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {YouTubePlayableApp} from "./YouTubePlayableApp";
import {createStandaloneSdkPort} from "./standaloneSdk";
import "./styles.css";

const target = import.meta.env.VITE_PLATFORM_TARGET;
if (target !== "netflix" && target !== "yahoo") throw new Error("standalone-target-invalid");
const root = document.getElementById("root");
if (!root) throw new Error(`${target}-root-missing`);

createRoot(root).render(
  <StrictMode>
    <YouTubePlayableApp sdk={createStandaloneSdkPort()} />
  </StrictMode>,
);
