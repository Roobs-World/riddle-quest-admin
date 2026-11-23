import {expect,it} from "@jest/globals";
import {createFakeRaceServices} from "../fakeRaceServices";
import {harness} from "../../../browser/controllers/__tests__/raceSession.support.ts";

/** A pending hint preserves canonical attempt positions when another tab submits a wrong answer. */
it.each([true,false])("merges concurrent attempts with returnedHistory=%s",async returnedHistory=>{
  /** Shared authority accepts both tabs' mutations. */
  const authority=createFakeRaceServices();
  /** Canonical active question before local entry. */
  let {run}=await authority.startRace({locale:"en",categoryId:"mixed",requestId:"concurrent-hint-start",includeEvaluation:true});
  /** Three prior wrong guesses are already known to this client. */
  const rows=[];
  for(let index=0;index<3;index++){
    /** Independently accepted canonical attempt. */
    const result=await authority.submitRaceGuess({runId:run.runId,riddleId:run.currentRiddle!.riddleId,guess:"abbba",requestId:`old-${index}`});
    run=result.run;rows.push({guess:result.feedback.map(cell=>cell.letter),feedback:result.feedback.map(cell=>cell.status)});
  }
  run.currentRiddle!.confirmedGuesses=structuredClone(rows);
  /** Cold resume then unsent input and one pending Hint. */
  const h=harness({},run.runId);h.respond("raceResume",{run});h.session.input("text","pa");h.session.hint();
  /** Another tab consumes a fourth attempt before the Hint response. */
  const concurrent=await authority.submitRaceGuess({runId:run.runId,riddleId:run.currentRiddle!.riddleId,guess:"wrong",requestId:"other-tab"});
  /** Canonical hint commits once after the concurrent wrong guess. */
  const hinted=await authority.requestRaceHint({runId:run.runId,riddleId:run.currentRiddle!.riddleId,requestId:"local-hint"});
  /** Full history or compatible legacy omission identifies only facts actually supplied. */
  const newest={guess:concurrent.feedback.map(cell=>cell.letter),feedback:concurrent.feedback.map(cell=>cell.status)};
  if(returnedHistory)hinted.run.currentRiddle!.confirmedGuesses=[...structuredClone(rows),newest];
  h.respond("raceHint",hinted);
  expect(h.session.getSnapshot()).toMatchObject({error:null,currentLetters:["p","a","","",""],raceGuesses:[...rows,returnedHistory?newest:{guess:[],feedback:[]}],run:{currentRiddle:{guessesUsed:4},totalPenaltyMs:15000}});
  expect(h.commands.filter(command=>command.type==="game:requestRaceHint")).toHaveLength(1);
});
