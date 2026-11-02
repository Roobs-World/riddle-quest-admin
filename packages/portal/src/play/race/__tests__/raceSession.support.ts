import {expect} from "@jest/globals";
import type {GameToHostMessage} from "@riddle-quest/core/bridge";
import type {RaceChallengePreview, RaceRunView} from "@riddle-quest/core/race";
import {RaceSession} from "../RaceSession";
import type {RaceSessionEffect, RaceSessionEntry, RaceSessionOptions} from "../RaceSession.types";
import {createFakeRaceServices} from "../testing/fakeRaceServices";
import {projectRaceOutcome} from "../logic/racePresentation";

/** Deterministic transport, persistence and time adapters exercise the public session seam. */
export const harness = (entry: Partial<RaceSessionEntry> = {}, resumeId: string | null = null, options: Pick<RaceSessionOptions, "draftStorage" | "recovery" | "persistence" | "wallNow" | "getMatchmaking" | "effect" | "postToHost"> = {}) => {
  /** Monotonic time and unique receipts. */
  let now = 0, sequence = 0;
  /** Issued bridge commands. */
  const commands: GameToHostMessage[] = [];
  /** Validated downstream effects. */
  const effects: RaceSessionEffect[] = [];
  /** Account-bound resume hint writes. */
  const saved: Array<{
    /** Account bound to the saved hint. */ ownerId?: string;
    /** Authority-issued run hint. */ runId: string;
  }> = [];
  /** Cleared account hints. */
  const cleared: Array<string | undefined> = [];
  /** Expected run retained with every persistence cleanup request. */
  const clearCalls: Array<{
    /** Account requesting cleanup. */ ownerId?: string;
    /** Exact run whose hint may be cleared. */ runId?: string;
  }> = [];
  /** Scheduled loader timers. */
  const timers = new Map<number, {
    /** Scheduled monotonic deadline. */ at: number;
    /** Loader transition to execute at the deadline. */ callback: () => void;
  }>();
  /** Owned player journey. */
  const session = new RaceSession({locale: "en", ownerId: "owner-1", ...entry}, {
    ...options, postToHost: message => {commands.push(message); return options.postToHost?.(message);}, effect: effect => {effects.push(effect); return options.effect?.(effect);},
    requestId: operation => `${operation}-${++sequence}`,
    random: () => 0.5,
    clock: {now: () => now, schedule: (callback, delay) => {
      /** Unique scheduled loader handle. */
      const id = ++sequence; timers.set(id, {at: now + delay, callback}); return id;}, cancel: id => {timers.delete(id);}},
    persistence: options.persistence ?? {read: () => resumeId, save: (ownerId, runId) => saved.push({ownerId, runId}), clear: (ownerId, runId) => {cleared.push(ownerId); clearCalls.push({ownerId, runId});}},
  });
  session.enter();
  return {session, commands, effects, saved, cleared, clearCalls, timers,
    last: () => commands[commands.length - 1],
    respond: (operation: string, data: unknown, command = commands[commands.length - 1]) => session.receive({type: "host:operationResult", requestId: command.requestId, payload: {operation, ok: true, data}}),
    reject: (operation: string, error: string, command = commands[commands.length - 1]) => session.receive({type: "host:operationResult", requestId: command.requestId, payload: {operation, ok: false, error}}),
    advance: (elapsed: number) => {now += elapsed; for (const [id, timer] of timers) if (timer.at <= now) {timers.delete(id); timer.callback();} session.tick();},
  };
};
/** Complete validated catalog from the production-style browser adapter. */
export const catalog = async () => createFakeRaceServices().listRaceCategories("en");
/** Complete authority-issued deck for active/prepared transitions. */
export const fixture = async (prepare = false, authority = createFakeRaceServices()): Promise<RaceRunView> => (await authority.startRace({locale: "en", categoryId: "mixed", requestId: "fixture-start", includeEvaluation: true, prepare})).run;
/** Enter a fully loaded legacy active run without touching React internals. */
export const racing = async (effect?: RaceSessionOptions["effect"]) => {
  /** Public session harness for this player journey. */
  const h = harness({}, null, {effect});
  h.respond("raceCategories", await catalog());
  h.session.begin("mixed");
  /** Complete authority-issued run fixture. */
  const authority = createFakeRaceServices();
  /** Complete deck and stable schedule belong to the same authority used by later mutations. */
  const run = await fixture(false, authority);
  h.respond("raceStart", {run});
  h.advance(3480);
  expect(h.session.getSnapshot().stage).toBe("racing");
  return {...h, run, authority};
};
/** Waits for the public discovery transition rather than assuming an implementation microtask count. */
export const settleMatch = (session: RaceSession): Promise<void> => {
  if (!session.getSnapshot().findingOpponent) return Promise.resolve();
  return new Promise(resolve => {
    /** Subscription ends at the owned search's final observable transition. */
    const unsubscribe = session.subscribe(() => {if (!session.getSnapshot().findingOpponent) {unsubscribe(); resolve();}});
  });
};
/** Privacy-safe direct challenge preview. */
export const preview = (challengeId = "challenge-1"): RaceChallengePreview => ({challengeId, categoryId: "mixed", locale: "en", rulesVersion: "race10_v1", targetCorrect: 10, adjustedTimeToBeatMs: 60000, creator: {displayName: "Nova"}, status: "active", expiresAtMs: Date.now() + 60000});
/** Authors a clean all-correct recording for fixtures focused on terminal delivery and effects. */
export const withCorrectHistory = (run: RaceRunView): RaceRunView => {
  if (run.totalPenaltyMs !== 0) throw new Error("Clean recording fixture cannot contain paid time");
  return {...run, events: Array.from({length: run.correctCount}, (_, position) => ({sequence: position,
    type: "correct" as const, riddlePosition: position, wallElapsedMs: run.wallElapsedMs, penaltyAddedMs: 0 as const,
    totalPenaltyMs: 0, adjustedElapsedMs: run.wallElapsedMs, correctCount: position + 1}))};
};
/** Confirmed creator result awaiting an explicit publication request. */
export const recorded = async (effect?: RaceSessionOptions["effect"]) => {
  /** Public session completing its owned run. */
  const h = await racing(effect);
  h.session.input("text", "piano"); h.session.submit();
  /** Terminal authority view with a stable recorded score. */
  const run = withCorrectHistory({...h.run, status: "completed", correctCount: 10, currentRiddle: null, wallElapsedMs: 60000, adjustedElapsedMs: 60000});
  h.respond("raceGuess", {run, isCorrect: true, autoSkipped: false, feedback: [..."piano"].map(letter => ({letter, status: "green"}))});
  expect(h.session.getSnapshot()).toMatchObject({error: null, stage: "result", pending: "raceOutcome"});
  h.respond("raceOutcome", projectRaceOutcome(run, run.adjustedElapsedMs)!);
  return h;
};
