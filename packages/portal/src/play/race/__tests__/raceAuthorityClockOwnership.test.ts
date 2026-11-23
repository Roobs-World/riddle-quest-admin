import {expect, it} from "@jest/globals";
import type {GameToHostMessage} from "@riddle-quest/core/bridge";
import {RaceSession} from "../RaceSession";
import {catalog, fixture, preview} from "./raceSession.support";

/** Accepted run clocks must not let a retired receipt overwrite replacement state. */
it.each(["first", "second", "valid"])("retains authority ownership during %s clock read", async mode => {
  /** Count only clock observations made while processing the selected response. */
  let armed = false, observations = 0, sequence = 0;
  /** Actual bridge receipts remain independently acknowledgeable after replacement. */
  const commands: GameToHostMessage[] = [];
  /** Public clock seam replaces account during authority parsing or accepted run anchoring. */
  const session = new RaceSession({ownerId: "owner-1", locale: "en"}, {
    clock: {now: () => {
      if (armed && ++observations === (mode === "first" ? 1 : 2) && mode !== "valid") {
        armed = false; session.enter({ownerId: "owner-2", locale: "en", challengeId: "replacement"});
      }
      return 0;
    }, schedule: () => ++sequence, cancel: () => undefined},
    requestId: operation => `${operation}-${++sequence}`, postToHost: command => {commands.push(command);},
    persistence: {read: () => null, save: () => undefined, clear: () => undefined},
    recovery: {read: () => null, save: () => undefined, clear: () => undefined},
  });
  session.enter();
  /** Canonical catalog makes a normal prepared start available. */
  const initial = commands.at(-1)!;
  session.receive({type: "host:operationResult", requestId: initial.requestId, payload: {operation: "raceCategories", ok: true, data: await catalog()}});
  session.begin("mixed");
  /** Authority payload is prepared before arming the optional clock observation. */
  const start = commands.at(-1)!, run = await fixture(true);
  armed = true;
  session.receive({type: "host:operationResult", requestId: start.requestId, payload: {operation: "raceStart", ok: true, data: {run}}});
  armed = false;
  if (mode === "valid") expect(session.getSnapshot()).toMatchObject({stage: "countdown", run, error: null});
  else {
    expect(session.getSnapshot()).toMatchObject({stage: "challenge", activeChallengeId: "replacement", pending: "raceEntry", run: null, error: null});
    /** Independent replacement receipt still accepts its own authority selection. */
    const entry = commands.at(-1)!;
    expect(entry.type).toBe("game:getRaceEntry");
    session.receive({type: "host:operationResult", requestId: entry.requestId, payload: {operation: "raceEntry", ok: true,
      data: {status: "ready", challenge: preview("replacement"), viewerRole: "recipient", serverNowMs: 1000}}});
    expect(session.getSnapshot()).toMatchObject({stage: "challenge", activeChallengeId: "replacement", pending: null, error: null});
  }
  session.dispose();
});
