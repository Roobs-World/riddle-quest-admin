import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {beforeAll, afterAll, describe, it, beforeEach} from "@jest/globals";
import {doc, getDoc, setDoc, updateDoc, deleteDoc} from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

let testEnv: RulesTestEnvironment;
const PROJECT_ID = "qwordly-rules-test"; // Use a unique project ID for testing

interface UserData {
  email?: string;
  displayName?: string;
  coins?: number;
  // Add other user fields as necessary for your tests
}

// Helper function to get an authenticated Firestore client
function getAuthedFirestore(auth?: {uid: string; email?: string}) {
  if (!testEnv) throw new Error("Test environment not initialized");

  // TokenOptions typically include custom claims, email, etc., but not the uid itself as it's the first param.
  let tokenOptionsOverride: {email?: string} | undefined = undefined;
  if (auth?.email) {
    tokenOptionsOverride = {email: auth.email};
  }

  return testEnv.authenticatedContext(auth?.uid || "test-user", tokenOptionsOverride).firestore();
}

// Helper function to get an unauthenticated Firestore client
function getUnauthedFirestore() {
  if (!testEnv) throw new Error("Test environment not initialized");
  return testEnv.unauthenticatedContext().firestore();
}

beforeAll(async () => {
  try {
    const rulesPath = path.join(__dirname, "../../firestore.rules"); // Adjusted path
    const rules = fs.readFileSync(rulesPath, "utf8");
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: rules,
        host: "localhost", // Ensure your emulator is running on this host/port
        port: 8096,
      },
    });
  } catch (error) {
    console.error("Error initializing test environment:", error);
    throw error;
  }
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

describe("Firestore Security Rules", () => {
  const alice = {uid: "alice", email: "alice@example.com"};
  const bob = {uid: "bob", email: "bob@example.com"};

  describe("Users Collection (/users/{userId})", () => {
    const aliceDocPath = `users/${alice.uid}`;
    const bobDocPath = `users/${bob.uid}`;
    const sampleUserData: UserData = {email: "test@example.com", coins: 100};

    // Setup initial data for some tests
    beforeEach(async () => {
      if (testEnv) {
        // Alice creates her own document (should succeed)
        await testEnv.withSecurityRulesDisabled(async (context) => {
          const adminDb = context.firestore();
          await setDoc(doc(adminDb as any, aliceDocPath), {...sampleUserData, ownerId: alice.uid});
        });
      }
    });

    // --- Read Tests ---
    it("should allow an authenticated user to read any user document", async () => {
      const db = getAuthedFirestore(bob);
      await assertSucceeds(getDoc(doc(db as any, aliceDocPath)));
    });

    it("should NOT allow an unauthenticated user to read user documents", async () => {
      const db = getUnauthedFirestore();
      await assertFails(getDoc(doc(db as any, aliceDocPath)));
    });

    // --- Create Tests ---
    it("should allow a user to create their own document", async () => {
      const db = getAuthedFirestore(bob);
      await assertSucceeds(setDoc(doc(db as any, bobDocPath), {...sampleUserData, ownerId: bob.uid}));
    });

    it("should NOT allow a user to create another user's document", async () => {
      const db = getAuthedFirestore(alice);
      // Alice tries to create Bob's document
      await assertFails(setDoc(doc(db as any, bobDocPath), {...sampleUserData, ownerId: bob.uid}));
    });

    it("should NOT allow an unauthenticated user to create a user document", async () => {
      const db = getUnauthedFirestore();
      await assertFails(setDoc(doc(db as any, `users/someUser`), sampleUserData));
    });

    // --- Update Tests ---
    it("should allow a user to update their own document", async () => {
      const db = getAuthedFirestore(alice);
      await assertSucceeds(updateDoc(doc(db as any, aliceDocPath), {coins: 200}));
    });

    it("should NOT allow a user to update another user's document", async () => {
      const db = getAuthedFirestore(bob); // Bob tries to update Alice's doc
      await assertFails(updateDoc(doc(db as any, aliceDocPath), {coins: 300}));
    });

    it("should NOT allow an unauthenticated user to update a user document", async () => {
      const db = getUnauthedFirestore();
      await assertFails(updateDoc(doc(db as any, aliceDocPath), {coins: 400}));
    });

    // --- Delete Tests ---
    it("should NOT allow a user to delete their own document", async () => {
      const db = getAuthedFirestore(alice);
      await assertFails(deleteDoc(doc(db as any, aliceDocPath)));
    });

    it("should NOT allow a user to delete another user's document", async () => {
      const db = getAuthedFirestore(bob);
      await assertFails(deleteDoc(doc(db as any, aliceDocPath)));
    });

    it("should NOT allow an unauthenticated user to delete a user document", async () => {
      const db = getUnauthedFirestore();
      await assertFails(deleteDoc(doc(db as any, aliceDocPath)));
    });
  });

  // TODO: Add tests for 'riddles' collection
  // TODO: Add tests for 'userClassicProgress' collection
  // TODO: Add tests for 'dailyChallenge' collection
  // TODO: Add tests for 'userDailyChallengeAttempts' collection
  // TODO: Add tests for default deny rule (match /{document=**})
});
