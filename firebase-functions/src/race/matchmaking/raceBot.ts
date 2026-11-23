import {createHash} from "node:crypto";
import {z} from "zod";
import {HttpsError} from "firebase-functions/v2/https";
import {RaceCategoryIdSchema, RaceLocaleSchema, RACE_CHALLENGE_TTL_MS, RACE_RULES,
  raceMatchFailure, type RaceMatchRequest, type StartRaceRunRequest} from "../../../../src/races/contracts/index.js";
import {admin} from "../../shared/firebaseAdmin";
import {requestDocumentId, listRaceCategoriesForLocale, type Firestore} from "../raceSetupService";
import {racePerformanceExpectation, type RaceMatchProfile} from "./raceMatchPerformance";
import type {RaceMatchContext} from "./raceMatchPolicy";
import type {RaceOpponentRecord, RaceRiddleSnapshot, RaceRunRecord} from "../runs/raceEngine";
import {assertRaceMatchReadBudget, withMeteredRaceTransaction, type RaceMatchReadMeter} from "./raceMatchReadMeter";

/** Internal receipts keep retry pacing and ownership immutable without creating fake accounts. */
const BotOffer = z.object({version: z.literal(1), userId: z.string().min(1), requestId: z.string().min(8),
  locale: RaceLocaleSchema, categoryId: RaceCategoryIdSchema, requestedCategoryId: RaceCategoryIdSchema.nullable(),
  performanceMs: z.number().finite().min(1000).max(300000), createdAtMs: z.number().int().nonnegative(),
  expiresAtMs: z.number().int().nonnegative(), acceptedRunId: z.string().min(1).max(160).refine(value => !value.includes("/")).optional()})
  .refine(offer => offer.expiresAtMs === offer.createdAtMs + 60_000, {message: "Invalid fallback lifetime"})
  .refine(offer => offer.requestedCategoryId === null || offer.categoryId === offer.requestedCategoryId,
    {message: "Invalid fallback category preference"});
/** Server-selected fallback receipt; timing never comes from the player. */
export type RaceBotOffer = z.infer<typeof BotOffer>;
/** Short selection window; accepted runs retain their own lifecycle and countdown. */
const OFFER_MS = 60_000;
/** Fictional rival names never refer to a real provider account. */
const NAMES = ["Nova", "RiddleRider", "ClueFox", "Luna", "PuzzlePilot", "Echo", "WordWanderer", "Atlas"];

/** Validates the canonical receipt before any bot preparation or concurrent acceptance. */
export function parseRaceBotOffer(value: unknown, userId: string, input: Pick<StartRaceRunRequest, "locale" | "categoryId">, expectedId?: string): RaceBotOffer {
  /** Complete receipt schema result before ownership checks. */
  const parsed = BotOffer.safeParse(value);
  if (!parsed.success) throw new HttpsError("data-loss", "Fallback opponent receipt is invalid.");
  /** Validated immutable selection receipt. */
  const offer = parsed.data;
  if (expectedId !== undefined && requestDocumentId(offer.userId, offer.requestId) !== expectedId)
    throw new HttpsError("data-loss", "Fallback opponent receipt identity is invalid.");
  if (offer.userId !== userId) throw new HttpsError("permission-denied", "Opponent offer belongs to another player.");
  if (offer.locale !== input.locale || offer.categoryId !== input.categoryId)
    throw new HttpsError("invalid-argument", "Opponent offer preferences changed.");
  return offer;
}

/** Accepted offer aliases must resume their original owned synthetic run before a request receipt is written. */
export function assertRaceAcceptedBotRun(run: RaceRunRecord, offer: RaceBotOffer, offerId: string): void {
  if (offer.acceptedRunId !== run.runId || offer.userId !== run.userId || offer.locale !== run.locale || offer.categoryId !== run.categoryId ||
    run.role !== "challenger" || run.fallbackOfferId !== offerId || run.challengeId !== undefined || run.opponent?.kind !== "bot")
    throw new HttpsError("data-loss", "Stored fallback run does not match its accepted offer.");
}

