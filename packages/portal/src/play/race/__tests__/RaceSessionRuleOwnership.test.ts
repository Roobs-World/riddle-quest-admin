import {describe, expect, it} from "@jest/globals";
import {RACE_RULES} from "@riddle-quest/core/race";
import {catalog, fixture, harness, racing} from "./raceSession.support";
import {createFakeRaceServices} from "../testing/fakeRaceServices";

describe("Race Session immutable rule ownership", () => {
  it.each([1, RACE_RULES.maxHintsPerRiddle] as const)("rejects rule replacement on resume from hint limit %s", async limit => {
    /** Compatible rule versions are accepted independently on first ownership. */
    const h = harness();h.respond("raceCategories", await catalog());h.session.begin("mixed");
    /** Each new run owns its recorded rules rather than a later server default. */
    const run = await fixture();run.rules = {...run.rules, maxHintsPerRiddle: limit};
    h.respond("raceStart", {run});h.advance(3480);
    expect(h.session.getSnapshot()).toMatchObject({error: null, stage: "racing"});
    h.session.input("text", "pi");h.session.retry();
    /** Both replacement rule sets are individually schema-valid for an untouched prompt. */
    const changed = structuredClone(run);changed.rules.maxHintsPerRiddle = limit === 1 ? RACE_RULES.maxHintsPerRiddle : 1;
    h.respond("raceResume", {run: changed});
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", run: {rules: {maxHintsPerRiddle: limit}}, currentLetters: ["p", "i", "", "", ""]});
    h.session.retry();h.respond("raceResume", {run});
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {rules: {maxHintsPerRiddle: limit}}, currentLetters: ["p", "i", "", "", ""]});
  });
  it.each(["hint", "skip"] as const)("rejects rule replacement before consuming a %s checkpoint", async operation => {
    /** A valid canonical paid mutation remains recoverable after transport changes its rules. */
    const h = await racing();h.session.input("text", "pi");
    /** Original paid draft and rules belong to the same authority checkpoint. */
    const before = h.session.getSnapshot();h.session[operation]();
    /** Actual authority commits the mutation once with the original hint budget. */
    const input = {runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "rule-paid"};
    /** Corruption does not alter the canonical source used by recovery. */
    const bad = structuredClone(operation === "hint" ? await h.authority.requestRaceHint(input) : await h.authority.skipRaceRiddle(input));
    bad.run.rules.maxHintsPerRiddle = 1;
    if (operation === "hint") bad.run.currentRiddle!.hintAvailable = false;
    h.respond(operation === "hint" ? "raceHint" : "raceSkip", bad);
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", run: before.run, currentLetters: before.currentLetters});
    h.session.retry();h.respond("raceResume", await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {rules: RACE_RULES, totalPenaltyMs: operation === "hint" ? 15000 : 45000}});
    expect(h.commands.filter(command => command.type === (operation === "hint" ? "game:requestRaceHint" : "game:skipRaceRiddle"))).toHaveLength(1);
  });
  it("rejects readiness that replaces already owned preparation rules", async () => {
    /** Compatible legacy preparation pins its hint budget before scheduling. */
    const authority = createFakeRaceServices();
    /** The readiness adapter is deliberately modeled as a newer compatible server revision. */
    const prepared = await fixture(true, authority);prepared.rules = {...prepared.rules, maxHintsPerRiddle: 1};
    /** Public ownership exists before the first ready acknowledgement. */
    const h = harness();h.respond("raceCategories", await catalog());h.session.begin("mixed");h.respond("raceStart", {run: prepared});
    expect(h.session.getSnapshot()).toMatchObject({error: null, pending: "raceReady"});
    /** Individually valid scheduling cannot silently increase a previously recorded budget. */
    const ready = await authority.readyRace({runId: prepared.runId});
    h.respond("raceReady", ready);
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", run: {status: "prepared", rules: {maxHintsPerRiddle: 1}}});
    h.session.retry();h.respond("raceReady", {run: {...ready.run, rules: prepared.rules}});
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {status: "scheduled", rules: {maxHintsPerRiddle: 1}}});
  });
  it.each([1, RACE_RULES.maxHintsPerRiddle] as const)("preserves unchanged recorded hint limit %s", async limit => {
    /** Existing supported rule sets remain usable independently of current defaults. */
    const run = await fixture();run.rules = {...run.rules, maxHintsPerRiddle: limit};
    /** Unchanged read authority retains the player's local draft. */
    const h = harness();h.respond("raceCategories", await catalog());h.session.begin("mixed");h.respond("raceStart", {run});h.advance(3480);
    h.session.input("text", "pi");h.session.retry();h.respond("raceResume", {run: structuredClone(run)});
    expect(h.session.getSnapshot()).toMatchObject({error: null, stage: "racing", run: {rules: {maxHintsPerRiddle: limit}}, currentLetters: ["p", "i", "", "", ""]});
  });
});
