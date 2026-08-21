import {commitJestStartupSession} from "../commitJestStartupSession";
import {
  createNotificationOperationGate,
  type NotificationCrossContextLock,
} from "../notifications/operationGate";
import type {JestSession} from "../types";

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
  let epoch = "before";
  let enterShared: (() => Promise<unknown>) | undefined;
  const crossContextLock: NotificationCrossContextLock = {
    runShared: (operation) => new Promise((resolve, reject) => {
      enterShared = () => operation().then(resolve, reject);
    }),
    runExclusive: (operation) => operation(),
  };
  const gate = createNotificationOperationGate({
    crossContextLock,
    deletionPending: () => false,
    deletionEpoch: () => epoch,
  });
  const enablePlayerStateWrites = jest.fn();
  const setEngagementProgress = jest.fn();
  const setSession = jest.fn();
  const trackFunnel = jest.fn();
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
