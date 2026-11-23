import {describe, expect, it} from "@jest/globals";
import {catalog, fixture, harness} from "../../controllers/__tests__/raceSession.support.ts";

/** Starts a challenger after its first confirmed hint, before the next charged reveal. */
const hinted = async (terminal: boolean) => {
  /** The original private answer and reveal remain independent of later public edits. */
  const run = {...await fixture(), role: "challenger" as const, challengeId: "hint-evidence",
    opponent: {displayName: "Nova", adjustedFinishMs: terminal ? 20000 : 100000, events: []}};
  run.wallElapsedMs = 0; run.serverNowMs = run.startsAtMs;
  run.totalPenaltyMs = run.adjustedElapsedMs = run.rules.hintPenaltyMs;
  run.currentRiddle!.revealedLetters = [{index: 0, letter: "p"}];
  run.events = [{sequence: 0, type: "hint", riddlePosition: 0, wallElapsedMs: 0,
    penaltyAddedMs: run.rules.hintPenaltyMs, totalPenaltyMs: run.rules.hintPenaltyMs,
    adjustedElapsedMs: run.rules.hintPenaltyMs, correctCount: 0}];
  /** Public session receives the genuine previously paid question. */
  const h = harness(); h.respond("raceCategories", await catalog()); h.session.begin("mixed", run.challengeId);
  h.respond("raceStart", {run}); h.advance(3480);
  return {...h, run};
};

describe("Paid hint reveal evidence", () => {
  it.each(["live-reused", "terminal-reused", "terminal-letter", "terminal-public-letter", "live-valid", "terminal-valid"])("validates %s before consuming the checkpoint", async mode => {
    /** Only a terminal charge removes the editable prompt from the response. */
    const terminal = mode.startsWith("terminal"), h = await hinted(terminal);
    if (mode === "terminal-public-letter") h.session.getSnapshot().run!.currentRiddle!.evaluation!.answer = "pzano";
    h.session.hint();
    /** Coherent history proves a second charge but not fabricated reveal metadata. */
    const penalty = h.run.rules.hintPenaltyMs * 2;
    /** Canonical response reveals the next unrevealed answer slot. */
    const response = {run: {...h.run, status: terminal ? "completed" as const : "active" as const,
      currentRiddle: terminal ? null : {...h.run.currentRiddle!, revealedLetters: [{index: 0, letter: "p"}, {index: 1, letter: "i"}]},
      totalPenaltyMs: penalty, adjustedElapsedMs: penalty,
      events: [...h.run.events, {sequence: 1, type: "hint" as const, riddlePosition: 0, wallElapsedMs: 0,
        penaltyAddedMs: h.run.rules.hintPenaltyMs, totalPenaltyMs: penalty, adjustedElapsedMs: penalty, correctCount: 0}]},
      index: mode.endsWith("reused") ? 0 : 1, revealedLetter: mode.endsWith("reused") ? "p" : mode.endsWith("letter") ? "z" : "i"};
    h.respond("raceHint", response);
    if (mode.endsWith("valid")) expect(h.session.getSnapshot().error).toBeNull();
    else {
      expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_INVALID_RESPONSE");
      expect(h.session.getSnapshot().run?.totalPenaltyMs).toBe(h.run.rules.hintPenaltyMs);
      expect(h.commands.filter(command => command.type === "game:getRaceOutcome")).toHaveLength(0);
      h.session.retry(); h.respond("raceResume", {run: response.run});
      expect(h.session.getSnapshot().error).toBeNull();
    }
  });
});
