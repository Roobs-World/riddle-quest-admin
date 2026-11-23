import type {Firestore} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {RaceLocaleSchema, type RaceLocale} from "@riddle-quest/core/race";
import {admin} from "../../../../../firebase-functions/src/shared/firebaseAdmin";
import {isFacebookFirebaseUid} from "../facebookSecurity";
import {
  FACEBOOK_CONTEXT_BOARD_DURATION_MS,
  FACEBOOK_CONTEXT_HISTORY_RETENTION_MS,
  FACEBOOK_FIRESTORE_TIMESTAMP_MAX_MS,
  createFacebookContextCompetition,
  facebookContextKey,
  type FacebookContextCompetition,
  type FacebookContextType,
  updateFacebookContextCompetition,
} from "./facebookContextCompetition";

/** Defines the facebook context member limit value. */
export const FACEBOOK_CONTEXT_MEMBER_LIMIT = 50;
/** Defines the facebook context deletion page size value. */
const FACEBOOK_CONTEXT_DELETION_PAGE_SIZE = 100;
export {FACEBOOK_CONTEXT_HISTORY_RETENTION_MS} from "./facebookContextCompetition";

/** Parses facebook context competition. */
export const parseFacebookContextCompetition = (
  value: FirebaseFirestore.DocumentData | undefined,
): FacebookContextCompetition => {
  if (
    !value ||
    typeof value.contextKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.contextKey) ||
    (value.contextType !== "THREAD" && value.contextType !== "GROUP") ||
    !RaceLocaleSchema.safeParse(value.locale).success ||
    typeof value.hostUserId !== "string" ||
    !Array.isArray(value.members) ||
    !Number.isSafeInteger(value.createdAtMs) ||
    value.createdAtMs < 0 ||
    !Number.isSafeInteger(value.expiresAtMs) ||
    value.expiresAtMs !== value.createdAtMs + FACEBOOK_CONTEXT_BOARD_DURATION_MS ||
    value.expiresAtMs > FACEBOOK_FIRESTORE_TIMESTAMP_MAX_MS - FACEBOOK_CONTEXT_HISTORY_RETENTION_MS
  )
    throw new HttpsError("data-loss", "Facebook context record is invalid.");
  /** Provides members behavior. */
  const members = value.members.map((member: unknown) => {
    if (
      typeof member !== "object" ||
      member === null ||
      typeof (member as Record<string, unknown>).userId !== "string" ||
      !Number.isSafeInteger((member as Record<string, unknown>).joinedAtMs) ||
      typeof (member as Record<string, unknown>).active !== "boolean"
    )
      throw new HttpsError("data-loss", "Facebook context membership is invalid.");
    /** Parses d. */
    const parsed = member as FacebookContextCompetition["members"][number];
    if (!isFacebookFirebaseUid(parsed.userId)) {
      throw new HttpsError("data-loss", "Facebook context membership identity is invalid.");
    }
    if (parsed.joinedAtMs < value.createdAtMs || parsed.joinedAtMs >= value.expiresAtMs) {
      throw new HttpsError("data-loss", "Facebook context membership time is invalid.");
    }
    return parsed;
  });
  if (!isFacebookFirebaseUid(value.hostUserId)) {
    throw new HttpsError("data-loss", "Facebook context host identity is invalid.");
  }
  if (members.length < 1 || members.length > FACEBOOK_CONTEXT_MEMBER_LIMIT) {
    throw new HttpsError("data-loss", "Facebook context membership count is invalid.");
  }
  if (new Set(members.map(({userId}) => userId)).size !== members.length) {
    throw new HttpsError("data-loss", "Facebook context membership identities are duplicated.");
  }
  /** Provides active members behavior. */
  const activeMembers = members
    .filter(({active}) => active)
    .sort((left, right) => left.joinedAtMs - right.joinedAtMs || left.userId.localeCompare(right.userId));
  if (activeMembers.length === 0 || activeMembers[0]!.userId !== value.hostUserId) {
    throw new HttpsError("data-loss", "Facebook context host election is invalid.");
  }
  return {
    contextKey: value.contextKey,
    contextType: value.contextType,
    locale: value.locale as RaceLocale,
    hostUserId: value.hostUserId,
    members,
    createdAtMs: value.createdAtMs,
    expiresAtMs: value.expiresAtMs,
  };
};

/** Asserts facebook user. */
const assertFacebookUser = (userId: string): void => {
  if (!isFacebookFirebaseUid(userId)) throw new HttpsError("permission-denied", "Facebook identity is required.");
};