/** Replays only the original owner/request fallback, preserving consumption and expiry recovery. */
export function replayRaceBotOffer(value: unknown, userId: string, input: RaceMatchRequest, requestId: string, nowMs: number) {
  /** Shape validation precedes interpretation of private receipt fields. */
  const result = BotOffer.safeParse(value);
  if (!result.success) throw new HttpsError("data-loss", "Fallback opponent receipt is invalid.");
  /** Physical identity must agree with the caller's original search. */
  const stored = result.data;
  /** Both offer kinds share this deterministic request key. */
  const offerId = requestDocumentId(userId, requestId);
  if (requestDocumentId(stored.userId, stored.requestId) !== offerId)
    throw new HttpsError("data-loss", "Fallback opponent receipt identity is invalid.");
  if (stored.userId !== userId || stored.locale !== input.locale || stored.requestedCategoryId !== (input.categoryId ?? null))
    throw new HttpsError("invalid-argument", "Opponent search preferences changed.");
  if (stored.acceptedRunId) throw new HttpsError("already-exists", "Opponent offer was already accepted.");
  if (stored.expiresAtMs <= nowMs) throw new HttpsError("failed-precondition", "Opponent offer expired.",
    {matchmaking: raceMatchFailure("intent-expired")});
  return {offerId, categoryId: stored.categoryId};
}

/** Issues one stable fallback only after a successful empty recorded-pool search. */
export async function offerRaceBot(db: Firestore, userId: string, input: RaceMatchRequest, requestId: string,
  nowMs: number, profile: RaceMatchProfile, context: RaceMatchContext, meter?: RaceMatchReadMeter) {
  /** Deterministic account/request key coalesces concurrent discovery retries. */
  const ref = db.doc(`raceBotOffers/${requestDocumentId(userId, requestId)}`);
  /** Existing receipt fixes category and pace for the selection lifetime. */
  if (meter) {assertRaceMatchReadBudget(meter); meter.documentReadAttempts++;}
  /** This optional replay read is included in the lookup work budget. */
  const previous = await ref.get();
  if (previous.exists) return replayRaceBotOffer(previous.data(), userId, input, requestId, nowMs);
  /** Unfiltered discovery chooses only a validated available category. */
  const categoryId = input.categoryId ?? (await listRaceCategoriesForLocale(input.locale, db)).categories[0]?.categoryId;
  if (!categoryId) return undefined;
  /** Server-selected expected pace clamped to the supported receipt range. */
  const performanceMs = Math.max(1000, Math.min(300000, Math.exp(
    racePerformanceExpectation(profile, categoryId, nowMs, context.priors, context.policy.performance).expectedLog)));
  /** Immutable timing and preference snapshot retained for acceptance. */
  const offer: RaceBotOffer = {version: 1, userId, requestId, locale: input.locale, categoryId,
    requestedCategoryId: input.categoryId ?? null, performanceMs, createdAtMs: nowMs, expiresAtMs: nowMs + OFFER_MS};
  /** Reading both receipt kinds makes concurrent issuance mutually exclusive. */
  const commit = async (transaction: FirebaseFirestore.Transaction) => {
    /** The winner is re-read after every automatic transaction retry. */
    const [fallback, recorded] = await transaction.getAll(ref, db.doc(`raceMatchOffers/${ref.id}`));
    if (recorded.exists) throw new HttpsError("aborted", "A recorded offer already owns this search; retry with a new intent.");
    if (fallback.exists) return replayRaceBotOffer(fallback.data(), userId, input, requestId, nowMs);
    transaction.create(ref, {...offer, expiresAt: admin.firestore.Timestamp.fromMillis(nowMs + RACE_CHALLENGE_TTL_MS)});
    return {offerId: ref.id, categoryId};
  };
  return meter ? withMeteredRaceTransaction(db, meter, commit) : db.runTransaction(commit);
}

