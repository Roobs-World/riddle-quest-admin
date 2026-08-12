import {readFileSync} from "node:fs";
import {join} from "node:path";
import {assertFails, initializeTestEnvironment, type RulesTestEnvironment} from "@firebase/rules-unit-testing";
import {doc, getDoc, setDoc} from "firebase/firestore";

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
let testEnvironment: RulesTestEnvironment;

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {rules: readFileSync(join(__dirname, "../../firestore.rules"), "utf8")},
  });
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await Promise.all([
      setDoc(doc(context.firestore(), "usernameReservations/reservation-1"), {userId: "player-1"}),
      setDoc(doc(context.firestore(), "usernameReservationMigrations/v1"), {complete: true}),
      setDoc(doc(context.firestore(), "leaderboard/player-1"), {
        userId: "player-1",
        subjectUserId: "player-1",
        username: "Player One",
      }),
    ]);
  });

});

afterAll(async () => testEnvironment.cleanup());

describe("username reservation Firestore boundary", () => {
  it.each(["player-1", undefined])("denies direct leaderboard access to client %s", async (userId) => {
    const db = userId
      ? testEnvironment.authenticatedContext(userId).firestore()
      : testEnvironment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "leaderboard/player-1")));
    await assertFails(setDoc(doc(db, "leaderboard/player-1"), {username: "forged"}));
  });

  it.each(["player-1", undefined])("denies reservation and migration state to client %s", async (userId) => {
    const db = userId
      ? testEnvironment.authenticatedContext(userId).firestore()
      : testEnvironment.unauthenticatedContext().firestore();
    for (const path of ["usernameReservations/reservation-1", "usernameReservationMigrations/v1"]) {
      await assertFails(getDoc(doc(db, path)));
      await assertFails(setDoc(doc(db, path), {forged: true}));
    }
  });
});