/** Joins/creates one context and establishes rivals only among independently joined active members. */
export async function joinFacebookContextCompetition(
  input: {
    /** Stores user id. */
    userId: string;
    /** Stores context id. */
    contextId: string;
    /** Stores context type. */
    contextType: FacebookContextType;
    /** Stores locale. */
    locale: RaceLocale;
    /** Stores now ms. */
    nowMs?: number;
  },
  db: Firestore = admin.firestore(),
): Promise<FacebookContextCompetition> {
  assertFacebookUser(input.userId);
  /** Provides now ms behavior. */
  const nowMs = input.nowMs ?? Date.now();
  if (
    !Number.isSafeInteger(nowMs) ||
    nowMs < 0 ||
    nowMs >
      FACEBOOK_FIRESTORE_TIMESTAMP_MAX_MS - FACEBOOK_CONTEXT_BOARD_DURATION_MS - FACEBOOK_CONTEXT_HISTORY_RETENTION_MS
  ) {
    throw new HttpsError("invalid-argument", "Facebook context time is invalid.");
  }
  /** Provides context key behavior. */
  const contextKey = facebookContextKey(input.contextId);
  /** Provides context ref behavior. */
  const contextRef = db.collection("facebookContextCompetitions").doc(contextKey);
  return db.runTransaction(async (transaction) => {
    /** Provides snapshot behavior. */
    const snapshot = await transaction.get(contextRef);
    /** Provides current behavior. */
    const current = snapshot.exists ? parseFacebookContextCompetition(snapshot.data()) : undefined;
    if (current && current.contextKey !== contextKey) {
      throw new HttpsError("data-loss", "Facebook context record key is invalid.");
    }
    /** Provides expired behavior. */
    const expired = current !== undefined && nowMs >= current.expiresAtMs;
    if (current && !expired && current.contextType !== input.contextType) {
      throw new HttpsError("failed-precondition", "Facebook context type changed unexpectedly.");
    }
    if (current && expired) {
      transaction.set(
        db.doc(`facebookContextCompetitionHistory/${contextKey}_${current.createdAtMs}`),
        {
          contextKey,
          contextType: current.contextType,
          locale: current.locale,
          startsAtMs: current.createdAtMs,
          endsAtMs: current.expiresAtMs,
          participantCount: current.members.length,
          archivedAtMs: nowMs,
          rewardsEnabled: false,
          expiresAt: admin.firestore.Timestamp.fromMillis(current.expiresAtMs + FACEBOOK_CONTEXT_HISTORY_RETENTION_MS),
        },
        {merge: false},
      );
      for (const member of current.members) {
        transaction.delete(db.doc(`facebookContextCompetitions/${contextKey}/entries/${member.userId}`));
      }
    }
    /** Provides reactivating behavior. */
    const reactivating =
      current !== undefined &&
      !expired &&
      current.members.some((member) => member.userId === input.userId && !member.active);
    /** Provides competition behavior. */
    const competition =
      current && !expired
        ? updateFacebookContextCompetition(current, {
            kind: "join",
            userId: input.userId,
            locale: input.locale,
            nowMs,
          })
        : createFacebookContextCompetition({...input, nowMs});
    if (competition.members.length > FACEBOOK_CONTEXT_MEMBER_LIMIT) {
      throw new HttpsError("resource-exhausted", "Facebook context member limit reached.");
    }
    transaction.set(contextRef, {
      ...competition,
      memberIds: competition.members.map(({userId}) => userId),
      expiresAt: admin.firestore.Timestamp.fromMillis(competition.expiresAtMs),
    });
    if (reactivating) {
      transaction.delete(db.doc(`facebookContextCompetitions/${contextKey}/entries/${input.userId}`));
    }
    for (const member of competition.members) {
      if (!member.active || member.userId === input.userId) continue;
      transaction.set(
        db.doc(`users/${input.userId}/knownRivals/${member.userId}`),
        {
          targetUserId: member.userId,
          source: "facebook_context",
          contextKey,
          establishedAtMs: nowMs,
        },
        {merge: true},
      );
      transaction.set(
        db.doc(`users/${member.userId}/knownRivals/${input.userId}`),
        {
          targetUserId: input.userId,
          source: "facebook_context",
          contextKey,
          establishedAtMs: nowMs,
        },
        {merge: true},
      );
    }
    return competition;
  });
}

