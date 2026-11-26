import {beforeEach, describe, expect, it} from "@jest/globals";
import type {BridgeLeaderboardEntry} from "../../../../../src/platform/bridge/messages";
import type {HostServices, LeaderboardType} from "../../../../../src/platform/contracts/hostServices";
import {type YouTubeLocale} from "../../../../../src/gameplay/local/types";
import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {AndroidApp} from "../AndroidApp";
import type {HostedFirebaseClient} from "../hosted/firebaseClient";
import {PROFILE_COPY, profileText} from "../i18n/profileCopy";
import {HostedProfileScreen} from "../screens/HostedProfileScreen";
import {calls, createFakeHostServices, subscribers} from "../test/fakeHostServices";
import {contentSource, createPort, expectScreen, press} from "../test/harness";

/** One leaderboard row. */
const row = (userId: string, username: string, xp: number): BridgeLeaderboardEntry => ({userId, username, level: 2, xp, totalWins: xp / 10, bestStreak: xp / 100});
/** Services with scripted profile operations. */
const createServices = (overrides: Partial<HostServices> = {}): HostServices & {
/** Stores recorded. */
recorded: string[]} => {
  /** Recorded profile operations. */
  const recorded: string[] = [];
  return {
    ...createFakeHostServices(),
    loadLeaderboard: async (type: LeaderboardType) => {
      recorded.push(`leaderboard:${type}`);
      return {entries: [row("other", "Ada", 900), row("device-uid", "Android", 300)], nextCursor: null};
    },
    updateUsername: async (username: string) => {
      recorded.push(`username:${username}`);
      return null;
    },
    deleteAccount: async () => {
      recorded.push("delete");
    },
    ...overrides,
    recorded,
  };
};
/** Renders the profile screen. */
const renderProfile = async (services: HostServices, locale: YouTubeLocale = "en", onDeleted = () => undefined) =>
  render(
    <SafeAreaProvider>
      <HostedProfileScreen locale={locale} services={services} accountUid="device-uid" onBack={() => undefined} onDeleted={onDeleted} />
    </SafeAreaProvider>,
  );

