import {createHash} from "node:crypto";
import {RACE_CHALLENGE_TTL_MS, type RaceLocale} from "../../../../../src/core/race/index.js";
import {HttpsError} from "firebase-functions/v2/https";
import {isFacebookFirebaseUid} from "../facebookSecurity";

/** Defines the facebook context board duration ms value. */
export const FACEBOOK_CONTEXT_BOARD_DURATION_MS = RACE_CHALLENGE_TTL_MS;
/** Defines the facebook context history retention ms value. */
export const FACEBOOK_CONTEXT_HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
/** Defines the facebook firestore timestamp max ms value. */
export const FACEBOOK_FIRESTORE_TIMESTAMP_MAX_MS = 253_402_300_799_999;
/** Describes facebook context type. */
export type FacebookContextType = "THREAD" | "GROUP";

/** Describes facebook context member. */
export type FacebookContextMember = {
  /** Stores user id. */
  userId: string;
  /** Stores joined at ms. */
  joinedAtMs: number;
  /** Stores active. */
  active: boolean;
};

/** Describes facebook context competition. */
export type FacebookContextCompetition = {
  /** Stores context key. */
  contextKey: string;
  /** Stores context type. */
  contextType: FacebookContextType;
  /** Stores locale. */
  locale: RaceLocale;
  /** Stores host user id. */
  hostUserId: string;
  /** Stores members. */
  members: FacebookContextMember[];
  /** Stores created at ms. */
  createdAtMs: number;
  /** Stores expires at ms. */
  expiresAtMs: number;
};

/** Locale is part of the exact offline matchmaking tag and cannot be omitted. */
export const facebookOfflineMatchTag = (locale: RaceLocale): string => `race10_v1:${locale}`;

/** Hashes provider context identifiers before they enter shared server collections. */
export function facebookContextKey(contextId: string): string {
  if (!/^[A-Za-z0-9._:-]{1,256}$/.test(contextId)) {
    throw new HttpsError("invalid-argument", "Facebook context ID is invalid.");
  }
  return createHash("sha256").update(`facebook-context-v1\0${contextId}`, "utf8").digest("hex");
}

/** Provides elect host behavior. */
const electHost = (members: FacebookContextMember[]): string => {
  /** Provides eligible behavior. */
  const eligible = members
    .filter(({active}) => active)
    .sort((left, right) => left.joinedAtMs - right.joinedAtMs || left.userId.localeCompare(right.userId));
  if (eligible.length === 0) throw new HttpsError("failed-precondition", "Context has no eligible host.");
  return eligible[0].userId;
};

/** Creates a locale-isolated context record containing only game-owned identities. */
export function createFacebookContextCompetition(input: {
  /** Stores context id. */
  contextId: string;
  /** Stores context type. */
  contextType: FacebookContextType;
  /** Stores locale. */
  locale: RaceLocale;
  /** Stores user id. */
  userId: string;
  /** Stores now ms. */
  nowMs: number;
}): FacebookContextCompetition {
  if (!isFacebookFirebaseUid(input.userId)) {
    throw new HttpsError("permission-denied", "Facebook identity is required.");
  }
  if (
    !Number.isSafeInteger(input.nowMs) ||
    input.nowMs < 0 ||
    input.nowMs >
      FACEBOOK_FIRESTORE_TIMESTAMP_MAX_MS - FACEBOOK_CONTEXT_BOARD_DURATION_MS - FACEBOOK_CONTEXT_HISTORY_RETENTION_MS
  ) {
    throw new HttpsError("invalid-argument", "Facebook context time is invalid.");
  }
  /** Provides members behavior. */
  const members = [{userId: input.userId, joinedAtMs: input.nowMs, active: true}];
  return {
    contextKey: facebookContextKey(input.contextId),
    contextType: input.contextType,
    locale: input.locale,
    hostUserId: input.userId,
    members,
    createdAtMs: input.nowMs,
    expiresAtMs: input.nowMs + FACEBOOK_CONTEXT_BOARD_DURATION_MS,
  };
}

/** Transaction reducer for joins, blocking, and deterministic host failover. */
export function updateFacebookContextCompetition(
  current: FacebookContextCompetition,
  action:
    | {
        /** Stores kind. */
        kind: "join"; /** Stores user id. */
        /** Stores user id. */
        userId: string; /** Stores locale. */
        /** Stores locale. */
        locale: RaceLocale; /** Stores now ms. */
        /** Stores now ms. */
        nowMs: number;
      }
    | {
        /** Stores kind. */
        kind: "leave"; /** Stores user id. */
        /** Stores user id. */
        userId: string; /** Stores now ms. */
        /** Stores now ms. */
        nowMs: number;
      },
): FacebookContextCompetition {
  if (!isFacebookFirebaseUid(action.userId)) {
    throw new HttpsError("permission-denied", "Facebook identity is required.");
  }
  if (!Number.isSafeInteger(action.nowMs) || action.nowMs < 0) {
    throw new HttpsError("invalid-argument", "Facebook context time is invalid.");
  }
  if (action.nowMs < current.createdAtMs) {
    throw new HttpsError("failed-precondition", "Facebook context competition has not started.");
  }
  if (action.nowMs >= current.expiresAtMs) {
    throw new HttpsError("failed-precondition", "Facebook context competition has expired.");
  }
  /** Provides members behavior. */
  const members = current.members.map((member) => ({...member}));
  if (action.kind === "join") {
    if (action.locale !== current.locale) {
      throw new HttpsError("failed-precondition", "Facebook context locale does not match the player locale.");
    }
    /** Provides existing behavior. */
    const existing = members.find(({userId}) => userId === action.userId);
    if (existing) {
      if (!existing.active) existing.joinedAtMs = action.nowMs;
      existing.active = true;
    } else {
      members.push({userId: action.userId, joinedAtMs: action.nowMs, active: true});
    }
  } else {
    /** Provides leaving behavior. */
    const leaving = members.find(({userId}) => userId === action.userId);
    if (!leaving?.active) throw new HttpsError("failed-precondition", "Player is not active in this context.");
    leaving.active = false;
  }
  return {...current, members, hostUserId: electHost(members)};
}
