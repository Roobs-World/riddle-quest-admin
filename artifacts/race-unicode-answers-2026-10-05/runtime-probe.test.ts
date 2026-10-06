import {RaceRunViewSchema, SubmitRaceGuessRequestSchema} from "@qwordly/core/race";
import {graphemeLength} from "@qwordly/core/game";
import {buildDeterministicRaceDeck} from "../../firebase-functions/src/race/raceSetupService";
import {validateRacePool} from "../../firebase-functions/src/race/raceContentValidation";
import {liveRun} from "../../firebase-functions/src/race/raceLiveState";
import {toRaceRunView, applyRaceGuess} from "../../firebase-functions/src/race/raceEngine";
it("reproduces a legal seven-grapheme answer rejected by evaluation and guess contracts", () => {
 const answer="élément".normalize("NFD");
 const records=Array.from({length:30},(_,i)=>({locale:"fr" as const,documentPath:`localizedRiddles/fr/riddles/probe-${i}`,data:{riddleId:`probe-${i}`,canonicalRiddleId:`history:${i}`,text:`Unique question ${i}`,answer:i===0?answer:`a${String(i).padStart(6,"0")}`,categoryId:"history",difficultyBand:(["easy","medium","hard"] as const)[i%3],raceEligible:true,qualityVersion:"human_review_v1"}}));
 const validation=validateRacePool(records,{locale:"fr",categoryId:"history"});expect(validation.valid).toBe(true);
 const deck=buildDeterministicRaceDeck(records,{locale:"fr",categoryId:"history",seed:"unicode-probe"});
 const position=deck.riddles.findIndex(r=>r.riddleId==="probe-0");expect(position).toBeGreaterThanOrEqual(0);
 const run={...liveRun({...deck,locale:"fr",categoryId:"history"},"viewer","probe-run",1000),currentPosition:position,evaluationPolicy:"preloaded" as const};
 expect(RaceRunViewSchema.safeParse(toRaceRunView(run,2000)).success).toBe(true);
 expect(RaceRunViewSchema.safeParse(toRaceRunView(run,2000,true)).success).toBe(false);
 expect(SubmitRaceGuessRequestSchema.safeParse({runId:run.runId,riddleId:"probe-0",guess:answer,requestId:"unicode-probe-guess"}).success).toBe(false);
 expect(applyRaceGuess(run,{riddleId:"probe-0",guess:answer},2000).isCorrect).toBe(true);
 console.info(JSON.stringify({locale:"fr",answerUnits:answer.length,answerGraphemes:graphemeLength(answer,"fr"),poolAccepted:validation.valid,legacyProjection:"accepted",evaluationProjection:"rejected",guessRequest:"rejected",engineGuess:"correct"}));
});
