import {describe, expect, it} from "@jest/globals";
import {projectRaceOutcome} from "../../presentation/racePresentation";
import {catalog, fixture, harness, preview, racing, withCorrectHistory} from "../../browser/controllers/__tests__/raceSession.support.ts";

describe("Race Session synchronous lifetime replacement", () => {
  it.each(["hint", "skip", "submit"] as const)("does not apply the old error after a %s rollback observer changes account", async operation => {
    /** Projection and rollback occur in the original authenticated lifetime. */
    const h = await racing(); h.session.input("text", "piano");
    /** Owned pre-action checkpoint identifies the rollback notification. */
    const before = h.session.getSnapshot(); h.session[operation]();
    /** Account replacement happens before the old rejection can publish its error. */
    let changed = false;
    /** Observer runs only once and leaves the replacement category request owned. */
    const unsubscribe = h.session.subscribe(() => {
      /** Rollback restores facts in a detached copy, rather than exposing the original reference. */
      const restored = h.session.getSnapshot().run;
      if (!changed && restored?.runId === before.run?.runId && restored?.correctCount === before.run?.correctCount &&
        restored?.totalPenaltyMs === before.run?.totalPenaltyMs) {
        expect(restored).toEqual(before.run);
        changed = true; h.session.enter({locale: "en", ownerId: "owner-2"});
      }
    });
    h.reject(operation === "hint" ? "raceHint" : operation === "skip" ? "raceSkip" : "raceGuess", "old-action-rejected"); unsubscribe();
    expect(changed).toBe(true);
    expect(h.session.getSnapshot()).toMatchObject({run: null, stage: "categories", pending: "raceCategories", error: null});
    expect(h.timers.size).toBe(1);
    h.respond("raceCategories", await catalog()); h.session.retry();
    expect(h.last().type).toBe("game:listRaceCategories");
  });
  it("does not retain an old start retry when an observer changes account during start acceptance", async () => {
    /** The second account owns a fresh category journey. */
    const h = harness(); h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Account change is triggered only by the old owned run becoming observable. */
    let changed = false;
    /** State observers must not cause old response cleanup to mutate the replacement lifetime. */
    const unsubscribe = h.session.subscribe(() => {
      if (!changed && h.session.getSnapshot().run) {changed = true; h.session.enter({locale: "en", ownerId: "owner-2"});}
    });
    h.respond("raceStart", {run: await fixture(true)}); unsubscribe();
    expect(h.session.getSnapshot()).toMatchObject({run: null, pending: "raceCategories", error: null});
    h.respond("raceCategories", await catalog()); h.session.retry();
    expect(h.last().type).toBe("game:listRaceCategories");
    expect(h.commands.filter(command => command.type === "game:startRace")).toHaveLength(1);
  });
  it.each(["start", "outcome", "publication"])("stops old %s effects when an earlier effect changes account", async phase => {
    /** Optional host effects may synchronously replace the account. */
    let armed = false;
    /** Effect adapter gets the actual public session after harness initialization. */
    let h: ReturnType<typeof harness>;
    h = harness({}, null, {effect: effect => {
      if (armed && effect.kind === "analytics" && effect.event === (phase === "start" ? "race_started" : phase === "outcome" ? "race_completed" : "race_challenge_published")) {
        armed = false; h.session.enter({locale: "en", ownerId: "owner-2"});
      }
    }});
    h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Real-shaped owned start and terminal response exercise accepted authority effects. */
    const run = await fixture();
    if (phase === "start") armed = true;
    h.respond("raceStart", {run});
    if (phase !== "start") {
      h.advance(3480); h.session.input("text", "piano"); h.session.submit();
      /** Terminal score belongs exclusively to the original account. */
      const completed = withCorrectHistory({...run, status: "completed", correctCount: 10, currentRiddle: null, wallElapsedMs: 60000, adjustedElapsedMs: 60000});
      h.respond("raceGuess", {run: completed, isCorrect: true, autoSkipped: false, feedback: [..."piano"].map(letter => ({letter, status: "green"}))});
      if (phase === "outcome") armed = true;
      h.respond("raceOutcome", projectRaceOutcome(completed, completed.adjustedElapsedMs)!);
      if (phase === "publication") {h.session.publish(); armed = true; h.respond("racePublish", {challengeId: "published", preview: preview("published")});}
    }
    expect(h.session.getSnapshot()).toMatchObject({run: null, stage: "categories", pending: "raceCategories", error: null});
    /** No old effect may be attributed to the replacement authenticated account. */
    const boundary = h.effects.findIndex(effect => effect.kind === "analytics" && effect.event ===
      (phase === "start" ? "race_started" : phase === "outcome" ? "race_completed" : "race_challenge_published"));
    expect(h.effects.slice(boundary + 1)).toEqual([]);
    h.respond("raceCategories", await catalog()); h.session.retry();
    expect(h.last().type).toBe("game:listRaceCategories");
  });
});
