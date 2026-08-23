import {describe, expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import type {BridgeProfile} from "@qwordly/core/bridge";
import {ProfileModalPage} from "../modalPages/profile/ProfileModalPage";
import {
  ReferralSharingProvider,
  type ReferralSharingCapability,
} from "../sharing/ReferralSharingCapability";

/** No-op callback used by server-rendered profile fixtures. */
const noop = () => undefined;

/** Resolving avatar callback used by server-rendered profile fixtures. */
const updateAvatar = async () => undefined;

/** Fake target capability used to expose referral UI in server-rendered tests. */
const referralSharing: ReferralSharingCapability = {
  rewardCoins: 100,
  shareInvite: noop,
  shareRace: noop,
  shareResult: noop,
};

/** Complete profile fixture displayed by the registered-player variant. */
const profile: BridgeProfile = {
  userId: "player-profile",
  username: "Nova",
  avatarUrl: "https://example.com/avatar.webp",
  coins: 250,
  xp: 155,
  level: 2,
  achievements: [],
  stats: {},
  wins: 3,
  totalWins: 4,
  bestStreak: 2,
  dailyPuzzlesCompleted: 5,
};

describe("ProfileModalPage", () => {
  it("renders safe guest and registration fallbacks", () => {
    /** Guest profile markup with no optional platform profile fields. */
    const html = renderToString(
      <ProfileModalPage
        profile={null}
        platformRegistered={false}
        onOpenModal={noop}
        onUpdateAvatar={updateAvatar}
        onDeleteAccount={noop}
      />,
    );
    expect(html).toContain("Guest");
    expect(html).toContain("profile-avatar-fallback");
    expect(html).toContain("Upgrade Account");
  });

  it("renders registered identity, progression, and profile destinations", () => {
    /** Registered profile markup containing an externally hosted avatar. */
    const html = renderToString(
      <ProfileModalPage
        profile={profile}
        platformRegistered
        onOpenModal={noop}
        onUpdateAvatar={updateAvatar}
        onDeleteAccount={noop}
      />,
    );
    expect(html).toContain("Nova");
    expect(html).toContain("avatar.webp");
    expect(html).toContain("width:50%");
    expect(html).toContain("Leaderboard");
    expect(html).not.toContain("Invite a friend");
    expect(html).toContain("Delete Account");
  });

  it("renders an invite only when the active target supplies sharing", () => {
    const html = renderToString(
      <ReferralSharingProvider capability={referralSharing}>
        <ProfileModalPage
          profile={profile}
          platformRegistered
          onOpenModal={noop}
          onUpdateAvatar={updateAvatar}
          onDeleteAccount={noop}
        />
      </ReferralSharingProvider>,
    );
    expect(html).toContain("Invite a friend");
    expect(html).toContain("100");
  });
});
