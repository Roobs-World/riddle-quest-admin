import {describe, expect, it} from "@jest/globals";
import type {GameToHostMessage} from "../../../../core/bridge";
import {RacePlay, type RacePlayClock} from "../RacePlay";
import {RaceSession} from "../RaceSession";
import {catalog, preview} from "./raceSession.support";

/** Clock and receipt adapters can synchronously install another operation through the public seam. */
const seam = () => {
  /** Timer identities remain distinct from correlated mutation receipts. */
  let timerId = 0, receiptId = 0;
  /** Each observation callback fires once before its replacement adapter is used. */
  let hook: (() => void) | undefined, phase = "";
  /** Pending resource ownership is observable without private module access. */
  const timers = new Map<number, () => void>();
  /** Public commands expose any retired operation dispatched after replacement. */
  const commands: GameToHostMessage[] = [];
  /** One-shot adapter notification avoids recursive replacement. */
  const notify = (observed: string) => {if (phase === observed && hook) {
  /** One-shot timer callback is detached before reentrant delivery replacement. */
  const action = hook; hook = undefined; action();}};
  /** Real clock contract retains callbacks even if scheduling/cancellation reenters. */
  const clock: RacePlayClock = {now: () => 0,
    schedule: callback => {
    /** Unique timer or mutation receipt identifies ownership independently of replacement callbacks. */
    const id = ++timerId; timers.set(id, callback); notify("schedule"); return id;},
    cancel: id => {timers.delete(id); notify("cancel");},
  };
  /** Default delivery expiry remains enabled for owned timer assertions. */
  const play = new RacePlay({clock, postToHost: command => {commands.push(command);},
    requestId: operation => {
    /** Unique timer or mutation receipt identifies ownership independently of replacement callbacks. */
    const id = `${operation}-${++receiptId}`; notify("receipt"); return id;}, onDeliveryFailure: () => undefined});
  return {play, clock, commands, timers, observe: (at: string, action: () => void) => {phase = at; hook = action;}};
};

describe("Race timer ownership under adapter reentry", () => {
  it.each(["acknowledge", "send", "dispose", "schedule", "receipt", "loader"])("preserves replacement during %s", mode => {
    /** Real delivery module runs against deterministic reentrant adapters. */
    const h = seam();
    /** Replacement command becomes the only live owner of its deadline and pending state. */
    const replace = () => {h.play.dispose(); h.play.send("raceEntry", "game:getRaceEntry", {challengeId: "replacement", locale: "en"});};
    if (["schedule", "receipt"].includes(mode)) {
      h.observe(mode, replace); h.play.send("raceCategories", "game:listRaceCategories", {locale: "en"});
    } else if (mode === "loader") {
      h.play.send("raceGuess", "game:submitRaceGuess", {runId: "old", riddleId: "old", guess: "wrong"});
      h.play.acceptResponse(h.commands[0].requestId, "raceGuess"); h.play.finish("raceGuess");
      h.observe("cancel", replace); h.play.send("raceGuess", "game:submitRaceGuess", {runId: "old", riddleId: "old", guess: "wrong"});
    } else {
      h.play.send("raceCategories", "game:listRaceCategories", {locale: "en"}); h.observe("cancel", replace);
      if (mode === "acknowledge") expect(h.play.acceptResponse(h.commands[0].requestId, "raceCategories")).toBe(false);
      else if (mode === "send") h.play.send("raceInbox", "game:listRaceInbox", {limit: 20});
      else h.play.dispose();
    }
    expect(h.commands.at(-1)?.type).toBe("game:getRaceEntry");
    expect(h.play.getSnapshot()).toMatchObject({pending: "raceEntry", raceGuessLoading: false});
    expect(h.timers.size).toBe(1);
    expect(h.play.acceptResponse(h.commands.at(-1)?.requestId, "raceEntry")).toBe(true);
    h.play.finish("raceEntry"); expect(h.play.getSnapshot().pending).toBeNull(); expect(h.timers.size).toBe(0);
  });
  it("preserves the replacement session command when acknowledgement cancels the old deadline", async () => {
    /** Session-level receipt ownership must survive the same clock callback as RacePlay. */
    const h = seam();
    /** Real session binds its command privately to the selected account. */
    const session = new RaceSession({ownerId: "owner-1", locale: "en"}, {clock: h.clock,
      postToHost: command => {h.commands.push(command);}, persistence: {read: () => null, save: () => undefined, clear: () => undefined},
      recovery: {read: () => null, save: () => undefined, clear: () => undefined}});
    session.enter();
    /** Original receipt is captured before cancellation enters the replacement. */
    const old = h.commands[0]; h.observe("cancel", () => session.enter({ownerId: "owner-2", locale: "en", challengeId: "replacement"}));
    session.receive({type: "host:operationResult", requestId: old.requestId, payload: {operation: "raceCategories", ok: true, data: await catalog()}});
    expect(session.getSnapshot()).toMatchObject({stage: "challenge", activeChallengeId: "replacement", pending: "raceEntry", categories: [], error: null});
    /** Replacement entry still accepts its own correlated authority response. */
    const current = h.commands.at(-1)!;
    session.receive({type: "host:operationResult", requestId: current.requestId, payload: {operation: "raceEntry", ok: true,
      data: {status: "ready", challenge: preview("replacement"), viewerRole: "recipient", serverNowMs: 1000}}});
    expect(session.getSnapshot()).toMatchObject({stage: "challenge", activeChallengeId: "replacement", pending: null, error: null});
    expect(h.timers.size).toBe(0);
  });
});
