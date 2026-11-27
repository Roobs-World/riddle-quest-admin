import {createContext, useContext, useSyncExternalStore, type ReactNode} from "react";
import {useTranslator} from "../../localization/browser/i18n";
import type {HapticFeedbackCapability} from "../contracts/hapticFeedback";

const HapticFeedbackContext = createContext<HapticFeedbackCapability | null>(null);

/** Targets without a haptics adapter do not expose a vibration preference. */
export function HapticFeedbackProvider({capability, children}: {
  capability?: HapticFeedbackCapability | null;
  children: ReactNode;
}) {
  return <HapticFeedbackContext.Provider value={capability ?? null}>{children}</HapticFeedbackContext.Provider>;
}

function AvailableHapticFeedbackSettings({capability}: {capability: HapticFeedbackCapability}) {
  const tr = useTranslator();
  const snapshot = useSyncExternalStore(capability.subscribe, capability.getSnapshot, capability.getSnapshot);
  if (!snapshot.available) return null;
  return <button
    type="button"
    className="settings-row"
    aria-pressed={snapshot.enabled}
    onClick={() => capability.setEnabled(!snapshot.enabled)}
  >
    <span>{tr("Settings.HAPTICS_TOGGLE")}</span>
    <strong>{tr(snapshot.enabled ? "Settings.TOGGLE_ON" : "Settings.TOGGLE_OFF")}</strong>
  </button>;
}

export function HapticFeedbackSettings() {
  const capability = useContext(HapticFeedbackContext);
  return capability ? <AvailableHapticFeedbackSettings capability={capability} /> : null;
}
