import {commitJestStartupSession} from "../commitJestStartupSession";
import {createNotificationOperationGate, type NotificationCrossContextLock} from "../notifications/operationGate";
import type {JestSession} from "../types";

/** Provides session behavior. */
const session: JestSession = {
  firebaseUid: "jest_fixture_uid",
  player: {playerId: "player-1", registered: true},
  profile: null,
  entryIntent: {},
  preferences: {locale: "fr"},
  playerData: null,
  firebaseAuthenticated: true,
};

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
