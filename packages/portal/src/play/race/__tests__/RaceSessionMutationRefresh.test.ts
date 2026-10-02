import {describe, expect, it} from "@jest/globals";
import {racing} from "./raceSession.support";

describe("Race mutation recovery barrier", () => {
  it.each(["submit", "hint", "skip"] as const)("requires a canonical read before another mutation after lost %s delivery", async action => {
    /** Real authority fixture pins the original question and run contract. */
    const h = await racing();
    h.session.input("text", "zzzzz"); h.session[action](); h.advance(30000);
    h.session.input("slot", 0); h.session.input("letter", "A");
    expect(h.session.getSnapshot().currentLetters[0]).toBe("A");
    /** A lost response cannot establish whether the authority committed the command. */
    const sent = h.commands.length;
    h.session.submit(); h.session.hint(); h.session.skip();
    expect(h.commands).toHaveLength(sent);
    expect(h.session.getSnapshot()).toMatchObject({requiresRunRefresh: true, pending: null});
    h.session.retry(); expect(h.last().type).toBe("game:resumeRace");
    h.reject("raceResume", "offline");
    h.session.submit(); h.session.hint(); h.session.skip();
    expect(h.commands).toHaveLength(sent + 1);
    h.session.retry(); h.respond("raceResume", {run: h.run});
    expect(h.session.getSnapshot().requiresRunRefresh).toBe(false);
    h.session.submit(); expect(h.last().type).toBe("game:submitRaceGuess");
  });
  it("does not block gameplay for an unrelated optional provider error", async () => {
    /** Optional social presentation errors do not imply uncertain race authority. */
    const h = await racing(); h.session.reportError("optional sharing failed");
    h.session.input("text", "zzzzz"); h.session.submit();
    expect(h.last().type).toBe("game:submitRaceGuess");
  });
  it.each(["submit", "hint", "skip"] as const)("keeps failed %s delivery private when a consumer edits the recovery snapshot", async action => {
    /** Retained presentation objects must not grant another uncertain authority mutation. */
    const h = await racing(); h.session.input("text", "zzzzz"); h.session[action](); h.advance(30000);
    Reflect.set(h.session.getSnapshot(), "requiresRunRefresh", false);
    /** Private transport ownership remains unchanged by this presentation edit. */
    const count = h.commands.length;
    h.session.submit(); h.session.hint(); h.session.skip();
    expect(h.commands).toHaveLength(count);
    h.session.retry(); h.respond("raceResume", await h.authority.resumeRace(h.run.runId));
    h.session.submit(); expect(h.last().type).toBe("game:submitRaceGuess");
  });
});
