import {expect, it} from "@jest/globals";
import type {RaceRecovery} from "@riddle-quest/core/race";
import {catalog, harness, preview} from "./raceSession.support";

/** Optional retention time cannot transfer an old start intent into a replacement journey. */
it.each(["start-account", "start-navigation", "retry-account", "retry-navigation", "valid"])("preserves journal ownership during %s clock observation", async mode => {
  /** Observation replaces the journey once, before the old wall-clock call returns. */
  let armed = false;
  /** Shared journal exposes account-retargeted writes independently of host delivery. */
  let journal: RaceRecovery | null = null;
  /** Optional retention clock runs through the actual session recovery path. */
  const h = harness({}, null, {wallNow: () => {
    if (armed) {
      armed = false;
      if (mode.endsWith("navigation")) h.session.navigate("inbox");
      else if (mode !== "valid") h.session.enter({ownerId: "owner-2", locale: "en", challengeId: "replacement"});
    }
    return 1000;
  }, recovery: {read: () => journal, save: record => {journal = record;},
    clear: (owner, id) => {if (journal?.ownerId === owner && journal.id === id) journal = null;}}});
  h.respond("raceCategories", await catalog());
  if (mode.startsWith("retry")) {h.session.begin("mixed"); h.reject("raceStart", "lost-start");}
  /** Only dispatches from the attempted start or replay are compared. */
  const commandCount = h.commands.length;
  armed = true;
  if (mode.startsWith("retry")) h.session.retry();
  else h.session.begin("mixed");
  if (mode === "valid") {
    expect(h.last().type).toBe("game:startRace");
    expect(journal).toMatchObject({ownerId: "owner-1", intent: {kind: "start", request: {requestId: h.last().requestId}}});
  } else if (mode.endsWith("navigation")) {
    expect(journal).toBeNull();
    expect(h.commands.slice(commandCount).map(command => command.type)).toEqual(["game:listRaceInbox"]);
    expect(h.session.getSnapshot()).toMatchObject({stage: "inbox", pending: "raceInbox", error: null});
  } else {
    expect(journal).toMatchObject({ownerId: "owner-2", intent: {kind: "challenge", challengeId: "replacement"}});
    expect(h.commands.slice(commandCount).map(command => command.type)).toEqual(["game:getRaceEntry"]);
    h.respond("raceEntry", {status: "ready", challenge: preview("replacement"), viewerRole: "recipient", serverNowMs: 1000});
    expect(h.session.getSnapshot()).toMatchObject({activeChallengeId: "replacement", pending: null, error: null});
  }
  h.session.dispose();
});
