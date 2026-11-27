import {ProviderProfileContext} from "../ProviderProfileContext";
import {describe, expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import type {BridgeProfile} from "../../../platform/bridge/messages";
import {ProfileModalPage} from "../ProfileModalPage";
import {ReferralSharingProvider, type ReferralSharingCapability} from "../../../sharing/components/ReferralSharingCapability";

/** No-op callback used by server-rendered profile fixtures. */
const noop = () => undefined;

/** Resolving avatar callback used by server-rendered profile fixtures. */
const updateAvatar = async () => undefined;

/** Fake target capability used to expose referral UI in server-rendered tests. */
const referralSharing: ReferralSharingCapability = {
  rewardCoins: 100,
  shareInvite: async () => "success",
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
  it("shows the saved game avatar and its picker when the provider supplies a profile", () => {
    /** Captures html for this regression check. */
    const html = renderToString(<ProviderProfileContext.Provider value={{username: "Provider Solver", avatarUrl: "https://example.com/provider.webp"}}>
      <ProfileModalPage profile={profile} accountManagement={{username: false, avatar: true, deletion: true}} onOpenModal={noop} onUpdateAvatar={updateAvatar} onDeleteAccount={noop} />
    </ProviderProfileContext.Provider>);
    expect(html).toContain("Nova");
    expect(html).toContain("avatar.webp");
    expect(html).not.toContain("provider.webp");
    expect(html).toContain("250");
    expect(html).not.toContain("Provider Solver");
    expect(html).toContain('type="file"');
    expect(html).toContain('aria-label="Upload from Photo Library"');
    expect(html).toContain("profile-avatar-edit");
    expect(html).not.toContain('class="play-text-button"');
  });
  it("preserves the game username when the provider has no configured profile", () => {
    /** Captures html for this regression check. */
    const html = renderToString(<ProviderProfileContext.Provider value={{username: null, avatarUrl: null}}>
      <ProfileModalPage profile={profile} accountManagement={{username: false, avatar: true, deletion: true}} onOpenModal={noop} onUpdateAvatar={updateAvatar} onDeleteAccount={noop} />
    </ProviderProfileContext.Provider>);
    expect(html).toContain("Nova");
    expect(html).not.toContain("Guest");
  });

  it("does not offer account operations without target permissions", () => {
    /** Profile markup for a target without account permissions. */
    const html = renderToString(<ProfileModalPage profile={profile} onOpenModal={noop}
      onUpdateAvatar={updateAvatar} onDeleteAccount={noop} />);
    expect(html).toContain("avatar.webp");
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain("profile-avatar-edit");
    expect(html).not.toContain("Delete Account");
  });
  it("renders a safe guest fallback without unsupported controls", () => {
    /** Guest profile markup with no optional platform profile fields. */
    const html = renderToString(
      <ProfileModalPage
        profile={null}
        accountManagement={{username: false, avatar: false, deletion: false}}
        onOpenModal={noop}
        onUpdateAvatar={updateAvatar}
        onDeleteAccount={noop}
      />,
    );
    expect(html).toContain("Guest");
    expect(html).toContain("profile-avatar-fallback");
    expect(html).not.toContain("Register or Log In");
    expect(html).not.toContain("Delete Account");
    expect(html).not.toContain("profile-danger-zone");
  });

  it.each([false, true])("shows account deletion only with explicit permission %s", deletion => {
    /** Provider-backed profile reflects the explicit account capability. */
    const html = renderToString(<ProviderProfileContext.Provider value={{username: "Provider Solver", avatarUrl: null}}>
      <ProfileModalPage profile={profile} accountManagement={{username: false, avatar: false, deletion}}
        onOpenModal={noop} onUpdateAvatar={updateAvatar} onDeleteAccount={noop} />
    </ProviderProfileContext.Provider>);
    expect(html).toContain("Nova");
    expect(html.includes("Delete Account")).toBe(deletion);
    expect(html.includes("profile-danger-zone")).toBe(deletion);
  });

  it("renders registered identity, progression, and profile destinations", () => {
    /** Registered profile markup containing an externally hosted avatar. */
    const html = renderToString(
      <ProfileModalPage
        profile={profile}
        accountManagement={{username: true, avatar: true, deletion: true}}
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
    /** Provides html behavior. */
    const html = renderToString(
      <ReferralSharingProvider capability={referralSharing}>
        <ProfileModalPage
          profile={profile}
          accountManagement={{username: true, avatar: true, deletion: true}}
          onOpenModal={noop}
          onUpdateAvatar={updateAvatar}
          onDeleteAccount={noop}
        />
      </ReferralSharingProvider>,
    );
    expect(html).toContain("Invite a friend");
    expect(html).not.toContain("100 coins each");
    expect(html).toContain('aria-busy="false"');
  });
});
