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
      setDoc(doc(context.firestore(), "providerIdentities/facebook-identity-1"), {
        provider: "facebook",
        providerPlayerId: "meta-player-secret",
        uid: "facebook_uid",
        accountGeneration: 1,
      }),
      setDoc(doc(context.firestore(), "facebookIdentityNonces/nonce-1"), {
        createdAtMs: 1,
        expiresAtMs: 2,
        consumedAtMs: null,
      }),
      setDoc(doc(context.firestore(), "users/player-1/knownRivals/player-2"), {establishedAtMs: 1}),
      setDoc(doc(context.firestore(), "users/player-1/blockedRivals/player-2"), {blockedAtMs: 1}),
      setDoc(doc(context.firestore(), "socialModerationQueue/report-1"), {reporterId: "player-1"}),
      setDoc(doc(context.firestore(), "socialReportRateLimits/limit-1"), {reporterId: "player-1"}),
      setDoc(doc(context.firestore(), "facebookTournaments/tournament-1"), {locale: "en"}),
      setDoc(doc(context.firestore(), "facebookTournaments/tournament-1/entries/player-1"), {adjustedTimeMs: 1}),
      setDoc(doc(context.firestore(), "facebookCommerceAccounts/facebook_uid"), {coinDebt: 0}),
      setDoc(doc(context.firestore(), "facebookCommerceReceipts/receipt-1"), {uid: "facebook_uid"}),
      setDoc(doc(context.firestore(), "facebookCommerceRefunds/refund-1"), {uid: "facebook_uid"}),
      setDoc(doc(context.firestore(), "facebookNotificationPromptLeases/facebook_uid"), {
        uid: "facebook_uid", accepted: false,
      }),
      setDoc(doc(context.firestore(), "facebookReferralTokens/token-1"), {inviterUid: "facebook_uid"}),
      setDoc(doc(context.firestore(), "facebookReferralBindings/facebook_uid"), {inviteeUid: "facebook_uid"}),
      setDoc(doc(context.firestore(), "facebookReferralDailyCaps/cap-1"), {inviterUid: "facebook_uid"}),
      setDoc(doc(context.firestore(), "facebookReferralSettlements/settlement-1"), {inviteeUid: "facebook_uid"}),
      setDoc(doc(context.firestore(), "facebookContextCompetitions/context-1"), {
        hostUid: "facebook_uid",
        locale: "en",
        memberIds: ["facebook_uid"],
      }),
      setDoc(doc(context.firestore(), "facebookContextCompetitions/context-1/entries/facebook_uid"), {
        adjustedTimeMs: 1,
      }),
      setDoc(doc(context.firestore(), "facebookContextCompetitionHistory/context-1_1"), {
        startsAtMs: 1,
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

  it.each(["facebook_uid", "player-1", undefined])("denies Facebook identity state to client %s", async (userId) => {
    const db = userId
      ? testEnvironment.authenticatedContext(userId).firestore()
      : testEnvironment.unauthenticatedContext().firestore();
    for (const path of ["providerIdentities/facebook-identity-1", "facebookIdentityNonces/nonce-1"]) {
      await assertFails(getDoc(doc(db, path)));
      await assertFails(setDoc(doc(db, path), {forged: true}));
    }
  });

  it.each(["player-1", "player-2", undefined])("denies social safety and tournament state to client %s", async (userId) => {
    const db = userId
      ? testEnvironment.authenticatedContext(userId).firestore()
      : testEnvironment.unauthenticatedContext().firestore();
    for (const path of [
      "users/player-1/knownRivals/player-2",
      "users/player-1/blockedRivals/player-2",
      "socialModerationQueue/report-1",
      "socialReportRateLimits/limit-1",
      "facebookTournaments/tournament-1",
      "facebookTournaments/tournament-1/entries/player-1",
      "facebookCommerceAccounts/facebook_uid",
      "facebookCommerceReceipts/receipt-1",
      "facebookCommerceRefunds/refund-1",
      "facebookNotificationPromptLeases/facebook_uid",
      "facebookReferralTokens/token-1",
      "facebookReferralBindings/facebook_uid",
      "facebookReferralDailyCaps/cap-1",
      "facebookReferralSettlements/settlement-1",
      "facebookContextCompetitions/context-1",
      "facebookContextCompetitions/context-1/entries/facebook_uid",
      "facebookContextCompetitionHistory/context-1_1",
    ]) {
      await assertFails(getDoc(doc(db, path)));
      await assertFails(setDoc(doc(db, path), {forged: true}));
    }
  });
});
