import {RaceRunViewSchema} from "@qwordly/core/race";
import {graphemeLength} from "@qwordly/core/game";
import {buildDeterministicRaceDeck} from "../../firebase-functions/src/race/raceSetupService";
import {validateRacePool} from "../../firebase-functions/src/race/raceContentValidation";
import {liveRun} from "../../firebase-functions/src/race/raceLiveState";
import {toRaceRunView, applyRaceGuess} from "../../firebase-functions/src/race/raceEngine";
it.each([" cat ","a"+"\u0301".repeat(128)])("reproduces an accepted answer that cannot be delivered or solved normally", answer => {
 const records=Array.from({length:30},(_,i)=>({locale:"en" as const,documentPath:`localizedRiddles/en/riddles/probe-${i}`,data:{riddleId:`probe-${i}`,canonicalRiddleId:`history:${i}`,text:`Unique question ${i}`,answer:i===0?answer:`a${String(i).padStart(6,"0")}`,categoryId:"history",difficultyBand:(["easy","medium","hard"] as const)[i%3],raceEligible:true,qualityVersion:"human_review_v1"}}));
 const validation=validateRacePool(records,{locale:"en",categoryId:"history"});expect(validation.valid).toBe(true);
 const deck=buildDeterministicRaceDeck(records,{locale:"en",categoryId:"history",seed:"answer-probe"});
 const position=deck.riddles.findIndex(r=>r.riddleId==="probe-0");expect(position).toBeGreaterThanOrEqual(0);
 const run={...liveRun({...deck,locale:"en",categoryId:"history"},"viewer","probe-run",1000),currentPosition:position,evaluationPolicy:"preloaded" as const};
 if(answer.trim()!==answer){
  expect(RaceRunViewSchema.safeParse(toRaceRunView(run,2000,true)).success).toBe(true);
  expect(()=>applyRaceGuess(run,{riddleId:"probe-0",guess:answer.trim()},2000)).toThrow("exactly 5 characters");
  expect(()=>applyRaceGuess(run,{riddleId:"probe-0",guess:answer},2000)).toThrow("exactly 5 characters");
 }else expect(RaceRunViewSchema.safeParse(toRaceRunView(run,2000,true)).success).toBe(false);
 console.info(JSON.stringify({answerKind:answer.trim()!==answer?"padded":"oversized-encoding",answerUnits:answer.length,trimmedGraphemes:graphemeLength(answer.trim()),poolAccepted:validation.valid,failure:answer.trim()!==answer?"normal-and-padded-guess-rejected":"evaluation-projection-rejected"}));
});
