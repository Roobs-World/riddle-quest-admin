import {RaceEntryResponseSchema, AbandonRaceRunResponseSchema, ListRaceCategoriesResponseSchema, ListRaceInboxResponseSchema, PublishRaceChallengeResponseSchema, RaceChallengePreviewSchema, RaceOutcomeSchema, RaceRunResponseSchema, RequestRaceHintResponseSchema, SkipRaceRiddleResponseSchema, SubmitRaceGuessResponseSchema, type RaceRunView} from "@qwordly/core/race";
import {RacePlay} from "./RacePlay";
import type {RaceSessionState} from "./RaceSession.types";
import type {RaceOperation} from "./logic/raceOperations";
import type {RaceLocale} from "@qwordly/core/race";
import {applyRaceOutcome, createRaceAttempt, findFirstEditableRaceSlot} from "./logic/racePresentation";
import {splitGraphemes} from "@qwordly/core/game";

/** Recreates input only when the authority actually changes the displayed question. */
export const raceAttemptState = (run: RaceRunView): Pick<RaceSessionState, "currentLetters" | "activeSlotIndex" | "raceGuesses" | "feedback"> => ({
  currentLetters: createRaceAttempt(run.currentRiddle), activeSlotIndex: findFirstEditableRaceSlot(run.currentRiddle), raceGuesses: [], feedback: null,
});
/** Private input candidate whose question identity must be confirmed before restoration. */
export type RaceResumeDraft = Pick<RaceSessionState, "run" | "currentLetters" | "activeSlotIndex" | "raceGuesses">;
/** Validates the complete reveal set before any guess or paid-action checkpoint is consumed. */
const raceReveals = (prompt: RaceRunView["currentRiddle"]): Map<number, string> => {
  /** A terminal view has no editable answer or reveals to merge. */
  const revealed = new Map<number, string>();
  for (const {index, letter} of prompt?.revealedLetters ?? []) {
    if (!prompt || index >= prompt.answerLength || revealed.has(index)) throw new Error("Invalid hint slot");
    revealed.set(index, letter);
  }
  return revealed;
};
/** Checks immutable content and editable prompt coherence before any rollback checkpoint is consumed. */
const raceSnapshot = (run: RaceRunView, previous?: RaceRunView | null): RaceRunView => {
  if (previous?.startsAtMs !== undefined && run.startsAtMs !== undefined && previous.startsAtMs !== run.startsAtMs ||
    previous?.preparationExpiresAtMs !== undefined && run.preparationExpiresAtMs !== undefined && previous.preparationExpiresAtMs !== run.preparationExpiresAtMs) throw new Error("Changed race schedule");
  for (const [position, riddle] of (run.preloadedRiddles ?? []).entries()) {
    /** Answers and server-selected hints use the same grapheme segmentation as gameplay. */
    const answer = splitGraphemes(riddle.evaluation.answer, run.locale);
    if (riddle.position !== position || riddle.evaluation.locale !== run.locale || answer.length !== riddle.answerLength ||
      riddle.hint && (riddle.hint.index >= answer.length || riddle.hint.letter.normalize("NFC") !== answer[riddle.hint.index])) throw new Error("Invalid race deck");
    /** Optional first-hint metadata can be added or omitted by compatible server revisions. */
    const original = previous?.preloadedRiddles?.[position];
    if (original && (original.riddleId !== riddle.riddleId || original.text !== riddle.text ||
      original.answerLength !== riddle.answerLength || original.evaluation.answer !== riddle.evaluation.answer ||
      original.evaluation.locale !== riddle.evaluation.locale || original.hint && riddle.hint &&
        (original.hint.index !== riddle.hint.index || original.hint.letter !== riddle.hint.letter))) throw new Error("Changed race deck");
  }
  /** Answer-free responses can omit the deck while still referring to already-owned immutable content. */
  const prompt = run.currentRiddle, deck = run.preloadedRiddles ?? previous?.preloadedRiddles;
  /** Legacy prompts also pin known content when evaluation or a complete deck arrives later. */
  const originalPrompt = previous?.currentRiddle;
  /** A complete deck must preserve the previous question even after another tab advances. */
  const replacement = originalPrompt && (deck?.[originalPrompt.position] ?? (prompt?.position === originalPrompt.position ? prompt : null));
  if (originalPrompt && replacement && (originalPrompt.riddleId !== replacement.riddleId || originalPrompt.text !== replacement.text ||
    originalPrompt.answerLength !== replacement.answerLength || originalPrompt.evaluation && replacement.evaluation &&
      (originalPrompt.evaluation.answer !== replacement.evaluation.answer || originalPrompt.evaluation.locale !== replacement.evaluation.locale))) throw new Error("Changed race prompt");
  if (!prompt) return run;
  /** Position, rather than content ID alone, identifies an attempt even when content repeats. */
  const riddle = deck?.[prompt.position];
  if (riddle && (prompt.riddleId !== riddle.riddleId || prompt.text !== riddle.text || prompt.answerLength !== riddle.answerLength ||
    prompt.evaluation && (prompt.evaluation.answer !== riddle.evaluation.answer || prompt.evaluation.locale !== riddle.evaluation.locale))) throw new Error("Wrong race deck prompt");
  /** A legacy current-answer payload must be internally coherent even without a complete deck. */
  const evaluation = prompt.evaluation ?? riddle?.evaluation;
  if (evaluation) {
    /** Reveals must fix actual answer slots instead of silently changing local scoring. */
    const answer = splitGraphemes(evaluation.answer, run.locale);
    if (evaluation.locale !== run.locale || answer.length !== prompt.answerLength ||
      [...raceReveals(prompt)].some(([index, letter]) => letter.normalize("NFC") !== answer[index])) throw new Error("Invalid race answer");
  }
  return run;
};
/** Internal response application; only RaceSession crosses this implementation seam. */
export function applyRaceAuthority(state: RaceSessionState, operation: RaceOperation, data: unknown, play: RacePlay, now: number, locale: RaceLocale, resumeDraft?: RaceResumeDraft | null, ownedSnapshot?: RaceRunView | null): Partial<RaceSessionState> {
  /** Rejects validly shaped payloads for a different owned attempt before checkpoint consumption. */
  const owned = (run: RaceRunView): RaceRunView => {
    if (!state.run || run.runId !== state.run.runId || run.locale !== locale ||
      run.role !== state.run.role || run.categoryId !== state.run.categoryId ||
      run.challengeId !== state.run.challengeId || run.rivalryChallengeId !== state.run.rivalryChallengeId) throw new Error("Wrong race run");
    return raceSnapshot(run, ownedSnapshot ?? state.run);
  };
  switch (operation) {
    case "raceCategories": return {categories: ListRaceCategoriesResponseSchema.parse(data).categories};
    case "raceInbox": return {inboxItems: ListRaceInboxResponseSchema.parse(data).items};
    case "raceChallenge": {
      /** Validated preview tied to the requested entry. */
      const challenge = RaceChallengePreviewSchema.parse(data);
      if (challenge.locale !== locale) throw new Error("Wrong challenge locale");
      if (state.activeChallengeId && challenge.challengeId !== state.activeChallengeId) throw new Error("Wrong challenge");
      return {challenge, activeChallengeId: challenge.challengeId};
    }
    case "raceEntry": case "raceInviteCancel": {
      /** Only typed readiness determines waiting, terminal state and polling. */
      let entryStatus = RaceEntryResponseSchema.parse(data);
      if (entryStatus.status === "ready" && entryStatus.challenge.locale !== locale) throw new Error("Wrong entry locale");
      if (entryStatus.status === "ready" && entryStatus.challenge.challengeId !== state.activeChallengeId) throw new Error("Wrong entry challenge");
      // A delayed pre-expiry read cannot revive this invitation lifetime.
      if (operation === "raceEntry" && state.entryStatus?.status === "expired" && ["waiting", "ready"].includes(entryStatus.status)) entryStatus = state.entryStatus;
      return {entryStatus, challenge: entryStatus.status === "ready" ? entryStatus.challenge : null};
    }
    case "raceStart": case "raceResume": case "raceReady": {
      /** Prepared, scheduled, active or terminal authority snapshot. */
      const run = raceSnapshot(RaceRunResponseSchema.parse(data).run);
      if (run.locale !== locale) throw new Error("Wrong race locale");
      /** Every editable authority snapshot must have a coherent reveal set before recovery can consume input. */
      const revealed = raceReveals(run.currentRiddle);
      if (operation === "raceReady" || operation === "raceResume" && state.run) owned(run);
      if (operation === "raceStart" && state.activeChallengeId &&
        (run.challengeId !== state.activeChallengeId || run.role !== "challenger" || !run.opponent ||
          state.challenge && (run.opponent.adjustedFinishMs !== state.challenge.adjustedTimeToBeatMs ||
            run.opponent.displayName !== state.challenge.creator.displayName))) throw new Error("Wrong challenge run");
      /** Recovery preserves known input only for the same authority-owned question. */
      let attempt = raceAttemptState(run);
      /** Provisional input supplies letters only after the server confirms its exact question. */
      const matchesDraft = (draft: RaceResumeDraft): boolean => Boolean(run.status === "active" && run.currentRiddle &&
        draft.run?.runId === run.runId && run.currentRiddle.riddleId === draft.run.currentRiddle?.riddleId &&
        run.currentRiddle.position === draft.run.currentRiddle.position && run.currentRiddle.answerLength === draft.currentLetters.length);
      /** Prefer confirmed successor input; otherwise preserve the current authority-owned draft. */
      const draft = resumeDraft && matchesDraft(resumeDraft) ? resumeDraft : state;
      if (operation === "raceResume" && run.currentRiddle && matchesDraft(draft)) {
        owned(run);
        /** Newly confirmed hints replace only their own draft positions. */
        const currentLetters = [...draft.currentLetters];
        for (const [index, letter] of revealed) currentLetters[index] = letter;
        attempt = {...attempt, currentLetters, raceGuesses: draft.raceGuesses,
          activeSlotIndex: revealed.has(draft.activeSlotIndex)
            ? findFirstEditableRaceSlot(run.currentRiddle) : draft.activeSlotIndex};
      }
      return {run, receivedAtMs: now, adjustedNow: run.adjustedElapsedMs, ...attempt};
    }
    case "raceAbandon": {
      /** Abandonment must never manufacture a scored result. */
      const response = AbandonRaceRunResponseSchema.parse(data);
      owned(response.run);
      if (response.run.status !== "abandoned" || response.result !== null) throw new Error("Invalid abandonment");
      return {run: response.run, receivedAtMs: now, closeAfterStart: false, quitConfirmationOpen: false};
    }
    case "raceGuess": {
      /** Confirmation preserves any draft already typed into the projected successor. */
      const result = SubmitRaceGuessResponseSchema.parse(data);
      owned(result.run);
      /** Invalid hint metadata must leave the original submission recoverable. */
      const revealed = raceReveals(result.run.currentRiddle);
      /** RacePlay retains the original submission even when successor input changes. */
      const confirmation = play.confirmGuess(result, state.run, state.raceGuesses, state.currentLetters);
      /** Authority may include hints applied while this confirmation was in flight. */
      const currentLetters = [...state.currentLetters];
      for (const [index, letter] of revealed) currentLetters[index] = letter;
      play.setAwaitingOutcome(result.run.status !== "active");
      return {run: result.run, receivedAtMs: now,
        ...(confirmation.resetAttempt ? raceAttemptState(result.run) : {currentLetters,
          activeSlotIndex: revealed.has(state.activeSlotIndex) ? findFirstEditableRaceSlot(result.run.currentRiddle) : state.activeSlotIndex}),
        ...(confirmation.guesses ? {raceGuesses: confirmation.guesses} : {}),
        feedback: result.isCorrect ? "correct" : "incorrect",
        ...(result.autoSkipped ? {penaltyFlash: "RaceTo10.SKIP_PENALTY"} : {}),
      };
    }
    case "raceHint": {
      /** Paid confirmation must match both run ownership and the pending checkpoint. */
      const result = RequestRaceHintResponseSchema.parse(data);
      owned(result.run);
      /** A hint confirms the same question even when its authority view contains additional hints. */
      const prompt = result.run.currentRiddle;
      if (!prompt) {
        /** Terminal hints still belong to the original paid question and recorded penalty event. */
        const original = state.run?.currentRiddle;
        /** The final event proves that this hint caused the competitive deadline transition. */
        const event = result.run.events.at(-1);
        /** Only server-recorded competitive completion or timeout can omit the active question. */
        const ended = event && result.run.role === "challenger" && (
          result.run.status === "timed_out" && event.adjustedElapsedMs >= result.run.rules.maxAdjustedTimeMs ||
          result.run.status === "completed" && result.run.opponent && result.run.correctCount < result.run.rules.targetCorrect &&
            event.adjustedElapsedMs > result.run.opponent.adjustedFinishMs);
        if (!original || result.index >= original.answerLength || event?.type !== "hint" ||
          event.riddlePosition !== original.position || event.penaltyAddedMs !== result.run.rules.hintPenaltyMs ||
          event.correctCount !== result.run.correctCount || !ended) throw new Error("Invalid terminal hint confirmation");
        play.confirmPaid("raceHint", result.run);
        return {run: result.run, receivedAtMs: now, adjustedNow: result.run.adjustedElapsedMs,
          ...raceAttemptState(result.run), penaltyFlash: "RaceTo10.HINT_PENALTY"};
      }
      if (result.run.status !== "active" || prompt.riddleId !== state.run?.currentRiddle?.riddleId ||
        prompt.position !== state.run.currentRiddle.position || prompt.answerLength !== state.currentLetters.length) throw new Error("Wrong hint question");
      /** Every reveal must occupy a unique answer slot before the rollback checkpoint is consumed. */
      const revealed = raceReveals(prompt);
      if (revealed.get(result.index) !== result.revealedLetter) throw new Error("Inconsistent hint confirmation");
      play.confirmPaid("raceHint", result.run);
      /** Merge the complete authoritative reveal set and preserve all unrevealed draft letters. */
      const currentLetters = [...state.currentLetters];
      for (const [index, letter] of revealed) currentLetters[index] = letter;
      return {run: result.run, receivedAtMs: now, currentLetters,
        activeSlotIndex: revealed.has(state.activeSlotIndex) ? findFirstEditableRaceSlot(prompt) : state.activeSlotIndex,
        penaltyFlash: "RaceTo10.HINT_PENALTY"};
    }
    case "raceSkip": {
      /** A confirmed skip replaces the entire attempt. */
      const result = SkipRaceRiddleResponseSchema.parse(data);
      owned(result.run);
      raceReveals(result.run.currentRiddle);
      play.confirmPaid("raceSkip", result.run);
      return {run: result.run, receivedAtMs: now, ...raceAttemptState(result.run), penaltyFlash: "RaceTo10.SKIP_PENALTY"};
    }
    case "raceOutcome": {
      /** Wrong-run results cannot restore an earlier attempt or trigger provider effects. */
      const outcome = RaceOutcomeSchema.parse(data);
      if (!state.run || outcome.runId !== state.run.runId || outcome.challengeId !== state.run.challengeId) throw new Error("Wrong outcome run");
      if (outcome.totalPenaltyMs !== outcome.hintPenaltyMs + outcome.skipPenaltyMs ||
        outcome.adjustedFinishMs !== outcome.wallFinishMs + outcome.totalPenaltyMs ||
        (state.run.role === "creator" ? !["recorded", "timed_out"].includes(outcome.result) : outcome.result === "recorded") ||
        ["recorded", "player_win", "tie"].includes(outcome.result) && outcome.correctCount !== state.run.rules.targetCorrect ||
        outcome.publishable && (outcome.result !== "recorded" || outcome.correctCount !== state.run.rules.targetCorrect) ||
        outcome.rematchEligible && ["recorded", "timed_out"].includes(outcome.result)) throw new Error("Invalid race outcome");
      return {outcome, run: applyRaceOutcome(state.run, outcome), stage: "result", receivedAtMs: now};
    }
    case "racePublish": {
      /** Only the current completed creator run may become a publication. */
      const published = PublishRaceChallengeResponseSchema.parse(data);
      if (!state.run || state.run.status !== "completed" || state.run.role !== "creator" ||
        published.challengeId !== published.preview.challengeId || published.preview.locale !== state.run.locale ||
        published.preview.categoryId !== state.run.categoryId || published.preview.adjustedTimeToBeatMs !== state.outcome?.adjustedFinishMs) throw new Error("Invalid publication");
      return {published, publishRequested: false};
    }
    case "raceBlock": case "raceReport": {
      /** Safety confirmations must carry their expected boolean acknowledgment. */
      const field = operation === "raceBlock" ? "blocked" : "queued";
      if (!state.safetyTargetUserId || typeof data !== "object" || data === null || Reflect.get(data, field) !== true) throw new Error("Invalid safety response");
      return {safetyTargetUserId: null, safetyNotice: operation === "raceBlock" ? "RaceTo10.BLOCK_SUCCESS" : "RaceTo10.REPORT_SUCCESS",
        ...(operation === "raceBlock" ? {inboxItems: state.inboxItems.filter(item => item.opponentUserId !== state.safetyTargetUserId)} : {})};
    }
  }
}
