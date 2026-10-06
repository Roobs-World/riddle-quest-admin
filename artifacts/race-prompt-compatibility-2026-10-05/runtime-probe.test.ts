import {RaceRunViewSchema} from "@qwordly/core/race";
import {buildDeterministicRaceDeck} from "../../firebase-functions/src/race/raceSetupService";
import {validateRacePool} from "../../firebase-functions/src/race/raceContentValidation";
import {liveRun, liveView, type LiveTicket, type LiveMatch} from "../../firebase-functions/src/race/raceLiveState";
import {toRaceRunView} from "../../firebase-functions/src/race/raceEngine";
it("reproduces an accepted oversized clue breaking actual live and preloaded projections", () => {
 const records=Array.from({length:30},(_,i)=>({locale:"en" as const,documentPath:`localizedRiddles/en/riddles/probe-${i}`,data:{riddleId:`probe-${i}`,canonicalRiddleId:`history:${i}`,text:i===0?"Q".repeat(2001):`Unique question ${i}`,answer:`a${String(i).padStart(6,"0")}`,categoryId:"history",difficultyBand:(["easy","medium","hard"] as const)[i%3],raceEligible:true,qualityVersion:"human_review_v1"}}));
 const validation=validateRacePool(records,{locale:"en",categoryId:"history"}); expect(validation.valid).toBe(true);
 const deck=buildDeterministicRaceDeck(records,{locale:"en",categoryId:"history",seed:"prompt-probe"});
 const position=deck.riddles.findIndex(r=>r.riddleId==="probe-0");expect(position).toBeGreaterThanOrEqual(0);
 const run=liveRun({...deck,locale:"en",categoryId:"history"},"viewer","probe-run",1000);run.currentPosition=position;
 const player={displayName:"Probe player",avatarUrl:null,level:1,correctCount:0};
 const ticket:LiveTicket={userId:"viewer",pool:"jest:en:history",createdAtMs:0,seenAtMs:0,player,run};
 const match:LiveMatch={tickets:["probe-ticket",null],startsAtMs:1000,runs:[run,run],players:[player,player]};
 expect(()=>liveView("probe-ticket",ticket,match,2000)).toThrow();
 expect(RaceRunViewSchema.safeParse(toRaceRunView({...run,evaluationPolicy:"preloaded"},2000,true)).success).toBe(false);
 console.info(JSON.stringify({poolAccepted:validation.valid,selectedClueLength:deck.riddles[position]!.text.length,liveProjection:"rejected",preloadedProjection:"rejected"}));
});
