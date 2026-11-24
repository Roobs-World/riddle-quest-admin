import {AppState, NativeModules} from "react-native";
import {useSyncExternalStore} from "react";
import {configureAnalytics, currentAnalyticsScreen, setAnalyticsCollectionEnabled, trackEvent, type SanitizedAnalyticsParams} from "../../../../../src/observability/analytics/eventsRuntime";
import {createAnalyticsSession} from "../../../../../src/observability/analytics/analyticsSession";
import type {YouTubeLocale} from "../../../../../src/gameplay/local/types";
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
let gameLocale: YouTubeLocale | null = null;
let session: ReturnType<typeof createAnalyticsSession> | null = null;
let stopSession = () => {};
const now = () => performance.now();
const destination = (name: string, params: SanitizedAnalyticsParams) => native?.logEvent(name,
  {platform: "android", schema_version: 1, analytics_version: 2, ...(gameLocale ? {game_locale: gameLocale} : {}), ...params}).then(() => undefined);

/** Supported game language is separate from the SDK's automatic device-language dimension. */
export const setAndroidAnalyticsLocale = (locale: YouTubeLocale) => {gameLocale = locale;};

/** A duration never includes an action begun before consent or across a consent replacement. */
export const startAndroidAnalyticsTiming = () => {
  const owner = session;
  const started = now();
  return () => owner && session === owner ? {duration_ms: Math.min(3_600_000, Math.max(0, Math.round(now() - started)))} : {};
};

const connect = (enabled: boolean) => {
  stopSession();
  setAnalyticsCollectionEnabled(enabled);
  if (!enabled) return;
  const owned = createAnalyticsSession({send: destination, now, initialScreen: currentAnalyticsScreen(),
    foreground: AppState.currentState === "active",
    context: {platform: "android", screen_class: "RiddleQuestAndroid", schema_version: 1, analytics_version: 2}});
  session = owned;
  const disconnect = configureAnalytics(owned.record);
  const lifecycle = AppState.addEventListener("change", value => owned.setForeground(value === "active"));
  const timer = setInterval(() => owned.checkpoint("interval"), 60_000);
  stopSession = () => {
    if (session !== owned) return;
    session = null;
    clearInterval(timer);
    lifecycle.remove();
    owned.dispose();
    disconnect();
    stopSession = () => {};
  };
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
  }, () => {connect(false); publish({enabled: false, available: false, busy: false, failed: true});});
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
