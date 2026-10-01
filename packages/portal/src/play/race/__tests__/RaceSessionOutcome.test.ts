import {describe, expect, it} from "@jest/globals";
import type {RaceOutcome, RaceRunView} from "@qwordly/core/race";
import {catalog, fixture, harness} from "./raceSession.support";
import {projectRaceOutcome} from "../logic/racePresentation";

/** Public transport journey with a pinned competitive recording or creator role. */
const started = async (role: RaceRunView["role"] = "challenger") => {
  /** The outgoing start intent fixes whether this is a direct challenge. */
  const h = harness(); h.respond("raceCategories", await catalog()); h.session.begin("mixed", role === "challenger" ? "challenge" : undefined);
  /** Privacy-safe ghost timeline remains immutable independently of its display identity. */
  const run: RaceRunView = {...await fixture(), role, challengeId: role === "challenger" ? "challenge" : undefined,
    opponent: role === "challenger" ? {displayName: "Nova", adjustedFinishMs: 100000,
      events: [{sequence: 0, type: "correct", riddlePosition: 9, wallElapsedMs: 100000,
        penaltyAddedMs: 0, totalPenaltyMs: 0, adjustedElapsedMs: 100000, correctCount: 10}]} : undefined};
  h.respond("raceStart", {run}); h.advance(3480);
  return {...h, run};
};

/** Complete server view including a known paid hint, independent of the final result read. */
const completed = async (role: RaceRunView["role"] = "challenger", correctCount = 10, finishMs = 45000) => {
  /** A resume may legitimately reveal completion performed in another tab. */
  const h = await started(role); h.session.retry();
  /** Final paid history accounts for the exact split of the immutable clock. */
  const terminal: RaceRunView = {...h.run, status: "completed", currentRiddle: null, correctCount,
    wallElapsedMs: finishMs - 15000, totalPenaltyMs: 15000, adjustedElapsedMs: finishMs,
    events: [{sequence: 0, type: "hint", riddlePosition: 0, wallElapsedMs: 1000,
      penaltyAddedMs: 15000, totalPenaltyMs: 15000, adjustedElapsedMs: 16000, correctCount: 0}]};
  h.respond("raceResume", {run: terminal});
  /** A valid final response includes the same canonical run facts. */
  const outcome = projectRaceOutcome(terminal, terminal.adjustedElapsedMs)!;
  expect(h.session.getSnapshot()).toMatchObject({error: null, pending: "raceOutcome", stage: "result"});
  return {...h, terminal, outcome};
};

