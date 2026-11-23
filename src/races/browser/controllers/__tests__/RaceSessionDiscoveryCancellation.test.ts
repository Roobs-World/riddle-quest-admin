import {describe, expect, it} from "@jest/globals";
import type {MatchmakingCapability, MatchmakingResult} from "../../../../platform/contracts/capabilities";
import {catalog, fixture, harness, preview} from "./raceSession.support.ts";

describe("Discovery capability cancellation", () => {
  it.each(["removed", "replaced"] as const)("releases a stalled search on the next tick when %s", async mode => {
    /** Late SDK completion remains externally controlled after its search has ended. */
    let resolve!: (result: MatchmakingResult) => void;
    /** Original provider does not resolve before capability retirement. */
    const first: MatchmakingCapability = {find: () => new Promise(yes => {resolve = yes;})};
    /** Replacement may be searched only after a new player intent. */
    let replacementCalls = 0;
    /** Current selected capability can disappear while a provider waits forever. */
    let selected: MatchmakingCapability | undefined = first;
    /** Replacement reports cancellation so the fixture cannot create another run. */
    const second: MatchmakingCapability = {find: async () => {replacementCalls++; return {status: "cancelled"};}};
    /** Tick uses the same live resolver as real rendered multiplayer. */
    const h = harness({}, null, {getMatchmaking: () => selected});
    h.respond("raceCategories", await catalog());
    /** Retired wait must finish without advancing to its delivery deadline. */
    const pending = h.session.findOpponent(first);
    selected = mode === "removed" ? undefined : second;
    h.advance(50);
    await new Promise(yes => setTimeout(yes, 0));
    expect(h.session.getSnapshot()).toMatchObject({findingOpponent: false, matchSearchStatus: "idle", error: null});
    expect(h.timers.size).toBe(0);
    expect(replacementCalls).toBe(0);
    await pending;
    resolve({status: "success", value: {status: "matched", challenge: preview()}});
    await Promise.resolve();
    expect(h.session.getSnapshot()).toMatchObject({stage: "categories", challenge: null, matchSearchStatus: "idle"});
  });
  it("does not cancel a replacement account search created by a resolver callback", async () => {
    /** Original SDK remains pending until entry replacement cancels its wait. */
    const first: MatchmakingCapability = {find: () => new Promise(() => {})};
    /** Replacement SDK completion is independently controlled. */
    let resolve!: (result: MatchmakingResult) => void;
    /** New provider's live wait must survive the retired tick continuation. */
    const second: MatchmakingCapability = {find: () => new Promise(yes => {resolve = yes;})};
    /** Resolver side effects are armed only after the original search begins. */
    let armed = false, selected = first;
    /** Replacement search remains observable through its own promise. */
    let replacement!: Promise<void>;
    /** Existing session is assigned before the callback may reenter it. */
    let h!: ReturnType<typeof harness>;
    /** Valid catalog is retained before the optional resolver can reenter synchronously. */
    const categories = await catalog();
    h = harness({}, null, {getMatchmaking: () => {
      if (armed) {
        armed = false; selected = second;
        h.session.enter({ownerId: "owner-2", locale: "en"});
        h.respond("raceCategories", categories);
        replacement = h.session.findOpponent(second);
      }
      return selected;
    }});
    h.respond("raceCategories", await catalog());
    /** A retired tick must use the originally captured cancellation function. */
    const pending = h.session.findOpponent(first);
    armed = true; h.advance(50); await pending;
    expect(h.session.getSnapshot()).toMatchObject({findingOpponent: true, matchSearchStatus: "searching"});
    expect(h.timers.size).toBe(1);
    resolve({status: "cancelled"}); await replacement;
    expect(h.session.getSnapshot()).toMatchObject({findingOpponent: false, matchSearchStatus: "idle"});
  });
  it("preserves an active race and typed input when matchmaking disappears", async () => {
    /** A selectable provider exists when the independent run starts. */
    let selected: MatchmakingCapability | undefined = {find: async () => ({status: "cancelled"})};
    /** Canonical gameplay is independent of later discovery capability changes. */
    const h = harness({}, null, {getMatchmaking: () => selected});
    h.respond("raceCategories", await catalog());
    h.session.begin("mixed");
    /** Authority confirms the current competitive attempt. */
    const run = await fixture();
    h.respond("raceStart", {run}); h.advance(3480);
    h.session.input("letter", "A");
    selected = undefined; h.advance(50);
    expect(h.session.getSnapshot()).toMatchObject({stage: "racing", run: {runId: run.runId}, currentLetters: ["A", "", "", "", ""]});
  });
});
