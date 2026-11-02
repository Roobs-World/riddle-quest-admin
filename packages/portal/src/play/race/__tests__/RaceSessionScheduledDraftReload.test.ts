import {describe, expect, it} from "@jest/globals";
import type {RaceRunView} from "@riddle-quest/core/race";
import {fixture, harness, catalog} from "./raceSession.support";
import type {RaceDraftStorage} from "../logic/raceDraftStorage";

/** One persisted raw revision survives mounting another real session. */
const storage = () => {
  /** Optional browser value, initially an observed empty key. */
  let raw: string | null = null;
  /** Minimal raw adapter leaves all race transitions in production code. */
  const adapter: RaceDraftStorage = {
    /** Observes the current persisted revision. */ read: () => raw,
    /** Saves only production-provided bytes. */ write: value => {raw = value;},
    /** Clears the observed value. */ remove: () => {raw = null;},
  };
  return {adapter, read: () => raw};
};
/** Builds a valid scheduled authority snapshot with a three-second start lead-in. */
const schedule = (run: RaceRunView): RaceRunView => ({...run, status: "scheduled", startsAtMs: run.serverNowMs! + 3000});
/** Resume after elapsed server time confirms activation independently of local draft bytes. */
const active = (run: RaceRunView): RaceRunView => ({...run, status: "active", serverNowMs: run.serverNowMs! + 3500, wallElapsedMs: 500, adjustedElapsedMs: 500});

describe("draft recovery after server-scheduled race activation", () => {
  it.each(["fresh-start", "cold-resume"].flatMap(path => [0, 10000].map(delay => [path, delay] as const)))("retains first-puzzle input after %s with a %sms response delay", async (path, delay) => {
    /** Fresh starts and resumed countdowns share the same server-issued schedule. */
    const prepared = await fixture(true), run = schedule(prepared), store = storage();
    /** The private confirmed run remains scheduled until the next server operation. */
    const h = harness({}, path === "cold-resume" ? run.runId : null, {draftStorage: store.adapter, wallNow: () => 100000});
    if (path === "fresh-start") {
      h.respond("raceCategories", await catalog()); h.session.begin("mixed"); h.respond("raceStart", {run: prepared}); h.advance(delay); h.respond("raceReady", {run});
    } else {h.advance(delay); h.respond("raceResume", {run});}
    expect(h.session.getSnapshot().error).toBeNull(); expect(store.read()).toBeNull();
    h.advance(3500); expect(h.session.getSnapshot()).toMatchObject({stage: "racing", run: {status: "active"}});
    h.session.input("text", "pi"); h.session.input("slot", 3); h.session.dispose();
    /** A new mount must restore only after its separate canonical active response. */
    const reload = harness({}, run.runId, {draftStorage: store.adapter, wallNow: () => 100100});
    reload.respond("raceResume", {run: active(run)}); reload.advance(3500);
    expect(reload.session.getSnapshot()).toMatchObject({error: null, currentLetters: ["p", "i", "", "", ""], activeSlotIndex: 3});
    expect(reload.commands.map(command => command.type)).toEqual(["game:resumeRace"]);
  });
  it("does not treat a mutated visible status or wall clock as proof that a scheduled run started", async () => {
    /** Only the private receipt and monotonic timer determine start eligibility. */
    const run = schedule(await fixture(true)), store = storage(), h = harness({}, run.runId, {draftStorage: store.adapter, wallNow: () => 999999999});
    h.respond("raceResume", {run});
    /** A mutable observer cannot advance the server-issued private schedule. */
    const exposed = h.session.getSnapshot(); exposed.stage = "racing"; exposed.run!.status = "active"; exposed.run!.startsAtMs = 0; exposed.run!.serverNowMs = Number.MAX_SAFE_INTEGER; exposed.receivedAtMs = -999999;
    h.session.input("text", "pi");
    expect(h.session.getSnapshot().currentLetters).toEqual(["p", "i", "", "", ""]);
    expect(store.read()).toBeNull();
    expect(h.commands.map(command => command.type)).toEqual(["game:resumeRace"]);
  });
});
