import {FindRedditRaceMatchResponseSchema, type FindRedditRaceMatchResponse, type RaceLocale} from "@qwordly/core/race";
import {admin} from "../shared/firebaseAdmin";
import {getRaceChallengePreview} from "../race/raceService";
import {parseChallengeRecord} from "../race/raceSetupService";
import {isRedditFirebaseUid} from "./redditSecurity";
import {readRedditSocialProfile} from "./redditSocialProfile";

/** Describes firestore. */
type Firestore = FirebaseFirestore.Firestore;

/** Finds an active answer-safe Reddit ghost globally, never within a Devvit installation silo. */
export async function findRedditRaceMatch(
  userId: string,
  locale: RaceLocale,
  options: {db?: Firestore; nowMs?: number; preview?: typeof getRaceChallengePreview;
    socialProfile?: typeof readRedditSocialProfile} = {},
): Promise<FindRedditRaceMatchResponse> {
  if (!isRedditFirebaseUid(userId)) throw new Error("reddit-matchmaking-identity-required");
  const db = options.db ?? admin.firestore();
  const nowMs = options.nowMs ?? Date.now();
  const preview = options.preview ?? getRaceChallengePreview;
  const socialProfile = options.socialProfile ?? readRedditSocialProfile;
  const snapshot = await db.collection("raceChallenges")
    .where("locale", "==", locale)
    .where("status", "==", "active")
    .where("expiresAtMs", ">", nowMs)
    .orderBy("expiresAtMs", "asc")
    .limit(50)
    .get();
  for (const document of snapshot.docs) {
    try {
      const challenge = parseChallengeRecord(document.data());
      if (challenge.creatorId === userId || !isRedditFirebaseUid(challenge.creatorId)) continue;
      const challengePreview = await preview(challenge.challengeId, locale, {db, nowMs});
      const profile = await socialProfile(challenge.creatorId, {db, nowMs});
      return FindRedditRaceMatchResponseSchema.parse({
        status: "matched",
        challenge: {...challengePreview, creator: profile ?? {displayName: "Riddle Quest player"}},
      });
    } catch {
      // Corrupt, expired, deleted, or concurrently revoked candidates are skipped.
    }
  }
  return FindRedditRaceMatchResponseSchema.parse({status: "empty", locale});
}
