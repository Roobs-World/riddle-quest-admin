import {describe, expect, it} from "@jest/globals";
import {racing} from "./raceSession.support";

describe("Race Session confirmed event history", () => {
  it.each(["drop", "clock", "question"])("rejects resumed history that changes a confirmed event: %s", async kind => {
    /** A real paid hint establishes an authority-owned event before recovery. */
    const h = await racing();h.session.hint();
    h.respond("raceHint", await h.authority.requestRaceHint({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "confirmed-hint"}));
    h.session.input("text", "pi");
    /** Invalid transport must preserve both confirmed history and the current draft. */
    const before = h.session.getSnapshot();h.session.retry();
    /** The canonical run remains intact behind the deliberately altered reply. */
    const response = structuredClone(await h.authority.resumeRace(h.run.runId));
    if (kind === "drop") response.run.events = [];
    else if (kind === "question") response.run.events[0].riddlePosition = 1;
    else {response.run.events[0].wallElapsedMs += 1;response.run.events[0].adjustedElapsedMs += 1;}
    h.respond("raceResume", response);
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", run: before.run, currentLetters: before.currentLetters});
    h.session.retry();h.respond("raceResume", await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, currentLetters: before.currentLetters, run: {events: before.run!.events}});
  });
  it.each(["hint", "skip"] as const)("rejects a charged %s reply that rewrites an earlier paid event", async operation => {
    /** Paid acknowledgements must retain earlier events as well as prove the new charge. */
    const h = await racing();h.session.hint();
    h.respond("raceHint", await h.authority.requestRaceHint({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "first-hint"}));
    /** The provisional mutation may not replace its authority checkpoint with altered history. */
    const before = h.session.getSnapshot();h.session[operation]();
    /** New charge evidence is valid; only the original event's question is changed. */
    const input = {runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "second-paid"};
    /** Genuine authority commits the action exactly once despite a malformed acknowledgement. */
    const response = structuredClone(operation === "hint" ? await h.authority.requestRaceHint(input) : await h.authority.skipRaceRiddle(input));
    response.run.events[0].riddlePosition = 1;
    h.respond(operation === "hint" ? "raceHint" : "raceSkip", response);
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", run: before.run});
    h.session.retry();h.respond("raceResume", await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {events: [before.run!.events[0], expect.any(Object)]}});
    expect(h.commands.filter(command => command.type === (operation === "hint" ? "game:requestRaceHint" : "game:skipRaceRiddle"))).toHaveLength(operation === "hint" ? 2 : 1);
  });
  it("accepts an unchanged prefix followed by progress made in another tab", async () => {
    /** Confirmation pins only existing history, allowing canonical new events to append. */
    const h = await racing();h.session.hint();
    h.respond("raceHint", await h.authority.requestRaceHint({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "original-hint"}));
    /** Another tab advances independently before the next resume request. */
    const original = h.session.getSnapshot().run!.events[0];
    await h.authority.skipRaceRiddle({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "other-tab-skip"});
    h.session.retry();h.respond("raceResume", await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {correctCount: 1, currentRiddle: {position: 1}, events: [original, expect.objectContaining({type: "skip"})]}});
  });
});
