import {getDatabase} from "firebase-admin/database";
import {onValueWritten} from "firebase-functions/v2/database";
import {isFacebookFeatureEnabled} from "../../../platforms/web/facebook/server/facebookFeatureFlags";

/** Describes connection value. */
type ConnectionValue = {
  /** Stores state. */
  /** Stores state. */
  state?: unknown; /** Stores platform. */
  /** Stores platform. */
  platform?: unknown;
};
/** Provides priority behavior. */
const priority = {online: 1, playing: 2, racing: 3} as const;
/** Provides presence user id behavior. */
const presenceUserId = /^(?:facebook|jest)_[0-9a-f]{40}$/;

/** Reduces server-observed sessions to one public state without trusting a client aggregate. */
export function aggregatePresenceValue(
  value: unknown,
  facebookPresenceEnabled = true,
): "offline" | "online" | "playing" | "racing" {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "offline";
  /** Provides highest behavior. */
  let highest: keyof typeof priority | "offline" = "offline";
  for (const connection of Object.values(value as Record<string, ConnectionValue>)) {
    if (connection?.platform !== "facebook" && connection?.platform !== "jest") continue;
    if (!facebookPresenceEnabled && connection?.platform === "facebook") continue;
    /** Provides state behavior. */
    const state = connection?.state;
    if (
      typeof state === "string" &&
      state in priority &&
      priority[state as keyof typeof priority] > (highest === "offline" ? 0 : priority[highest])
    ) {
      highest = state as keyof typeof priority;
    }
  }
  return highest;
}

/** Writes the aggregate and account-level opt-in bit in one RTDB update. */
export async function writeAggregatedPresence(
  userId: string,
  database = getDatabase(),
  now = Date.now(),
): Promise<"offline" | "online" | "playing" | "racing"> {
  /** Provides connections behavior. */
  const connections = (await database.ref(`presenceConnections/${userId}`).get()).val();
  /** Provides state behavior. */
  const state = aggregatePresenceValue(connections, isFacebookFeatureEnabled("presence"));
  await database.ref().update({
    [`presenceStatus/${userId}`]: {state, updatedAt: now},
    [`presenceOptIn/${userId}`]: state !== "offline",
  });
  return state;
}

/** Updates server-owned consent; disabling also atomically clears every live session and rival read bit. */
export async function setPresenceConsentForUser(
  userId: string,
  enabled: boolean,
  database = getDatabase(),
  now = Date.now(),
): Promise<void> {
  if (!presenceUserId.test(userId) || typeof enabled !== "boolean" || !Number.isSafeInteger(now) || now < 0) {
    throw new Error("invalid-presence-consent");
  }
  await database.ref().update(
    enabled
      ? {
          [`presenceConsent/${userId}`]: true,
        }
      : {
          [`presenceConsent/${userId}`]: false,
          [`presenceConnections/${userId}`]: null,
          [`presenceStatus/${userId}`]: {state: "offline", updatedAt: now},
          [`presenceOptIn/${userId}`]: false,
        },
  );
}

/** Maintains the server-owned aggregate whenever a tab/device connects, changes, or disconnects. */
export const aggregatePresenceStatus = onValueWritten(
  // The production RTDB instance is in europe-west1. Database triggers must
  // be colocated with the instance or Eventarc cannot resolve the pattern.
  {ref: "/presenceConnections/{userId}/{sessionId}", region: "europe-west1"},
  async (event) => {
    /** Provides r id. */
    const userId = event.params.userId;
    await writeAggregatedPresence(userId);
  },
);
