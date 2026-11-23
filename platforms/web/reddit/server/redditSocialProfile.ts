import {RaceEntryResponseSchema} from "../../../../src/races/contracts/index.js";
import {admin} from "../../../../firebase-functions/src/shared/firebaseAdmin";
import {isRedditFirebaseUid} from "./redditSecurity";
import {
  ListRaceInboxResponseSchema,
  PublishRaceChallengeResponseSchema,
  RaceChallengePreviewSchema,
  RaceRunResponseSchema,
  SubmitRaceGuessResponseSchema,
  RequestRaceHintResponseSchema,
  SkipRaceRiddleResponseSchema,
  AbandonRaceRunResponseSchema,
} from "../../../../src/races/contracts/index.js";
import {parseChallengeRecord, parseRunRecord} from "../../../../firebase-functions/src/race/raceSetupService";

/** Describes reddit social profile. */
export type RedditSocialProfile = Readonly<{
  /** Stores display name. */
  displayName: string; /** Stores avatar url. */
  /** Stores avatar url. */
  avatarUrl?: string;
}>;
/** Provides timestamp millis behavior. */
const timestampMillis = (value: unknown): number | undefined => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("toMillis" in value) ||
    typeof (
      value as {
        /** Stores to millis. */
        toMillis?: unknown;
      }
    ).toMillis !== "function"
  )
    return undefined;
  try {
    /** Provides result behavior. */
    const result = (
      value as {
        /** Provides to millis behavior. */
        toMillis(): unknown;
      }
    ).toMillis();
    return Number.isSafeInteger(result) && (result as number) >= 0 ? (result as number) : undefined;
  } catch {
    return undefined;
  }
};

/** Reads a bounded, unexpired provider profile for a Reddit-only social surface. */
export async function readRedditSocialProfile(
  uid: string,
  options: {
    /** Stores db. */
    db?: FirebaseFirestore.Firestore; /** Stores now ms. */
    /** Stores now ms. */
    nowMs?: number;
  } = {},
): Promise<RedditSocialProfile | undefined> {
  if (!isRedditFirebaseUid(uid)) return undefined;
  /** Provides snapshot behavior. */
  const snapshot = await (options.db ?? admin.firestore())
    .collection("providerIdentities")
    .where("provider", "==", "reddit")
    .where("uid", "==", uid)
    .limit(2)
    .get();
  if (snapshot.size !== 1) return undefined;
  /** Provides provider behavior. */
  const provider = snapshot.docs[0].data();
  /** Provides profile behavior. */
  const profile = provider.redditProfile;
  if (
    provider.status !== "active" ||
    typeof profile !== "object" ||
    profile === null ||
    !/^[A-Za-z0-9_-]{3,20}$/.test(profile.username) ||
    timestampMillis(profile.expiresAt) === undefined ||
    timestampMillis(profile.expiresAt)! <= (options.nowMs ?? Date.now())
  ) {
    return undefined;
  }
  /** Provides avatar url behavior. */
  const avatarUrl = profile.avatarUrl;
  return {
    displayName: profile.username,
    ...(typeof avatarUrl === "string" &&
    /^https:\/\/(?:styles\.redditmedia\.com|www\.redditstatic\.com)\//.test(avatarUrl)
      ? {avatarUrl}
      : {}),
  };
}

/** Provides identity behavior. */
const identity = async (uid: string, db: FirebaseFirestore.Firestore, nowMs: number) =>
  (await readRedditSocialProfile(uid, {db, nowMs})) ?? {displayName: "Riddle Quest player"};

