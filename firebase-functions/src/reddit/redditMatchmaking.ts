import {RaceMatchResponseSchema, type RaceMatchRequest, type RaceMatchResponse, type RaceLocale} from "@qwordly/core/race";
import {admin} from "../shared/firebaseAdmin";
import {findRecordedRaceMatch} from "../race/raceMatchmaking";
import {isRedditFirebaseUid} from "./redditSecurity";
import {readRedditSocialProfile} from "./redditSocialProfile";

/** Authenticated Reddit adapter for the provider-neutral recorded-race selector. */
export async function findRedditRaceMatch(
  userId: string,
  input: RaceMatchRequest | RaceLocale,
  options: {
    /** Canonical game storage; installation-local storage is never used. */ db?: FirebaseFirestore.Firestore;
    /** Authoritative request time. */ nowMs?: number;
    /** Provider-owned presentation refreshed only after selection. */ socialProfile?: typeof readRedditSocialProfile;
  } = {},
): Promise<RaceMatchResponse> {
  if (!isRedditFirebaseUid(userId)) throw new Error("reddit-matchmaking-identity-required");
  const request = typeof input === "string" ? {locale: input} : input;
  const result = await findRecordedRaceMatch(userId, request, options);
  if (result.status !== "matched") return result;
  // Canonical provider-neutral previews expose only game-owned presentation.
  // Provider identity hydration stays entirely inside the Reddit adapter.
  const db = options.db;
  const creatorSnapshot = await (db ?? admin.firestore())
    .doc(`raceChallenges/${result.challenge.challengeId}`).get();
  const creatorId = creatorSnapshot.data()?.creatorId;
  const profile = typeof creatorId === "string" ? await (options.socialProfile ?? readRedditSocialProfile)(creatorId, options) : undefined;
  return RaceMatchResponseSchema.parse({...result, challenge: {...result.challenge,
    creator: profile ?? {displayName: "Riddle Quest player"},
  }});
}