describe("Race Session immutable outcome confirmation", () => {
  it("retains an unacknowledged terminal run for reload and revalidates its result", async () => {
    /** Original session retains its terminal authority until result acknowledgement. */
    const h = await completed();
    h.respond("raceOutcome", h.outcome);
    expect(h.clearCalls).not.toContainEqual({ownerId: "owner-1", runId: h.run.runId});
    expect(h.saved.at(-1)).toEqual({ownerId: "owner-1", runId: h.run.runId});
    h.session.dispose();
    /** A fresh owner session independently reconfirms the pending result. */
    const reload = harness({}, h.run.runId);
    expect(reload.last()).toMatchObject({type: "game:resumeRace", payload: {runId: h.run.runId}});
    reload.respond("raceResume", {run: h.terminal});
    expect(reload.session.getSnapshot()).toMatchObject({stage: "result", pending: "raceOutcome"});
    reload.respond("raceOutcome", h.outcome);
    expect(reload.session.getSnapshot()).toMatchObject({stage: "result", outcome: h.outcome, error: null});
    reload.session.requestClose();
    expect(reload.clearCalls).toContainEqual({ownerId: "owner-1", runId: h.run.runId});
  });

  it.each(["active", "completed"] as const)("rejects an arithmetically contradictory %s clock before saving resume hints", async status => {
    /** A correctly shaped clock must still account for its paid time. */
    const h = harness(); h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Initial receipts cannot establish contradictory confirmed clock facts. */
    const run = {...await fixture(), status, wallElapsedMs: 1, adjustedElapsedMs: 0};
    if (status === "completed") run.currentRiddle = null;
    h.respond("raceStart", {run});
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", run: null});
    expect(h.saved).toEqual([]);
  });
  it.each(["winner", "tie", "phase", "ghost-clock", "missing-ghost", "finish-clock", "penalty-split"])("rejects an internally shaped but contradictory final %s and recovers without effects", async kind => {
    /** Already confirmed score and clocks must survive corruption of the separate outcome read. */
    const h = await completed(), before = h.session.getSnapshot(), corrupt = {...h.outcome};
    if (kind === "winner") corrupt.result = "ghost_win";
    if (kind === "tie") corrupt.result = "tie";
    if (kind === "phase") {corrupt.result = "timed_out"; corrupt.rematchEligible = false;}
    if (kind === "ghost-clock") corrupt.opponentAdjustedFinishMs! += 1;
    if (kind === "missing-ghost") delete corrupt.opponentAdjustedFinishMs;
    if (kind === "finish-clock") {corrupt.wallFinishMs += 1; corrupt.adjustedFinishMs += 1;}
    if (kind === "penalty-split") {corrupt.hintPenaltyMs = 0; corrupt.skipPenaltyMs = 15000;}
    h.respond("raceOutcome", corrupt);
    expect(h.session.getSnapshot()).toMatchObject({run: before.run, outcome: before.outcome, error: "RaceTo10.ERROR_INVALID_RESPONSE"});
    expect(h.effects.filter(effect => effect.kind === "outcome")).toHaveLength(0);
    h.session.retry(); h.respond("raceOutcome", h.outcome);
    expect(h.session.getSnapshot()).toMatchObject({outcome: h.outcome, error: null});
    expect(h.effects.filter(effect => effect.kind === "outcome")).toHaveLength(1);
  });
  it.each([100000, 110000, 1845000])("accepts exact ties and genuine slower full-score finishes, including final penalties above the active limit: %i", async finish => {
    /** A full-score clearing action has different rules from an active deadline projection. */
    const h = await completed("challenger", 10, finish); h.respond("raceOutcome", h.outcome);
    expect(h.session.getSnapshot()).toMatchObject({error: null, outcome: h.outcome, run: h.terminal});
    expect(h.effects.filter(effect => effect.kind === "outcome")).toHaveLength(1);
  });
  it.each(["score", "finish-clock"])("preserves an incomplete ghost loss's confirmed %s", async kind => {
    /** Incomplete scores are valid losses, so basic full-score checks cannot catch this regression. */
    const h = await completed("challenger", 5, 100000), corrupt = {...h.outcome};
    if (kind === "score") corrupt.correctCount = 4;
    else {corrupt.wallFinishMs += 1; corrupt.adjustedFinishMs += 1;}
    h.respond("raceOutcome", corrupt);
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", run: h.terminal, outcome: h.outcome});
    expect(h.effects.some(effect => effect.kind === "outcome")).toBe(false);
  });
  it.each(["finish-clock", "unexpected-ghost"])("preserves a creator recording against a changed %s", async kind => {
    /** Creator publication cannot use a finish time manufactured by the later outcome response. */
    const h = await completed("creator"), corrupt = {...h.outcome};
    if (kind === "finish-clock") {corrupt.wallFinishMs += 1; corrupt.adjustedFinishMs += 1;}
    else corrupt.opponentAdjustedFinishMs = 100000;
    h.respond("raceOutcome", corrupt); h.session.publish();
    expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_INVALID_RESPONSE");
    expect(h.commands.some(command => command.type === "game:publishRace")).toBe(false);
    h.session.retry(); h.respond("raceOutcome", h.outcome);
    expect(h.commands.filter(command => command.type === "game:publishRace")).toHaveLength(1);
  });
  it("reconciles another tab's completion over a projected ghost loss and pins subsequent reads without requiring unseen events", async () => {
    /** This tab sees its deadline while another tab completed actions before that deadline. */
    const h = await started(); h.advance(100001);
    expect(h.session.getSnapshot().outcome?.result).toBe("ghost_win");
    /** Unseen paid progress belongs to the server; the stale live event list cannot veto it. */
    const outcome: RaceOutcome = {...projectRaceOutcome({...h.run, status: "completed", currentRiddle: null, correctCount: 10,
      wallElapsedMs: 30000, totalPenaltyMs: 15000, adjustedElapsedMs: 45000}, 45000)!, hintPenaltyMs: 15000};
    h.respond("raceOutcome", outcome);
    expect(h.session.getSnapshot()).toMatchObject({error: null, outcome, run: {status: "completed", correctCount: 10, totalPenaltyMs: 15000}});
    h.session.retry(); h.respond("raceOutcome", {...outcome, wallFinishMs: 30001, adjustedFinishMs: 45001});
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", outcome});
    h.session.retry(); h.respond("raceOutcome", {...outcome, achievementCoinsAwarded: 150, newCoins: 900});
    expect(h.session.getSnapshot()).toMatchObject({error: null, outcome: {achievementCoinsAwarded: 150, newCoins: 900}});
    expect(h.effects.filter(effect => effect.kind === "outcome")).toHaveLength(1);
  });
  it.each(["finish", "timeline", "omission"])("rejects a changed ghost %s on resume while accepting privacy anonymization", async kind => {
    /** Timing ownership persists through read recovery without pinning a deleted player's identity. */
    const h = await started(); h.session.input("text", "pi"); h.session.retry();
    /** Every corruption remains individually schema-valid. */
    const changed = structuredClone(h.run);
    if (kind === "finish") changed.opponent!.adjustedFinishMs += 1;
    if (kind === "timeline") {changed.opponent!.events[0].wallElapsedMs += 1; changed.opponent!.events[0].adjustedElapsedMs += 1;}
    if (kind === "omission") delete changed.opponent;
    h.respond("raceResume", {run: changed});
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", run: h.run, currentLetters: ["p", "i", "", "", ""]});
    h.session.retry(); h.respond("raceResume", {run: {...h.run, opponent: {...h.run.opponent!, displayName: "Riddle Quest player", avatarUrl: null}}});
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {opponent: {displayName: "Riddle Quest player", adjustedFinishMs: 100000}}});
  });
  it.each(["score", "hint-progress", "impossible-loss-clock"])("rejects outcome %s missing from the last confirmed live view", async kind => {
    /** Confirmed progress is a minimum, even when final actions were performed elsewhere. */
    const h = await started(); h.session.retry();
    /** Five cleared questions own the next immutable prompt, not the untouched first one. */
    const question = h.run.preloadedRiddles![5];
    /** Known paid progress precedes the local ghost deadline. */
    const progress: RaceRunView = {...h.run, correctCount: 5, totalPenaltyMs: 15000, adjustedElapsedMs: h.run.wallElapsedMs + 15000,
      currentRiddle: {...h.run.currentRiddle!, position: 5, riddleId: question.riddleId, text: question.text,
        answerLength: question.answerLength, evaluation: question.evaluation},
      events: [{sequence: 0, type: "hint", riddlePosition: 0, wallElapsedMs: 0,
        penaltyAddedMs: 15000, totalPenaltyMs: 15000, adjustedElapsedMs: 15000, correctCount: 0}]};
    h.respond("raceResume", {run: progress});
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {correctCount: 5, currentRiddle: {position: 5}}});
    h.advance(100001);
    /** Canonical incomplete loss still retains the entire confirmed paid history. */
    const outcome = projectRaceOutcome(progress, 100001)!;
    if (kind === "score") outcome.correctCount = 4;
    if (kind === "hint-progress") {outcome.hintPenaltyMs = 0; outcome.skipPenaltyMs = 15000;}
    if (kind === "impossible-loss-clock") {outcome.wallFinishMs += 1; outcome.adjustedFinishMs += 1;}
    h.respond("raceOutcome", outcome);
    expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_INVALID_RESPONSE");
    expect(h.effects.some(effect => effect.kind === "outcome")).toBe(false);
  });
  it.each(["full-score-timeout", "penalty-timeout", "ghost-after-limit"])("rejects a final result contradicting the authoritative deadline order: %s", async kind => {
    /** An active view may reach its deadline before the final server read returns. */
    const h = await started();
    if (kind === "ghost-after-limit") {
      h.session.rematch(); h.session.begin("mixed", "late-challenge");
      h.run.runId = "late-run"; h.run.challengeId = "late-challenge";
      h.run.opponent!.adjustedFinishMs = h.run.rules.maxAdjustedTimeMs + 1000;
      h.respond("raceStart", {run: h.run}); h.advance(3480);
    }
    h.advance(h.run.rules.maxAdjustedTimeMs);
    /** A valid timeout is the safe recovery candidate for every incomplete boundary case. */
    const timeout: RaceOutcome = {...projectRaceOutcome(h.run, h.run.rules.maxAdjustedTimeMs)!,
      result: "timed_out", rematchEligible: false};
    /** Each corrupt candidate remains arithmetically coherent and owned by the same run. */
    const corrupt = {...timeout};
    if (kind === "full-score-timeout") corrupt.correctCount = 10;
    else {
      corrupt.result = "ghost_win"; corrupt.rematchEligible = true;
      if (kind === "penalty-timeout") {
        corrupt.hintPenaltyMs = corrupt.totalPenaltyMs = corrupt.adjustedFinishMs = h.run.rules.maxAdjustedTimeMs;
        corrupt.wallFinishMs = 0;
      } else {corrupt.wallFinishMs = corrupt.adjustedFinishMs = h.run.opponent!.adjustedFinishMs;}
    }
    h.respond("raceOutcome", corrupt);
    expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_INVALID_RESPONSE");
    expect(h.effects.some(effect => effect.kind === "outcome")).toBe(false);
    h.session.retry(); h.respond("raceOutcome", timeout);
    expect(h.session.getSnapshot()).toMatchObject({error: null, outcome: timeout});
    expect(h.effects.filter(effect => effect.kind === "outcome")).toHaveLength(1);
  });
});
