import {describe,expect,it} from "@jest/globals";
import {racing} from "./raceSession.support.ts";

describe("Race Session pending same-question input recovery",()=>{
  it.each(["applied","not-applied"])("retains the next typed attempt after a failed wrong-guess confirmation: %s",async commit=>{
    /** The player starts composing the next attempt while the old submission is in flight. */
    const h=await racing();h.session.input("text","zzzzz");h.session.submit();h.session.input("text","pi");
    if(commit === "applied")await h.authority.submitRaceGuess({runId:h.run.runId,riddleId:h.run.currentRiddle!.riddleId,guess:"zzzzz",requestId:"pending-wrong"});
    h.reject("raceGuess","Lost confirmation");
    expect(h.session.getSnapshot().currentLetters).toEqual([..."zzzzz"]);
    h.session.retry();h.respond("raceResume",await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error:null,raceGuesses:commit === "applied" ? [{guess:[],feedback:[]}] : [],currentLetters:["p","i","","",""],run:{currentRiddle:{guessesUsed:commit === "applied" ? 1 : 0}}});
    expect(h.commands.filter(command=>command.type==="game:submitRaceGuess")).toHaveLength(1);
  });
  it("retains a deliberately emptied pending draft after canonical recovery",async()=>{
    /** Backspace is a real edit even when its intended result is an empty answer. */
    const h=await racing();h.session.input("text","zzzzz");h.session.submit();h.session.input("text","p");h.session.input("backspace");
    h.reject("raceGuess","Lost confirmation");h.session.retry();h.respond("raceResume",await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot().currentLetters).toEqual(["","","","",""]);
  });
  it.each([-1,1.5,Number.NaN,Number.POSITIVE_INFINITY,99])("ignores an invalid answer slot without corrupting the draft: %s",async slot=>{
    /** Invalid focus input must not create sparse arrays or non-index properties. */
    const h=await racing();h.session.input("text","pi");
    /** The stable public snapshot proves the invalid selection publishes no state transition. */
    const before=h.session.getSnapshot();h.session.input("slot",slot);
    expect(h.session.getSnapshot()).toBe(before);
    h.session.input("letter","a");
    expect(h.session.getSnapshot().currentLetters).toEqual(["p","i","a","",""]);
  });
  it.each(["invalid-slot","ignored-text"])("does not discard recovery input after an ignored %s event",async event=>{
    /** Ignored input is not a new player intent superseding the retained draft. */
    const h=await racing();h.session.input("text","zzzzz");h.session.submit();h.session.input("text","pi");h.reject("raceGuess","Lost confirmation");
    if(event === "invalid-slot")h.session.input("slot",99);else h.session.input("text"," ");
    h.session.retry();h.respond("raceResume",await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot().currentLetters).toEqual(["p","i","","",""]);
  });
  it("keeps the submitted attempt when no pending draft edit occurred",async()=>{
    /** A failed submission still restores its original answer when the player did not change it. */
    const h=await racing();h.session.input("text","zzzzz");h.session.submit();h.reject("raceGuess","Lost confirmation");
    h.session.retry();h.respond("raceResume",await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot().currentLetters).toEqual([..."zzzzz"]);
  });
  it("does not carry an old-question pending draft into another tab's successor",async()=>{
    /** Question position remains the authority boundary for pending input recovery. */
    const h=await racing();h.session.input("text","zzzzz");h.session.submit();h.session.input("text","pi");
    await h.authority.submitRaceGuess({runId:h.run.runId,riddleId:h.run.currentRiddle!.riddleId,guess:"piano",requestId:"other-tab-correct"});
    h.reject("raceGuess","Lost confirmation");h.session.retry();h.respond("raceResume",await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error:null,currentLetters:["","","","",""],run:{currentRiddle:{position:1}}});
  });
});
