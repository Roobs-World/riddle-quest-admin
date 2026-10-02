import {configurePlatformAnalytics, trackEvent} from "../analytics/events";
import type {FacebookInstantSdk} from "./fbinstant";

/** Connects Meta's native event API after authenticated 13+ audience startup. */
export function installFacebookAnalytics(sdk: FacebookInstantSdk, isActive: () => boolean) {
  if (!sdk.logEvent || !sdk.getSupportedAPIs().includes("logEvent")) return () => {};
  /** Keeps parameters primitive and bounded for Meta's custom event contract. */
  const stop = configurePlatformAnalytics((name, params) => {
    if (!isActive()) return;
    /** Projects purchase item dimensions into Meta's string-only parameter contract. */
    const dimensions = {...params, ...(Array.isArray(params.items) ? params.items[0] : {})};
    /** Meta accepts at most 25 custom dimensions and string values. */
    const parameters = Object.fromEntries(
      Object.entries(dimensions)
        .filter(([, value]) => !Array.isArray(value))
        .slice(0, 25)
        .map(([key, value]) => [key, String(value).slice(0, 100)]),
    );
    sdk.logEvent!(name, typeof params.value === "number" ? params.value : null, parameters);
  });
  trackEvent("session_started", {platform: "facebook"});
  return stop;
}
