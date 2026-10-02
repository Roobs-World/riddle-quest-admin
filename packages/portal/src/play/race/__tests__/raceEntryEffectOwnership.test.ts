import {describe, expect, it} from "@jest/globals";
import {harness, preview} from "./raceSession.support";

describe("Entry recovery effect ownership", () => {
  it.each(["inbox", "replacement"] as const)("does not resume from a retired entry after analytics selects %s", mode => {
    /** Analytics retires exactly the first accepted entry, preserving replacement effects. */
    let armed = true;
    /** Public session callbacks may synchronously navigate or enter another account. */
    const h = harness({challengeId: "original"}, null, {effect: effect => {
      if (!armed || effect.kind !== "analytics" || effect.event !== "race_link_entered") return;
      armed = false;
      if (mode === "inbox") h.session.navigate("inbox");
      else {
        h.session.enter({locale: "en", ownerId: "replacement-owner", challengeId: "replacement"});
        h.respond("raceEntry", {status: "ready", challenge: preview("replacement"), existingRunId: "replacement-run", serverNowMs: 1000});
      }
    }});
    h.respond("raceEntry", {status: "ready", challenge: preview("original"), existingRunId: "original-run", serverNowMs: 1000});
    /** Only a still-owned entry may issue a recovery command. */
    const resumes = h.commands.filter(command => command.type === "game:resumeRace");
    if (mode === "inbox") {
      expect(resumes).toHaveLength(0);
      expect(h.session.getSnapshot()).toMatchObject({stage: "inbox", pending: "raceInbox"});
    } else {
      expect(resumes).toHaveLength(1);
      expect(resumes[0]).toMatchObject({payload: {runId: "replacement-run"}});
      expect(h.session.getSnapshot()).toMatchObject({pending: "raceResume", activeChallengeId: "replacement"});
    }
  });
  it("keeps automatic recovery when the analytics adapter throws", () => {
    /** Optional effect failure cannot suppress authority-confirmed recovery. */
    const h = harness({challengeId: "original"}, null, {effect: () => {throw new Error("optional analytics unavailable");}});
    h.respond("raceEntry", {status: "ready", challenge: preview("original"), existingRunId: "original-run", serverNowMs: 1000});
    expect(h.commands.filter(command => command.type === "game:resumeRace")).toHaveLength(1);
    expect(h.last()).toMatchObject({payload: {runId: "original-run"}});
  });
  it("does not continue expired-entry processing after recovery cleanup enters another account", () => {
    /** Storage cleanup can synchronously notify a replacement account selection. */
    let armed = true;
    /** Only the original cleanup performs the replacement; nested disposal remains harmless. */
    const h = harness({challengeId: "original"}, null, {recovery: {read: () => null, save: () => {}, clear: () => {
      if (!armed) return;
      armed = false;
      h.session.enter({ownerId: "replacement-owner", locale: "en", challengeId: "replacement"});
      h.respond("raceEntry", {status: "ready", challenge: preview("replacement"), existingRunId: "replacement-run", serverNowMs: 1000});
    }}});
    h.respond("raceEntry", {status: "expired", serverNowMs: 1000});
    expect(h.commands.filter(command => command.type === "game:resumeRace")).toHaveLength(1);
    expect(h.effects.filter(effect => effect.kind === "analytics" && effect.event === "race_link_entered")).toHaveLength(1);
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceResume", activeChallengeId: "replacement"});
  });
});
