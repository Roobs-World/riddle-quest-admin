import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {Analytics} from "@vercel/analytics/react";
import {SpeedInsights} from "@vercel/speed-insights/react";
import {App} from "./App";
import "./styles.css";

const shouldEnableVercelTelemetry = () => {
  if (import.meta.env.VITE_ENABLE_VERCEL_TELEMETRY !== "1") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("harness") === "jest") {
    return false;
  }

  const hostname = window.location.hostname;
  return hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "0.0.0.0";
};

const enableVercelTelemetry = shouldEnableVercelTelemetry();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    {enableVercelTelemetry ? (
      <>
        <Analytics />
        <SpeedInsights />
      </>
    ) : null}
  </StrictMode>,
);
