import {describe,expect,it} from "@jest/globals";
import {recorded,racing} from "./raceSession.support";
import type {RaceRunView} from "@riddle-quest/core/race";

/** Changes a retained rendering reference without changing any canonical authority data. */
const mutate = (run:RaceRunView,field:string):void => {
  if(field === "runId")run.runId="another-run";
  if(field === "role")run.role="challenger";
  if(field === "categoryId")run.categoryId="history";
  if(field === "locale")run.locale="fr";
  if(field === "challengeId")run.challengeId="another-challenge";
  if(field === "rivalryChallengeId")run.rivalryChallengeId="another-rivalry";
};

describe("Race Session private command ownership",()=>{
  it.each(["runId","role","categoryId","locale","challengeId","rivalryChallengeId"])("recovers the original run after a public %s edit",async field=>{
    /** Genuine authority retains this account's original run identity. */
    const h=await racing();
    mutate(h.session.getSnapshot().run!,field);h.session.retry();
    expect(h.last()).toMatchObject({type:"game:resumeRace",payload:{runId:h.run.runId}});
    h.respond("raceResume",await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error:null,run:{runId:h.run.runId,role:"creator",categoryId:"mixed",locale:"en"}});
    expect(h.session.getSnapshot().run!.challengeId).toBeUndefined();
    expect(h.session.getSnapshot().run!.rivalryChallengeId).toBeUndefined();
    expect(h.commands.filter(command=>command.type==="game:startRace")).toHaveLength(1);
  });
  it.each(["abandon","publish"])("retains the original %s mutation receipt after a public run-ID edit and failed delivery",async operation=>{
    /** A private mutation receipt remains bound to the original authoritative run. */
    const h=operation === "publish" ? await recorded() : await racing();
    mutate(h.session.getSnapshot().run!,"runId");
    if(operation === "publish")h.session.publish();else h.session.abandon();
    /** The posted command must address only this session's confirmed run. */
    const original=h.last();
    expect(original.type).toBe(operation === "publish" ? "game:publishRace" : "game:abandonRace");
    expect(original.payload).toMatchObject({runId:h.run.runId});
    h.reject(operation === "publish" ? "racePublish" : "raceAbandon","Temporary delivery failure");h.session.retry();
    expect(h.last()).toEqual(original);
  });
  it.each(["rematch","close"])("clears the original owned pointer during %s after a public ID edit",async action=>{
    /** Cleanup cannot select another tab's pointer through mutated presentation metadata. */
    const h=action === "close" ? await recorded() : await racing();
    mutate(h.session.getSnapshot().run!,"runId");
    if(action === "close")h.session.requestClose();else h.session.rematch();
    expect(h.clearCalls).toEqual([{ownerId:"owner-1",runId:h.run.runId}]);
  });
  it("persists confirmed identity when a synchronous observer edits a delivered run reference",async()=>{
    /** A state observer runs between accepted authority and optional persistence. */
    const h=await racing(),before=h.session.getSnapshot().run;
    h.session.subscribe(()=>{if(h.session.getSnapshot().run&&h.session.getSnapshot().run!==before)mutate(h.session.getSnapshot().run!,"runId");});
    h.session.retry();h.respond("raceResume",await h.authority.resumeRace(h.run.runId));
    expect(h.saved.at(-1)).toEqual({ownerId:"owner-1",runId:h.run.runId});
  });
  it.each(["role","categoryId","challengeId","rivalryChallengeId"])("rejects a response matching the edited public %s rather than the private contract",async field=>{
    /** Both the UI edit and response must remain outside the confirmed authority boundary. */
    const h=await racing(),forged=structuredClone(h.run);
    mutate(h.session.getSnapshot().run!,field);mutate(forged,field);h.session.retry();
    h.respond("raceResume",{run:forged});
    expect(h.session.getSnapshot().error).toBe("RaceTo10.ERROR_INVALID_RESPONSE");
    h.session.retry();h.respond("raceResume",await h.authority.resumeRace(h.run.runId));
    expect(h.session.getSnapshot()).toMatchObject({error:null,run:{runId:h.run.runId,role:"creator",categoryId:"mixed"}});
  });
});
