import {describe, expect, jest, test} from "@jest/globals";

/** Captures the payload before Firebase serializes an omitted argument as null. */
const mockInvoke = jest.fn<(name: string, data: unknown) => Promise<{
  /** Validated callable response payload. */
  data: unknown;
}>>();

jest.mock("firebase/functions", () => ({
  httpsCallable: (_functions: unknown, name: string) => (data: unknown) => mockInvoke(name, data),
}));
jest.mock("../../../../../src/platform/firebase/browserClient", () => ({firebaseFunctions: {}}));

import {
  acceptFacebookNotificationPermissionPrompt,
  claimFacebookNotificationPermissionPrompt,
  getFacebookClientConfiguration,
} from "../firebaseClient";

describe("Facebook empty callable requests", () => {
  test.each([
    [
      "getFacebookClientConfiguration",
      getFacebookClientConfiguration,
      {
        interstitialsEnabled: false,
        notificationsEnabled: false,
        commerceEnabled: false,
        rewardedAdsEnabled: false,
        referralsEnabled: false,
        matchmakingEnabled: false,
        tournamentsEnabled: false,
        presenceEnabled: false,
        removeInterstitialAds: false,
      },
    ],
    ["claimFacebookNotificationPermissionPrompt", claimFacebookNotificationPermissionPrompt, {granted: false}],
    ["acceptFacebookNotificationPermissionPrompt", acceptFacebookNotificationPermissionPrompt, {accepted: true}],
  ] as const)("%s supplies the server's required empty object", async (name, invoke, response) => {
    mockInvoke.mockResolvedValueOnce({data: response});
    await invoke();
    expect(mockInvoke).toHaveBeenLastCalledWith(name, {});
  });
});
