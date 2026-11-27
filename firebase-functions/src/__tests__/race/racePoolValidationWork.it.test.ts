import {mkdirSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {listRaceCategoriesForLocale} from "../../race/raceSetupService";
import {startRaceRunForUser} from "../../race/raceService";
import {joinLiveRaceForUser} from "../../race/live/raceLiveService";

/** All catalog, account and gameplay observations belong to one private loopback demo. */
const PROJECT=process.env.GCLOUD_PROJECT??"", A=`facebook_${"a".repeat(40)}`, NOW=1_800_000_000_000;
/** Actual queries and commits exercise category listing, recording and both live admission paths. */
let db: FirebaseFirestore.Firestore;
/** Only the invoking isolated demo owns these collections. */
const clear=async()=>{
  for(const name of ["localizedRiddles","raceRuns","raceDecks","raceStartRequests","raceAttempts","raceMatchCandidates","liveRaceTickets","liveRacePlayers","liveRaceQueues","liveRaceSignals","liveRaceMatches"])
    await db.recursiveDelete(db.collection(name));
  await db.recursiveDelete(db.doc(`users/${A}`));await db.recursiveDelete(db.doc(`jestAccountDeletionTombstones/${A}`));
};
beforeAll(()=>{
  if(!PROJECT.startsWith("demo-")||!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST??""))throw new Error("Private loopback demo required");
  if(!getApps().length)initializeApp({projectId:PROJECT});db=getFirestore();
});
beforeEach(clear);afterAll(clear);
/** Each storage-sized fixture fits below Firestore's document byte budget. */
const cases=[{name:"minimum",answer:"x".repeat(129)},{name:"fullwidth",answer:"Ａ".repeat(200000)},
  {name:"combining",answer:"a\u0301".repeat(100000)},{name:"joined-emoji",answer:"👩‍👩‍👧‍👦".repeat(10000)}];
it.each(cases)("rejects $name at actual game boundaries without oversized Unicode work or accepted writes",async({name,answer})=>{
  /** One invalid pool and one unaffected valid pool share the actual projected catalog query. */
  const batch=db.batch();
  for(const category of ["history","music"] as const)for(let index=0;index<30;index++)batch.set(db.doc(`localizedRiddles/en/riddles/work-${category}-${index}`),{
    riddleId:`work-${category}-${index}`,canonicalRiddleId:`${category}:${index}`,text:`Original ${category} clue ${index} follows a distinct trail`,
    answer:category==="history"&&index===0?answer:`${category==="history"?"a":"b"}${String(index).padStart(6,"0")}`,
    categoryId:category,difficultyBand:["easy","medium","hard"][index%3],raceEligible:true,qualityVersion:"human_review_v1"});
  batch.set(db.doc(`users/${A}`),{username:"Catalog Work",coins:500});await batch.commit();
  /** Versions detect even a profile rewrite that keeps the apparent balance unchanged. */
  const before=await db.doc(`users/${A}`).get(), original=String.prototype.normalize, calls:number[]=[];
  /** The complete authority paths retain real ICU processing while exposing its oversized-input work. */
  const spy=jest.spyOn(String.prototype,"normalize").mockImplementation(function(this:string,form?:string){
    /** Match exact unchanged source bytes instead of unrelated SDK string normalization. */
    const value=String(this);if(value===answer)calls.push(value.length);return original.call(value,form);
  });
  try{
    expect((await listRaceCategoriesForLocale("en",db)).categories.map(category=>category.categoryId)).toEqual(["music"]);
    await expect(startRaceRunForUser(A,{locale:"en",categoryId:"history",requestId:"work-record"},{db,nowMs:NOW})).rejects.toThrow("Race category is not ready");
    for(const createChallenge of [false,true])await expect(joinLiveRaceForUser(A,{locale:"en",categoryId:"history",requestId:`work-live-${createChallenge}`,createChallenge},{db,nowMs:NOW})).rejects.toThrow("Race category is not ready");
  }finally{spy.mockRestore();}
  /** Rejection cannot publish pointers, runs, receipts, queues, seats or signals. */
  for(const collection of ["raceRuns","raceDecks","raceStartRequests","raceAttempts","raceMatchCandidates","liveRaceTickets","liveRacePlayers","liveRaceQueues","liveRaceSignals","liveRaceMatches"])
    expect((await db.collection(collection).get()).empty).toBe(true);
  expect((await db.collection(`users/${A}/raceMatchProfiles`).get()).empty).toBe(true);
  /** Canonical source text and profile versions remain byte-exact across every rejecting boundary. */
  const after=await db.doc(`users/${A}`).get();expect(after.data()).toEqual(before.data());expect(after.updateTime?.valueOf()).toBe(before.updateTime?.valueOf());
  expect((await db.doc("localizedRiddles/en/riddles/work-history-0").get()).data()?.answer).toBe(answer);
  /** Named actual SDK traces retain work dimensions and durable account versions. */
  const directory=process.env.RACE_CATALOG_SDK_TRACE;
  if(directory){mkdirSync(directory,{recursive:true});writeFileSync(join(directory,`${name}.json`),JSON.stringify({name,answerUnits:answer.length,
    answerBytes:Buffer.byteLength(answer),answerNormalizationCalls:calls.length,answerNormalizationUnits:calls.reduce((sum,n)=>sum+n,0),
    before:{data:before.data(),version:before.updateTime?.valueOf()},after:{data:after.data(),version:after.updateTime?.valueOf()}},null,2));}
  expect(calls).toEqual([]);
});
