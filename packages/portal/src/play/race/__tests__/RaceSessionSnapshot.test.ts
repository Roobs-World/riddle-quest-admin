import {describe, expect, it} from "@jest/globals";
import type {RaceRunView} from "@riddle-quest/core/race";
import {createFakeRaceServices} from "../testing/fakeRaceServices";
import {catalog, fixture, harness, racing} from "./raceSession.support";

/** Shape-valid corruptions exercise content checks beyond the shared transport schema. */
const corrupt = (run: RaceRunView, kind: string): void => {
  /** Deck entry independent of the editable first question. */
  const riddle = run.preloadedRiddles![1];
  if (kind === "position") riddle.position = 0;
  if (kind === "locale") riddle.evaluation.locale = "fr";
  if (kind === "length") riddle.answerLength += 1;
  if (kind === "hint-index") riddle.hint = {index: riddle.answerLength, letter: "c"};
  if (kind === "hint-letter") riddle.hint = {index: 0, letter: "z"};
  if (kind === "prompt-text") run.currentRiddle!.text = "A different clue";
  if (kind === "prompt-answer") run.currentRiddle!.evaluation!.answer = "ziano";
  if (kind === "prompt-locale") run.currentRiddle!.evaluation!.locale = "fr";
  if (kind === "reveal") run.currentRiddle!.revealedLetters = [{index: 0, letter: "z"}];
  if (kind === "changed-deck") riddle.text = "A replacement clue";
  if (kind === "changed-answer") riddle.evaluation.answer = "clocx";
  if (kind === "changed-start") run.startsAtMs! += 1;
};

