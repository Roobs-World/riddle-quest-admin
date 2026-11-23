import {expect,it} from "@jest/globals";
import {createFakeRaceServices} from "../fakeRaceServices";
import {harness} from "../../../browser/controllers/__tests__/raceSession.support.ts";

/** Malformed canonical history rejects before a guess or paid-action rollback checkpoint is consumed. */
it.each(["raceGuess","raceHint"].flatMap(operation=>["word","feedback"].map(mutation=>({operation,mutation}))))("preserves checkpoint for $operation with changed $mutation",async ({operation,mutation})=>{
  /** Canonical authority contains three accepted attempts before cold entry. */
  const authority=createFakeRaceServices();
  /** Private server run identity never comes from edited rendering references. */
  let {run}=await authority.startRace({locale:"en",categoryId:"mixed",requestId:"checkpoint-start",includeEvaluation:true});
  /** Original canonical rows include duplicate letters and exact yellow/red scoring. */
  const history=[];
  for(let index=0;index<3;index++){
    /** One distinct accepted attempt receipt. */
    const result=await authority.submitRaceGuess({runId:run.runId,riddleId:run.currentRiddle!.riddleId,guess:"abbba",requestId:`seed-${index}`});
    run=result.run;history.push({guess:result.feedback.map(cell=>cell.letter),feedback:result.feedback.map(cell=>cell.status)});
  }
  run.currentRiddle!.confirmedGuesses=structuredClone(history);
  /** Public session accepts the canonical cold-resume history before editing input. */
  const h=harness({},run.runId);h.respond("raceResume",{run});h.session.input("text","wrong");
  /** Original displayed history is the rollback checkpoint's authority-independent baseline. */
  const before=structuredClone(h.session.getSnapshot().raceGuesses);
  if(operation==="raceHint")h.session.hint();else h.session.submit();
  /** Server has applied the mutation; corruption belongs only to the delivered history field. */
  const result=operation==="raceHint"
    ? await authority.requestRaceHint({runId:run.runId,riddleId:run.currentRiddle!.riddleId,requestId:"applied-hint"})
    : await authority.submitRaceGuess({runId:run.runId,riddleId:run.currentRiddle!.riddleId,guess:"wrong",requestId:"applied-guess"});
  /** Correct response history includes the newly consumed guess when applicable. */
  const canonical=structuredClone(history);
  if("feedback" in result)canonical.push({guess:result.feedback.map(cell=>cell.letter),feedback:result.feedback.map(cell=>cell.status)});
  result.run.currentRiddle!.confirmedGuesses=structuredClone(canonical);
  /** Changed old fact must not be allowed to validate a newly applied action. */
  const bad=structuredClone(result);
  if(mutation==="word")bad.run.currentRiddle!.confirmedGuesses![0].guess[1]="z";
  else bad.run.currentRiddle!.confirmedGuesses![0].feedback[0]="green";
  h.respond(operation,bad);
  expect(h.session.getSnapshot()).toMatchObject({error:"RaceTo10.ERROR_INVALID_RESPONSE",requiresRunRefresh:true,raceGuesses:before,run:{currentRiddle:{guessesUsed:3}}});
  h.session.retry();expect(h.last().type).toBe("game:resumeRace");
  /** Owned canonical refresh reconciles the applied mutation without replaying its receipt. */
  const resumed=await authority.resumeRace(run.runId);resumed.run.currentRiddle!.confirmedGuesses=canonical;h.respond("raceResume",resumed);
  expect(h.session.getSnapshot()).toMatchObject({error:null,requiresRunRefresh:false,raceGuesses:canonical});
  expect(h.commands.filter(command=>command.type===(operation==="raceHint"?"game:requestRaceHint":"game:submitRaceGuess"))).toHaveLength(1);
});
