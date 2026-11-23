import {expect,it} from "@jest/globals";
import type {RaceRunView} from "../../../contracts/index";
import {createFakeRaceServices} from "../fakeRaceServices";
import {raceHintHistory} from "../../../history/raceHintHistory";

/** A hint can return a newer attempt counter without moving previously known history. */
it.each(["canonical","legacy","partial","unchanged"])("aligns %s hint history after another tab's attempt",async mode=>{
  /** Complete validated authority fixture supplies prompt identity and rules. */
  const services=createFakeRaceServices();
  /** Original run provides the unchanged same-question shape. */
  const {run}=await services.startRace({locale:"en",categoryId:"mixed",requestId:"hint-history-start"});
  /** Known canonical row and newly returned suffix use distinct words to detect shifts. */
  const row={guess:[..."abbba"],feedback:["yellow","red","red","red","red"] as const};
  /** Mutable public rows use the same shape as actual scored feedback. */
  const old=Array.from({length:3},()=>({guess:[...row.guess],feedback:[...row.feedback]}));
  /** Earlier authority has three consumed attempts. */
  const previous:RaceRunView={...run,currentRiddle:{...run.currentRiddle!,guessesUsed:3,guessesRemaining:2}};
  /** Hint observes one newer consumed attempt unless used as the same-counter control. */
  const next:RaceRunView={...previous,currentRiddle:{...previous.currentRiddle!,guessesUsed:mode==="unchanged"?3:4,guessesRemaining:mode==="unchanged"?2:1}};
  /** New row is server-scored history, not an invented unknown word. */
  const newest={guess:[..."wrong"],feedback:["red","red","red","yellow","yellow"] as const};
  if(mode==="canonical")next.currentRiddle!.confirmedGuesses=[...old,{guess:[...newest.guess],feedback:[...newest.feedback]}];
  if(mode==="partial")next.currentRiddle!.confirmedGuesses=[{guess:[...newest.guess],feedback:[...newest.feedback]}];
  /** Result must preserve old words or canonical suffix indices without aliasing the checkpoint. */
  const actual=raceHintHistory(next,previous,old);
  expect(actual).toEqual(mode==="canonical"?next.currentRiddle!.confirmedGuesses:mode==="partial"?[...old,next.currentRiddle!.confirmedGuesses![0]]:mode==="unchanged"?old:[...old,{guess:[],feedback:[]}]);
  actual[0].guess[0]="z";expect(old[0].guess[0]).toBe("a");
});
