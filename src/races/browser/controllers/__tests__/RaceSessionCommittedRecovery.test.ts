import {describe, expect, it} from "@jest/globals";
import {racing} from "./raceSession.support.ts";

describe("Committed race mutation with lost response", () => {
  it.each(["wrong", "correct", "hint", "skip"] as const)("reconciles committed %s without a second mutation", async action => {
    /** Independent authority owns mutation receipts and the later resume view. */
    const h = await racing();
    h.session.input("text", action === "correct" ? "piano" : "zzzzz");
    if (action === "hint") h.session.hint();
    else if (action === "skip") h.session.skip();
    else h.session.submit();
    /** The original command commits at authority, but its reply never reaches the session. */
    const requestId = h.last().requestId!, input = {runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId};
    if (action === "hint") await h.authority.requestRaceHint(input);
    else if (action === "skip") await h.authority.skipRaceRiddle(input);
    else await h.authority.submitRaceGuess({...input, guess: action === "correct" ? "piano" : "zzzzz"});
    if (action === "correct") h.session.input("text", "clo");
    h.advance(30000);
    /** All gameplay actions wait for committed canonical progress, regardless of the projected clue. */
    const count = h.commands.length;
    h.session.submit(); h.session.hint(); h.session.skip();
    expect(h.commands).toHaveLength(count);
    h.session.retry(); expect(h.last().type).toBe("game:resumeRace");
    /** Recovery obtains the independently committed view through the read seam. */
    const canonical = await h.authority.resumeRace(h.run.runId);
    h.respond("raceResume", canonical);
    expect(h.session.getSnapshot()).toMatchObject({error: null, pending: null, requiresRunRefresh: false, run: canonical.run});
    expect(h.commands).toHaveLength(count + 1);
    if (action === "wrong") expect(h.session.getSnapshot().run?.currentRiddle?.guessesUsed).toBe(1);
    if (action === "correct") expect(h.session.getSnapshot().currentLetters).toEqual(["c", "l", "o", "", ""]);
    if (action === "hint") {
      expect(h.session.getSnapshot().run?.totalPenaltyMs).toBe(15000);
      expect(h.session.getSnapshot().currentLetters[0]).toBe("p");
    }
    if (action === "skip") {
      expect(h.session.getSnapshot().run?.totalPenaltyMs).toBe(45000);
      expect(h.session.getSnapshot().currentLetters).toEqual(["", "", "", "", ""]);
    }
  });
});
