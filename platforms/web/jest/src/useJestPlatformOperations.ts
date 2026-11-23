import {useCallback, useState, type MutableRefObject} from "react";
import {sanitizeAnalyticsParams, trackEvent} from "../../../../src/observability/analytics/events";
import type {NotificationOperationGate} from "./notifications/operationGate";
import type {JestPlatformPort, JestSession} from "./types";

/** Primitive analytics properties accepted by both browser and Jest event sinks. */
type TrackFunnelParams = Record<string, string | number | boolean>;

/** Sends one best-effort funnel event without letting telemetry interrupt gameplay. */
export function trackJestFunnelEvent({
  gate,
  platform,
  session,
  eventName,
  params = {},
}: {
  /** Gate that closes when account deletion begins. */
  gate: Pick<NotificationOperationGate, "isOpen">;
  /** Jest-owned event destination. */
  platform: Pick<JestPlatformPort, "captureEvent">;
  /** Current session used only for bounded attribution. */
  session: Pick<JestSession, "entryIntent"> | null;
  /** Bounded funnel event name. */
  eventName: string;
  /** Primitive event properties. */
  params?: TrackFunnelParams;
}): void {
  if (!gate.isOpen()) return;
  /** Provides intent behavior. */
  const intent = session?.entryIntent;
  /** Provides attributed params behavior. */
  const attributedParams = {
    ...(intent?.campaign ? {campaign: intent.campaign} : {}),
    ...(intent?.reference ? {reference: intent.reference} : {}),
    ...(intent?.utmSource ? {utm_source: intent.utmSource} : {}),
    ...(intent?.utmMedium ? {utm_medium: intent.utmMedium} : {}),
    ...(intent?.utmCampaign ? {utm_campaign: intent.utmCampaign} : {}),
    ...(intent?.utmTerm ? {utm_term: intent.utmTerm} : {}),
    ...(intent?.utmContent ? {utm_content: intent.utmContent} : {}),
    ...params,
  };
  /** Provides safe params behavior. */
  const safeParams = sanitizeAnalyticsParams(attributedParams);
  try {
    console.info("[riddle-quest-funnel]", eventName, safeParams);
    // The attributed event below owns native delivery; avoid sending it twice.
    trackEvent(eventName, safeParams, false);
  } catch {
    // A configured analytics sink is nonessential and may fail independently.
  }
  /** Provides safe platform params behavior. */
  const safePlatformParams = Object.fromEntries(
    Object.entries(safeParams).filter(
      (entry): entry is [string, string | number | boolean] => !Array.isArray(entry[1]),
    ),
  );
  try {
    platform.captureEvent(eventName, safePlatformParams);
  } catch {
    // Jest telemetry is best-effort and must never break player operations.
  }
}

/** Coordinates foreground and background Jest platform operations. */
export function useJestPlatformActivity(gate: NotificationOperationGate) {
  /** Provides [pending platform operations, set pending platform operations] behavior. */
  const [pendingPlatformOperations, setPendingPlatformOperations] = useState(0);
  /** Runs platform activity. */
  const withPlatformActivity = useCallback(
    async <Result>(operation: () => Promise<Result>): Promise<Result> => {
      /** Starts ed at. */
      const startedAt = Date.now();
      setPendingPlatformOperations((current) => current + 1);
      try {
        return await gate.run(operation);
      } finally {
        /** Provides remaining time behavior. */
        const remainingTime = Math.max(0, 180 - (Date.now() - startedAt));
        window.setTimeout(() => {
          setPendingPlatformOperations((current) => Math.max(0, current - 1));
        }, remainingTime);
      }
    },
    [gate],
  );
  /** Runs background platform activity. */
  const withBackgroundPlatformActivity = useCallback(
    async <Result>(operation: () => Promise<Result>): Promise<Result> => gate.run(operation),
    [gate],
  );

  return {pendingPlatformOperations, withPlatformActivity, withBackgroundPlatformActivity};
}

/** Creates the attributed analytics bridge shared by Jest player flows. */
export function useJestFunnelTracking({
  gate,
  platform,
  sessionRef,
}: {
  /** Stores gate. */
  gate: NotificationOperationGate;
  /** Stores platform. */
  platform: JestPlatformPort;
  /** Stores session ref. */
  sessionRef: MutableRefObject<JestSession | null>;
}) {
  return useCallback(
    (eventName: string, params: TrackFunnelParams = {}) => {
      trackJestFunnelEvent({gate, platform, session: sessionRef.current, eventName, params});
    },
    [gate, platform, sessionRef],
  );
}
