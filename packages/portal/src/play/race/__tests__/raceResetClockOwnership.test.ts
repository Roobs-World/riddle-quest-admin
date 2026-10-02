import {expect, it} from "@jest/globals";
import type {GameToHostMessage} from "@qwordly/core/bridge";
import {RaceSession} from "../RaceSession";
import {catalog, preview} from "./raceSession.support";

/** Fresh snapshot resets cannot publish after their clock callback replaces the journey. */
it.each(["entry", "rematch", "valid"])("preserves replacement state during %s reset clock", async mode => {
  /** Only the chosen reset clock observation triggers one account replacement. */
  let armed = false, sequence = 0;
  /** Correlated commands prove the replacement receipt remains independently usable. */
  const commands: GameToHostMessage[] = [];
  /** Real session executes reset and transport through a deterministic public clock seam. */
  const session = new RaceSession({ownerId: "owner-1", locale: "en"}, {
    clock: {now: () => {
      if (armed) {armed = false; if (mode !== "valid") session.enter({ownerId: "owner-2", locale: "en", challengeId: "replacement"});}
      return 0;
    }, schedule: () => ++sequence, cancel: () => undefined},
    requestId: operation => `${operation}-${++sequence}`, postToHost: command => {commands.push(command);},
    persistence: {read: () => null, save: () => undefined, clear: () => undefined},
    recovery: {read: () => null, save: () => undefined, clear: () => undefined},
  });
  session.enter();
  /** Loaded catalog distinguishes a retired rematch reset from the replacement's empty catalog. */
  const initial = commands.at(-1)!;
  session.receive({type: "host:operationResult", requestId: initial.requestId, payload: {operation: "raceCategories", ok: true, data: await catalog()}});
  armed = true;
  if (mode === "entry") session.enter({ownerId: "discarded", locale: "en"});
  else session.rematch();
  if (mode === "valid") {expect(session.getSnapshot()).toMatchObject({stage: "categories", pending: null, error: null}); expect(session.getSnapshot().categories.length).toBeGreaterThan(0);}
  else {
    expect(commands.at(-1)?.type).toBe("game:getRaceEntry");
    expect(session.getSnapshot()).toMatchObject({stage: "challenge", activeChallengeId: "replacement", pending: "raceEntry", categories: [], error: null});
    /** Replacement response must reconcile with the still-intact challenge presentation. */
    const entry = commands.at(-1)!;
    session.receive({type: "host:operationResult", requestId: entry.requestId, payload: {operation: "raceEntry", ok: true,
      data: {status: "ready", challenge: preview("replacement"), viewerRole: "recipient", serverNowMs: 1000}}});
    expect(session.getSnapshot()).toMatchObject({stage: "challenge", activeChallengeId: "replacement", pending: null, error: null});
  }
  session.dispose();
});
