import {describe, expect, it, jest} from "@jest/globals";
import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {Share} from "react-native";
import {YOUTUBE_COPY, resolveYouTubeLocale} from "@riddle-quest/solo";
import type {AndroidReferralBackend, AndroidReferralStatus} from "@riddle-quest/hosted/androidReferrals";
import {HostedReferralScreen} from "../screens/HostedReferralScreen";
import {referralCopy} from "../i18n/referralCopy";
/** Retains token for this operation. */
const token = "b".repeat(43);
/** Retains ready for this operation. */
const ready: AndroidReferralStatus = {kind: "ready", canBind: true, bound: false, settled: false, rewardCoins: 100};
/** Retains show for this operation. */
async function show(initial: AndroidReferralStatus = ready) {
  /** Retains status for this operation. */
  let status = initial;
  /** Retains backend for this operation. */
  const backend = {
    status: jest.fn(async () => status),
    create: jest.fn(async () => ({token, expiresAtMs: Date.now() + 1000, rewardCoins: 100})),
    bind: jest.fn(async (_token: string, _expectedOwnerId?: string) => {status = {kind: "ready", canBind: false, bound: true, settled: false, rewardCoins: 100}; return {alreadyBound: false, expiresAtMs: Date.now() + 1000};}),
  } satisfies AndroidReferralBackend;
  /** Retains on google for this operation. */
  const onGoogle = jest.fn();
  await render(<SafeAreaProvider><HostedReferralScreen locale="en" accountUid="native-user" backend={backend} token={token} onBack={() => {}} onGoogle={onGoogle} /></SafeAreaProvider>);
  return {backend, onGoogle};
}
describe("native referrals", () => {
  it("routes anonymous players to explicit Google sign-in without binding a launch token", async () => {
    /** Retains f for this operation. */
    const f = await show({kind: "google-required"});
    await waitFor(() => expect(screen.getByTestId("referral-google")).toBeVisible());
    await fireEvent.press(screen.getByTestId("referral-google")); expect(f.onGoogle).toHaveBeenCalledTimes(1);
    expect(f.backend.bind).not.toHaveBeenCalled();
  });
  it("accepts an incoming invite only when pressed and shows the first-win condition", async () => {
    /** Retains f for this operation. */
    const f = await show(); await waitFor(() => expect(screen.getByTestId("referral-accept")).toBeVisible());
    expect(f.backend.bind).not.toHaveBeenCalled(); await fireEvent.press(screen.getByTestId("referral-accept"));
    await waitFor(() => expect(screen.getByTestId("referral-bound")).toBeVisible());
    expect(f.backend.bind).toHaveBeenCalledWith(token, "native-user");
  });
  it("shares an issued link without promising a completed reward", async () => {
    /** Retains share for this operation. */
    const share = jest.spyOn(Share, "share").mockResolvedValue({action: Share.dismissedAction, activityType: ""});
    try {
      /** Retains f for this operation. */
      const f = await show(); await waitFor(() => expect(screen.getByTestId("referral-share")).toBeVisible());
      await fireEvent.press(screen.getByTestId("referral-share"));
      await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({message: expect.stringContaining(`riddlequest://referral?token=${token}`)})));
      expect(f.backend.bind).not.toHaveBeenCalled(); expect(screen.queryByTestId("referral-settled")).toBeNull();
    } finally {share.mockRestore();}
  });
  it("contains every invite key in every supported locale", () => {
    for (const locale of Object.keys(YOUTUBE_COPY).map(resolveYouTubeLocale)) {
      expect(Object.keys(referralCopy(locale)).sort()).toEqual(Object.keys(referralCopy("en")).sort());
      for (const value of Object.values(referralCopy(locale))) expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});
