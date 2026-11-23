import {expect,it} from "@jest/globals";
import {racing} from "./raceSession.support";

/** A locally correlated server guess receipt is canonical history even when optional rows are absent. */
it.each(["word","feedback"])("rejects later changed %s after a history-free guess receipt",async mutation=>{
  /** Public racing seam owns the submitted question and its pending checkpoint. */
  const h=await racing();h.session.input("text","wrong");h.session.submit();
  /** Server confirms one wrong guess without negotiated history. */
  const result=await h.authority.submitRaceGuess({runId:h.run.runId,riddleId:h.run.currentRiddle!.riddleId,guess:"wrong",requestId:"confirmed-local"});
  h.respond("raceGuess",result);
  /** Later history changes a fact already proven by the correlated feedback. */
  const changed=await h.authority.resumeRace(h.run.runId);
  changed.run.currentRiddle!.confirmedGuesses=[{guess:result.feedback.map(cell=>cell.letter),feedback:result.feedback.map(cell=>cell.status)}];
  if(mutation==="word")changed.run.currentRiddle!.confirmedGuesses[0].guess[0]="z";
  else changed.run.currentRiddle!.confirmedGuesses[0].feedback[0]="green";
  h.session.retry();h.respond("raceResume",changed);
  expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_INVALID_RESPONSE");
});

/** Optional canonical history must agree with the correlated guess feedback before checkpoint consumption. */
it.each(["word","feedback"])("rejects contradictory new canonical %s before confirmation",async mutation=>{
  /** Fresh submission owns the original empty history checkpoint. */
  const h=await racing();h.session.input("text","wrong");h.session.submit();
  /** Otherwise valid response contradicts its own feedback with the optional latest row. */
  const result=await h.authority.submitRaceGuess({runId:h.run.runId,riddleId:h.run.currentRiddle!.riddleId,guess:"wrong",requestId:"contradictory-local"});
  result.run.currentRiddle!.confirmedGuesses=[{guess:result.feedback.map(cell=>cell.letter),feedback:result.feedback.map(cell=>cell.status)}];
  if(mutation==="word")result.run.currentRiddle!.confirmedGuesses[0].guess[0]="z";
  else result.run.currentRiddle!.confirmedGuesses[0].feedback[0]="green";
  h.respond("raceGuess",result);
  expect(h.session.getSnapshot()).toMatchObject({error:"RaceTo10.ERROR_INVALID_RESPONSE",requiresRunRefresh:true,raceGuesses:[],run:{currentRiddle:{guessesUsed:0}}});
});
