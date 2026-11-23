import {describe,expect,it} from "@jest/globals";
import {catalog,fixture,harness,racing} from "./raceSession.support";
import {createFakeRaceServices} from "../testing/fakeRaceServices";

/** Removes optional answer payloads while retaining the same canonical question and clock. */
const answerFree = <T extends {
  /** Canonical run retained while stripping optional answer payloads. */
  run: Awaited<ReturnType<typeof fixture>>;
}>(response:T):T => {
  /** Wire omission must not modify the independent authority fixture. */
  const wire=structuredClone(response);
  delete wire.run.preloadedRiddles;
  if(wire.run.currentRiddle)delete wire.run.currentRiddle.evaluation;
  return wire;
};

describe("Race Session privately known answer feedback",()=>{
  it.each(["both","prompt","deck"])("retains exact colors after omitting previously confirmed %s answer data",async known=>{
    /** Initial authority confirms an answer through the supported optional paths. */
    const authority=createFakeRaceServices(),run=await fixture(false,authority),h=harness();
    if(known === "prompt")delete run.preloadedRiddles;
    if(known === "deck")delete run.currentRiddle!.evaluation;
    h.respond("raceCategories",await catalog());h.session.begin("mixed");h.respond("raceStart",{run});h.advance(3480);
    h.session.retry();h.respond("raceResume",answerFree(await authority.resumeRace(run.runId)));
    expect(h.session.getSnapshot().run!.currentRiddle!.evaluation).toBeUndefined();
    expect(h.session.getSnapshot().run!.preloadedRiddles).toBeUndefined();
    h.session.input("text","zzzzz");h.session.submit();
    /** Arithmetic, attempt count and feedback echo remain valid; only one positional color is wrong. */
    const response=answerFree(await authority.submitRaceGuess({runId:run.runId,riddleId:run.currentRiddle!.riddleId,guess:"zzzzz",requestId:"known-answer"}));
    response.feedback[0].status="yellow";h.respond("raceGuess",response);
    expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_INVALID_RESPONSE");
    h.session.retry();h.respond("raceResume",answerFree(await authority.resumeRace(run.runId)));
    expect(h.session.getSnapshot()).toMatchObject({error:null,currentLetters:[..."zzzzz"],run:{currentRiddle:{guessesUsed:1}}});
    expect(h.commands.filter(command=>command.type==="game:submitRaceGuess")).toHaveLength(1);
  });
  it.each(["canonical","matching-public-edit"])("uses the private answer over an edited projection checkpoint: %s",async delivery=>{
    /** A retained public evaluation cannot redefine the owned answer before submission. */
    const h=await racing();h.session.getSnapshot().run!.currentRiddle!.evaluation!.answer="ziano";
    h.session.input("text","zzzzz");h.session.submit();
    /** Genuine authority still scores against the original piano answer. */
    const response=structuredClone(await h.authority.submitRaceGuess({runId:h.run.runId,riddleId:h.run.currentRiddle!.riddleId,guess:"zzzzz",requestId:"private-answer"}));
    if(delivery === "matching-public-edit")response.feedback[0].status="green";
    h.respond("raceGuess",response);
    expect(h.session.getSnapshot().error).toBe(delivery === "canonical" ? null : "RaceTo10.ERROR_INVALID_RESPONSE");
  });
  it("accepts canonical wrong feedback after optional answer data disappears",async()=>{
    /** Compatibility omissions do not require decorating the public wire snapshot. */
    const h=await racing();h.session.retry();h.respond("raceResume",answerFree(await h.authority.resumeRace(h.run.runId)));
    h.session.input("text","zzzzz");h.session.submit();
    h.respond("raceGuess",answerFree(await h.authority.submitRaceGuess({runId:h.run.runId,riddleId:h.run.currentRiddle!.riddleId,guess:"zzzzz",requestId:"valid-known-answer"})));
    expect(h.session.getSnapshot()).toMatchObject({error:null,run:{currentRiddle:{guessesUsed:1}},raceGuesses:[{guess:[..."zzzzz"],feedback:["red","red","red","red","red"]}]});
  });
  it("keeps genuinely answer-free legacy feedback compatible without inventing color evidence",async()=>{
    /** No accepted answer exists in this client's lifetime. */
    const authority=createFakeRaceServices(),{run}=await authority.startRace({locale:"en",categoryId:"mixed",requestId:"unknown-answer",includeEvaluation:false}),h=harness();
    h.respond("raceCategories",await catalog());h.session.begin("mixed");h.respond("raceStart",{run});h.advance(3480);
    h.session.input("text","zzzzz");h.session.submit();
    /** Unknown answers allow internally shaped non-green feedback; exact colors cannot be independently proved. */
    const response=await authority.submitRaceGuess({runId:run.runId,riddleId:run.currentRiddle!.riddleId,guess:"zzzzz",requestId:"legacy-guess"});
    response.feedback[0].status="yellow";h.respond("raceGuess",response);
    expect(h.session.getSnapshot().error).toBeNull();
  });
});
