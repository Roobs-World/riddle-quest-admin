import type {GameToHostMessage} from "@qwordly/core/bridge";
import {RACE_ANALYTICS_FIELDS, type RaceAnalyticsEventName} from "@qwordly/core/race";
import {createRequestId} from "../requestIds";

export const createRaceAnalyticsMessage = (
  eventName: RaceAnalyticsEventName,
  params: Record<string, string | number | boolean> = {},
): Extract<GameToHostMessage, {type: "game:analytics"}> => {
  const allowed = new Set<string>(RACE_ANALYTICS_FIELDS[eventName]);
  return {
    type: "game:analytics",
    requestId: createRequestId("race-analytics"),
    payload: {
      eventName,
      params: Object.fromEntries(
        Object.entries(params).filter(
          ([key, value]) => allowed.has(key) && (typeof value !== "string" || value.length <= 80),
        ),
      ),
    },
  };
};
