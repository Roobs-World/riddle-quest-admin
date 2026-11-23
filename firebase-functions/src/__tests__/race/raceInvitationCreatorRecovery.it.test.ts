import {getApps,initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {createHash} from "node:crypto";
import {RACE_RULES, type CancelRaceInviteRequest} from "@riddle-quest/core/race";
import {getRaceEntryForUser,cancelRaceInviteForUser} from "../../race/raceInvitation";
import {raceDeckContentVersion} from "../../race/raceDeckSnapshot";

/** Only the dedicated loopback demo owns these profile, invitation and recording fixtures. */
const PROJECT=process.env.GCLOUD_PROJECT??"",A=`jest_${"a".repeat(40)}`,B=`jest_${"b".repeat(40)}`,NOW=1_800_000_000_000;
/** A canonical reservation, not a client prefix, establishes the original creator. */
const ID=`jest-invite-${createHash("sha256").update(A).digest("hex")}-${"c".repeat(32)}`;
/** Real Firestore transactions retain permissions and atomic cancellation behavior. */
let db:FirebaseFirestore.Firestore;
/** Cleanup stays within the private demo and named identities. */
const clear=async()=>{for(const name of ["raceInviteLobbies","raceInviteRequests","raceChallenges","raceRuns","raceDecks","raceAttempts","raceStartRequests"])await db.recursiveDelete(db.collection(name));for(const owner of[A,B]){await db.recursiveDelete(db.doc(`users/${owner}`));await db.recursiveDelete(db.doc(`jestAccountDeletionTombstones/${owner}`));}};
beforeAll(()=>{if(!PROJECT.startsWith("demo-")||!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST??""))throw new Error("Private loopback demo required");if(!getApps().length)initializeApp({projectId:PROJECT});db=getFirestore();});
beforeEach(clear);afterAll(clear);
/** Completed original metadata and truthful scoring isolate retained-source structural corruption. */
const seed=async()=>{
  /** Original fifteen-question snapshot and ten successful authority events. */
  const riddles=Array.from({length:15},(_,position)=>({riddleId:`creator-${position}`,canonicalRiddleId:`history:${position}`,text:`Original clue ${position}`,answer:"piano",position}));
  /** Competitive facts remain valid before deliberately corrupting a later unused clue. */
  const events=Array.from({length:10},(_,index)=>({sequence:index,type:"correct",riddlePosition:index,wallElapsedMs:(index+1)*1000,penaltyAddedMs:0,totalPenaltyMs:0,adjustedElapsedMs:(index+1)*1000,correctCount:index+1}));
  await db.doc(`raceInviteLobbies/${ID}`).set({challengeId:ID,creatorId:A,locale:"en",status:"published",claimState:"unclaimed",publicationState:"published",createdAtMs:NOW-20000,expiresAtMs:NOW+100000});
  await db.doc(`raceChallenges/${ID}`).set({challengeId:ID,scope:"invitation",creatorId:A,creatorRunId:"creator-run",creatorSnapshot:{displayName:"Creator"},categoryId:"history",locale:"en",deckId:"creator-deck",canonicalRiddleIds:riddles.map(x=>x.canonicalRiddleId),targetCorrect:10,creatorWallFinishMs:10000,creatorHintPenaltyMs:0,creatorSkipPenaltyMs:0,creatorTotalPenaltyMs:0,creatorAdjustedFinishMs:10000,ghostEvents:events,rules:RACE_RULES,contentVersion:raceDeckContentVersion(riddles),status:"active",createdAtMs:NOW-10000,expiresAtMs:NOW+100000,riddles,snapshotVersion:1});
  await db.doc(`users/${A}`).set({username:"Creator",coins:500});await db.doc(`users/${B}`).set({username:"Recipient",coins:500});
  return riddles;
};
it.each(["clue","rules","ghost"])("keeps authenticated creator cancellation available with malformed %s metadata",async kind=>{
  /** Metadata corruption cannot remove ownership of the independently valid reservation. */
  const riddles=await seed();
  if(kind==="clue")await db.doc(`raceChallenges/${ID}`).update({riddles:riddles.map((riddle,index)=>index===14?{...riddle,text:"Q".repeat(2001)}:riddle)});
  else await db.doc(`raceChallenges/${ID}`).update(kind==="rules"?{rules:{version:"broken"}}:{ghostEvents:[{type:"broken"}]});
  /** Readiness remains unavailable while the owner retains a privacy-safe independent action. */
  const before=await db.doc(`raceInviteLobbies/${ID}`).get(),entry=await getRaceEntryForUser(A,ID,"en",{db,nowMs:NOW,includeViewerRole:true});
  /** The existing authority endpoint already accepts this valid owner/lobby despite malformed source content. */
  const input={challengeId:ID,locale:"en",requestId:"cancel-malformed-creator"} satisfies CancelRaceInviteRequest,cancelled=await cancelRaceInviteForUser(A,input,{db,nowMs:NOW+1});
  expect(cancelled).toMatchObject({status:"cancelled",invitation:{role:"creator",canCancel:false}});expect(await cancelRaceInviteForUser(A,input,{db,nowMs:NOW+2})).toEqual(cancelled);
  expect(before.exists).toBe(true);
  expect(entry).toMatchObject({status:"unavailable",reason:"invalid",invitation:{role:"creator",canCancel:true,claimState:"unclaimed",publicationState:"published"}});
  expect((await db.doc(`users/${A}`).get()).data()?.coins).toBe(500);
  expect((await db.doc(`users/${B}`).get()).data()?.coins).toBe(500);
  expect((await db.doc(`raceInviteLobbies/${ID}`).get()).data()?.recipientId).toBeUndefined();
  expect((await db.collection("raceInviteRequests").get()).size).toBe(1);
  expect((await db.collection("raceRuns").get()).size).toBe(0);
  expect((await db.collection("raceAttempts").get()).size).toBe(0);
});
it("retains cold creator cancellation state when the revoked original recording remains malformed",async()=>{
  /** A canonical cancel receipt is independent of parsing the old question payload. */
  const riddles=await seed();await db.doc(`raceChallenges/${ID}`).update({riddles:riddles.map((riddle,index)=>index===14?{...riddle,text:"Q".repeat(2001)}:riddle)});
  await cancelRaceInviteForUser(A,{challengeId:ID,locale:"en",requestId:"cold-malformed-cancel"},{db,nowMs:NOW+1});
  /** Cold reload reads independent authoritative lifecycle facts without trusting client memory. */
  const entry=await getRaceEntryForUser(A,ID,"en",{db,nowMs:NOW+2,includeViewerRole:true});
  expect(entry).toMatchObject({status:"cancelled",invitation:{role:"creator",canCancel:false}});
});

