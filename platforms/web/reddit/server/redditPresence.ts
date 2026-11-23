import {admin} from "../../../../firebase-functions/src/shared/firebaseAdmin";
import {isRedditFirebaseUid} from "./redditSecurity";

/** Defines the reddit presence lease ms value. */
export const REDDIT_PRESENCE_LEASE_MS = 15_000;
/** Defines the reddit presence max rivals value. */
export const REDDIT_PRESENCE_MAX_RIVALS = 50;
/** Describes reddit presence state. */
export type RedditPresenceState = "offline" | "online" | "playing" | "racing";
/** Describes active state. */
type ActiveState = Exclude<RedditPresenceState, "offline">;
/** Provides priority behavior. */
const priority: Record<RedditPresenceState, number> = {offline: 0, online: 1, playing: 2, racing: 3};
/** Provides session pattern behavior. */
const sessionPattern = /^[A-Za-z0-9_-]{16,80}$/;
/** Provides known rival sources behavior. */
const knownRivalSources = new Set(["completed_race", "facebook_context", "facebook_invite"]);

/** Parses connection. */
const parseConnection = (value: unknown, nowMs: number): ActiveState | undefined => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  /** Provides connection behavior. */
  const connection = value as Record<string, unknown>;
  if (
    connection.platform !== "reddit" ||
    typeof connection.state !== "string" ||
    !(connection.state in priority) ||
    connection.state === "offline" ||
    !Number.isSafeInteger(connection.expiresAtMs) ||
    (connection.expiresAtMs as number) <= nowMs
  )
    return undefined;
  return connection.state as ActiveState;
};

/** Aggregates only live, server-leased Reddit sessions. */
export function aggregateRedditPresence(value: unknown, nowMs: number): RedditPresenceState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "offline";
  return Object.values(value as Record<string, unknown>).reduce<RedditPresenceState>((highest, item) => {
    /** Provides state behavior. */
    const state = parseConnection(item, nowMs);
    return state && priority[state] > priority[highest] ? state : highest;
  }, "offline");
}

/** Asserts input. */
const assertInput = (userId: string, sessionId: string, nowMs: number) => {
  if (!isRedditFirebaseUid(userId) || !sessionPattern.test(sessionId) || !Number.isSafeInteger(nowMs) || nowMs < 0)
    throw new Error("invalid-reddit-presence-input");
};

/** Provides poll reddit presence behavior. */
export async function pollRedditPresence(
  userId: string,
  input: {
    /** Stores session id. */
    sessionId: string; /** Stores state. */
    /** Stores state. */
    state: ActiveState; /** Stores enabled. */
    /** Stores enabled. */
    enabled: boolean;
  },
  options: {
    /** Stores firestore. */
    firestore?: FirebaseFirestore.Firestore; /** Stores database. */
    /** Stores database. */
    database?: ReturnType<typeof admin.database>; /** Stores now ms. */
    /** Stores now ms. */
    nowMs?: number;
  } = {},
): Promise<{
  /** Stores rivals. */
  rivals: Array<{
    /** Stores user id. */
    userId: string; /** Stores state. */
    /** Stores state. */
    state: RedditPresenceState;
  }>;
}> {
  /** Provides now ms behavior. */
  const nowMs = options.nowMs ?? Date.now();
  assertInput(userId, input.sessionId, nowMs);
  if (!(input.state in priority) || typeof input.enabled !== "boolean") {
    throw new Error("invalid-reddit-presence-input");
  }
  /** Provides firestore behavior. */
  const firestore = options.firestore ?? admin.firestore();
  /** Provides database behavior. */
  const database = options.database ?? admin.database();
  if (!input.enabled) {
    await database.ref().update({
      [`presenceConsent/${userId}`]: false,
      [`presenceConnections/${userId}`]: null,
      [`presenceStatus/${userId}`]: {state: "offline", updatedAt: nowMs},
      [`presenceOptIn/${userId}`]: false,
    });
    return {rivals: []};
  }
  /** Provides connections ref behavior. */
  const connectionsRef = database.ref(`presenceConnections/${userId}`);
  /** Provides connections behavior. */
  const connections = (await connectionsRef.get()).val();
  /** Updates s. */
  const updates: Record<string, unknown> = {
    [`presenceConnections/${userId}/${input.sessionId}`]: {
      platform: "reddit",
      state: input.state,
      updatedAt: nowMs,
      expiresAtMs: nowMs + REDDIT_PRESENCE_LEASE_MS,
    },
    [`presenceConsent/${userId}`]: true,
  };
  if (typeof connections === "object" && connections !== null) {
    for (const [sessionId, value] of Object.entries(connections as Record<string, unknown>)) {
      if (!parseConnection(value, nowMs)) updates[`presenceConnections/${userId}/${sessionId}`] = null;
    }
  }
  /** Provides own state behavior. */
  const ownState = aggregateRedditPresence(
    {
      ...((connections ?? {}) as object),
      [input.sessionId]: {platform: "reddit", state: input.state, expiresAtMs: nowMs + REDDIT_PRESENCE_LEASE_MS},
    },
    nowMs,
  );
  updates[`presenceStatus/${userId}`] = {state: ownState, updatedAt: nowMs};
  updates[`presenceOptIn/${userId}`] = true;
  await database.ref().update(updates);

  /** Provides known behavior. */
  const known = await firestore.collection(`users/${userId}/knownRivals`).limit(REDDIT_PRESENCE_MAX_RIVALS).get();
  /** Provides rivals behavior. */
  const rivals = await Promise.all(
    known.docs
      .flatMap((document) => {
        /** Provides value behavior. */
        const value = document.data();
        return isRedditFirebaseUid(document.id) &&
          value.targetUserId === document.id &&
          typeof value.source === "string" &&
          knownRivalSources.has(value.source)
          ? [document.id]
          : [];
      })
      .map(async (targetId) => {
        /** Provides [viewer block, target block, consent, target connections] behavior. */
        const [viewerBlock, targetBlock, consent, targetConnections] = await Promise.all([
          firestore.doc(`users/${userId}/blockedRivals/${targetId}`).get(),
          firestore.doc(`users/${targetId}/blockedRivals/${userId}`).get(),
          database.ref(`presenceConsent/${targetId}`).get(),
          database.ref(`presenceConnections/${targetId}`).get(),
        ]);
        /** Provides state behavior. */
        const state =
          !viewerBlock.exists && !targetBlock.exists && consent.val() === true
            ? aggregateRedditPresence(targetConnections.val(), nowMs)
            : "offline";
        return {userId: targetId, state};
      }),
  );
  return {rivals};
}

/** Provides disconnect reddit presence behavior. */
export async function disconnectRedditPresence(
  userId: string,
  sessionId: string,
  options: {
    /** Stores database. */
    database?: ReturnType<typeof admin.database>; /** Stores now ms. */
    /** Stores now ms. */
    nowMs?: number;
  } = {},
): Promise<void> {
  /** Provides now ms behavior. */
  const nowMs = options.nowMs ?? Date.now();
  assertInput(userId, sessionId, nowMs);
  /** Provides database behavior. */
  const database = options.database ?? admin.database();
  await database.ref(`presenceConnections/${userId}/${sessionId}`).remove();
  /** Provides connections behavior. */
  const connections = (await database.ref(`presenceConnections/${userId}`).get()).val();
  /** Provides state behavior. */
  const state = aggregateRedditPresence(connections, nowMs);
  await database.ref().update({
    [`presenceStatus/${userId}`]: {state, updatedAt: nowMs},
    [`presenceOptIn/${userId}`]: state !== "offline",
  });
}