/** Builds bounded, deterministic ghost playback once, with no per-tick server work. */
export function buildRaceBotOpponent(offer: RaceBotOffer, seed: string, riddles: RaceRiddleSnapshot[]): RaceOpponentRecord {
  /** Deterministic independent samples preserve retry playback. */
  const random = (key: string) => createHash("sha256").update(`${seed}:${key}`).digest().readUInt32BE(0) / 0x100000000;
  /** Bounded skip count selected for slower opponents. */
  const skips = offer.performanceMs >= 90_000 && random("skips") < 0.45 ? 1 : 0;
  /** Optional hint position fixed before any gameplay events are emitted. */
  const hintPosition = offer.performanceMs >= 60_000 && random("hint") < 0.5 ? Math.floor(random("hint-position") * 9) : -1;
  /** Optional skipped question within the supported deck. */
  const skipPosition = skips ? 2 + Math.floor(random("skip-position") * 5) : -1;
  /** Questions needed to reach the target after the selected skips. */
  const played = riddles.slice(0, RACE_RULES.targetCorrect + skips);
  if (played.length !== RACE_RULES.targetCorrect + skips) throw new HttpsError("failed-precondition", "Opponent deck is incomplete.");
  /** Relative question durations incorporate authored difficulty and stable variation. */
  const weights = played.map((riddle, position) =>
    (riddle.difficultyBand === "easy" ? 1 : riddle.difficultyBand === "medium" ? 1.5 : riddle.difficultyBand === "hard" ? 2 : 1.25) *
    (0.75 + random(`question:${position}`) * 0.6));
  /** Average authored difficulty adjusts the selected finish pace. */
  const difficulty = played.reduce((sum, riddle) => sum + (riddle.difficultyBand === "easy" ? 1 : riddle.difficultyBand === "medium" ? 1.5 : riddle.difficultyBand === "hard" ? 2 : 1.25), 0) / played.length;
  /** A skip suppresses a hint on the same question. */
  const hasHint = hintPosition >= 0 && hintPosition !== skipPosition;
  /** Complete hint and skip penalties included in the adjusted finish. */
  const penalties = skips * RACE_RULES.skipPenaltyMs + (hasHint ? RACE_RULES.hintPenaltyMs : 0);
  /** Finish pace retains enough wall time for every selected question. */
  const adjustedFinishMs = Math.round(Math.max(30_000, penalties + played.length * 2_000, Math.min(240_000,
    offer.performanceMs * difficulty / 1.25 * (0.9 + random("pace") * 0.22))));
  /** Playback duration excluding competitive penalties. */
  const wallFinishMs = adjustedFinishMs - penalties;
  /** Normalizer for allocating finish time among questions. */
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  /** Accumulated duration weight, penalty time and successful answers. */
  let weight = 0, penalty = 0, correct = 0;
  /** Complete deterministic ghost timeline consumed by browser playback. */
  const events: RaceOpponentRecord["events"] = [];
  for (const [position, value] of weights.entries()) {
    /** Wall clock at the beginning of this question. */
    const beforeMs = Math.round(wallFinishMs * weight / totalWeight);
    weight += value;
    /** Last question ends at the exact selected wall finish. */
    const wallElapsedMs = position === played.length - 1 ? wallFinishMs : Math.round(wallFinishMs * weight / totalWeight);
    if (hasHint && position === hintPosition) {
      penalty += RACE_RULES.hintPenaltyMs;
      /** Hint occurs halfway through its selected question. */
      const hintAt = Math.round((beforeMs + wallElapsedMs) / 2);
      events.push({sequence: events.length, type: "hint", riddlePosition: position, wallElapsedMs: hintAt,
        penaltyAddedMs: RACE_RULES.hintPenaltyMs, totalPenaltyMs: penalty, adjustedElapsedMs: hintAt + penalty, correctCount: correct});
    }
    /** Selected skips add penalties without increasing successful answer count. */
    const skipped = position === skipPosition;
    if (skipped) penalty += RACE_RULES.skipPenaltyMs;
    else correct++;
    events.push({sequence: events.length, type: skipped ? "skip" : "correct", riddlePosition: position, wallElapsedMs,
      penaltyAddedMs: skipped ? RACE_RULES.skipPenaltyMs : 0, totalPenaltyMs: penalty,
      adjustedElapsedMs: wallElapsedMs + penalty, correctCount: correct});
  }
  return {kind: "bot", displayName: NAMES[Math.floor(random("name") * NAMES.length)], adjustedFinishMs, events};
}