/** Recovery never admits a recipient, bypasses authorization or adds fields to an old client response. */
it.each(["legacy", "recipient", "deleted", "locale", "owner-conflict", "reservation-invalid", "blocked"])("keeps malformed creator recovery closed for %s", async kind => {
  await seed();
  await db.doc(`raceChallenges/${ID}`).update({ghostEvents:[{type:"broken"}]});
  if (kind === "deleted") await db.doc(`jestAccountDeletionTombstones/${A}`).set({deleted:true});
  if (kind === "owner-conflict") await db.doc(`raceChallenges/${ID}`).update({creatorId:B});
  if (kind === "reservation-invalid") await db.doc(`raceInviteLobbies/${ID}`).update({status:"broken"});
  if (kind === "blocked") await db.doc(`users/${B}/blockedRivals/${A}`).set({blocked:true});
  /** Entry reads cannot claim or alter a malformed recording's independent lobby. */
  const before = await db.doc(`raceInviteLobbies/${ID}`).get();
  /** Only the same-provider recipient is selected for the recipient and blocked cases. */
  const actor = kind === "recipient" || kind === "blocked" ? B : A;
  /** Locale and deletion checks must still precede creator recovery. */
  const entry = await getRaceEntryForUser(actor,ID,kind === "locale" ? "fr" : "en",{db,nowMs:NOW,includeViewerRole:kind !== "legacy"});
  expect(entry).toMatchObject({status:"unavailable",reason:kind === "deleted" ? "deleted" : kind === "locale" ? "locale" : kind === "blocked" ? "blocked" : "invalid"});
  expect(entry).not.toHaveProperty("invitation");
  expect((await db.doc(`raceInviteLobbies/${ID}`).get()).updateTime?.valueOf()).toEqual(before.updateTime?.valueOf());
});
