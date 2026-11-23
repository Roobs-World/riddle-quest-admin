import {describe, expect, it} from "@jest/globals";
import {catalog, fixture, harness} from "../../browser/controllers/__tests__/raceSession.support.ts";
import {projectRaceOutcome} from "../../presentation/racePresentation";

/** Shared account-bound persistence survives session disposal and clears only matching run hints. */
const persistence = () => {
  /** Browser-equivalent stored resume pointer shared by successive mounted sessions. */
  let saved: string | null = null;
  return {read: () => saved, save: (_owner: string | undefined, runId: string) => {saved = runId;},
    clear: (_owner: string | undefined, runId?: string) => {if (!runId || saved === runId) saved = null;}};
};

/** A real client journey reaches an authoritative timeout before its separate outcome read settles. */
const timedOut = async () => {
  /** Reload shares the exact adapter used by the original session. */
  const storage = persistence(), h = harness({}, null, {persistence: storage});
  h.respond("raceCategories", await catalog());h.session.begin("mixed", "timeout-challenge");
  /** Ghost deadline is later than the challenger's maximum, so the maximum ends this race. */
  const run = {...await fixture(), role: "challenger" as const, challengeId: "timeout-challenge",
    opponent: {displayName: "Nova", adjustedFinishMs: 360000, events: []}};
  h.respond("raceStart", {run});h.advance(3480);h.session.retry();
  /** Canonical timeout fixes the elapsed clock independently of response latency. */
  const terminal = {...run, status: "timed_out" as const, currentRiddle: null, wallElapsedMs: 300000,
    adjustedElapsedMs: 300000, serverNowMs: run.startsAtMs! + 300000};
  h.respond("raceResume", {run: terminal});
  expect(h.session.getSnapshot()).toMatchObject({error: null, stage: "result", pending: "raceOutcome", run: terminal});
  return {h, storage, terminal};
};

describe("Race Session unacknowledged timeout reload", () => {
  it.each(["pending", "rejected", "malformed"])("retains timeout ownership across reload with %s outcome", async delivery => {
    /** Until outcome confirmation, no result has been acknowledged by this session. */
    const {h, storage, terminal} = await timedOut();
    if (delivery === "rejected") h.reject("raceOutcome", "Temporary read failure");
    if (delivery === "malformed") h.respond("raceOutcome", {...projectRaceOutcome(terminal, 300000)!, runId: "another-run"});
    if (delivery === "pending") h.session.requestClose();else h.session.dispose();
    /** A fresh mount must independently reconfirm the saved terminal run and its outcome. */
    const reload = harness({}, null, {persistence: storage});
    expect(reload.last()).toMatchObject({type: "game:resumeRace", payload: {runId: terminal.runId}});
    reload.respond("raceResume", {run: terminal});
    expect(reload.session.getSnapshot()).toMatchObject({error: null, stage: "result", pending: "raceOutcome", run: terminal});
    reload.respond("raceOutcome", projectRaceOutcome(terminal, 300000));
    expect(reload.effects.filter(effect => effect.kind === "outcome")).toHaveLength(1);
    reload.session.requestClose();
    expect(storage.read()).toBeNull();
  });
  it("preserves another tab's newer run pointer when the older timeout is reconfirmed", async () => {
    /** Concurrent selection remains authoritative for the next mount's resume hint. */
    const {h, storage, terminal} = await timedOut();
    storage.save("owner-1", "newer-run");h.reject("raceOutcome", "Lost result");h.session.retry();
    h.respond("raceOutcome", projectRaceOutcome(terminal, 300000));h.session.requestClose();
    expect(storage.read()).toBe("newer-run");
  });
});
