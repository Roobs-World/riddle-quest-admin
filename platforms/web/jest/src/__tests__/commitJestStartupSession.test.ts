import {commitJestStartupSession} from "../commitJestStartupSession";
import {createNotificationOperationGate, type NotificationCrossContextLock} from "../notifications/operationGate";
import type {JestSession} from "../types";
import {getCurrentLocale} from "../../../../../packages/web-game/src/play/i18n";

/** Provides session behavior. */
const session: JestSession = {
  firebaseUid: "jest_fixture_uid",
  player: {playerId: "player-1", registered: true},
  profile: null,
  entryIntent: {},
  preferences: {locale: "en"},
  playerData: null,
  firebaseAuthenticated: true,
};

/** Creates isolated startup collaborators for each assertion. */
const createCommitDependencies = () => ({
  enablePlayerStateWrites: jest.fn(),
  setEngagementProgress: jest.fn(),
  setSession: jest.fn(),
  trackFunnel: jest.fn(),
});

it("mounts returning Jest play in English despite a saved non-English locale", async () => {
  /** Controlled effects isolate persistence and startup sequencing. */
  const dependencies = createCommitDependencies();
  /** Observed hosted mounts verify language readiness before rendering. */
  const mountedLocales: string[] = [];
  dependencies.setSession.mockImplementation(() => {mountedLocales.push(getCurrentLocale());});
  /** Operation gate serializes startup with account deletion. */
  const gate = createNotificationOperationGate({crossContextLock: null, deletionPending: () => false,
    deletionEpoch: () => null, requireCrossContextLock: false});
  await expect(commitJestStartupSession({gate, isActive: () => true,
    session: {...session, preferences: {locale: "tr"}}, ...dependencies})).resolves.toBe(true);
  expect(mountedLocales).toEqual(["en"]);
  expect(dependencies.setSession).toHaveBeenCalledWith(expect.objectContaining({preferences: {locale: "en"}}));
});

it("commits restored progress and attributed invite analytics", async () => {
  /** Captures each startup side effect. */
  const dependencies = createCommitDependencies();
  /** Represents a registered player returning through an invite. */
  const restoredSession: JestSession = {
    ...session,
    entryIntent: {
      campaign: "friend_challenge_v2",
      inviteKind: "friend",
      inviterName: "Riddle Quest player",
      utmSource: "jest",
    },
    playerData: {profile: {level: 7, winStreak: 3, wins: 12}},
  } as JestSession;
  /** Keeps startup operations enabled for this successful commit. */
  const gate = createNotificationOperationGate({
    crossContextLock: null,
    deletionPending: () => false,
    deletionEpoch: () => null,
    requireCrossContextLock: false,
  });

  await expect(commitJestStartupSession({
    gate,
    isActive: () => true,
    session: restoredSession,
    ...dependencies,
  })).resolves.toBe(true);

  expect(dependencies.enablePlayerStateWrites).toHaveBeenCalledWith(restoredSession.playerData, restoredSession.player.playerId);
  expect(dependencies.setEngagementProgress).toHaveBeenCalledWith({level: 7, winStreak: 3, wins: 12});
  expect(dependencies.setSession).toHaveBeenCalledWith(restoredSession);
  expect(dependencies.trackFunnel).toHaveBeenCalledWith(
    "viral_invite_opened",
    expect.objectContaining({inviteKind: "friend", hasInviterName: true}),
  );
});

it("does not fail an authoritative startup commit when optional analytics throws", async () => {
  /** Captures startup effects while simulating an unavailable analytics sink. */
  const dependencies = createCommitDependencies();
  dependencies.trackFunnel.mockImplementation(() => {
    throw new Error("analytics-unavailable");
  });
  /** Keeps authoritative startup work enabled. */
  const gate = createNotificationOperationGate({
    crossContextLock: null,
    deletionPending: () => false,
    deletionEpoch: () => null,
    requireCrossContextLock: false,
  });

  await expect(commitJestStartupSession({
    gate,
    isActive: () => true,
    session,
    ...dependencies,
  })).resolves.toBe(true);

  expect(dependencies.setSession).toHaveBeenCalledWith(session);
});

it("does not reapply startup state after deletion wins the cross-tab lock", async () => {
  /** Provides epoch behavior. */
  let epoch = "before";
  /** Provides enter shared behavior. */
  let enterShared: (() => Promise<unknown>) | undefined;
  /** Provides cross context lock behavior. */
  const crossContextLock: NotificationCrossContextLock = {
    runShared: (operation) =>
      new Promise((resolve, reject) => {
        enterShared = () => operation().then(resolve, reject);
      }),
    runExclusive: (operation) => operation(),
  };
  /** Provides gate behavior. */
  const gate = createNotificationOperationGate({
    crossContextLock,
    deletionPending: () => false,
    deletionEpoch: () => epoch,
  });
  /** Provides enable player state writes behavior. */
  const enablePlayerStateWrites = jest.fn();
  /** Sets engagement progress. */
  const setEngagementProgress = jest.fn();
  /** Sets session. */
  const setSession = jest.fn();
  /** Tracks funnel. */
  const trackFunnel = jest.fn();
  /** Provides commit behavior. */
  const commit = commitJestStartupSession({
    gate,
    isActive: () => true,
    session,
    enablePlayerStateWrites,
    setEngagementProgress,
    setSession,
    trackFunnel,
  });

  epoch = "after-deletion";
  await enterShared?.();

  await expect(commit).resolves.toBe(false);
  expect(enablePlayerStateWrites).not.toHaveBeenCalled();
  expect(setEngagementProgress).not.toHaveBeenCalled();
  expect(setSession).not.toHaveBeenCalled();
  expect(trackFunnel).not.toHaveBeenCalled();
});
