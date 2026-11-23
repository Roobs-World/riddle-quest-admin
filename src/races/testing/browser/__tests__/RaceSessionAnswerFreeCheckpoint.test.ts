import {describe,expect,it} from "@jest/globals";
import {catalog,fixture,harness} from "../../../browser/controllers/__tests__/raceSession.support.ts";
import {createFakeRaceServices} from "../fakeRaceServices";

/** Compatible answer-free receipt independent of the authority's complete deck. */
const answerFree = <T extends {
  /** Canonical run whose optional evaluation fields may be omitted. */
  run: Awaited<ReturnType<typeof fixture>>;
}>(response:T):T => {
  /** The authority retains its own immutable scoring data. */
  const wire=structuredClone(response);delete wire.run.preloadedRiddles;
  if(wire.run.currentRiddle)delete wire.run.currentRiddle.evaluation;
  return wire;
};
/** Creates a legacy or compatible answer-free public run while preserving independent authority. */
const withoutEvaluation = async (known:boolean) => {
  /** Known-answer clients receive an initial modern response before a compatible omission. */
  const authority=createFakeRaceServices(),run=await fixture(false,authority),h=harness();
  h.respond("raceCategories",await catalog());h.session.begin("mixed");h.respond("raceStart",known?{run}:answerFree({run}));h.advance(3480);
  if(known){h.session.retry();h.respond("raceResume",answerFree(await authority.resumeRace(run.runId)));}
  return {...h,authority,run};
};

describe("Race Session answer-free submission checkpoints",()=>{
  it.each([true,false])("accepts genuine feedback despite a retained submitted-letter edit: known=%s",async known=>{
    /** A pending immutable submission owns zzzzz even if its public input is edited later. */
    const h=await withoutEvaluation(known);h.session.input("text","zzzzz");
    /** Public input can be retained independently of the privately captured submission. */
    const retained=h.session.getSnapshot().currentLetters;h.session.submit();retained[0]="x";
    expect(h.session.getSnapshot().allowTypingWhilePending).toBe(false);
    h.respond("raceGuess",answerFree(await h.authority.submitRaceGuess({runId:h.run.runId,riddleId:h.run.currentRiddle!.riddleId,guess:"zzzzz",requestId:"canonical-echo"})));
    expect(h.session.getSnapshot()).toMatchObject({error:null,currentLetters:["","","","",""],raceGuesses:[{guess:[..."zzzzz"],feedback:["red","red","red","red","red"]}]});
  });
  it.each([true,false])("rejects feedback echoing an edited public submission: known=%s",async known=>{
    /** Both guesses score red against piano, so only the privately submitted echo distinguishes them. */
    const h=await withoutEvaluation(known);h.session.input("text","zzzzz");
    /** Public input can be retained independently of the privately captured submission. */
    const retained=h.session.getSnapshot().currentLetters;h.session.submit();retained[0]="x";
    /** Changed wire echo follows the public edit rather than the command sent to authority. */
    const bad=answerFree(await h.authority.submitRaceGuess({runId:h.run.runId,riddleId:h.run.currentRiddle!.riddleId,guess:"zzzzz",requestId:"edited-echo"}));
    bad.feedback[0].letter="x";h.respond("raceGuess",bad);
    expect(h.session.getSnapshot()).toMatchObject({error:"RaceTo10.ERROR_INVALID_RESPONSE",currentLetters:[..."zzzzz"]});
    h.session.retry();h.respond("raceResume",answerFree(await h.authority.resumeRace(h.run.runId)));
    expect(h.session.getSnapshot()).toMatchObject({error:null,currentLetters:[..."zzzzz"],run:{currentRiddle:{guessesUsed:1}}});
    expect(h.commands.filter(command=>command.type==="game:submitRaceGuess")).toHaveLength(1);
  });
  it.each([true,false])("restores captured answer-free input after transport rejection: known=%s",async known=>{
    /** Recovery must retain the actual submission rather than any retained UI array edits. */
    const h=await withoutEvaluation(known);h.session.input("text","zzzzz");
    /** Public input can be retained independently of the privately captured submission. */
    const retained=h.session.getSnapshot().currentLetters;h.session.submit();retained[0]="x";
    h.reject("raceGuess","RaceTo10.ERROR_GENERIC");
    expect(h.session.getSnapshot()).toMatchObject({error:"RaceTo10.ERROR_GENERIC",currentLetters:[..."zzzzz"]});
  });
  it.each([true,false])("preserves captured guess history during answer-free confirmation: known=%s",async known=>{
    /** First accepted guess establishes history before the next submission checkpoint. */
    const h=await withoutEvaluation(known);h.session.input("text","aaaaa");h.session.submit();
    h.respond("raceGuess",answerFree(await h.authority.submitRaceGuess({runId:h.run.runId,riddleId:h.run.currentRiddle!.riddleId,guess:"aaaaa",requestId:"history-first"})));
    /** Original accepted rows are owned before retained public row edits. */
    const original=structuredClone(h.session.getSnapshot().raceGuesses),retained=h.session.getSnapshot().raceGuesses;
    h.session.input("text","zzzzz");h.session.submit();retained[0].guess[0]="x";retained[0].feedback[0]="green";
    h.respond("raceGuess",answerFree(await h.authority.submitRaceGuess({runId:h.run.runId,riddleId:h.run.currentRiddle!.riddleId,guess:"zzzzz",requestId:"history-second"})));
    expect(h.session.getSnapshot()).toMatchObject({error:null,raceGuesses:[...original,{guess:[..."zzzzz"],feedback:["red","red","red","red","red"]}]});
  });
  it.each([true,false])("retains answer-free input locking and normal confirmation: known=%s",async known=>{
    /** Creating a checkpoint does not need immediate feedback or pending draft editing. */
    const h=await withoutEvaluation(known);h.session.input("text","zzzzz");h.session.submit();h.session.input("text","x");
    expect(h.session.getSnapshot()).toMatchObject({allowTypingWhilePending:false,currentLetters:[..."zzzzz"]});
    h.respond("raceGuess",answerFree(await h.authority.submitRaceGuess({runId:h.run.runId,riddleId:h.run.currentRiddle!.riddleId,guess:"zzzzz",requestId:"normal-answer-free"})));
    expect(h.session.getSnapshot()).toMatchObject({error:null,currentLetters:["","","","",""],raceGuesses:[{guess:[..."zzzzz"],feedback:["red","red","red","red","red"]}]});
  });
});
