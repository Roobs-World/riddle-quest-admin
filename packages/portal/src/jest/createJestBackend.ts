import {JestBackendClient, type JestBackendPort} from "./backend";

/** Describes auth harness state. */
type AuthHarnessState = {
  /** Stores scenario. */
  scenario?: string;
  /** Stores backend exchanges. */
  backendExchanges?: string[];
};

/** Gets harness state. */
const getHarnessState = () => (
  window as typeof window & {__RIDDLE_QUEST_JEST_AUTH_TEST__?: AuthHarnessState}
).__RIDDLE_QUEST_JEST_AUTH_TEST__;

/** Creates either the deterministic test backend or the production HTTPS client. */
export function createJestBackend({
  authHarness,
  mockRuntime,
}: {
  authHarness: boolean;
  mockRuntime: boolean;
}): JestBackendPort {
  if (!mockRuntime) {
    return new JestBackendClient(import.meta.env.VITE_JEST_FUNCTIONS_BASE_URL || "/", {
      allowInsecureLoopback: import.meta.env.DEV,
    });
  }

  return {
    exchangeIdentity: async (playerSigned: string) => {
      const testState = authHarness ? getHarnessState() : undefined;
      testState?.backendExchanges?.push(playerSigned);
      const onceKey = "riddleQuest:jestAuthHarness:identityFailed";
      const shouldFailOnce =
        testState?.scenario === "identity-once-failure" && sessionStorage.getItem(onceKey) !== "1";
      if (shouldFailOnce) sessionStorage.setItem(onceKey, "1");
      if (testState?.scenario === "identity-failure" || shouldFailOnce) {
        throw new Error("Mock Jest identity exchange failed");
      }
      return {customToken: "mock", uid: "jest-mock-player"};
    },
    grantPurchase: async (_signed: string, _playerId: string, purchaseToken: string) => ({
      granted: true,
      purchaseToken,
      coinsAwarded: 250,
      newCoins: 550,
    }),
    verifyReferrals: async () => getHarnessState()?.scenario === "referral-reward"
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
