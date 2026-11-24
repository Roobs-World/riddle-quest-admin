import type {createAnalyticsSession} from "./analyticsSession";
import type {AnalyticsSink, SanitizedAnalyticsParams} from "./eventsRuntime";

type BrowserInsightsOptions = Readonly<{
  session: ReturnType<typeof createAnalyticsSession>;
  track: AnalyticsSink;
  isCurrent(): boolean;
}>;

const milliseconds = (value: number) => Math.round(Math.min(3_600_000, Math.max(0, Number.isFinite(value) ? value : 0)));

/** Owns post-consent browser summaries without retaining interaction names, elements or URLs. */
export function installBrowserAnalyticsInsights({session, track, isCurrent}: BrowserInsightsOptions): () => void {
  let active = true;
  let foreground = document.visibilityState === "visible";
  const observers: PerformanceObserver[] = [];
  const run = (operation: () => void) => {
    if (!active) return;
    try {if (isCurrent()) operation();} catch { /* Browser measurement is optional. */ }
  };
  const emit = (name: string, params: SanitizedAnalyticsParams) => run(() => {
    void Promise.resolve(track(name, params)).catch(() => {});
  });
  let longTaskCount = 0, longTaskTotal = 0, longTaskMaximum = 0, inputCount = 0, inputMaximum = 0;
  const flushPerformance = (reason: "interval" | "background" | "pagehide") => {
    if (longTaskCount || inputCount) emit("browser_performance_summary", {
      reason, long_task_count: longTaskCount, long_task_total_ms: milliseconds(longTaskTotal),
      long_task_max_ms: milliseconds(longTaskMaximum), observed_input_event_count: inputCount,
      observed_input_max_ms: milliseconds(inputMaximum),
    });
    longTaskCount = longTaskTotal = longTaskMaximum = inputCount = inputMaximum = 0;
  };
  const observe = (type: "longtask" | "event") => run(() => {
    if (typeof PerformanceObserver === "undefined" || !PerformanceObserver.supportedEntryTypes.includes(type)) return;
    const observer = new PerformanceObserver(list => run(() => {
      if (!foreground) return;
      for (const entry of list.getEntries()) {
        const duration = milliseconds(entry.duration);
        if (type === "longtask") {
          longTaskCount = Math.min(10_000, longTaskCount + 1);
          longTaskTotal = Math.min(3_600_000, longTaskTotal + duration);
          longTaskMaximum = Math.max(longTaskMaximum, duration);
        } else {
          inputCount = Math.min(10_000, inputCount + 1);
          inputMaximum = Math.max(inputMaximum, duration);
        }
      }
    }));
    observer.observe({type, buffered: false});
    observers.push(observer);
  });
  observe("longtask");
  observe("event");

  const navigationTiming = () => run(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    if (!(navigation instanceof PerformanceNavigationTiming) || navigation.loadEventEnd <= 0) return;
    emit("browser_navigation_timing", {
      navigation_type: navigation.type,
      dns_ms: milliseconds(navigation.domainLookupEnd - navigation.domainLookupStart),
      connect_ms: milliseconds(navigation.connectEnd - navigation.connectStart),
      response_wait_ms: milliseconds(navigation.responseStart - navigation.requestStart),
      dom_ready_ms: milliseconds(navigation.domContentLoadedEventEnd - navigation.startTime),
      page_load_ms: milliseconds(navigation.loadEventEnd - navigation.startTime),
      document_bytes: Math.min(50 * 1024 * 1024, Math.max(0, navigation.encodedBodySize)),
    });
  });
  let navigationTimer: number | undefined;
  const onLoad = () => {navigationTimer = window.setTimeout(navigationTiming, 0);};
  if (document.readyState === "complete") navigationTiming();
  else window.addEventListener("load", onLoad, {once: true});

  const onVisibility = () => run(() => {
    const next = document.visibilityState === "visible";
    if (next === foreground) return;
    if (!next) flushPerformance("background");
    foreground = next;
    session.setForeground(next);
  });
  const onPageHide = () => run(() => {
    flushPerformance("pagehide");
    session.checkpoint("pagehide");
    foreground = false;
    session.setForeground(false);
  });
  const onPageShow = () => run(() => {
    foreground = document.visibilityState === "visible";
    session.setForeground(foreground);
  });
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);
  const timer = window.setInterval(() => run(() => {
    if (!foreground) return;
    session.checkpoint("interval");
    flushPerformance("interval");
  }), 60_000);
  return () => {
    active = false;
    window.clearInterval(timer);
    window.clearTimeout(navigationTimer);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("load", onLoad);
    for (const observer of observers) {
      try {observer.disconnect();} catch { /* Cleanup cannot affect the game. */ }
    }
  };
}
