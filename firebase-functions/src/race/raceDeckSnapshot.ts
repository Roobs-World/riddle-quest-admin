import {RACE_RULES} from "@qwordly/core/race";
import {createHash} from "node:crypto";
import {HttpsError} from "firebase-functions/v2/https";
import type {RaceRiddleSnapshot, RaceRunRecord} from "./raceEngine";
import type {RaceChallengeRecord} from "./raceSetupService";

/** Binds legacy archive recovery to the original completed creator recording and fixed ghost metadata. */
export function assertRaceCreatorArchiveLink(run: RaceRunRecord, challenge: RaceChallengeRecord): void {
  if (run.runId !== challenge.creatorRunId || run.userId !== challenge.creatorId || run.role !== "creator" ||
    run.status !== "completed" || run.result !== "recorded" || run.correctCount !== challenge.targetCorrect ||
    run.locale !== challenge.locale || run.categoryId !== challenge.categoryId || run.deckId !== challenge.deckId ||
    run.rulesVersion !== challenge.rules.version || run.rulesSnapshot && Object.keys(challenge.rules).some(key =>
      run.rulesSnapshot![key as keyof typeof challenge.rules] !== challenge.rules[key as keyof typeof challenge.rules]) ||
    run.finishedAtMs === undefined || challenge.createdAtMs < run.finishedAtMs || run.wallFinishMs !== challenge.creatorWallFinishMs ||
    run.hintPenaltyMs !== challenge.creatorHintPenaltyMs || run.skipPenaltyMs !== challenge.creatorSkipPenaltyMs ||
    run.events.length !== challenge.ghostEvents.length || run.events.some((event, index) => {
      /** Ordered owned fields compare timeline meaning independently of object-key ordering. */
      const ghost = challenge.ghostEvents[index];
      return event.sequence !== ghost.sequence || event.type !== ghost.type || event.riddlePosition !== ghost.riddlePosition ||
        event.wallElapsedMs !== ghost.wallElapsedMs || event.penaltyAddedMs !== ghost.penaltyAddedMs ||
        event.totalPenaltyMs !== ghost.totalPenaltyMs || event.adjustedElapsedMs !== ghost.adjustedElapsedMs || event.correctCount !== ghost.correctCount;
    })) throw new HttpsError("data-loss", "The original challenge recording does not match its source.");
}

