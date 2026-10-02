import {RaceEntryResponseSchema, AbandonRaceRunResponseSchema, ListRaceCategoriesResponseSchema, ListRaceInboxResponseSchema, PublishRaceChallengeResponseSchema, RaceChallengePreviewSchema, RaceOutcomeSchema, RaceRunResponseSchema, RaceRunViewSchema, RequestRaceHintResponseSchema, SkipRaceRiddleResponseSchema, SubmitRaceGuessResponseSchema, type RaceRunView, type RaceOutcome, type RaceMatchFailure} from "@qwordly/core/race";
import {assertExistingRaceRun} from "./logic/raceEntrySelection";
import {RacePlay} from "./RacePlay";
import type {RaceSessionState} from "./RaceSession.types";
import {raceOperationRequiresRefresh, type RaceOperation} from "./logic/raceOperations";
import type {RaceLocale} from "@qwordly/core/race";
import {applyRaceOutcome, createRaceAttempt, findFirstEditableRaceSlot, projectRaceOutcome} from "./logic/racePresentation";
import {splitGraphemes} from "@qwordly/core/game";

/** Authority diagnostics never become untranslated player-facing copy. */
export const raceErrorKey = (error: string | null): string | null => error === null ? null
  : ["RaceTo10.ERROR_GENERIC", "RaceTo10.ERROR_INVALID_RESPONSE", "RaceTo10.ERROR_LOCALE_MISMATCH", "RaceTo10.RESULTS_EMPTY"].includes(error)
    ? error : "RaceTo10.ERROR_GENERIC";

/** Local rollback keeps the authority barrier until a later validated run replaces it. */
export const raceRejectedState = (error: string, operation: RaceOperation, requiresRunRefresh: boolean, allowTypingWhilePending: boolean):
  Pick<RaceSessionState, "error" | "requiresRunRefresh" | "allowTypingWhilePending"> => ({
    error: raceErrorKey(error), requiresRunRefresh: requiresRunRefresh || raceOperationRequiresRefresh(operation), allowTypingWhilePending,
  });

/** Converts validated matchmaking recovery reasons into the existing translated diagnostics. */
export const raceMatchErrorKey = (failure: RaceMatchFailure): string =>
  failure.reason === "invalid-response" ? "RaceTo10.ERROR_INVALID_RESPONSE" :
    failure.reason === "temporarily-unavailable" || failure.reason === "projection-unavailable" ? "RaceTo10.MATCH_TEMPORARY" :
    failure.reason === "search-budget-exceeded" || failure.reason === "eligibility-changed" ? "RaceTo10.MATCH_TRY_NEW" :
    failure.reason === "intent-expired" ? "RaceTo10.MATCH_EXPIRED" :
    failure.reason === "intent-consumed" ? "RaceTo10.MATCH_CONSUMED" : "RaceTo10.MATCH_UNAVAILABLE";

