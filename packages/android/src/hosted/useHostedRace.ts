import AsyncStorage from "@react-native-async-storage/async-storage";
import {LiveRaceController, type LiveRaceControllerOptions} from "@riddle-quest/hosted/live/LiveRaceController";
import {useEffect, useState, useSyncExternalStore} from "react";
import {AppState} from "react-native";

/** Native lifecycle and private persistence adapters for the shared live race controller. */
export function useHostedRace(options: Omit<LiveRaceControllerOptions, "storage">) {
  /** One shared race controller survives harmless native rerenders. */
  const [controller] = useState(() => new LiveRaceController({...options, storage: AsyncStorage, clockPresentationIntervalMs: 1000}));
  /** Immutable presentation subscribed through React's external-store contract. */
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    void controller.start();
    controller.setVisible(AppState.currentState === "active");
    /** Foreground changes update shared polling visibility. */
    const subscription = AppState.addEventListener("change", next => controller.setVisible(next === "active"));
    /** Frequent policy tick preserves transport timing while display publication is throttled. */
    const timer = setInterval(controller.tick, 100);
    return () => {clearInterval(timer); subscription.remove(); controller.dispose();};
  }, [controller]);
  return {controller, state};
}
