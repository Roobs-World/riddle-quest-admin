import {describe, expect, it} from "@jest/globals";
import {racing} from "./raceSession.support.ts";

describe("Race Session private confirmed snapshot isolation", () => {
  it.each(["rules", "deck-answer", "prompt-answer", "event", "reveal"])("recovers canonical authority after a public %s reference is mutated", async kind => {
    /** Genuine paid progress establishes nested authority facts before external rendering reads them. */
    const h = await racing();h.session.hint();
    h.respond("raceHint", await h.authority.requestRaceHint({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "private-snapshot-hint"}));
    h.session.input("text", "i");
    /** Original authority remains independent of mutable consumer references. */
    const original = structuredClone(h.session.getSnapshot().run!);
    /** A renderer or adapter can retain nested fields from the stable public snapshot. */
    const publicRun = h.session.getSnapshot().run!;
    if (kind === "rules") publicRun.rules.maxHintsPerRiddle = 1;
    if (kind === "deck-answer") publicRun.preloadedRiddles![1].evaluation.answer = "clocx";
    if (kind === "prompt-answer") publicRun.currentRiddle!.evaluation!.answer = "ziano";
    if (kind === "event") publicRun.events[0].riddlePosition = 1;
    if (kind === "reveal") publicRun.currentRiddle!.revealedLetters[0].letter = "x";
    h.session.retry();h.respond("raceResume", await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, currentLetters: ["p", "i", "", "", ""], run: {rules: original.rules, preloadedRiddles: original.preloadedRiddles, currentRiddle: original.currentRiddle, events: original.events}});
    expect(h.commands.filter(command => command.type === "game:requestRaceHint")).toHaveLength(1);
  });
  it("rejects changed rules even when a consumer has already edited the same public field", async () => {
    /** Matching public edits cannot authorize changes to the private contract. */
    const h = await racing();h.session.getSnapshot().run!.rules.maxHintsPerRiddle = 1;h.session.retry();
    /** A cloned malformed receipt must be checked against the original owned rules. */
    const bad = structuredClone(await h.authority.resumeRace(h.run.runId));bad.run.rules.maxHintsPerRiddle = 1;
    h.respond("raceResume", bad);
    expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_INVALID_RESPONSE");
    h.session.retry();h.respond("raceResume", await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {rules: h.run.rules}});
  });
});
