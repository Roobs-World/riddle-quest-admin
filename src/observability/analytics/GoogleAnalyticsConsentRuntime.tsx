import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {readBrowserStorage, writeBrowserStorage} from "../../platform/browser/storage/browserStorage";
import type {AnalyticsConsent} from "./AnalyticsConsentContext";
import type {GoogleAnalyticsConsentProps} from "./GoogleAnalyticsConsent";
import {trackEvent} from "./eventsRuntime";

/** Defaults collection to enabled for this target and restores explicit opt-outs. */
export default function GoogleAnalyticsConsentRuntime({platform, measurementId, available, isCurrent, lifetimeSignal, publish}: Omit<GoogleAnalyticsConsentProps, "children"> & {publish(consent: AnalyticsConsent | null): void}) {
  const storageKey = `riddleQuest:googleAnalyticsConsent:${platform}:v1`;
  const [enabled, setEnabled] = useState(() => readBrowserStorage("local", storageKey) !== "denied");
  const decision = useRef(enabled);
  const stop = useRef<() => void>(() => {});
  const initialization = useRef<AbortController | null>(null);
  const configured = available && /^G-[A-Z0-9]+$/u.test(measurementId ?? "");

  const change = useCallback((next: boolean) => {
    decision.current = next;
    writeBrowserStorage("local", storageKey, next ? "granted" : "denied");
    if (!next) {
      initialization.current?.abort();
      stop.current();
      stop.current = () => {};
    }
    setEnabled(next);
    trackEvent("analytics_consent_changed", {enabled: next});
  }, [storageKey]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!isCurrent()) {
        initialization.current?.abort();
        stop.current();
        stop.current = () => {};
      }
      if (event.key !== storageKey && event.key !== null) return;
      const next = readBrowserStorage("local", storageKey) !== "denied";
      decision.current = next;
      if (!next) {
        initialization.current?.abort();
        stop.current();
        stop.current = () => {};
      }
      setEnabled(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [isCurrent, storageKey]);

  useEffect(() => {
    if (!configured || !enabled || !measurementId || !isCurrent() || lifetimeSignal?.aborted) return;
    let active = true;
    const controller = new AbortController();
    const retire = () => controller.abort();
    lifetimeSignal?.addEventListener("abort", retire, {once: true});
    initialization.current = controller;
    const current = () => active && decision.current && isCurrent();
    void import("./googleAnalytics").then(({initializeGoogleAnalytics}) => {
      if (!current() || controller.signal.aborted) return () => {};
      return initializeGoogleAnalytics({measurementId, isCurrent: current, signal: controller.signal});
    }).then(cleanup => {
      if (current()) stop.current = cleanup;
      else cleanup();
    }).catch(() => {});
    return () => {
      active = false;
      lifetimeSignal?.removeEventListener("abort", retire);
      controller.abort();
      if (initialization.current === controller) initialization.current = null;
      stop.current();
      stop.current = () => {};
    };
  }, [configured, enabled, isCurrent, lifetimeSignal, measurementId]);

  const consent = useMemo(() => configured ? {enabled, change} : null, [configured, enabled, change]);
  useEffect(() => { publish(consent); }, [consent, publish]);
  useEffect(() => () => publish(null), [publish]);
  return null;
}
