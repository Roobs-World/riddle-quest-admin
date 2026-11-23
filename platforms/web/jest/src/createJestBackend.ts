import {JestBackendClient, type JestBackendPort} from "./backend";
import {readBrowserStorage, writeBrowserStorage} from "../../../../src/web/platform/browserStorage";

/** Describes auth harness state. */
type AuthHarnessState = {
  /** Stores scenario. */
  scenario?: string;
  /** Stores backend exchanges. */
  backendExchanges?: string[];
  /** Stores signed deletion retries. */
  backendDeletionRetries?: string[];
};

/** Gets harness state. */
const getHarnessState = () =>
  (
    window as typeof window & {
      /** Stores riddle quest jest auth test. */
      __RIDDLE_QUEST_JEST_AUTH_TEST__?: AuthHarnessState;
    }
  ).__RIDDLE_QUEST_JEST_AUTH_TEST__;

/** Creates either the deterministic test backend or the production HTTPS client. */
export function createJestBackend({
  authHarness,
  mockRuntime,
}: {
  /** Stores auth harness. */
  authHarness: boolean;
  /** Stores mock runtime. */
  mockRuntime: boolean;
}): JestBackendPort {
  if (!mockRuntime) {
    return new JestBackendClient(import.meta.env.VITE_JEST_FUNCTIONS_BASE_URL || "/", {
      allowInsecureLoopback: import.meta.env.DEV,
    });
  }

  return {
    exchangeIdentity: async (playerSigned: string) => {
      /** Provides test state behavior. */
      const testState = authHarness ? getHarnessState() : undefined;
      testState?.backendExchanges?.push(playerSigned);
      /** Provides once key behavior. */
      const onceKey = "riddleQuest:jestAuthHarness:identityFailed";
      /** Provides registration once key behavior. */
      const registrationOnceKey = "riddleQuest:jestAuthHarness:registrationIdentityFailed";
      /** Indicates whether should fail once. */
      const shouldFailOnce =
        testState?.scenario === "identity-once-failure" && readBrowserStorage("session", onceKey) !== "1";
      /** Indicates whether should fail after registration. */
      const shouldFailAfterRegistration =
        testState?.scenario === "registration-identity-failure" && playerSigned.endsWith(":true");
      /** Indicates whether should fail after registration once. */
      const shouldFailAfterRegistrationOnce =
        testState?.scenario === "registration-identity-once-failure" &&
        playerSigned.endsWith(":true") &&
        readBrowserStorage("session", registrationOnceKey) !== "1";
      if (shouldFailOnce) writeBrowserStorage("session", onceKey, "1");
      if (shouldFailAfterRegistrationOnce) writeBrowserStorage("session", registrationOnceKey, "1");
      if (
        testState?.scenario === "identity-failure" ||
        shouldFailOnce ||
        shouldFailAfterRegistration ||
        shouldFailAfterRegistrationOnce
      ) {
        throw new Error("Mock Jest identity exchange failed");
      }
      if (testState?.scenario === "registration-account-deleted" && playerSigned.endsWith(":true"))
        return {status: "account-deleted"};
      return {status: "success", customToken: "mock", uid: "jest-mock-player"};
    },
    retryAccountDeletion: async (playerSigned) => {
      if (authHarness) getHarnessState()?.backendDeletionRetries?.push(playerSigned);
      return {accountDeleted: true};
    },
    grantPurchase: async (_signed: string, _playerId: string, purchaseToken: string) => ({
      granted: true,
      purchaseToken,
      coinsAwarded: 250,
      newCoins: 550,
    }),
    verifyReferrals: async () =>
      getHarnessState()?.scenario === "referral-reward"
        ? {
            verified: true,
            conversionCount: 1,
            rewardsGranted: 1,
            referredRewardsGranted: 1,
            coinsPerPlayer: 100,
            newCoins: 400,
          }
        : {verified: true},
    syncSubscriptions: async (subscriptionsSigned: string) => ({
      verified: true,
      activeSkus:
        subscriptionsSigned.includes(".active.") || subscriptionsSigned.includes(".subscription.")
          ? ["com.roobsworld.riddlequest.premium.monthly"]
          : [],
      blockedSkus: [],
    }),
  };
}
