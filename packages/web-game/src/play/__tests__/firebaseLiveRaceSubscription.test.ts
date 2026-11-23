import {createFirebaseRaceMatchmaking} from "../firebaseRaceMatchmaking";
import {observeFirebaseLiveRace} from "../firebaseLiveRaceSignals";
jest.mock("../firebaseLiveRaceSignals", () => ({observeFirebaseLiveRace: jest.fn()}));

it("does not attach a listener when its owner retires before the lazy SDK loads", async () => {
  /** Provides status behavior. */
  const status = jest.fn(), change = jest.fn();
  /** Provides stop behavior. */
  const stop = createFirebaseRaceMatchmaking().live!.observe!("a".repeat(64), change, status);
  stop(); await Promise.resolve(); await Promise.resolve();
  expect(observeFirebaseLiveRace).not.toHaveBeenCalled();
  expect(status).toHaveBeenCalledTimes(1);
});

it("unsubscribes and ignores queued callbacks from a retired listener", async () => {
  /** Provides status behavior. */
  const status = jest.fn(), change = jest.fn(), cleanup = jest.fn();
  jest.mocked(observeFirebaseLiveRace).mockReturnValue(cleanup);
  /** Provides stop behavior. */
  const stop = createFirebaseRaceMatchmaking().live!.observe!("a".repeat(64), change, status);
  await Promise.resolve(); await Promise.resolve();
  /** Provides [, notify, connect] behavior. */
  const [, notify, connect] = jest.mocked(observeFirebaseLiveRace).mock.calls.at(-1)!;
  notify(); connect(true); expect(change).toHaveBeenCalledTimes(1); expect(status).toHaveBeenLastCalledWith(true);
  stop(); notify(); connect(false);
  expect(cleanup).toHaveBeenCalledTimes(1); expect(change).toHaveBeenCalledTimes(1); expect(status).toHaveBeenLastCalledWith(true);
});

it("reports setup failure so foreground observations continue", async () => {
  /** Provides status behavior. */
  const status = jest.fn(); jest.mocked(observeFirebaseLiveRace).mockImplementation(() => {throw new Error("offline");});
  createFirebaseRaceMatchmaking().live!.observe!("a".repeat(64), jest.fn(), status);
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(status).toHaveBeenLastCalledWith(false);
});