/** Hashes the exact ordered content played, including text and accepted answers. */
export function raceDeckContentVersion(riddles: RaceRiddleSnapshot[]): string {
  /** Provides canonical behavior. */
  const canonical = riddles.map((riddle) => ({
    riddleId: riddle.riddleId, canonicalRiddleId: riddle.canonicalRiddleId,
    text: riddle.text, answer: riddle.answer, position: riddle.position,
    ...(riddle.difficultyBand ? {difficultyBand: riddle.difficultyBand} : {}),
  }));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

/** Validates and copies a persisted immutable deck against its canonical ordering. */
export function validateRaceDeckSnapshot(value: unknown, canonicalIds: string[], expectedContentVersion?: string): RaceRiddleSnapshot[] {
  if (!Array.isArray(value) || value.length !== canonicalIds.length || value.length === 0 || value.length > 15 ||
    new Set(canonicalIds).size !== canonicalIds.length) {
    throw new HttpsError("failed-precondition", "The immutable race deck is unavailable.");
  }
  /** Provides snapshot behavior. */
  const snapshot = value.map((riddle: unknown, position) => {
    if (typeof riddle !== "object" || riddle === null) throw new HttpsError("data-loss", "Invalid race deck snapshot.");
    /** Provides record behavior. */
    const record = riddle as Record<string, unknown>;
    if (typeof record.riddleId !== "string" || typeof record.text !== "string" || typeof record.answer !== "string" ||
      record.canonicalRiddleId !== canonicalIds[position] || record.position !== position) {
      throw new HttpsError("data-loss", "Race deck snapshot does not match the challenge.");
    }
    return {
      riddleId: record.riddleId, canonicalRiddleId: canonicalIds[position],
      text: record.text, answer: record.answer, position,
      ...(["easy", "medium", "hard"].includes(String(record.difficultyBand)) ?
        {difficultyBand: record.difficultyBand as "easy" | "medium" | "hard"} : {}),
    };
  });
  if (new Set(snapshot.map(riddle => riddle.riddleId)).size !== snapshot.length) {
    throw new HttpsError("data-loss", "Race deck snapshot identities must be unique.");
  }
  if (expectedContentVersion !== undefined && raceDeckContentVersion(snapshot) !== expectedContentVersion) {
    throw new HttpsError("data-loss", "Race deck content does not match its immutable revision.");
  }
  return snapshot;
}

/** Canonicalizes owned rules independently of storage property insertion order. */
function recordingRules(rules: typeof RACE_RULES): unknown {
  return Object.keys(RACE_RULES).sort().map(key => [key, rules[key as keyof typeof RACE_RULES]]);
}

/** Projects only ordered scoring facts, excluding unknown event extension metadata. */
function recordingEvents(events: RaceRunRecord["events"]): unknown {
  return events.map(event => [event.sequence, event.type, event.riddlePosition, event.wallElapsedMs,
    event.penaltyAddedMs, event.totalPenaltyMs, event.adjustedElapsedMs, event.correctCount]);
}

/** Binds the resolved content and immutable recording facts while allowing equivalent legacy snapshot backfills. */
export function raceRecordingFingerprint(challenge: RaceChallengeRecord, riddles: RaceRiddleSnapshot[]): string {
  const source = [1, challenge.challengeId, challenge.creatorId, challenge.creatorRunId, challenge.categoryId,
    challenge.locale, challenge.deckId, challenge.canonicalRiddleIds, challenge.targetCorrect,
    challenge.evaluationPolicy ?? "preloaded", recordingRules(challenge.rules), raceDeckContentVersion(riddles),
    challenge.creatorWallFinishMs, challenge.creatorHintPenaltyMs, challenge.creatorSkipPenaltyMs,
    challenge.creatorTotalPenaltyMs, challenge.creatorAdjustedFinishMs, recordingEvents(challenge.ghostEvents)];
  return createHash("sha256").update(JSON.stringify(source)).digest("hex");
}

/** Checks source provenance and the prepared scoring snapshot; legacy runs compare every fact they actually retained. */
export function assertRacePreparedRecording(run: RaceRunRecord, challenge: RaceChallengeRecord, riddles: RaceRiddleSnapshot[]): void {
  if (run.challengeId !== challenge.challengeId || run.role !== "challenger" || run.categoryId !== challenge.categoryId ||
    run.locale !== challenge.locale || (run.evaluationPolicy ?? "preloaded") !== (challenge.evaluationPolicy ?? "preloaded") ||
    raceDeckContentVersion(run.riddles) !== raceDeckContentVersion(riddles) ||
    JSON.stringify(recordingRules(run.rulesSnapshot ?? RACE_RULES)) !== JSON.stringify(recordingRules(challenge.rules)) ||
    run.rulesVersion !== challenge.rules.version || run.opponent?.kind === "bot" || !run.opponent ||
    run.opponent.subjectUserId !== undefined && run.opponent.subjectUserId !== challenge.creatorId ||
    run.opponent.adjustedFinishMs !== challenge.creatorAdjustedFinishMs ||
    JSON.stringify(recordingEvents(run.opponent.events)) !== JSON.stringify(recordingEvents(challenge.ghostEvents)) ||
    run.recordingFingerprint !== undefined && run.recordingFingerprint !== raceRecordingFingerprint(challenge, riddles)) {
    throw new HttpsError("failed-precondition", "The race challenge changed during preparation.");
  }
}
