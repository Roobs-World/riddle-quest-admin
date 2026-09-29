import type {GameToHostMessage} from "@qwordly/core/bridge";
import {computeFeedback, type ScoredGuess} from "@qwordly/core/game";
import type {RaceRunView, SubmitRaceGuessResponse} from "@qwordly/core/race";
import {createRequestId} from "../requestIds";
import {raceOperationRequiresReceipt, type RaceOperation} from "./logic/raceOperations";
import {
  createRaceAttempt,
  findFirstEditableRaceSlot,
  getAdjustedRaceTime,
  projectInstantCorrectGuess,
  projectInstantRaceHint,
  projectInstantRaceSkip,
  projectRaceOutcome,
} from "./logic/racePresentation";
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
  /** Stores projected riddle id. */
  projectedRiddleId: string | null;
  /** Original authority receipt time retained during rollback. */
  receivedAt: number;
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
  /** Initial guess-loader receipt time. */ private loadingStarted = 0;
  /** Terminal guess hands its loader over to outcome reconciliation. */ private awaitingOutcome = false;
  /** Original input and history survive provisional successor typing. */ private guess: GuessProjection | null = null;
  /** Paid race mutations retain their own original authoritative view. */ private paid: {
    /** Stores operation. */
    operation: "raceHint" | "raceSkip";
    /** Stores run. */
    run: RaceRunView;
  } | null = null;
  /** Host command delivery seam. */ private readonly post: (message: GameToHostMessage) => void;
  /** Deterministic receipt/time seams. */ private readonly clock: RacePlayClock;
  /** Idempotent request identifier factory. */ private readonly requestId: (operation: string) => string;
  /** Creates one mounted race owner with browser defaults or deterministic adapters. */
  constructor({
    postToHost,
    clock = {
      now: () => performance.now(),
      schedule: (callback, delay) => window.setTimeout(callback, delay),
      cancel: (timer) => window.clearTimeout(timer),
    },
    requestId = createRequestId,
  }: {
    /** Host delivery adapter. */ postToHost: (message: GameToHostMessage) => void;
    /** Optional time adapter. */ clock?: RacePlayClock;
    /** Optional receipt adapter. */ requestId?: (operation: string) => string;
  }) {
    this.post = postToHost;
    this.clock = clock;
    this.requestId = requestId;
  }
  /** Subscribes rendering to immutable snapshots. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  /** Reads public operation state. */ getSnapshot = (): RaceDeliveryState => this.state;
  /** Indicates whether successor input may be edited during guess reconciliation. */
  get typingWhilePending(): boolean {
    return this.guess !== null;
  }
  /** Publishes a state transition. */
  private update(state: RaceDeliveryState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  /** Sends a command with one correlation ID, also used as the mutation receipt. */
  send = (operation: RaceOperation, type: GameToHostMessage["type"], payload: Record<string, unknown>): void => {
    /** Provides id behavior. */
    const id = this.requestId(operation);
    this.expected = {id, operation};
    if (operation === "raceGuess") {
      if (this.timer !== undefined) this.clock.cancel(this.timer);
      this.timer = undefined;
      this.loadingStarted = this.clock.now();
      this.awaitingOutcome = false;
    }
    this.update({pending: operation, raceGuessLoading: operation === "raceGuess" || this.state.raceGuessLoading});
    this.post({
      type,
      requestId: id,
      payload: raceOperationRequiresReceipt(operation) ? {...payload, requestId: id} : payload,
    } as GameToHostMessage);
  };
  /** Consumes exactly one matching response; stale and duplicate events are ignored. */
  acceptResponse(id: string | undefined, operation: RaceOperation): boolean {
    if (!id || this.expected?.id !== id || this.expected.operation !== operation) return false;
    this.expected = null;
    return true;
  }
  /** Keeps answer loading active until authoritative outcome reconciliation finishes. */
  setAwaitingOutcome = (awaiting: boolean): void => {
    this.awaitingOutcome = awaiting;
  };
  /** Completes this operation without clearing a newer command started by its handler. */
  finish = (operation: RaceOperation): void => {
    if (this.state.pending === operation) this.update({...this.state, pending: null});
    if (
      (operation === "raceGuess" && !this.awaitingOutcome) ||
      (operation === "raceOutcome" && this.state.raceGuessLoading)
    ) {
      if (this.timer !== undefined) this.clock.cancel(this.timer);
      this.timer = this.clock.schedule(
        () => {
          this.timer = undefined;
          this.awaitingOutcome = false;
          this.update({...this.state, raceGuessLoading: false});
        },
        Math.max(0, 180 - (this.clock.now() - this.loadingStarted)),
      );
    }
  };
  /** Cancels pending UI work on unmount. */
  dispose = (): void => {
    if (this.timer !== undefined) this.clock.cancel(this.timer);
    this.timer = undefined;
  };
  /** Creates immediate feedback and retains the complete original question checkpoint. */
  projectGuess(run: RaceRunView, letters: string[], history: ScoredGuess[], receivedAt: number) {
    if (!run.currentRiddle?.evaluation) return null;
    /** Provides feedback behavior. */
    const feedback = computeFeedback(letters.join(""), run.currentRiddle.evaluation.answer);
    /** Provides correct behavior. */
    const correct = feedback.every((status) => status === "green");
    /** Provides next behavior. */
    const next = correct ? projectInstantCorrectGuess(run) : null;
    this.guess = {
      run,
      history: [...history],
      submitted: [...letters],
      projectedRiddleId: next?.currentRiddle?.riddleId ?? null,
      receivedAt,
    };
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
  ) {
    /** Provides projection behavior. */
    const projection = this.guess;
    /** Provides previous behavior. */
    const previous = projection?.run.currentRiddle?.riddleId ?? currentRun?.currentRiddle?.riddleId;
    /** Provides changed behavior. */
    const changed = previous !== result.run.currentRiddle?.riddleId;
    /** Provides preserve draft behavior. */
    const preserveDraft = Boolean(projection && projection.projectedRiddleId === result.run.currentRiddle?.riddleId);
    this.guess = null;
    return {
      resetAttempt: changed ? !preserveDraft : !projection,
      guesses: changed
        ? null
        : [
            ...(projection ? history.slice(0, -1) : history),
            {guess: projection?.submitted ?? letters, feedback: result.feedback.map(({status}) => status)},
          ],
    };
  }
  /** Projects a paid action and privately retains its original authoritative view. */
  projectPaid(operation: "raceHint" | "raceSkip", run: RaceRunView): RaceRunView | null {
    /** Provides projected behavior. */
    const projected = operation === "raceHint" ? projectInstantRaceHint(run) : projectInstantRaceSkip(run);
    if (projected) this.paid = {operation, run};
    return projected;
  }
  /** Removes a confirmed paid-action checkpoint. */
  confirmPaid(operation: "raceHint" | "raceSkip"): void {
    if (this.paid?.operation === operation) this.paid = null;
  }
  /** The same rollback applies to authority rejection and malformed receipts. */
  rejectProjection(operation: RaceOperation) {
    if (operation === "raceGuess" && this.guess) {
      /** Provides projection behavior. */
      const projection = this.guess;
      this.guess = null;
      return {
        kind: "guess" as const,
        run: projection.projectedRiddleId ? projection.run : null,
        guesses: projection.history,
        letters: projection.submitted,
        receivedAt: projection.receivedAt,
      };
    }
    if (this.paid?.operation === operation) {
      /** Provides run behavior. */
      const run = this.paid.run;
      this.paid = null;
      return {kind: "paid" as const, run, guesses: null, letters: null};
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
