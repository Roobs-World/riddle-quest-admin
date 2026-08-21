import {admin} from "../shared/firebaseAdmin";
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
  const connection = value as Record<string, unknown>;
  if (connection.platform !== "reddit" || typeof connection.state !== "string" ||
    !(connection.state in priority) || connection.state === "offline" ||
    !Number.isSafeInteger(connection.expiresAtMs) || (connection.expiresAtMs as number) <= nowMs) return undefined;
  return connection.state as ActiveState;
};

/** Aggregates only live, server-leased Reddit sessions. */
export function aggregateRedditPresence(value: unknown, nowMs: number): RedditPresenceState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "offline";
  return Object.values(value as Record<string, unknown>).reduce<RedditPresenceState>((highest, item) => {
    const state = parseConnection(item, nowMs);
    return state && priority[state] > priority[highest] ? state : highest;
  }, "offline");
}

/** Asserts input. */
const assertInput = (userId: string, sessionId: string, nowMs: number) => {
  if (!isRedditFirebaseUid(userId) || !sessionPattern.test(sessionId) ||
    !Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error("invalid-reddit-presence-input");
};

/** Provides poll reddit presence behavior. */
export async function pollRedditPresence(
  userId: string,
  input: {sessionId: string; state: ActiveState; enabled: boolean},
  options: {firestore?: FirebaseFirestore.Firestore; database?: ReturnType<typeof admin.database>; nowMs?: number} = {},
): Promise<{rivals: Array<{userId: string; state: RedditPresenceState}>}> {
  const nowMs = options.nowMs ?? Date.now();
  assertInput(userId, input.sessionId, nowMs);
  if (!(input.state in priority) || typeof input.enabled !== "boolean") {
    throw new Error("invalid-reddit-presence-input");
  }
  const firestore = options.firestore ?? admin.firestore();
  const database = options.database ?? admin.database();
  if (!input.enabled) {
    await database.ref().update({[`presenceConsent/${userId}`]: false,
      [`presenceConnections/${userId}`]: null, [`presenceStatus/${userId}`]: {state: "offline", updatedAt: nowMs},
      [`presenceOptIn/${userId}`]: false});
    return {rivals: []};
  }
  const connectionsRef = database.ref(`presenceConnections/${userId}`);
  const connections = (await connectionsRef.get()).val();
  const updates: Record<string, unknown> = {
    [`presenceConnections/${userId}/${input.sessionId}`]: {platform: "reddit", state: input.state,
      updatedAt: nowMs, expiresAtMs: nowMs + REDDIT_PRESENCE_LEASE_MS},
    [`presenceConsent/${userId}`]: true,
  };
  if (typeof connections === "object" && connections !== null) {
    for (const [sessionId, value] of Object.entries(connections as Record<string, unknown>)) {
      if (!parseConnection(value, nowMs)) updates[`presenceConnections/${userId}/${sessionId}`] = null;
    }
  }
  const ownState = aggregateRedditPresence({...((connections ?? {}) as object),
    [input.sessionId]: {platform: "reddit", state: input.state, expiresAtMs: nowMs + REDDIT_PRESENCE_LEASE_MS}}, nowMs);
  updates[`presenceStatus/${userId}`] = {state: ownState, updatedAt: nowMs};
  updates[`presenceOptIn/${userId}`] = true;
  await database.ref().update(updates);

  const known = await firestore.collection(`users/${userId}/knownRivals`).limit(REDDIT_PRESENCE_MAX_RIVALS).get();
  const rivals = await Promise.all(known.docs.flatMap((document) => {
    const value = document.data();
    return isRedditFirebaseUid(document.id) && value.targetUserId === document.id &&
      typeof value.source === "string" && knownRivalSources.has(value.source) ? [document.id] : [];
  })
    .map(async (targetId) => {
      const [viewerBlock, targetBlock, consent, targetConnections] = await Promise.all([
        firestore.doc(`users/${userId}/blockedRivals/${targetId}`).get(),
        firestore.doc(`users/${targetId}/blockedRivals/${userId}`).get(),
        database.ref(`presenceConsent/${targetId}`).get(),
        database.ref(`presenceConnections/${targetId}`).get(),
      ]);
      const state = !viewerBlock.exists && !targetBlock.exists && consent.val() === true
        ? aggregateRedditPresence(targetConnections.val(), nowMs) : "offline";
      return {userId: targetId, state};
    }));
  return {rivals};
}

/** Provides disconnect reddit presence behavior. */
export async function disconnectRedditPresence(
  userId: string, sessionId: string,
  options: {database?: ReturnType<typeof admin.database>; nowMs?: number} = {},
): Promise<void> {
  const nowMs = options.nowMs ?? Date.now();
  assertInput(userId, sessionId, nowMs);
  const database = options.database ?? admin.database();
  await database.ref(`presenceConnections/${userId}/${sessionId}`).remove();
  const connections = (await database.ref(`presenceConnections/${userId}`).get()).val();
  const state = aggregateRedditPresence(connections, nowMs);
  await database.ref().update({[`presenceStatus/${userId}`]: {state, updatedAt: nowMs},
    [`presenceOptIn/${userId}`]: state !== "offline"});
}
