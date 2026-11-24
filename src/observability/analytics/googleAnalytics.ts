import {isBrowserTelemetryRuntimeAllowed} from "../telemetryRuntime";
import {firebaseEnvironment} from "../../platform/firebase/browserEnvironment";
import {configureAnalytics, currentAnalyticsScreen, sanitizeAnalyticsParams, setAnalyticsCollectionEnabled, type AnalyticsParams, type AnalyticsValue, type SanitizedAnalyticsParams} from "./eventsRuntime";
import {createAnalyticsSession} from "./analyticsSession";
import {installBrowserAnalyticsInsights} from "./browserInsights";

let stopActive: (() => void) | null = null;
type GoogleTag = {send(...args: unknown[]): void; ready: Promise<void>; configured: boolean};
const tags = new Map<string, GoogleTag>();
const googleValue = (value: AnalyticsValue) => typeof value === "boolean" ? Number(value) : value;
const googleParams = (params: SanitizedAnalyticsParams) => Object.fromEntries(Object.entries(params)
  .map(([key, value]) => [key, Array.isArray(value)
    ? value.map(item => Object.fromEntries(Object.entries(item).map(([name, itemValue]) => [name, googleValue(itemValue)])))
    : googleValue(value)]));

/** Only explicit campaign codes are read after consent; raw query strings never leave the page. */
const campaignParams = (): AnalyticsParams => {
  const query = new URLSearchParams(window.location.search);
  const params: AnalyticsParams = {};
  for (const [source, destination] of [
    ["utm_source", "campaign_source"], ["utm_medium", "campaign_medium"], ["utm_campaign", "campaign_name"],
    ["utm_id", "campaign_id"], ["utm_content", "campaign_content"],
  ]) {
    const value = query.get(source);
    if (value && /^[a-zA-Z0-9._~-]{1,80}$/.test(value)) params[destination] = value;
  }
  return params;
};

/** Reuse the loaded tag so renewed consent cannot install automatic listeners twice. */
const getTag = (measurementId: string): GoogleTag => {
  const existing = tags.get(measurementId);
  if (existing) return existing;
  const layerName = `riddleQuestAnalytics${measurementId.slice(2)}`;
  const commands: IArguments[] = [];
  const send = function (..._args: unknown[]) { commands.push(arguments); };
  Reflect.set(window, layerName, commands);
  Reflect.set(window, `ga-disable-${measurementId}`, true);
  send("consent", "default", {analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"});
  send("js", new Date());
  const script = document.createElement("script");
  script.async = true;
  script.referrerPolicy = "no-referrer";
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}&l=${layerName}`;
  const ready = new Promise<void>((resolve, reject) => {
    const fail = () => {
      script.onload = null;
      script.onerror = null;
      if (tags.get(measurementId)?.send === send) tags.delete(measurementId);
      script.remove();
      reject(new Error("analytics-load-failed"));
    };
    const timeout = window.setTimeout(fail, 10_000);
    script.onload = () => { window.clearTimeout(timeout); resolve(); };
    script.onerror = () => { window.clearTimeout(timeout); fail(); };
    document.head.append(script);
  });
  const tag = {send, ready, configured: false};
  tags.set(measurementId, tag);
  return tag;
};

/** Removes this game's GA instance and property cookies, including legacy parent-domain cookies. */
const clearCookies = (measurementId: string) => {
  const names = ["_ga", `_ga_${measurementId.slice(2).replaceAll("-", "_")}`];
  const parts = window.location.hostname.split(".");
  for (const name of names) {
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax; Secure`;
    for (let index = 0; index < parts.length - 1; index += 1) {
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${parts.slice(index).join(".")}; SameSite=Lax; Secure`;
    }
  }
};

/** Loads the Google tag only after affirmative consent in a real supported production session. */
export async function initializeGoogleAnalytics({measurementId, isCurrent = () => true, signal}: {
  measurementId: string;
  isCurrent?: () => boolean;
  signal?: AbortSignal;
}): Promise<() => void> {
  if (!/^G-[A-Z0-9]{6,}$/.test(measurementId) || signal?.aborted || !isCurrent() || !isBrowserTelemetryRuntimeAllowed()) return () => {};
  stopActive?.();
  let active = true;
  const tag = getTag(measurementId);
  const denied = {analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"};
  let disconnect = () => {};
  let cancelLoading = () => {};
  let stopInsights = () => {};
  let session: ReturnType<typeof createAnalyticsSession> | null = null;
  const stop = () => {
    if (!active) return;
    active = false;
    if (stopActive !== stop) return;
    stopInsights();
    session?.dispose();
    Reflect.set(window, `ga-disable-${measurementId}`, true);
    tag.send("consent", "update", denied);
    disconnect();
    setAnalyticsCollectionEnabled(false);
    signal?.removeEventListener("abort", stop);
    cancelLoading();
    clearCookies(measurementId);
    stopActive = null;
  };
  stopActive = stop;
  signal?.addEventListener("abort", stop, {once: true});
  setAnalyticsCollectionEnabled(true);
  try {
    const cancelled = new Promise<void>(resolve => {cancelLoading = resolve;});
    await Promise.race([tag.ready, cancelled]);
    if (!active || !isCurrent()) { stop(); return () => {}; }
    Reflect.set(window, `ga-disable-${measurementId}`, false);
    tag.send("consent", "update", {...denied, analytics_storage: "granted"});
    const page = {page_location: `${window.location.origin}/`, page_referrer: "", page_title: "Riddle Quest"};
    if (!tag.configured) {
      tag.send("set", {...page, ...campaignParams()});
      tag.send("config", measurementId, {
        ...page,
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        cookie_domain: "none",
        cookie_expires: 60 * 60 * 24 * 30,
        cookie_update: false,
        cookie_flags: "SameSite=None;Secure",
        ignore_referrer: true,
      });
      tag.configured = true;
    }
    const send = (eventName: string, params: SanitizedAnalyticsParams) => {
      if (!active || !isCurrent()) { stop(); return; }
      tag.send("event", eventName, {...googleParams(sanitizeAnalyticsParams({...params, platform: firebaseEnvironment.platformTarget ?? "unknown",
        game_locale: document.documentElement.lang || "en", app_release: firebaseEnvironment.sentryRelease ?? "unversioned",
        play_surface: typeof params.play_surface === "string" ? params.play_surface : "online",
        network_state: navigator.onLine ? "reported_online" : "reported_offline",
        schema_version: 1, analytics_version: 2})), ...page, send_to: measurementId});
    };
    session = createAnalyticsSession({send, now: () => performance.now(), foreground: document.visibilityState !== "hidden",
      initialScreen: currentAnalyticsScreen(), context: {play_surface: "online"}});
    const ownedSession = session;
    disconnect = configureAnalytics((name, params) => {
      if (!active || !isCurrent()) { stop(); return; }
      ownedSession.record(name, params);
    });
    stopInsights = installBrowserAnalyticsInsights({session: ownedSession, track: send, isCurrent: () => active && isCurrent()});
  } catch {
    stop();
  }
  return stop;
}
