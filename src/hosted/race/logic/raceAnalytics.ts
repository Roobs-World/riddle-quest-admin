import type {GameToHostMessage} from "../../../core/bridge";
import {RACE_ANALYTICS_FIELDS, type RaceAnalyticsEventName} from "../../../core/race";
import {createRequestId} from "../../play/requestIds";

/** Builds a host analytics message containing only fields allowed for the race event. */
export const createRaceAnalyticsMessage = (
  eventName: RaceAnalyticsEventName,
  params: Record<string, string | number | boolean> = {},
): Extract<
  GameToHostMessage,
  {
    /** Stores type. */
    type: "game:analytics";
  }
> => {
  /** Field names accepted by the shared schema for this event. */
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
