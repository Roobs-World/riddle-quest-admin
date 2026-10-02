import {describe,expect,it} from "@jest/globals";
import {catalog,fixture,harness} from "./raceSession.support";
import {createFakeRaceServices} from "../testing/fakeRaceServices";

/** Compatible payload omits every optional answer while leaving the authority fixture independent. */
const answerFree = <T extends {
  /** Canonical race before optional wire omissions. */
  run: Awaited<ReturnType<typeof fixture>>;
}>(response:T):T => {
  /** Private previously confirmed answers must still constrain the omitted question. */
  const wire=structuredClone(response);delete wire.run.preloadedRiddles;
  if(wire.run.currentRiddle)delete wire.run.currentRiddle.evaluation;
  return wire;
};
/** Starts with only a confirmed current-answer payload, independently of the server's complete deck. */
const promptOnly = async (legacy=false) => {
  /** The same authority issues later hints and reads. */
  const authority=createFakeRaceServices(),run=await fixture(false,authority),h=harness();
  delete run.preloadedRiddles;if(legacy)delete run.currentRiddle!.evaluation;
  h.respond("raceCategories",await catalog());h.session.begin("mixed");h.respond("raceStart",{run});h.advance(3480);
  return {...h,authority,run};
};

describe("Race Session privately known answer reveals",()=>{
  it.each(["resume","hint"] as const)("rejects wrong %s reveals after optional answer omissions",async operation=>{
    /** The known answer is piano, while the retained wire snapshot can lose its answer payload. */
    const h=await promptOnly();h.session.input("text","ia");
    if(operation==="hint")h.session.hint();else h.session.retry();
    /** A genuinely charged hint establishes valid events and penalty arithmetic. */
    const applied=await h.authority.requestRaceHint({runId:h.run.runId,riddleId:h.run.currentRiddle!.riddleId,requestId:"omitted-hint"});
    /** Only the revealed letter differs from the canonical charged result. */
    const bad=answerFree(applied);bad.run.currentRiddle!.revealedLetters[0].letter="z";bad.revealedLetter="z";
    h.respond(operation==="hint"?"raceHint":"raceResume",operation==="hint"?bad:{run:bad.run});
    expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_INVALID_RESPONSE");
    h.session.retry();h.respond("raceResume",answerFree(await h.authority.resumeRace(h.run.runId)));
    expect(h.session.getSnapshot()).toMatchObject({error:null,currentLetters:["p","a","","",""],run:{currentRiddle:{revealedLetters:[{index:0,letter:"p"}]}}});
    expect(h.commands.filter(command=>command.type==="game:requestRaceHint")).toHaveLength(operation==="hint"?1:0);
  });
  it.each(["resume","hint"] as const)("rejects %s reveals matching an edited public answer",async operation=>{
    /** A retained public answer cannot rewrite the private confirmed answer. */
    const h=await promptOnly();h.session.getSnapshot().run!.currentRiddle!.evaluation!.answer="ziano";
    if(operation==="hint")h.session.hint();else h.session.retry();
    /** Omitted payload agrees with the public edit but disagrees with the private answer. */
    const bad=answerFree(await h.authority.requestRaceHint({runId:h.run.runId,riddleId:h.run.currentRiddle!.riddleId,requestId:"edited-hint"}));
    bad.run.currentRiddle!.revealedLetters[0].letter="z";bad.revealedLetter="z";
    h.respond(operation==="hint"?"raceHint":"raceResume",operation==="hint"?bad:{run:bad.run});
    expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_INVALID_RESPONSE");
  });
  it.each(["resume","hint"] as const)("accepts canonical %s reveals despite omitted answer payloads",async operation=>{
    /** Optional omissions remain compatible when every reveal agrees with the known answer. */
    const h=await promptOnly();if(operation==="hint")h.session.hint();else h.session.retry();
    /** Independent charged response retains the original canonical question. */
    const response=answerFree(await h.authority.requestRaceHint({runId:h.run.runId,riddleId:h.run.currentRiddle!.riddleId,requestId:"canonical-hint"}));
    h.respond(operation==="hint"?"raceHint":"raceResume",operation==="hint"?response:{run:response.run});
    expect(h.session.getSnapshot()).toMatchObject({error:null,currentLetters:["p","","","",""]});
  });
  it("does not apply a known old question's answer to an answer-free successor",async()=>{
    /** Only the first piano question's answer was confirmed by this client. */
    const h=await promptOnly();
    await h.authority.submitRaceGuess({runId:h.run.runId,riddleId:h.run.currentRiddle!.riddleId,guess:"piano",requestId:"other-tab-correct"});
    /** Other-tab progress selects a different question with its own hint letter. */
    const next=await h.authority.resumeRace(h.run.runId);
    /** Independent charged response retains the original canonical question. */
    const response=answerFree(await h.authority.requestRaceHint({runId:h.run.runId,riddleId:next.run.currentRiddle!.riddleId,requestId:"other-tab-clock-hint"}));
    h.session.retry();h.respond("raceResume",{run:response.run});
    expect(h.session.getSnapshot()).toMatchObject({error:null,currentLetters:["c","","","",""],run:{currentRiddle:{position:1}}});
  });
  it("retains genuinely unknown legacy reveal compatibility",async()=>{
    /** No confirmed answer exists; shaped hint receipts cannot be independently scored. */
    const h=await promptOnly(true);h.session.retry();
    /** Independent charged response retains the original canonical question. */
    const response=answerFree(await h.authority.requestRaceHint({runId:h.run.runId,riddleId:h.run.currentRiddle!.riddleId,requestId:"unknown-hint"}));
    response.run.currentRiddle!.revealedLetters[0].letter="z";
    h.respond("raceResume",{run:response.run});
    expect(h.session.getSnapshot()).toMatchObject({error:null,currentLetters:["z","","","",""]});
  });
});