describe("HostedProfileScreen", () => {
  beforeEach(() => {
    calls.length = 0;
    subscribers.clear();
  });

  it("shows the confirmed profile, its stats and the XP leaderboard with the player's row highlighted", async () => {
    /** Retains services for this operation. */
    const services = createServices();
    await renderProfile(services);
    expect(screen.getByTestId("profile-username")).toHaveTextContent("Android");
    expect(screen.getByTestId("profile-stat-gamesPlayed")).toHaveTextContent(/Games Played0/u);
    expect(screen.getByTestId("profile-stat-winRate")).toHaveTextContent(/0%/u);
    await expectScreen("leaderboard-rows");
    expect(screen.getByTestId("leaderboard-row-0")).toHaveTextContent(/Ada900/u);
    expect(screen.getByTestId("leaderboard-own-row")).toHaveTextContent(/Android300/u);
    await press("leaderboard-tab-totalWins");
    await waitFor(() => expect(screen.getByTestId("leaderboard-row-0")).toHaveTextContent(/Ada90/u));
    await press("leaderboard-tab-bestStreak");
    await waitFor(() => expect(screen.getByTestId("leaderboard-row-0")).toHaveTextContent(/Ada9$/u));
    expect(services.recorded).toEqual(["leaderboard:xp", "leaderboard:totalWins", "leaderboard:bestStreak"]);
  });

  it("lists unlocked achievements and computes the win rate", async () => {
    /** Services whose profile has wins and achievements. */
    const base = createServices();
    /** Retains services for this operation. */
    const services: HostServices = {
      ...base,
      auth: {
        subscribe: (listener) => {
          listener({
            user: {uid: "device-uid", isAnonymous: true},
            profile: {username: "Android", coins: 500, level: 3, xp: 400, winStreak: 2, gamesPlayed: 4, wins: 3, achievements: ["first_win", "streak_3"], classicIndex: 4},
          });
          return () => undefined;
        },
      },
    };
    await renderProfile(services);
    expect(screen.getByTestId("profile-stat-winRate")).toHaveTextContent(/75%/u);
    expect(screen.getByTestId("profile-achievements")).toBeTruthy();
  });

  it("retries a leaderboard that failed to load", async () => {
    /** Whether the next load fails. */
    let fail = true;
    /** Retains services for this operation. */
    const services = createServices({
      loadLeaderboard: async () => {
        if (fail) throw new Error("unavailable");
        return {entries: [row("other", "Ada", 900)], nextCursor: null};
      },
    });
    await renderProfile(services);
    await expectScreen("leaderboard-failed");
    fail = false;
    await press("leaderboard-retry");
    await expectScreen("leaderboard-rows");
  });

  it("validates, saves and explains username changes", async () => {
    /** Successive username outcomes. */
    const outcomes: (Error | null)[] = [null, Object.assign(new Error("taken"), {code: "functions/already-exists"}), new Error("boom")];
    /** Retains services for this operation. */
    const services = createServices({
      updateUsername: async () => {
        /** Retains next for this operation. */
        const next = outcomes.shift();
        if (next) throw next;
        return null;
      },
    });
    await renderProfile(services);
    await fireEvent.changeText(screen.getByTestId("profile-username-input"), "ab");
    await press("profile-username-save");
    expect(screen.getByTestId("profile-username-notice")).toHaveTextContent("Username must be at least 3 characters long.");
    await fireEvent.changeText(screen.getByTestId("profile-username-input"), "  Riddler  ");
    await press("profile-username-save");
    await waitFor(() => expect(screen.getByTestId("profile-username-notice")).toHaveTextContent("Username updated successfully!"));
    await press("profile-username-save");
    await waitFor(() => expect(screen.getByTestId("profile-username-notice")).toHaveTextContent("Username already taken."));
    await press("profile-username-save");
    await waitFor(() => expect(screen.getByTestId("profile-username-notice")).toHaveTextContent("Failed to update username. Please try again."));
  });

  it("confirms before deleting, can cancel, reports a failure, and hands a deletion to the root", async () => {
    /** Whether the next deletion fails. */
    let fail = true;
    /** Deletions reported to the root. */
    let deleted = 0;
    /** Retains services for this operation. */
    const services = createServices({
      deleteAccount: async () => {
        if (fail) throw new Error("offline");
      },
    });
    await renderProfile(services, "en", () => {
      deleted += 1;
    });
    await press("profile-delete");
    expect(screen.getByTestId("profile-delete-confirm")).toHaveTextContent(/This permanently deletes your account/u);
    await press("profile-delete-cancel");
    expect(screen.queryByTestId("profile-delete-confirm")).toBeNull();
    await press("profile-delete");
    await press("profile-delete-confirm-button");
    await expectScreen("profile-delete-failed");
    expect(screen.getByTestId("profile-delete-failed")).toHaveTextContent("Please check your connection and try again.");
    fail = false;
    await press("profile-delete");
    await press("profile-delete-confirm-button");
    await waitFor(() => expect(deleted).toBe(1));
  });

  it("reads in the player's language", async () => {
    await renderProfile(createServices(), "de");
    expect(screen.getByTestId("profile-heading")).toHaveTextContent("Profil");
    expect(screen.getByTestId("leaderboard-tab-xp")).toHaveTextContent("XP");
  });
});

describe("AndroidApp profile", () => {
  beforeEach(() => {
    calls.length = 0;
    subscribers.clear();
  });

  it("opens the profile from the hosted home and provisions a fresh account after deletion", async () => {
    /** Provisioning calls. */
    const provisioned: string[] = [];
    /** Retains client for this operation. */
    const client = {
      projectId: "riddle-quest-test",
      usingEmulators: true,
      functions: {} as never,
      currentUser: () => null,
      onUserChanged: () => () => {},
      signInAnonymously: async () => ({uid: "device-uid"}) as never,
      signOut: async () => {},
      loadUserDocument: async () => null,
      provisionAccount: async () => {
        provisioned.push("provision");
        return {uid: "device-uid", created: provisioned.length > 1, coins: 300};
      },
      purchases: {} as never,
    } satisfies HostedFirebaseClient;
    await render(
      <SafeAreaProvider>
        <AndroidApp sdk={createPort()} contentSource={contentSource} client={client} services={createServices()} />
      </SafeAreaProvider>,
    );
    await expectScreen("screen-hosted-home");
    await press("show-profile");
    await expectScreen("screen-profile");
    await press("profile-delete");
    await press("profile-delete-confirm-button");
    await expectScreen("screen-hosted-home");
    expect(provisioned).toEqual(["provision", "provision"]);
    await press("show-profile");
    await expectScreen("screen-profile");
    await press("back");
    await expectScreen("screen-hosted-home");
  });
});

describe("profile copy", () => {
  it("covers every locale with the same non-empty keys", () => {
    /** English keys. */
    const keys = Object.keys(PROFILE_COPY.en).sort();
    for (const table of Object.values(PROFILE_COPY)) {
      expect(Object.keys(table).sort()).toEqual(keys);
      for (const value of Object.values(table)) expect(value.trim().length).toBeGreaterThan(0);
    }
    expect(profileText("ru", "deleteAccount")).not.toBe(profileText("en", "deleteAccount"));
  });
});
