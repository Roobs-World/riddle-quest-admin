import {describe, expect, it} from "@jest/globals";
import type {RaceRecovery} from "@qwordly/core/race";
import {createFakeRaceServices} from "../testing/fakeRaceServices";
import {catalog, fixture, harness, preview} from "./raceSession.support";

describe("Authority receipt observation retains its journey", () => {
  it.each(["catalog", "start", "resume", "guess", "hint", "skip", "valid"])("rejects replacement during %s parsing", async mode => {
    /** Ready and active authority fixtures retain canonical schemas and scoring evidence. */
    const authority = createFakeRaceServices();
    /** Paid and guess cases exercise the actual private projection/checkpoint module. */
    const active = ["guess", "hint", "skip"].includes(mode);
    /** Shared persistence observes only matching owners and exact cleanup revisions. */
    const journals = new Map<string, RaceRecovery>();
    /** The same authority fixture retains preparation and paid-action history. */
    const run = await fixture(!active && mode !== "resume", authority);
    /** Shared public seam remains independent of the optional active authority fixture. */
    const h = harness({}, mode === "resume" ? run.runId : null, {recovery: {
      read: owner => journals.get(owner ?? "") ?? null, save: record => {journals.set(record.ownerId, record);},
      clear: (owner, id) => {if (journals.get(owner ?? "")?.id === id) journals.delete(owner ?? "");},
    }});
    if (active) {h.respond("raceCategories", await catalog()); h.session.begin("mixed"); h.respond("raceStart", {run}); h.advance(3480);}
    /** Only the old receipt's first property observation replaces its account journey. */
    let armed = mode !== "valid";
    /** The replacement entry must keep its exact private command and public state. */
    const replace = () => {if (armed) {armed = false; h.session.enter({ownerId: "owner-2", locale: "en", challengeId: "replacement"});}};
    if (mode === "catalog") {
      /** Category parsing is pure but its patch still belongs to the original account. */
      const categories = (await catalog()).categories;
      h.respond("raceCategories", {get categories() {replace(); return categories;}});
    } else if (["start", "valid", "resume"].includes(mode)) {
      if (mode !== "resume") {h.respond("raceCategories", await catalog()); h.session.begin("mixed");}
      h.respond(mode === "resume" ? "raceResume" : "raceStart", {get run() {replace(); return run;}});
    } else {
      h.session.input("text", "wrong");
      /** Valid authority confirmations isolate lifecycle ownership from schema correctness. */
      const result = mode === "guess" ? await authority.submitRaceGuess({runId: run.runId, riddleId: run.currentRiddle!.riddleId, guess: "wrong", requestId: "observed-guess"}) :
        mode === "hint" ? await authority.requestRaceHint({runId: run.runId, riddleId: run.currentRiddle!.riddleId, requestId: "observed-hint"}) :
          await authority.skipRaceRiddle({runId: run.runId, riddleId: run.currentRiddle!.riddleId, requestId: "observed-skip"});
      if (mode === "guess") h.session.submit(); else if (mode === "hint") h.session.hint(); else h.session.skip();
      /** Run accessor fires during the schema parse before projection confirmation. */
      const data = {...result, get run() {replace(); return result.run;}};
      h.respond(mode === "guess" ? "raceGuess" : mode === "hint" ? "raceHint" : "raceSkip", data);
    }
    if (mode === "valid") expect(h.session.getSnapshot()).toMatchObject({stage: "countdown", run: {runId: run.runId}});
    else {
      expect(h.session.getSnapshot()).toMatchObject({stage: "challenge", activeChallengeId: "replacement", run: null, categories: [], pending: "raceEntry", error: null});
      expect(journals.get("owner-2")).toMatchObject({ownerId: "owner-2", intent: {kind: "challenge", challengeId: "replacement"}});
      h.respond("raceEntry", {status: "ready", challenge: preview("replacement"), viewerRole: "recipient", serverNowMs: 1000});
      expect(h.session.getSnapshot()).toMatchObject({stage: "challenge", activeChallengeId: "replacement", run: null, pending: null, error: null});
    }
  });
});
