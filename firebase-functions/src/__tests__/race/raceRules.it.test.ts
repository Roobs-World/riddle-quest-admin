import {readFileSync} from "node:fs";
import {join} from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {doc, getDoc, setDoc} from "firebase/firestore";

/** Defines the project id value. */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
/** Provides test environment behavior. */
let testEnvironment: RulesTestEnvironment;

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {rules: readFileSync(join(__dirname, "../../../firestore.rules"), "utf8")},
  });
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    /** Provides db behavior. */
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, "localizedRiddles/en/riddles/history-1"), {text: "Secret clue", answer: "piano"}),
      setDoc(doc(db, "raceDecks/deck-1"), {answers: ["piano"]}),
      setDoc(doc(db, "raceRuns/run-1"), {userId: "player-1", answer: "piano"}),
      setDoc(doc(db, "raceChallenges/challenge-1"), {creatorId: "player-1"}),
      setDoc(doc(db, "raceInviteLobbies/challenge-1"), {
        creatorId: "player-1",
        recipientId: null,
        status: "reserved",
      }),
      setDoc(doc(db, "raceInviteRequests/player-1_request-1"), {
        userId: "player-1",
        challengeId: "challenge-1",
      }),
      setDoc(doc(db, "raceAttempts/attempt-1"), {playerId: "player-1"}),
      setDoc(doc(db, "raceStartRequests/start-1"), {userId: "player-1"}),
      setDoc(doc(db, "raceConfig/rollout"), {enabled: false, percentage: 0}),
      setDoc(doc(db, "raceConfig/maintenance"), {projectionReconciliationEnabled: false}),
      setDoc(doc(db, "raceConfig/matchPolicy"), {schemaVersion: 1, algorithmVersion: 2}),
      setDoc(doc(db, "raceMaintenance/projectionReconciliation"), {phase: "challenges", afterId: null}),
      setDoc(doc(db, "raceMatchCandidates/challenge-1"), {challengeId: "challenge-1"}),
      setDoc(doc(db, "raceMatchOffers/offer-1"), {userId: "player-1"}),
      setDoc(doc(db, "raceSettlementOutbox/run-1"), {userId: "player-1"}),
      setDoc(doc(db, "racePerformanceOutbox/run-1"), {userId: "player-1"}),
      setDoc(doc(db, "raceDeadlineFailures/run-1"), {runId: "run-1"}),
      setDoc(doc(db, "users/player-1/raceMatchProfiles/en"), {version: 1}),
      setDoc(doc(db, "raceAnalytics/event-1"), {eventName: "race_mode_viewed"}),
      setDoc(doc(db, "users/player-1/raceInbox/item-1"), {challengeId: "challenge-1"}),
      setDoc(doc(db, "users/player-1"), {userId: "player-1", username: "Player", coins: 300}),
      setDoc(doc(db, "tutorialProgress/player-1"), {completed: false}),
    ]);
  });
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe("Race to 10 Firestore trust boundary", () => {
  it("allows the Admin test context to seed authoritative state", async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await assertSucceeds(getDoc(doc(context.firestore(), "raceRuns/run-1")));
    });
  });

  it("denies authenticated clients access to source answers and every race collection", async () => {
    /** Provides db behavior. */
    const db = testEnvironment.authenticatedContext("player-1").firestore();
    /** Provides paths behavior. */
    const paths = [
      "localizedRiddles/en/riddles/history-1",
      "raceDecks/deck-1",
      "raceRuns/run-1",
      "raceChallenges/challenge-1",
      "raceInviteLobbies/challenge-1",
      "raceInviteRequests/player-1_request-1",
      "raceAttempts/attempt-1",
      "raceStartRequests/start-1",
      "raceConfig/rollout",
      "raceConfig/maintenance",
      "raceConfig/matchPolicy",
      "raceMaintenance/projectionReconciliation",
      "raceMatchCandidates/challenge-1",
      "raceMatchOffers/offer-1",
      "raceSettlementOutbox/run-1",
      "racePerformanceOutbox/run-1",
      "raceDeadlineFailures/run-1",
      "users/player-1/raceMatchProfiles/en",
      "raceAnalytics/event-1",
      "users/player-1/raceInbox/item-1",
    ];
    for (const path of paths) {
      await assertFails(getDoc(doc(db, path)));
      await assertFails(setDoc(doc(db, path), {forged: true}));
    }
  });

  it("denies unauthenticated clients too", async () => {
    /** Provides db behavior. */
    const db = testEnvironment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "raceChallenges/challenge-1")));
    await assertFails(setDoc(doc(db, "raceRuns/run-2"), {userId: "attacker"}));
    await assertFails(getDoc(doc(db, "raceMaintenance/projectionReconciliation")));
    await assertFails(setDoc(doc(db, "raceConfig/maintenance"), {projectionReconciliationEnabled: true}));
    await assertFails(getDoc(doc(db, "raceConfig/matchPolicy")));
    await assertFails(setDoc(doc(db, "raceConfig/matchPolicy"), {revision: 999}));
  });

  it("allows a player to read but never directly mutate their authoritative profile", async () => {
    /** Provides db behavior. */
    const db = testEnvironment.authenticatedContext("player-1").firestore();
    await assertSucceeds(getDoc(doc(db, "users/player-1")));
    await assertFails(setDoc(doc(db, "users/player-1"), {userId: "player-1", username: "Forged"}, {merge: true}));
    await assertFails(setDoc(doc(db, "tutorialProgress/player-1"), {completed: true}, {merge: true}));
  });

  it("prevents one authenticated player from reading another player's profile", async () => {
    /** Provides db behavior. */
    const db = testEnvironment.authenticatedContext("attacker").firestore();
    await assertFails(getDoc(doc(db, "users/player-1")));
  });
});
