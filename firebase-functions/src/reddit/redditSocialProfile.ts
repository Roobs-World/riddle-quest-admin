import {admin} from "../shared/firebaseAdmin";
import {isRedditFirebaseUid} from "./redditSecurity";
import {
  ListRaceInboxResponseSchema, PublishRaceChallengeResponseSchema, RaceChallengePreviewSchema,
  RaceRunResponseSchema, SubmitRaceGuessResponseSchema, RequestRaceHintResponseSchema,
  SkipRaceRiddleResponseSchema, AbandonRaceRunResponseSchema,
} from "@qwordly/core/race";
import {parseChallengeRecord, parseRunRecord} from "../race/raceSetupService";

/** Describes reddit social profile. */
export type RedditSocialProfile = Readonly<{displayName: string; avatarUrl?: string}>;
/** Provides timestamp millis behavior. */
const timestampMillis = (value: unknown): number | undefined => {
  if (typeof value !== "object" || value === null || !("toMillis" in value) ||
    typeof (value as {toMillis?: unknown}).toMillis !== "function") return undefined;
  try {
    const result = (value as {toMillis(): unknown}).toMillis();
    return Number.isSafeInteger(result) && (result as number) >= 0 ? result as number : undefined;
  } catch { return undefined; }
};

/** Reads a bounded, unexpired provider profile for a Reddit-only social surface. */
export async function readRedditSocialProfile(
  uid: string,
  options: {db?: FirebaseFirestore.Firestore; nowMs?: number} = {},
): Promise<RedditSocialProfile | undefined> {
  if (!isRedditFirebaseUid(uid)) return undefined;
  const snapshot = await (options.db ?? admin.firestore()).collection("providerIdentities")
    .where("provider", "==", "reddit").where("uid", "==", uid).limit(2).get();
  if (snapshot.size !== 1) return undefined;
  const provider = snapshot.docs[0].data();
  const profile = provider.redditProfile;
  if (provider.status !== "active" || typeof profile !== "object" || profile === null ||
    !/^[A-Za-z0-9_-]{3,20}$/.test(profile.username) ||
    timestampMillis(profile.expiresAt) === undefined || timestampMillis(profile.expiresAt)! <= (options.nowMs ?? Date.now())) {
    return undefined;
  }
  const avatarUrl = profile.avatarUrl;
  return {
    displayName: profile.username,
    ...(typeof avatarUrl === "string" && /^https:\/\/(?:styles\.redditmedia\.com|www\.redditstatic\.com)\//.test(avatarUrl)
      ? {avatarUrl} : {}),
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
  options: {db?: FirebaseFirestore.Firestore; nowMs?: number} = {},
): Promise<unknown> {
  const db = options.db ?? admin.firestore();
  const nowMs = options.nowMs ?? Date.now();
  if (operation === "gameplay.race.challenge") {
    const preview = RaceChallengePreviewSchema.parse(result);
    const input = payload as {challengeId?: unknown};
    if (typeof input?.challengeId !== "string") return preview;
    const snapshot = await db.collection("raceChallenges").doc(input.challengeId).get();
    if (!snapshot.exists) return {...preview, creator: {displayName: "Riddle Quest player"}};
    const challenge = parseChallengeRecord(snapshot.data());
    return RaceChallengePreviewSchema.parse({...preview, creator: await identity(challenge.creatorId, db, nowMs)});
  }
  if (operation === "gameplay.race.publish") {
    const response = PublishRaceChallengeResponseSchema.parse(result);
    const snapshot = await db.collection("raceChallenges").doc(response.challengeId).get();
    const creatorId = snapshot.exists ? parseChallengeRecord(snapshot.data()).creatorId : undefined;
    return PublishRaceChallengeResponseSchema.parse({...response,
      preview: {...response.preview, creator: creatorId ? await identity(creatorId, db, nowMs) : {displayName: "Riddle Quest player"}}});
  }
  if (operation === "gameplay.race.inbox") {
    const response = ListRaceInboxResponseSchema.parse(result);
    return ListRaceInboxResponseSchema.parse({...response, items: await Promise.all(response.items.map(async (item) => {
      if (!item.opponentUserId || !isRedditFirebaseUid(item.opponentUserId)) return {
        ...item, opponentDisplayName: "Riddle Quest player", opponentAvatarUrl: undefined,
      };
      const profile = await identity(item.opponentUserId, db, nowMs);
      return {...item, opponentDisplayName: profile.displayName,
        ...(profile.avatarUrl ? {opponentAvatarUrl: profile.avatarUrl} : {opponentAvatarUrl: undefined})};
    }))});
  }
  const runSchemas = {
    "gameplay.race.start": RaceRunResponseSchema,
    "gameplay.race.resume": RaceRunResponseSchema,
    "gameplay.race.guess": SubmitRaceGuessResponseSchema,
    "gameplay.race.hint": RequestRaceHintResponseSchema,
    "gameplay.race.skip": SkipRaceRiddleResponseSchema,
    "gameplay.race.abandon": AbandonRaceRunResponseSchema,
  } as const;
  const schema = runSchemas[operation as keyof typeof runSchemas];
  if (!schema) return result;
  const response = schema.parse(result);
  if (!response.run.opponent) return response;
  const snapshot = await db.collection("raceRuns").doc(response.run.runId).get();
  const opponentId = snapshot.exists ? parseRunRecord(snapshot.data()).opponent?.subjectUserId : undefined;
  const profile = opponentId && isRedditFirebaseUid(opponentId)
    ? await identity(opponentId, db, nowMs) : {displayName: "Riddle Quest player"};
  return schema.parse({...response, run: {...response.run, opponent: {...response.run.opponent,
    displayName: profile.displayName, ...(profile.avatarUrl ? {avatarUrl: profile.avatarUrl} : {avatarUrl: undefined})}}});
}
