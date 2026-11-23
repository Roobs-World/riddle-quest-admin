import {createRaceClock} from "./raceClock";
import type {GameToHostMessage} from "../../platform/bridge/messages";
import {computeFeedback} from "../../gameplay/rules/computeFeedback";
import {lowerCaseGraphemes} from "../../gameplay/input/graphemes";
import {type ScoredGuess} from "../../gameplay/contracts/scoring";
import type {RaceRunView, SubmitRaceGuessResponse} from "../contracts/index";
import {createRequestId} from "../../gameplay/session/requestIds";
import {raceOperationRequiresRefresh, raceOperationRequiresReceipt, type RaceOperation} from "../rounds/raceOperations";
import {
  createRaceAttempt,
  findFirstEditableRaceSlot,
  getAdjustedRaceTime,
  projectInstantCorrectGuess,
  projectInstantRaceHint,
  projectInstantRaceSkip,
  projectRaceOutcome,
} from "../presentation/racePresentation";
/** Clock seam used by browser execution and deterministic transition tests. */
export type RacePlayClock = {
  /** Current local receipt time. */ now: () => number;
  /** Schedules a loader transition. */ schedule: (callback: () => void, delay: number) => number;
  /** Cancels a stale loader transition. */ cancel: (timer: number) => void;
};
/** Immutable observable operation state. */
type RaceDeliveryState = Readonly<{
  /** Stores pending. */
  pending: RaceOperation | null;
  /** Stores race guess loading. */
  raceGuessLoading: boolean;
}>;
/** One complete local mutation checkpoint. */
type GuessProjection = {
  /** Stores run. */
  run: RaceRunView;
  /** Stores history. */
  history: ScoredGuess[];
  /** Stores submitted. */
  submitted: string[];
  /** Evaluation-backed rendering permits draft edits while confirmation is pending. */
  canEditDraft: boolean;
  /** Stores projected riddle id. */
  projectedRiddleId: string | null;
  /** Original authority receipt time retained during rollback. */
  receivedAt: number;
};
/** Paid-action rollback preserves the entire answer draft and question history. */
type PaidDraft = {
  /** Original unrevealed and hinted answer letters. */ letters: string[];
  /** Previous guesses for the original question. */ guesses: ScoredGuess[];
  /** Selected answer slot before the projected action. */ activeSlotIndex: number;
};
/** Owns Race Projection, receipt correlation, rollback and terminal-result eligibility. */
export class RacePlay {
  /** Observable snapshot remains stable until a transition occurs. */
  private state: RaceDeliveryState = {pending: null, raceGuessLoading: false};
  /** Subscribers never receive mutable protocol state. */
  private readonly listeners = new Set<() => void>();
  /** Request and operation must both match before a response is consumed. */
  private expected: {
    /** Stores id. */
    id: string;
    /** Stores operation. */
    operation: RaceOperation;
  } | null = null;
  /** Loader transition retained for cancellation. */ private timer: number | undefined;
  /** Queued loader tails belong to one submitted attempt, independent of timer cancellation. */ private loaderGeneration = 0;
  /** Delivery expiry belongs to the same receipt as its pending operation. */ private responseTimer: number | undefined;
  /** Session recovery receives expiry or a throwing adapter as a correlated transport failure. */
  private readonly onDeliveryFailure?: (requestId: string, operation: RaceOperation) => void;
  /** Lost gameplay confirmation remains private until canonical run recovery. */
  private refreshRequired = false;
  /** Exposes only a copy of the private authority recovery decision. */
  get requiresRunRefresh(): boolean {return this.refreshRequired;}
  /** An accepted validated run establishes canonical progress again. */
  confirmRunRefresh(): void {this.refreshRequired = false;}
  /** Initial guess-loader receipt time. */ private loadingStarted = 0;
  /** Terminal guess hands its loader over to outcome reconciliation. */ private awaitingOutcome = false;
  /** Original input and history survive provisional successor typing. */ private guess: GuessProjection | null = null;
  /** Deliberate edits made after the submitted attempt was projected. */
  private draftEdited = false;
  /** Paid race mutations retain their own original authoritative view. */ private paid: {
    /** Stores operation. */
    operation: "raceHint" | "raceSkip";
    /** Stores run. */
    run: RaceRunView;
    /** Receipt clock restored when the projected action is rejected. */
    receivedAt: number;
    /** Original draft retained independently of hint/skip projection. */ draft?: PaidDraft;
  } | null = null;
  /** Host command delivery seam. */ private readonly post: (message: GameToHostMessage) => void | Promise<void>;
  /** Deterministic receipt/time seams. */ private readonly clock: RacePlayClock;
  /** Idempotent request identifier factory. */ private readonly requestId: (operation: string) => string;
  /** Creates one mounted race owner with browser defaults or deterministic adapters. */
  constructor({
    postToHost,
    clock = createRaceClock(),
    requestId = createRequestId,
    onDeliveryFailure,
  }: {
    /** Host delivery adapter. */ postToHost: (message: GameToHostMessage) => void | Promise<void>;
    /** Optional time adapter. */ clock?: RacePlayClock;
    /** Optional receipt adapter. */ requestId?: (operation: string) => string;
    /** Optional delivery-failure adapter; expiry never automatically repeats a mutation. */ onDeliveryFailure?: (requestId: string, operation: RaceOperation) => void;
  }) {
    this.post = postToHost;
    this.clock = clock;
    this.requestId = requestId;
    this.onDeliveryFailure = onDeliveryFailure;
  }
  /** Subscribes rendering to immutable snapshots. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  /** Reads public operation state. */ getSnapshot = (): RaceDeliveryState => this.state;
  /** Indicates whether successor input may be edited during guess reconciliation. */
  get typingWhilePending(): boolean {
    return this.guess?.canEditDraft ?? false;
  }
  /** Records a new answer intent only while a guess checkpoint owns pending input. */
  noteDraftEdit(): void {if (this.guess) this.draftEdited = true;}
  /** Publishes a state transition. */
  private update(state: RaceDeliveryState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  /** Sends a command with one correlation/mutation receipt; recovery may replay an owned receipt. */
  send = (operation: RaceOperation, type: GameToHostMessage["type"], payload: Record<string, unknown>, replayRequestId?: string): void => {
    /** Adapter callbacks cannot replace this sender's delivery while cleanup runs. */
    const generation = this.loaderGeneration, previous = this.expected;
    this.cancelResponseTimer();
    if (generation !== this.loaderGeneration || this.expected !== previous) return;
    /** Replaying the same authority mutation preserves its idempotency identity. */
    const id = replayRequestId ?? this.requestId(operation);
    if (generation !== this.loaderGeneration || this.expected !== previous) return;
    /** Delivery ownership is distinct even when an explicit retry reuses the mutation receipt. */
    const delivery = {id, operation};
    this.expected = delivery;
    if (operation === "raceGuess") {
      this.loaderGeneration++;
      /** Detach the old loader before cancellation can install a replacement. */
      const timer = this.timer;
      this.timer = undefined;
      if (timer !== undefined) this.clock.cancel(timer);
      if (this.expected !== delivery) return;
      this.loadingStarted = this.clock.now();
      if (this.expected !== delivery) return;
      this.awaitingOutcome = false;
    }
    this.update({pending: operation, raceGuessLoading: operation === "raceGuess" || this.state.raceGuessLoading});
    // A pending-state observer can dispose or replace delivery before the host is called.
    if (this.expected !== delivery) return;
    if (this.onDeliveryFailure) {
      /** Expiry may finish before an optional scheduler returns its handle. */
      let expired = false;
      /** Scheduling itself may enter another delivery before returning its handle. */
      const timer = this.clock.schedule(() => {
        expired = true;
        if (this.expected !== delivery) return;
        this.responseTimer = undefined;
        this.onDeliveryFailure?.(id, operation);
      }, 30000);
      if (this.expected !== delivery || expired) {if (!expired) this.clock.cancel(timer); return;}
      this.responseTimer = timer;
    }
    try {
      /** Asynchronous adapters retain this same delivery ownership receipt. */
      const result = this.post({
        type,
        requestId: id,
        payload: raceOperationRequiresReceipt(operation) ? {...payload, requestId: id} : payload,
      } as GameToHostMessage);
      if (result) void Promise.resolve(result).catch(() => {
        if (this.expected === delivery) this.onDeliveryFailure?.(id, operation);
      });
    } catch (error) {
      // A synchronous confirmation can already have consumed this receipt and issued its successor.
      if (this.expected !== delivery) return;
      if (!this.onDeliveryFailure) throw error;
      this.onDeliveryFailure(id, operation);
    }
  };
  /** Consumes exactly one matching response; stale and duplicate events are ignored. */
  acceptResponse(id: string | undefined, operation: RaceOperation): boolean {
    if (!id || this.expected?.id !== id || this.expected.operation !== operation) return false;
    /** Identity, rather than receipt text, distinguishes a replacement retry delivery. */
    const delivery = this.expected;
    this.cancelResponseTimer();
    if (this.expected !== delivery) return false;
    this.expected = null;
    return true;
  }
  /** Matching responses, replacement commands and lifetime disposal invalidate delivery expiry. */
  private cancelResponseTimer(): void {
    /** Release the owned handle before an optional cancellation callback can reenter. */
    const timer = this.responseTimer;
    this.responseTimer = undefined;
    if (timer !== undefined) this.clock.cancel(timer);
  }
  /** Keeps answer loading active until authoritative outcome reconciliation finishes. */
  setAwaitingOutcome = (awaiting: boolean): void => {
    this.awaitingOutcome = awaiting;
  };
  /** Completes this operation without clearing a newer command started by its handler. */
  finish = (operation: RaceOperation): void => {
    /** An observer may submit another guess or dispose while pending state is released. */
    const generation = this.loaderGeneration;
    if (this.state.pending === operation) this.update({...this.state, pending: null});
    if (generation !== this.loaderGeneration) return;
    if (
      (operation === "raceGuess" && !this.awaitingOutcome) ||
      (operation === "raceOutcome" && this.state.raceGuessLoading)
    ) {
      /** A replacement loader tail also invalidates any cancelled callback already queued. */
      const tailGeneration = ++this.loaderGeneration;
      /** Detach the old tail before cancellation can replace this lifetime. */
      const previousTimer = this.timer;
      this.timer = undefined;
      if (previousTimer !== undefined) this.clock.cancel(previousTimer);
      if (tailGeneration !== this.loaderGeneration) return;
      /** Clock observation must settle before allocating a still-owned tail. */
      const delay = Math.max(0, 180 - (this.clock.now() - this.loadingStarted));
      if (tailGeneration !== this.loaderGeneration) return;
      /** An adapter may invoke the callback before returning its handle. */
      let completed = false;
      /** Only the returned owned handle may become the next cancellable tail. */
      const timer = this.clock.schedule(
        () => {
          completed = true;
          if (tailGeneration !== this.loaderGeneration) return;
          this.timer = undefined;
          this.awaitingOutcome = false;
          this.update({...this.state, raceGuessLoading: false});
        },
        delay,
      );
      if (tailGeneration !== this.loaderGeneration) {if (!completed) this.clock.cancel(timer); return;}
      if (!completed) this.timer = timer;
    }
  };
  /** Cancels pending UI work on unmount. */
  dispose = (): void => {
    /** Detach all old resources and checkpoints before invoking cancellation adapters. */
    const generation = ++this.loaderGeneration, responseTimer = this.responseTimer, timer = this.timer;
    this.responseTimer = undefined;
    this.timer = undefined;
    this.expected = null;
    this.refreshRequired = false;
    this.guess = null;
    this.draftEdited = false;
    this.paid = null;
    this.awaitingOutcome = false;
    if (responseTimer !== undefined) this.clock.cancel(responseTimer);
    if (timer !== undefined) this.clock.cancel(timer);
    if (generation === this.loaderGeneration) this.update({pending: null, raceGuessLoading: false});
  };
  /** Retains every submission checkpoint and creates immediate feedback when evaluation is available. */
  projectGuess(run: RaceRunView, letters: string[], history: ScoredGuess[], receivedAt: number) {
    if (!run.currentRiddle) return null;
    /** Provides feedback behavior. */
    const feedback = run.currentRiddle.evaluation
      ? computeFeedback(letters.join(""), run.currentRiddle.evaluation.answer, run.locale) : null;
    /** Provides correct behavior. */
    const correct = feedback?.every((status) => status === "green") ?? false;
    /** Provides next behavior. */
    const next = correct ? projectInstantCorrectGuess(run) : null;
    this.draftEdited = false;
    this.guess = structuredClone({
      run,
      history: [...history],
      submitted: [...letters],
      canEditDraft: feedback !== null,
      projectedRiddleId: next?.currentRiddle?.riddleId ?? null,
      receivedAt,
    });
    if (!feedback) return null;
    /** Provides projected behavior. */
    const projected = next
      ? {
          ...next,
          wallElapsedMs: run.wallElapsedMs + Math.max(0, this.clock.now() - receivedAt),
          adjustedElapsedMs: getAdjustedRaceTime(run, receivedAt, this.clock.now()),
        }
      : null;
    /** Provides riddle behavior. */
    const riddle = (projected ?? run).currentRiddle;
    return {
      run: projected,
      letters: createRaceAttempt(riddle),
      slot: findFirstEditableRaceSlot(riddle),
      guesses: projected ? [] : [...history, {guess: [...letters], feedback}],
      feedback: correct ? ("correct" as const) : ("incorrect" as const),
    };
  }
  /** Reconciles confirmation while preserving a draft typed into the projected successor. */
  confirmGuess(
    result: SubmitRaceGuessResponse,
    currentRun: RaceRunView | null,
    history: ScoredGuess[],
    letters: string[],
    confirmedOriginal?: RaceRunView | null,
  ) {
    /** Provides projection behavior. */
    const projection = this.guess;
    /** Private confirmed content survives optional wire omissions and public snapshot edits. */
    const original = confirmedOriginal ?? projection?.run ?? currentRun;
    if (original && original.runId !== result.run.runId) {
      throw new Error("Guess confirmation belongs to a different race run");
    }
    /** Feedback belongs to the submitted attempt, never input already typed into its successor. */
    if (!original?.currentRiddle) throw new Error("Missing submitted question");
    /** Answer-free legacy callers still retain their exact pending input. */
    const submitted = projection?.submitted ?? letters;
    /** Canonical graphemes allow equivalent composition and casing in server echoes. */
    const expectedLetters = lowerCaseGraphemes(submitted.join(""), original.locale);
    if (result.feedback.length !== submitted.length || expectedLetters.length !== submitted.length ||
      result.feedback.some((entry, index) => {
        /** A feedback field must echo exactly one submitted answer slot. */
        const echoed = lowerCaseGraphemes(entry.letter, original.locale);
        return echoed.length !== 1 || echoed[0] !== expectedLetters[index];
      }) || result.isCorrect !== result.feedback.every(entry => entry.status === "green"))
      throw new Error("Invalid submitted feedback");
    /** Optional evaluation can be omitted while the immutable preload still owns the answer. */
    const evaluation = original.currentRiddle.evaluation ?? original.preloadedRiddles?.[original.currentRiddle.position]?.evaluation;
    if (evaluation) {
      /** The existing grapheme scorer fixes every positional color before checkpoint consumption. */
      const expected = computeFeedback(submitted.join(""), evaluation.answer, original.locale);
      if (result.feedback.some((entry, index) => entry.status !== expected[index])) throw new Error("Changed submitted scoring");
    }
    /** Content can repeat at another deck position without sharing an answer attempt. */
    const sameQuestion = (left: RaceRunView["currentRiddle"] | undefined, right: RaceRunView["currentRiddle"]): boolean =>
      Boolean(left && right && left.riddleId === right.riddleId && left.position === right.position && left.answerLength === right.answerLength);
    /** Guess history belongs to the submitted question, independently of the displayed draft. */
    const changed = !sameQuestion(original.currentRiddle, result.run.currentRiddle);
    /** Preserve only input already displayed for this exact confirmed question and answer shape. */
    const preserveDraft = Boolean(projection?.canEditDraft && sameQuestion(currentRun?.currentRiddle, result.run.currentRiddle) &&
      letters.length === result.run.currentRiddle?.answerLength);
    this.guess = null;
    this.draftEdited = false;
    return {
      resetAttempt: !preserveDraft,
      guesses: changed
        ? null
        : [
            ...(projection?.history ?? history),
            {guess: projection?.submitted ?? letters, feedback: result.feedback.map(({status}) => status)},
          ],
    };
  }
  /** Captures every paid draft and projects immediately when its immutable deck is available. */
  projectPaid(operation: "raceHint" | "raceSkip", run: RaceRunView, receivedAt = this.clock.now(), draft?: PaidDraft): RaceRunView | null {
    if (run.status !== "active" || !run.currentRiddle) return null;
    /** Provides projected behavior. */
    const projected = operation === "raceHint" ? projectInstantRaceHint(run) : projectInstantRaceSkip(run);
    this.paid = structuredClone({operation, run, receivedAt, ...(draft ? {draft} : {})});
    if (!projected) return null;
    /** Advance solving time before the rendering adapter anchors the projection. */
    const elapsed = run.status === "active" ? Math.max(0, this.clock.now() - receivedAt) : 0;
    return {...projected, wallElapsedMs: run.wallElapsedMs + elapsed,
      adjustedElapsedMs: projected.adjustedElapsedMs + elapsed};
  }
  /** Consumes confirmed paid ownership and returns the privately captured draft for hint merging. */
  confirmPaid(operation: "raceHint" | "raceSkip", confirmedRun?: RaceRunView): PaidDraft | undefined {
    if (this.paid?.operation !== operation) return;
    if (confirmedRun && confirmedRun.runId !== this.paid.run.runId) {
      throw new Error("Paid action confirmation belongs to a different race run");
    }
    /** Locked pending input retains the pre-command letters, history and selection. */
    const draft = this.paid.draft;
    this.paid = null;
    return draft;
  }
  /** The same rollback applies to authority rejection and malformed receipts. */
  rejectProjection(operation: RaceOperation) {
    this.refreshRequired ||= raceOperationRequiresRefresh(operation);
    if (operation === "raceGuess" && this.guess) {
      /** Provides projection behavior. */
      const projection = this.guess;
      this.guess = null;
      /** Recovery separates newly edited input from the original submission rollback. */
      const draftEdited = this.draftEdited;
      this.draftEdited = false;
      return {
        kind: "guess" as const, draftEdited, draftRun: projection.run,
        run: projection.projectedRiddleId ? projection.run : null,
        guesses: projection.history,
        letters: projection.submitted,
        receivedAt: projection.receivedAt,
      };
    }
    if (this.paid?.operation === operation) {
      /** Provides run behavior. */
      const {run, receivedAt, draft} = this.paid;
      this.paid = null;
      return {kind: "paid" as const, run, receivedAt, guesses: draft?.guesses ?? null, letters: draft?.letters ?? null,
        ...(draft ? {activeSlotIndex: draft.activeSlotIndex} : {})};
    }
    return null;
  }
  /** Defers ghost/deadline results while an authoritative mutation can change the outcome. */
  projectOutcome(run: RaceRunView, adjustedNow: number) {
    if (run.status === "active" && this.state.pending) return null;
    return projectRaceOutcome(run, adjustedNow);
  }
  /** Publication waits for a confirmed completed run and settled mutation receipts. */
  canPublish(run: RaceRunView | null): boolean {
    return Boolean(run?.status === "completed" && !this.state.pending && !this.guess && !this.paid);
  }
}
