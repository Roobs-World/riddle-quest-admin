import {useCallback, useState, type MutableRefObject} from "react";
import {sanitizeAnalyticsParams, trackEvent} from "../analytics/events";
import type {NotificationOperationGate} from "./notifications/operationGate";
import type {JestPlatformPort, JestSession} from "./types";

/** Primitive analytics properties accepted by both browser and Jest event sinks. */
type TrackFunnelParams = Record<string, string | number | boolean>;

/** Coordinates foreground and background Jest platform operations. */
export function useJestPlatformActivity(gate: NotificationOperationGate) {
  const [pendingPlatformOperations, setPendingPlatformOperations] = useState(0);
  const withPlatformActivity = useCallback(async <Result,>(
    operation: () => Promise<Result>,
  ): Promise<Result> => {
    const startedAt = Date.now();
    setPendingPlatformOperations((current) => current + 1);
    try {
      return await gate.run(operation);
    } finally {
      const remainingTime = Math.max(0, 180 - (Date.now() - startedAt));
      window.setTimeout(() => {
        setPendingPlatformOperations((current) => Math.max(0, current - 1));
      }, remainingTime);
    }
  }, [gate]);
  const withBackgroundPlatformActivity = useCallback(
    async <Result,>(operation: () => Promise<Result>): Promise<Result> => gate.run(operation),
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
  gate: NotificationOperationGate;
  platform: JestPlatformPort;
  sessionRef: MutableRefObject<JestSession | null>;
}) {
  return useCallback((eventName: string, params: TrackFunnelParams = {}) => {
    if (!gate.isOpen()) return;
    const intent = sessionRef.current?.entryIntent;
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
    const safeParams = sanitizeAnalyticsParams(attributedParams);
    console.info("[riddle-quest-funnel]", eventName, safeParams);
    trackEvent(eventName, safeParams);
    const safePlatformParams = Object.fromEntries(
      Object.entries(safeParams).filter(
        (entry): entry is [string, string | number | boolean] => !Array.isArray(entry[1]),
      ),
    );
    platform.captureEvent(eventName, safePlatformParams);
  }, [gate, platform, sessionRef]);
}
