import {expect, it} from "@jest/globals";
import type {GameToHostMessage} from "../../../../core/bridge";
import type {RaceRecovery} from "../../../../core/race";
import {RaceSession} from "../RaceSession";
import {catalog, fixture, preview} from "./raceSession.support";

/** Start receipt generation must retain its originating account before journaling. */
it.each(["replacement", "navigation", "retired-invalid", "valid"])("preserves recovery ownership during %s receipt creation", async mode => {
  /** The factory only reenters for the selected start, never its replacement command. */
  let armed = false, sequence = 0;
  /** Shared recovery exposes stale writes even when host delivery itself is suppressed. */
  let journal: RaceRecovery | null = null;
  /** Every actual outbound bridge command retains its own correlation receipt. */
  const commands: GameToHostMessage[] = [];
  /** Public session runs with deterministic time and account-bound optional storage. */
  const session = new RaceSession({ownerId: "owner-1", locale: "en"}, {
    clock: {now: () => 0, schedule: () => ++sequence, cancel: () => undefined}, wallNow: () => 1000,
    persistence: {read: () => null, save: () => undefined, clear: () => undefined},
    recovery: {read: owner => journal?.ownerId === owner ? journal : null, save: record => {journal = record;},
      clear: (owner, id) => {if (journal?.ownerId === owner && journal.id === id) journal = null;}},
    postToHost: command => {commands.push(command);},
    requestId: operation => {
      /** Capture the receipt before its factory changes the active journey. */
      const id = `${operation}-${++sequence}`;
      if (armed && operation === "raceStart") {
        armed = false;
        if (mode === "navigation") session.navigate("inbox");
        else if (mode !== "valid") session.enter({ownerId: "owner-2", locale: "en", challengeId: "replacement"});
        if (mode === "retired-invalid") return "bad";
      }
      return id;
    },
  });
  session.enter();
  /** Catalog acknowledgment makes the real public start action available. */
  const initial = commands.at(-1)!;
  session.receive({type: "host:operationResult", requestId: initial.requestId, payload: {operation: "raceCategories", ok: true, data: await catalog()}});
  armed = true;
  expect(() => session.begin("mixed")).not.toThrow();
  if (mode === "valid") {
    expect(commands.at(-1)?.type).toBe("game:startRace");
    expect(journal).toMatchObject({ownerId: "owner-1", intent: {kind: "start", request: {requestId: commands.at(-1)?.requestId}}});
    /** Still-owned receipt accepts a canonical preparation response. */
    const start = commands.at(-1)!;
    session.receive({type: "host:operationResult", requestId: start.requestId, payload: {operation: "raceStart", ok: true, data: {run: await fixture(true)}}});
    expect(session.getSnapshot()).toMatchObject({stage: "countdown", error: null});
  } else if (mode === "navigation") {
    expect(commands.at(-1)?.type).toBe("game:listRaceInbox");
    expect(journal).toBeNull();
  } else {
    expect(commands.at(-1)?.type).toBe("game:getRaceEntry");
    expect(journal).toMatchObject({ownerId: "owner-2", intent: {kind: "challenge", challengeId: "replacement"}});
    /** Replacement entry independently consumes its own response and retained journal. */
    const entry = commands.at(-1)!;
    session.receive({type: "host:operationResult", requestId: entry.requestId, payload: {operation: "raceEntry", ok: true,
      data: {status: "ready", challenge: preview("replacement"), viewerRole: "recipient", serverNowMs: 1000}}});
    expect(session.getSnapshot()).toMatchObject({activeChallengeId: "replacement", pending: null, error: null});
  }
  session.dispose();
});
