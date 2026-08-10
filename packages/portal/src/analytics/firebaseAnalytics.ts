import {firebaseEnvironment} from "../firebaseEnvironment";
import {configureAnalytics} from "./googleAnalytics";

/** Schedules non-critical analytics initialization after the playable shell has loaded. */
const scheduleWhenIdle = (task: () => void) => {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(task, {timeout: 2_000});
    return;
  }
  globalThis.queueMicrotask(task);
};

/** Provides initialize google analytics behavior. */
export const initializeGoogleAnalytics = () => {
  const measurementId = firebaseEnvironment.measurementId?.trim();
  if (!measurementId || typeof window === "undefined") return;

  scheduleWhenIdle(() => {
    void Promise.all([import("firebase/analytics"), import("../firebase")])
      .then(async ([module, {firebaseApp}]) => {
        if (!(await module.isSupported())) return;
        const client = module.getAnalytics(firebaseApp);
        configureAnalytics((eventName, params) => module.logEvent(client, eventName, params));
      })
      .catch((error) => {
        console.warn("[riddle-quest-analytics] Google Analytics is unavailable", error);
      });
  });
};