/** Leaves one active context membership and deterministically fails over the host. */
export async function leaveFacebookContextCompetition(
  input: {
    /** Stores user id. */
    userId: string; /** Stores context id. */
    /** Stores context id. */
    contextId: string; /** Stores now ms. */
    /** Stores now ms. */
    nowMs?: number;
  },
  db: Firestore = admin.firestore(),
): Promise<FacebookContextCompetition | null> {
  assertFacebookUser(input.userId);
  /** Provides now ms behavior. */
  const nowMs = input.nowMs ?? Date.now();
  if (
    !Number.isSafeInteger(nowMs) ||
    nowMs < 0 ||
    nowMs >
      FACEBOOK_FIRESTORE_TIMESTAMP_MAX_MS - FACEBOOK_CONTEXT_BOARD_DURATION_MS - FACEBOOK_CONTEXT_HISTORY_RETENTION_MS
  ) {
    throw new HttpsError("invalid-argument", "Facebook context time is invalid.");
  }
  /** Provides context ref behavior. */
  const contextRef = db.collection("facebookContextCompetitions").doc(facebookContextKey(input.contextId));
  return db.runTransaction(async (transaction) => {
    /** Provides snapshot behavior. */
    const snapshot = await transaction.get(contextRef);
    if (!snapshot.exists) throw new HttpsError("not-found", "Facebook context competition was not found.");
    /** Provides current behavior. */
    const current = parseFacebookContextCompetition(snapshot.data());
    if (current.contextKey !== contextRef.id) {
      throw new HttpsError("data-loss", "Facebook context record key is invalid.");
    }
    if (nowMs < current.createdAtMs) {
      throw new HttpsError("failed-precondition", "Facebook context competition has not started.");
    }
    if (nowMs >= current.expiresAtMs) {
      throw new HttpsError("failed-precondition", "Facebook context competition has expired.");
    }
    /** Provides leaving behavior. */
    const leaving = current.members.find(({userId}) => userId === input.userId);
    if (!leaving?.active) throw new HttpsError("failed-precondition", "Player is not active in this context.");
    if (current.members.filter(({active}) => active).length === 1) {
      for (const member of current.members) {
        transaction.delete(db.doc(`facebookContextCompetitions/${current.contextKey}/entries/${member.userId}`));
      }
      transaction.delete(contextRef);
      return null;
    }
    /** Provides competition behavior. */
    const competition = updateFacebookContextCompetition(current, {
      kind: "leave",
      userId: input.userId,
      nowMs,
    });
    transaction.set(contextRef, {
      ...competition,
      memberIds: competition.members.map(({userId}) => userId),
      expiresAt: admin.firestore.Timestamp.fromMillis(competition.expiresAtMs),
    });
    return competition;
  });
}

/**
 * Removes every trace of one player from context membership during account deletion.
 *
 * Context IDs never need to be recovered: the server-owned `memberIds` projection
 * provides the deletion index. Empty competitions are deleted; otherwise the
 * earliest active remaining member becomes host. Querying from the beginning on
 * every page is intentional because each successful transaction removes the UID
 * from the indexed array.
 */
export async function removeUserFromFacebookContextCompetitions(
  userId: string,
  db: Firestore = admin.firestore(),
): Promise<void> {
  if (!isFacebookFirebaseUid(userId)) return;
  while (true) {
    /** Provides snapshot behavior. */
    const snapshot = await db
      .collection("facebookContextCompetitions")
      .where("memberIds", "array-contains", userId)
      .limit(FACEBOOK_CONTEXT_DELETION_PAGE_SIZE)
      .get();
    if (snapshot.empty) return;
    await Promise.all(
      snapshot.docs.map((document) =>
        db.runTransaction(async (transaction) => {
          /** Provides current snapshot behavior. */
          const currentSnapshot = await transaction.get(document.ref);
          if (!currentSnapshot.exists) return;
          /** Provides current behavior. */
          const current = parseFacebookContextCompetition(currentSnapshot.data());
          if (current.contextKey !== document.ref.id) {
            throw new HttpsError("data-loss", "Facebook context record key is invalid.");
          }
          /** Provides members behavior. */
          const members = current.members.filter((member) => member.userId !== userId);
          /** Provides active behavior. */
          const active = members.filter((member) => member.active);
          if (active.length === 0) {
            for (const member of current.members) {
              transaction.delete(db.doc(`facebookContextCompetitions/${current.contextKey}/entries/${member.userId}`));
            }
            transaction.delete(document.ref);
            return;
          }
          transaction.delete(db.doc(`facebookContextCompetitions/${current.contextKey}/entries/${userId}`));
          /** Provides host user id behavior. */
          const hostUserId = [...active].sort(
            (left, right) => left.joinedAtMs - right.joinedAtMs || left.userId.localeCompare(right.userId),
          )[0].userId;
          transaction.set(document.ref, {
            ...current,
            hostUserId,
            members,
            memberIds: members.map((member) => member.userId),
            expiresAt: admin.firestore.Timestamp.fromMillis(current.expiresAtMs),
          });
        }),
      ),
    );
  }
}