/** Rehydrates provider identity only into Reddit race presentation responses. */
export async function hydrateRedditRaceSocialResult(
  operation: string,
  payload: unknown,
  result: unknown,
  options: {
    /** Stores db. */
    db?: FirebaseFirestore.Firestore; /** Stores now ms. */
    /** Stores now ms. */
    nowMs?: number;
  } = {},
): Promise<unknown> {
  /** Provides db behavior. */
  const db = options.db ?? admin.firestore();
  /** Provides now ms behavior. */
  const nowMs = options.nowMs ?? Date.now();
  if (operation === "gameplay.race.entry") {
    /** Typed lifecycle reads hydrate identity only when a challenge is ready. */
    const entry = RaceEntryResponseSchema.parse(result);
    if (entry.status !== "ready") return entry;
    /** Preserve provider-owned identity on the established preview seam. */
    const challenge = await hydrateRedditRaceSocialResult("gameplay.race.challenge", payload, entry.challenge, {db, nowMs});
    return RaceEntryResponseSchema.parse({...entry, challenge});
  }
  if (operation === "gameplay.race.challenge") {
    /** Provides preview behavior. */
    const preview = RaceChallengePreviewSchema.parse(result);
    /** Provides input behavior. */
    const input = payload as {
      /** Stores challenge id. */
      challengeId?: unknown;
    };
    if (typeof input?.challengeId !== "string") return preview;
    /** Provides snapshot behavior. */
    const snapshot = await db.collection("raceChallenges").doc(input.challengeId).get();
    if (!snapshot.exists) return {...preview, creator: {displayName: "Riddle Quest player"}};
    /** Provides challenge behavior. */
    const challenge = parseChallengeRecord(snapshot.data());
    return RaceChallengePreviewSchema.parse({...preview, creator: await identity(challenge.creatorId, db, nowMs)});
  }
  if (operation === "gameplay.race.publish") {
    /** Provides response behavior. */
    const response = PublishRaceChallengeResponseSchema.parse(result);
    /** Provides snapshot behavior. */
    const snapshot = await db.collection("raceChallenges").doc(response.challengeId).get();
    /** Provides creator id behavior. */
    const creatorId = snapshot.exists ? parseChallengeRecord(snapshot.data()).creatorId : undefined;
    return PublishRaceChallengeResponseSchema.parse({
      ...response,
      preview: {
        ...response.preview,
        creator: creatorId ? await identity(creatorId, db, nowMs) : {displayName: "Riddle Quest player"},
      },
    });
  }
  if (operation === "gameplay.race.inbox") {
    /** Provides response behavior. */
    const response = ListRaceInboxResponseSchema.parse(result);
    return ListRaceInboxResponseSchema.parse({
      ...response,
      items: await Promise.all(
        response.items.map(async (item) => {
          if (!item.opponentUserId || !isRedditFirebaseUid(item.opponentUserId))
            return {
              ...item,
              opponentDisplayName: "Riddle Quest player",
              opponentAvatarUrl: undefined,
              opponentLevel: undefined,
            };
          /** Provides profile behavior. */
          const profile = await identity(item.opponentUserId, db, nowMs);
          return {
            ...item,
            opponentDisplayName: profile.displayName,
            ...(profile.avatarUrl ? {opponentAvatarUrl: profile.avatarUrl} : {opponentAvatarUrl: undefined}),
          };
        }),
      ),
    });
  }
  /** Provides run schemas behavior. */
  const runSchemas = {
    "gameplay.race.start": RaceRunResponseSchema,
    "gameplay.race.ready": RaceRunResponseSchema,
    "gameplay.race.resume": RaceRunResponseSchema,
    "gameplay.race.guess": SubmitRaceGuessResponseSchema,
    "gameplay.race.hint": RequestRaceHintResponseSchema,
    "gameplay.race.skip": SkipRaceRiddleResponseSchema,
    "gameplay.race.abandon": AbandonRaceRunResponseSchema,
  } as const;
  /** Provides schema behavior. */
  const schema = runSchemas[operation as keyof typeof runSchemas];
  if (!schema) return result;
  /** Provides response behavior. */
  const response = schema.parse(result);
  if (!response.run.opponent) return response;
  /** Provides snapshot behavior. */
  const snapshot = await db.collection("raceRuns").doc(response.run.runId).get();
  /** Provides opponent id behavior. */
  const opponentId = snapshot.exists ? parseRunRecord(snapshot.data()).opponent?.subjectUserId : undefined;
  /** Provides profile behavior. */
  const profile =
    opponentId && isRedditFirebaseUid(opponentId)
      ? await identity(opponentId, db, nowMs)
      : {displayName: "Riddle Quest player"};
  return schema.parse({
    ...response,
    run: {
      ...response.run,
      opponent: {
        ...response.run.opponent,
        displayName: profile.displayName,
        ...(profile.avatarUrl ? {avatarUrl: profile.avatarUrl} : {avatarUrl: undefined}),
      },
    },
  });
}
