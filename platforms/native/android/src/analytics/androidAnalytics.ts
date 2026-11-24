import {NativeModules} from "react-native";
import {useSyncExternalStore} from "react";
import {configureAnalytics, setAnalyticsCollectionEnabled, trackEvent, type SanitizedAnalyticsParams} from "../../../../../src/observability/analytics/eventsRuntime";
import type {HostedConfig} from "../hosted/hostedConfig";

type NativeAnalytics = {
  configure(config: {appId: string; apiKey: string; projectId: string; senderId: string; collectionAllowed: boolean}): Promise<unknown>;
  setEnabled(enabled: boolean): Promise<unknown>;
  logEvent(name: string, params: SanitizedAnalyticsParams): Promise<unknown>;
};
function isNativeAnalytics(value: unknown): value is NativeAnalytics {
  return typeof value === "object" && value !== null &&
    "configure" in value && typeof value.configure === "function" &&
    "setEnabled" in value && typeof value.setEnabled === "function" &&
    "logEvent" in value && typeof value.logEvent === "function";
}
type AnalyticsPreference = Readonly<{enabled: boolean; available: boolean; busy: boolean; failed: boolean}>;
let state: AnalyticsPreference = {enabled: false, available: false, busy: false, failed: false};
let native: NativeAnalytics | null = null;
let initialization: Promise<void> | null = null;
let failedChoice: boolean | null = null;
const listeners = new Set<() => void>();
const publish = (next: AnalyticsPreference) => {state = next; listeners.forEach(listener => listener());};
const destination = (name: string, params: SanitizedAnalyticsParams) => native?.logEvent(name, params).then(() => undefined);
const connect = (enabled: boolean) => {
  setAnalyticsCollectionEnabled(enabled);
  if (enabled) configureAnalytics(destination);
};

/** Native app-private consent is separate from authentication and notification preferences. */
export function initializeAndroidAnalytics(config: HostedConfig): Promise<void> {
  if (initialization) return initialization;
  const candidate: unknown = NativeModules.RiddleQuestAnalytics;
  if (!isNativeAnalytics(candidate) || !config.firebase.androidAppId) return Promise.resolve();
  native = candidate;
  const appId = config.firebase.androidAppId;
  publish({...state, busy: true});
  initialization = candidate.configure({appId, apiKey: config.firebase.androidApiKey ?? config.firebase.apiKey,
    projectId: config.firebase.projectId, senderId: config.firebase.messagingSenderId, collectionAllowed: !__DEV__ && !config.emulators}).then(enabled => {
    connect(enabled === true);
    publish({enabled: enabled === true, available: typeof enabled === "boolean", busy: false, failed: false});
  }, () => {publish({enabled: false, available: false, busy: false, failed: true});});
  return initialization;
}

/** No pre-consent event is replayed, and revocation stops JS delivery immediately. */
export async function setAndroidAnalyticsEnabled(enabled: boolean): Promise<void> {
  if (!native || !state.available || state.busy) return;
  if (!enabled) connect(false);
  publish({...state, busy: true, failed: false});
  try {
    await native.setEnabled(enabled);
    connect(enabled);
    publish({enabled, available: true, busy: false, failed: false});
    failedChoice = null;
    if (enabled) trackEvent("analytics_consent_changed", {enabled: true});
  } catch {
    failedChoice = enabled;
    connect(false);
    publish({...state, enabled: false, busy: false, failed: true});
  }
}

export const retryAndroidAnalyticsPreference = () => failedChoice === null ? Promise.resolve() : setAndroidAnalyticsEnabled(failedChoice);

export const useAndroidAnalyticsPreference = () => useSyncExternalStore(
  listener => {listeners.add(listener); return () => {listeners.delete(listener);};},
  () => state,
  () => state,
);
