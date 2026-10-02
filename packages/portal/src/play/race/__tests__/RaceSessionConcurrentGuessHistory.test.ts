import {expect,it} from "@jest/globals";
import {createFakeRaceServices} from "../testing/fakeRaceServices";
import {harness} from "./raceSession.support";

/** A correlated wrong guess receipt preserves attempt indexes after another tab submits first. */
it.each(["full","partial","legacy"])("reconciles %s concurrent guess history",async mode=>{
  /** Shared authoritative run supplies both tabs' accepted guesses. */
  const authority=createFakeRaceServices();
  /** Cold entry follows two known prior attempts. */
  let {run}=await authority.startRace({locale:"en",categoryId:"mixed",requestId:"concurrent-guess-start",includeEvaluation:true});
  /** Exact previously confirmed words and feedback. */
  const rows=[];
  for(let index=0;index<2;index++){
    /** Distinct original attempt. */
    const response=await authority.submitRaceGuess({runId:run.runId,riddleId:run.currentRiddle!.riddleId,guess:"abbba",requestId:`old-${index}`});
    run=response.run;rows.push({guess:response.feedback.map(cell=>cell.letter),feedback:response.feedback.map(cell=>cell.status)});
  }
  run.currentRiddle!.confirmedGuesses=structuredClone(rows);
  /** Local pending wrong guess allows typing the next unsent answer. */
  const h=harness({},run.runId);h.respond("raceResume",{run});h.session.input("text","wrong");h.session.submit();h.session.input("text","pa");
  /** Another tab commits before this local command's authoritative mutation. */
  const other=await authority.submitRaceGuess({runId:run.runId,riddleId:run.currentRiddle!.riddleId,guess:"anbbb",requestId:"other-tab"});
  /** Local receipt's final consumed slot belongs to the local word. */
  const result=await authority.submitRaceGuess({runId:run.runId,riddleId:run.currentRiddle!.riddleId,guess:"wrong",requestId:"local-tab"});
  /** Canonical returned history may be complete, a latest-row suffix, or absent. */
  const concurrent={guess:other.feedback.map(cell=>cell.letter),feedback:other.feedback.map(cell=>cell.status)};
  /** The correlated local result is always known independently of optional history. */
  const latest={guess:result.feedback.map(cell=>cell.letter),feedback:result.feedback.map(cell=>cell.status)};
  if(mode==="full")result.run.currentRiddle!.confirmedGuesses=[...structuredClone(rows),concurrent,latest];
  if(mode==="partial")result.run.currentRiddle!.confirmedGuesses=[latest];
  h.respond("raceGuess",result);
  expect(h.session.getSnapshot()).toMatchObject({error:null,currentLetters:["p","a","","",""],raceGuesses:[...rows,mode==="full"?concurrent:{guess:[],feedback:[]},latest],run:{currentRiddle:{guessesUsed:4}}});
  expect(h.commands.filter(command=>command.type==="game:submitRaceGuess")).toHaveLength(1);
});