describe("Race Session immutable snapshot ownership", () => {
  it.each(["position", "locale", "length", "hint-index", "hint-letter", "prompt-text", "prompt-answer", "prompt-locale", "reveal"])("rejects an incoherent first snapshot before entering gameplay: %s", async kind => {
    /** Original preparation selection survives malformed content delivery. */
    const h = harness(); h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Valid authority fixture is cloned before the transport corruption. */
    const run = await fixture(); corrupt(run, kind); h.respond("raceStart", {run});
    expect(h.session.getSnapshot()).toMatchObject({run: null, stage: "categories", error: "RaceTo10.ERROR_INVALID_RESPONSE"});
    expect(h.saved).toEqual([]); expect(h.effects.some(effect => effect.kind === "outcome")).toBe(false);
  });
  it.each(["guess", "hint", "skip", "resume"] as const)("retains %s recovery when content or schedule changes in its receipt", async operation => {
    for (const kind of ["changed-deck", "changed-answer", "changed-start"]) {
      /** A single real authority owns both the initial run and later mutations. */
      const h = await racing(); h.session.input("text", operation === "guess" ? "piano" : "zzzzz");
      /** Original draft is retained before any provisional transition. */
      const original = h.session.getSnapshot();
      /** Matching mutation or resume response remains available for read recovery. */
      let response: {
        /** Confirmed authority view before transport corruption. */
        run: RaceRunView;
      };
      if (operation === "guess") {
        h.session.submit(); h.session.input("text", "clo");
        response = await h.authority.submitRaceGuess({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, guess: "piano", requestId: "actual-guess"});
      } else if (operation === "hint") {
        h.session.hint(); response = await h.authority.requestRaceHint({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "actual-hint"});
      } else if (operation === "skip") {
        h.session.skip(); response = await h.authority.skipRaceRiddle({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "actual-skip"});
      } else {h.session.retry(); response = await h.authority.resumeRace(h.run.runId);}
      /** Corruption must not modify the authority's genuine run or mutation history. */
      const invalid = structuredClone(response); corrupt(invalid.run, kind);
      h.respond(operation === "guess" ? "raceGuess" : operation === "hint" ? "raceHint" : operation === "skip" ? "raceSkip" : "raceResume", invalid);
      expect(h.session.getSnapshot()).toMatchObject({run: original.run, currentLetters: original.currentLetters, error: "RaceTo10.ERROR_INVALID_RESPONSE"});
      h.session.retry(); h.respond("raceResume", await h.authority.resumeRace(h.run.runId));
      expect(h.session.getSnapshot().error).toBeNull();
      expect(h.commands.filter(command => command.type === "game:submitRaceGuess" || command.type === "game:requestRaceHint" || command.type === "game:skipRaceRiddle")).toHaveLength(operation === "resume" ? 0 : 1);
      if (operation === "guess") expect(h.session.getSnapshot().currentLetters).toEqual(["c", "l", "o", "", ""]);
    }
  });
  it("keeps immutable ownership privately across answer-free views without repopulating their payload", async () => {
    /** A compatible legacy reply can omit optional evaluation content. */
    const h = await racing(); h.session.hint();
    /** Actual paid confirmation remains internally consistent with the original deck. */
    const hint = await h.authority.requestRaceHint({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "hint"});
    Reflect.deleteProperty(hint.run, "preloadedRiddles"); Reflect.deleteProperty(hint.run.currentRiddle!, "evaluation");
    h.respond("raceHint", hint);
    expect(h.session.getSnapshot().error).toBeNull(); expect(h.session.getSnapshot().run?.preloadedRiddles).toBeUndefined();
    h.session.skip();
    /** A later evaluation-enabled reply cannot replace the privately pinned deck. */
    const skip = await h.authority.skipRaceRiddle({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, requestId: "skip"});
    corrupt(skip.run, "changed-deck"); h.respond("raceSkip", skip);
    expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_INVALID_RESPONSE");
    h.session.retry(); h.respond("raceResume", await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {correctCount: 1, totalPenaltyMs: 60000}});
  });
  it.each(["raceGuess", "raceResume"])("accepts coherent progress from another tab without attaching the provisional draft: %s", async operation => {
    /** The server can legitimately advance beyond the locally predicted successor. */
    const h = await racing(); h.session.input("text", "piano"); h.session.submit(); h.session.input("text", "clo");
    /** Two real authority mutations advance to the third immutable question. */
    const first = await h.authority.submitRaceGuess({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId, guess: "piano", requestId: "first"});
    /** Another tab completes the successor before this tab receives its confirmation. */
    const second = await h.authority.submitRaceGuess({runId: h.run.runId, riddleId: first.run.currentRiddle!.riddleId, guess: "clock", requestId: "other-tab"});
    if (operation === "raceResume") {h.reject("raceGuess", "lost-reply"); h.session.retry();}
    h.respond(operation, operation === "raceResume" ? {run: second.run} : {...first, run: second.run});
    expect(h.session.getSnapshot()).toMatchObject({error: null, currentLetters: ["", "", "", "", ""], raceGuesses: [], run: {correctCount: 2, currentRiddle: {position: 2}}});
  });
  it("permits a new attempt to own revised content after rematch", async () => {
    /** Previous content cannot pin a different player intent forever. */
    const h = await racing(); h.session.rematch(); h.session.begin("mixed");
    /** A new authority-issued run may use newly published content. */
    const run = await fixture(); run.runId = "new-run"; corrupt(run, "changed-deck");
    h.respond("raceStart", {run}); h.advance(3480);
    expect(h.session.getSnapshot()).toMatchObject({error: null, stage: "racing", run: {runId: "new-run"}});
  });
  it("compares normalized grapheme reveals rather than UTF-16 length", async () => {
    /** Combining characters remain valid server-authored answer content. */
    const h = harness(); h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Equivalent NFC/decomposed letters refer to the same answer slot. */
    const run = await fixture();
    Object.assign(run.preloadedRiddles![0], {answerLength: 2, evaluation: {answer: "e\u0301x", locale: "en"}, hint: {index: 0, letter: "é"}});
    Object.assign(run.currentRiddle!, {answerLength: 2, evaluation: {answer: "e\u0301x", locale: "en"}, revealedLetters: [{index: 0, letter: "e\u0301"}]});
    h.respond("raceStart", {run});
    expect(h.session.getSnapshot().error).toBeNull(); expect(h.session.getSnapshot().currentLetters[0].normalize("NFC")).toBe("é");
  });
  it.each([false, true])("pins a legacy prompt when complete evaluation arrives after progress (advanced=%s)", async advanced => {
    /** Legacy transport can begin without any downloadable answers. */
    const h = harness(); h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Authority retains the complete deck independently of the legacy view. */
    const authority = createFakeRaceServices(), run = await fixture(false, authority), legacy = structuredClone(run);
    Reflect.deleteProperty(legacy, "preloadedRiddles"); Reflect.deleteProperty(legacy.currentRiddle!, "evaluation");
    h.respond("raceStart", {run: legacy}); h.advance(3480); h.session.input("text", "pi"); h.session.retry();
    /** Even an advanced complete deck must retain the already-owned first clue. */
    const response = advanced ? await authority.submitRaceGuess({runId: run.runId, riddleId: run.currentRiddle!.riddleId, guess: "piano", requestId: "other-tab"}) : await authority.resumeRace(run.runId);
    response.run.preloadedRiddles![0].text = "Replaced original clue";
    if (!advanced) response.run.currentRiddle!.text = "Replaced original clue";
    h.respond("raceResume", response);
    expect(h.session.getSnapshot()).toMatchObject({error: "RaceTo10.ERROR_INVALID_RESPONSE", currentLetters: ["p", "i", "", "", ""]});
    h.session.retry(); h.respond("raceResume", await authority.resumeRace(run.runId));
    expect(h.session.getSnapshot().error).toBeNull();
  });
  it("retains first-hint metadata through omission while allowing a legacy metadata upgrade", async () => {
    /** The first delivery may omit optional deterministic hint metadata. */
    const h = await racing(); h.session.retry();
    /** Legacy omission does not erase the known hint selector. */
    const omitted = await h.authority.resumeRace(h.run.runId);
    for (const riddle of omitted.run.preloadedRiddles!) Reflect.deleteProperty(riddle, "hint");
    h.respond("raceResume", omitted); expect(h.session.getSnapshot().error).toBeNull();
    h.session.retry();
    /** Another valid answer letter is nevertheless a changed immutable hint selector. */
    const changed = await h.authority.resumeRace(h.run.runId);
    changed.run.preloadedRiddles![0].hint = {index: 1, letter: "i"};
    h.respond("raceResume", changed); expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_INVALID_RESPONSE");
    h.session.retry(); h.respond("raceResume", await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot().error).toBeNull();
    /** Separate legacy-first journey can safely acquire new optional metadata. */
    const legacy = harness(); legacy.respond("raceCategories", await catalog()); legacy.session.begin("mixed");
    legacy.respond("raceStart", omitted); legacy.advance(3480); legacy.session.retry();
    legacy.respond("raceResume", await h.authority.resumeRace(h.run.runId));
    expect(legacy.session.getSnapshot().error).toBeNull();
  });
  it.each(["changed-deck", "preparation-expiry"])("owns prepared content and expiry while accepting its first ready schedule: %s", async kind => {
    /** Prepared content is already immutable before countdown scheduling. */
    const h = harness(); h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** One authority supplies preparation and the first server-controlled schedule. */
    const authority = createFakeRaceServices(), prepared = await fixture(true, authority);
    h.respond("raceStart", {run: prepared});
    /** Readiness may add a start time but cannot replace content or the existing expiry. */
    const ready = await authority.readyRace({runId: prepared.runId}), invalid = structuredClone(ready);
    if (kind === "preparation-expiry") invalid.run.preparationExpiresAtMs! += 1; else corrupt(invalid.run, kind);
    h.respond("raceReady", invalid); expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_INVALID_RESPONSE");
    h.session.retry(); h.respond("raceReady", ready);
    expect(h.session.getSnapshot()).toMatchObject({error: null, stage: "countdown", run: {startsAtMs: ready.run.startsAtMs}});
  });
  it.each([false, true])("does not dispatch an exhausted one-hint request (answerFree=%s)", async answerFree => {
    /** Legacy rules can remain active across compatible server revisions. */
    const h = harness(); h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Exhausted availability must suppress duplicate paid commands even without instant evaluation. */
    const run = await fixture(); run.rules = {...run.rules, maxHintsPerRiddle: 1};
    run.currentRiddle!.revealedLetters = [{index: 0, letter: "p"}];
    run.currentRiddle!.hintAvailable = false;
    if (answerFree) {Reflect.deleteProperty(run, "preloadedRiddles"); Reflect.deleteProperty(run.currentRiddle!, "evaluation");}
    h.respond("raceStart", {run}); h.advance(3480); h.session.hint();
    expect(h.session.getSnapshot()).toMatchObject({error: null, stage: "racing", run: {rules: {maxHintsPerRiddle: 1}}});
    expect(h.commands.filter(command => command.type === "game:requestRaceHint")).toHaveLength(0);
    expect(h.session.getSnapshot().pending).toBeNull();
  });
});
