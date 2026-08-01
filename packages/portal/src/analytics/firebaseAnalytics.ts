import {firebaseApp} from "../firebase";
import {configureAnalytics} from "./googleAnalytics";

export const initializeGoogleAnalytics = () => {
  const measurementId = import.meta.env.VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID?.trim();
  if (!measurementId || typeof window === "undefined") return;

  void import("firebase/analytics")
    .then(async (module) => {
      if (!(await module.isSupported())) return;
      const client = module.getAnalytics(firebaseApp);
      configureAnalytics((eventName, params) => module.logEvent(client, eventName, params));
    })
    .catch((error) => {
      console.warn("[riddle-quest-analytics] Google Analytics is unavailable", error);
    });
};