/** Privately owns confirmed nested facts and retains immutable optional content omitted by compatible legacy views. */
export const isolateConfirmedRace = (run: RaceRunView, owned: RaceRunView | null): RaceRunView => {
  /** Retention is restricted to the same authority-owned run. */
  const previous = owned?.runId === run.runId ? owned : null;
  return structuredClone({...run,
    preloadedRiddles: run.preloadedRiddles?.map((riddle, position) => ({...riddle,
      hint: riddle.hint ?? previous?.preloadedRiddles?.[position].hint})) ?? previous?.preloadedRiddles,
    currentRiddle: run.currentRiddle && {...run.currentRiddle,
      evaluation: run.currentRiddle.evaluation ?? (run.currentRiddle.position === previous?.currentRiddle?.position ? previous.currentRiddle.evaluation : undefined)},
    startsAtMs: run.startsAtMs ?? previous?.startsAtMs,
    preparationExpiresAtMs: run.preparationExpiresAtMs ?? previous?.preparationExpiresAtMs});
};
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
  // A creator records its own target; only challengers can race a recorded opponent.
  if (run.role === "creator" && run.opponent) throw new Error("Unexpected creator opponent");
  // A compatible response can omit a known start, but cannot evade its clock relationship.
  if (run.startsAtMs === undefined && previous?.startsAtMs !== undefined)
    RaceRunViewSchema.parse({...run, startsAtMs: previous.startsAtMs});
  if (run.adjustedElapsedMs !== run.wallElapsedMs + run.totalPenaltyMs) throw new Error("Invalid race clock");
  /** Only live preparation, scheduling and gameplay expose an editable question. */
  const phases = ["prepared", "scheduled", "active"];
  if (phases.includes(run.status) !== Boolean(run.currentRiddle)) throw new Error("Invalid race phase prompt");
  if (previous) {
    /** Compatible rule versions can start new runs but cannot rewrite an owned attempt. */
    if (Object.entries(previous.rules).some(([field, value]) => Reflect.get(run.rules, field) !== value))
      throw new Error("Changed race rules");
    /** Confirmed scoring and charge events are immutable; concurrent actions may only append. */
    if (run.events.length < previous.events.length || previous.events.some((event, index) =>
      Object.entries(event).some(([field, value]) => Reflect.get(run.events[index], field) !== value)))
      throw new Error("Changed race event history");
    /** Confirmed authority phases advance independently of provisional rendering. */
    const before = phases.indexOf(previous.status), after = phases.indexOf(run.status);
    if (after >= 0 && (before < 0 || after < before) || before < 0 && run.status !== previous.status ||
      run.correctCount < previous.correctCount || run.totalPenaltyMs < previous.totalPenaltyMs) throw new Error("Regressed race progress");
    if (before < 0 && (run.correctCount !== previous.correctCount || run.totalPenaltyMs !== previous.totalPenaltyMs ||
      run.wallElapsedMs !== previous.wallElapsedMs || run.adjustedElapsedMs !== previous.adjustedElapsedMs)) throw new Error("Changed final race facts");
    if (previous.opponent && (!run.opponent || run.opponent.adjustedFinishMs !== previous.opponent.adjustedFinishMs ||
      run.opponent.events.length !== previous.opponent.events.length || previous.opponent.events.some((event, index) => {
        /** Identity may anonymize after deletion, but the recorded rival's timing is immutable. */
        const next = run.opponent!.events[index];
        return Object.entries(event).some(([field, value]) => Reflect.get(next, field) !== value);
      }))) throw new Error("Changed race opponent recording");
    if (run.currentRiddle && previous.currentRiddle) {
      if (run.currentRiddle.position < previous.currentRiddle.position) throw new Error("Regressed race question");
      if (run.currentRiddle.position === previous.currentRiddle.position) {
        /** Already-confirmed attempts and hints cannot disappear from a later owned read. */
        const revealed = raceReveals(run.currentRiddle);
        if (run.currentRiddle.guessesUsed < previous.currentRiddle.guessesUsed ||
          previous.currentRiddle.revealedLetters.some(({index, letter}) => revealed.get(index)?.normalize("NFC") !== letter.normalize("NFC"))) throw new Error("Regressed race attempt");
      }
    }
  }
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
  /** Omitted answers still constrain reveals when this exact question was privately confirmed. */
  const evaluation = prompt.evaluation ?? riddle?.evaluation ??
    (prompt.position === originalPrompt?.position ? originalPrompt.evaluation : undefined);
  if (evaluation) {
    /** Reveals must fix actual answer slots instead of silently changing local scoring. */
    const answer = splitGraphemes(evaluation.answer, run.locale);
    if (evaluation.locale !== run.locale || answer.length !== prompt.answerLength ||
      [...raceReveals(prompt)].some(([index, letter]) => letter.normalize("NFC") !== answer[index])) throw new Error("Invalid race answer");
  }
  return run;
};
/** Binds run-scoped command identity to confirmed authority rather than retained rendering references. */
export const bindRaceCommand = (payload: Record<string, unknown>, owned: RaceRunView | null): Record<string, unknown> => {
  if (!owned || typeof payload.runId !== "string") return payload;
  return {...payload, runId: owned.runId,
    ...(typeof payload.riddleId === "string" && owned.currentRiddle ? {riddleId: owned.currentRiddle.riddleId} : {})};
};
/** Internal response application; only RaceSession crosses this implementation seam. */
export function applyRaceAuthority(state: RaceSessionState, operation: RaceOperation, data: unknown, play: RacePlay, now: number, locale: RaceLocale, resumeDraft?: RaceResumeDraft | null, ownedSnapshot?: RaceRunView | null, confirmedOutcome?: RaceOutcome | null, current: () => boolean = () => true): Partial<RaceSessionState> {
  /** Rejects validly shaped payloads for a different owned attempt before checkpoint consumption. */
  const owned = (run: RaceRunView): RaceRunView => {
    if (!current()) throw new Error("Retired race receipt");
    /** Run selection remains private even when consumers edit the displayed snapshot. */
    const previous = ownedSnapshot ?? state.run;
    if (!previous || run.runId !== previous.runId || run.locale !== locale ||
      run.role !== previous.role || run.categoryId !== previous.categoryId ||
      run.challengeId !== previous.challengeId || run.rivalryChallengeId !== previous.rivalryChallengeId) throw new Error("Wrong race run");
    return raceSnapshot(run, previous);
  };
  /** Paid confirmations must include the original action's charge before consuming its checkpoint. */
  const paid = (run: RaceRunView, type: "hint" | "skip"): void => {
    /** Private authority history excludes the immediately rendered local projection. */
    const original = ownedSnapshot ?? state.run;
    if (!original?.currentRiddle) throw new Error("Missing paid question");
    /** The action's rule fixes the minimum new charge independently of concurrent later actions. */
    const penalty = type === "hint" ? original.rules.hintPenaltyMs : original.rules.skipPenaltyMs;
    if (run.totalPenaltyMs < original.totalPenaltyMs + penalty ||
      !run.events.slice(original.events.length).some(event => event.type === type &&
        event.riddlePosition === original.currentRiddle!.position && event.penaltyAddedMs === penalty &&
        (type !== "skip" || event.correctCount > original.correctCount))) throw new Error("Missing paid confirmation charge");
    if (type === "skip" && run.correctCount <= original.correctCount) throw new Error("Unacknowledged skip score");
    if (type === "skip" && run.status === "active" &&
      (!run.currentRiddle || run.currentRiddle.position <= original.currentRiddle.position)) throw new Error("Unacknowledged skip transition");
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
      if (operation === "raceInviteCancel" && entryStatus.status !== "cancelled") throw new Error("Cancellation was not confirmed");
      if (entryStatus.status === "ready" && entryStatus.challenge.locale !== locale) throw new Error("Wrong entry locale");
      if (entryStatus.status === "ready" && entryStatus.challenge.challengeId !== state.activeChallengeId) throw new Error("Wrong entry challenge");
      // A delayed read cannot revive an expired or cancelled invitation lifetime.
      if (operation === "raceEntry" && state.entryStatus && (state.entryStatus.status === "cancelled" ||
        state.entryStatus.status === "expired" && ["waiting", "ready"].includes(entryStatus.status))) entryStatus = state.entryStatus;
      return {entryStatus, activeChallengeId: state.activeChallengeId, challenge: entryStatus.status === "ready" ? entryStatus.challenge : null};
    }
    case "raceStart": case "raceResume": case "raceReady": {
      /** Prepared, scheduled, active or terminal authority snapshot. */
      const run = raceSnapshot(RaceRunResponseSchema.parse(data).run);
      // Readiness must schedule or recover this run; a preparation echo cannot acknowledge it.
      if (operation === "raceReady" && run.status === "prepared") throw new Error("Unacknowledged race readiness");
      if (run.locale !== locale) throw new Error("Wrong race locale");
      /** Every editable authority snapshot must have a coherent reveal set before recovery can consume input. */
      const revealed = raceReveals(run.currentRiddle);
      if (operation === "raceReady" || operation === "raceResume" && state.run) owned(run);
      if (operation === "raceResume") assertExistingRaceRun(state, run);
      if (operation === "raceStart" && state.activeChallengeId &&
        (run.challengeId !== state.activeChallengeId || run.role !== "challenger" || !run.opponent ||
          state.challenge && (run.categoryId !== state.challenge.categoryId || run.opponent.adjustedFinishMs !== state.challenge.adjustedTimeToBeatMs ||
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
      return {run, entryStatus: null, challenge: null, activeChallengeId: run.challengeId,
        receivedAtMs: now, adjustedNow: run.adjustedElapsedMs, ...attempt};
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
      if (result.isCorrect && result.autoSkipped) throw new Error("Contradictory guess progression");
      if (result.autoSkipped) paid(result.run, "skip");
      if (result.isCorrect) {
        /** A successful submission must retain its original question's scoring event. */
        const original = ownedSnapshot ?? state.run;
        if (!original?.currentRiddle || result.run.correctCount <= original.correctCount ||
          !result.run.events.slice(original.events.length).some(event => event.type === "correct" &&
            event.riddlePosition === original.currentRiddle!.position && event.correctCount > original.correctCount) ||
          result.run.status === "active" && result.run.currentRiddle!.position <= original.currentRiddle.position)
          throw new Error("Missing correct guess progression");
      }
      /** An accepted wrong guess on the same live question consumes at least one attempt. */
      const original = ownedSnapshot ?? state.run;
      if (!result.isCorrect && !result.autoSkipped && result.run.status === "active" &&
        original?.currentRiddle && result.run.currentRiddle?.position === original.currentRiddle.position &&
        result.run.currentRiddle.guessesUsed <= original.currentRiddle.guessesUsed)
        throw new Error("Missing incorrect guess attempt");
      /** Invalid hint metadata must leave the original submission recoverable. */
      const revealed = raceReveals(result.run.currentRiddle);
      /** RacePlay retains the original submission even when successor input changes. */
      const confirmation = play.confirmGuess(result, state.run, state.raceGuesses, state.currentLetters, ownedSnapshot);
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
      paid(result.run, "hint");
      /** A hint confirms the same question even when its authority view contains additional hints. */
      const prompt = result.run.currentRiddle;
      /** Question identity comes from confirmed ownership, independently of paid rendering. */
      const original = ownedSnapshot ?? state.run;
      /** A newly charged hint must reveal a previously unknown slot of its privately confirmed question. */
      const question = original?.currentRiddle;
      if (!question || result.index >= question.answerLength || raceReveals(question).has(result.index))
        throw new Error("Unchanged hint reveal");
      /** Terminal responses omit the prompt, so validate metadata against any already-known answer. */
      const evaluation = question.evaluation ?? original?.preloadedRiddles?.[question.position]?.evaluation;
      if (evaluation && splitGraphemes(evaluation.answer, locale)[result.index] !== result.revealedLetter.normalize("NFC"))
        throw new Error("Wrong hint answer");
      if (!prompt) {
        /** Terminal hints still belong to the original paid question and recorded penalty event. */
        /** The final event proves that this hint caused the competitive deadline transition. */
        const event = result.run.events.at(-1);
        /** Only server-recorded competitive completion or timeout can omit the active question. */
        const ended = event && result.run.role === "challenger" && (
          result.run.status === "timed_out" && event.adjustedElapsedMs >= result.run.rules.maxAdjustedTimeMs ||
          result.run.status === "completed" && result.run.opponent && result.run.correctCount < result.run.rules.targetCorrect &&
            event.adjustedElapsedMs > result.run.opponent.adjustedFinishMs);
        if (!question || result.index >= question.answerLength || event?.type !== "hint" ||
          event.riddlePosition !== question.position || event.penaltyAddedMs !== result.run.rules.hintPenaltyMs ||
          event.correctCount !== result.run.correctCount || !ended) throw new Error("Invalid terminal hint confirmation");
        play.confirmPaid("raceHint", result.run);
        return {run: result.run, receivedAtMs: now, adjustedNow: result.run.adjustedElapsedMs,
          ...raceAttemptState(result.run), penaltyFlash: "RaceTo10.HINT_PENALTY"};
      }
      if (result.run.status !== "active" || prompt.riddleId !== original?.currentRiddle?.riddleId ||
        prompt.position !== original.currentRiddle.position || prompt.answerLength !== original.currentRiddle.answerLength) throw new Error("Wrong hint question");
      /** Every reveal must occupy a unique answer slot before the rollback checkpoint is consumed. */
      const revealed = raceReveals(prompt);
      if (revealed.get(result.index) !== result.revealedLetter) throw new Error("Inconsistent hint confirmation");
      /** The paid checkpoint owns every unrevealed letter and accepted historical row. */
      const draft = play.confirmPaid("raceHint", result.run);
      /** Merge the complete authoritative reveal set and preserve all unrevealed draft letters. */
      const currentLetters = [...(draft?.letters ?? state.currentLetters)];
      /** Selection was fixed before paid delivery locked editing. */
      const activeSlotIndex = draft?.activeSlotIndex ?? state.activeSlotIndex;
      for (const [index, letter] of revealed) currentLetters[index] = letter;
      return {run: result.run, receivedAtMs: now, currentLetters,
        activeSlotIndex: revealed.has(activeSlotIndex) ? findFirstEditableRaceSlot(prompt) : activeSlotIndex,
        ...(draft ? {raceGuesses: draft.guesses} : {}),
        penaltyFlash: "RaceTo10.HINT_PENALTY"};
    }
    case "raceSkip": {
      /** A confirmed skip replaces the entire attempt. */
      const result = SkipRaceRiddleResponseSchema.parse(data);
      owned(result.run);
      paid(result.run, "skip");
      raceReveals(result.run.currentRiddle);
      play.confirmPaid("raceSkip", result.run);
      return {run: result.run, receivedAtMs: now, ...raceAttemptState(result.run), penaltyFlash: "RaceTo10.SKIP_PENALTY"};
    }
    case "raceOutcome": {
      /** Wrong-run results cannot restore an earlier attempt or trigger provider effects. */
      const outcome = RaceOutcomeSchema.parse(data);
      /** A projected deadline may be superseded by another tab; confirmed terminal facts cannot be. */
      const confirmed = ownedSnapshot ?? state.run;
      if (!confirmed || outcome.runId !== confirmed.runId || outcome.challengeId !== confirmed.challengeId) throw new Error("Wrong outcome run");
      /** Repeated outcome reads may change reward presentation without changing the settled race. */
      const expected = confirmedOutcome ?? (["completed", "timed_out"].includes(confirmed.status)
        ? projectRaceOutcome(confirmed, confirmed.adjustedElapsedMs) : null);
      /** Minimum paid progress is known even when another tab completed unseen actions. */
      const hintPenaltyMs = confirmed.events.filter(event => event.type === "hint").reduce((total, event) => total + event.penaltyAddedMs, 0);
      /** Confirmed skips cannot disappear or be reassigned to hint charges. */
      const skipPenaltyMs = confirmed.events.filter(event => event.type === "skip").reduce((total, event) => total + event.penaltyAddedMs, 0);
      /** The immutable ghost and final adjusted clock determine every competitive winner. */
      const opponentFinishMs = confirmed.opponent?.adjustedFinishMs;
      /** Incomplete players lose to the ghost; a full score uses the exact recorded times. */
      const competitiveResult = outcome.correctCount < confirmed.rules.targetCorrect || opponentFinishMs !== undefined && outcome.adjustedFinishMs > opponentFinishMs
        ? "ghost_win" : outcome.adjustedFinishMs === opponentFinishMs ? "tie" : "player_win";
      if (outcome.totalPenaltyMs !== outcome.hintPenaltyMs + outcome.skipPenaltyMs ||
        outcome.adjustedFinishMs !== outcome.wallFinishMs + outcome.totalPenaltyMs ||
        outcome.opponentAdjustedFinishMs !== opponentFinishMs || outcome.correctCount < confirmed.correctCount ||
        outcome.totalPenaltyMs < confirmed.totalPenaltyMs || outcome.hintPenaltyMs < hintPenaltyMs || outcome.skipPenaltyMs < skipPenaltyMs ||
        ["player_win", "ghost_win", "tie"].includes(outcome.result) && (opponentFinishMs === undefined || outcome.result !== competitiveResult) ||
        outcome.result === "ghost_win" && outcome.correctCount < confirmed.rules.targetCorrect &&
          (outcome.adjustedFinishMs !== Math.max(opponentFinishMs!, outcome.totalPenaltyMs) ||
            opponentFinishMs! >= confirmed.rules.maxAdjustedTimeMs || outcome.totalPenaltyMs >= confirmed.rules.maxAdjustedTimeMs) ||
        outcome.result === "timed_out" && outcome.correctCount === confirmed.rules.targetCorrect ||
        expected && ["result", "correctCount", "wallFinishMs", "hintPenaltyMs", "skipPenaltyMs", "totalPenaltyMs", "adjustedFinishMs", "opponentAdjustedFinishMs"]
          .some(field => Reflect.get(outcome, field) !== Reflect.get(expected, field)) ||
        (confirmed.role === "creator" ? !["recorded", "timed_out"].includes(outcome.result) : outcome.result === "recorded") ||
        ["recorded", "player_win", "tie"].includes(outcome.result) && outcome.correctCount !== confirmed.rules.targetCorrect ||
        outcome.publishable && (outcome.result !== "recorded" || outcome.correctCount !== confirmed.rules.targetCorrect) ||
        outcome.rematchEligible && ["recorded", "timed_out"].includes(outcome.result)) throw new Error("Invalid race outcome");
      return {outcome, run: applyRaceOutcome(confirmed, outcome), stage: "result", receivedAtMs: now};
    }
    case "racePublish": {
      /** Only the current completed creator run may become a publication. */
      const published = PublishRaceChallengeResponseSchema.parse(data);
      /** Publication belongs to the private completed recording and its settled outcome. */
      const confirmed = ownedSnapshot ?? state.run;
      if (!confirmed || confirmed.status !== "completed" || confirmed.role !== "creator" ||
        published.challengeId !== published.preview.challengeId || published.preview.locale !== confirmed.locale ||
        published.preview.categoryId !== confirmed.categoryId || published.preview.adjustedTimeToBeatMs !== (confirmedOutcome ?? state.outcome)?.adjustedFinishMs) throw new Error("Invalid publication");
      return {published, publishRequested: false, run: structuredClone(confirmed),
        outcome: structuredClone(confirmedOutcome ?? state.outcome)};
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
