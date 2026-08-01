import {readFileSync} from "node:fs";
import {join} from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {doc, getDoc, setDoc} from "firebase/firestore";

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
let testEnvironment: RulesTestEnvironment;

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {rules: readFileSync(join(__dirname, "../../firestore.rules"), "utf8")},
  });
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, "localizedRiddles/en/riddles/history-1"), {text: "Secret clue", answer: "piano"}),
      setDoc(doc(db, "raceDecks/deck-1"), {answers: ["piano"]}),
      setDoc(doc(db, "raceRuns/run-1"), {userId: "player-1", answer: "piano"}),
      setDoc(doc(db, "raceChallenges/challenge-1"), {creatorId: "player-1"}),
      setDoc(doc(db, "raceAttempts/attempt-1"), {playerId: "player-1"}),
      setDoc(doc(db, "raceStartRequests/start-1"), {userId: "player-1"}),
      setDoc(doc(db, "raceConfig/rollout"), {enabled: false, percentage: 0}),
      setDoc(doc(db, "raceAnalytics/event-1"), {eventName: "race_mode_viewed"}),
      setDoc(doc(db, "users/player-1/raceInbox/item-1"), {challengeId: "challenge-1"}),
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
    const db = testEnvironment.authenticatedContext("player-1").firestore();
    const paths = [
      "localizedRiddles/en/riddles/history-1",
      "raceDecks/deck-1",
      "raceRuns/run-1",
      "raceChallenges/challenge-1",
      "raceAttempts/attempt-1",
      "raceStartRequests/start-1",
      "raceConfig/rollout",
      "raceAnalytics/event-1",
      "users/player-1/raceInbox/item-1",
    ];
    for (const path of paths) {
      await assertFails(getDoc(doc(db, path)));
      await assertFails(setDoc(doc(db, path), {forged: true}));
    }
  });

  it("denies unauthenticated clients too", async () => {
    const db = testEnvironment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "raceChallenges/challenge-1")));
    await assertFails(setDoc(doc(db, "raceRuns/run-2"), {userId: "attacker"}));
  });
});
