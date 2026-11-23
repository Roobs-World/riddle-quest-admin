import {observeFirebaseLiveRace} from "../firebaseLiveRaceSignals";
import {updateLiveRace} from "../../../../platform/firebase/browserClient";

jest.mock("../../../../platform/firebase/browserClient", () => ({updateLiveRace: {stream: jest.fn()}}));
/** Provides revision behavior. */
const revision = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
beforeEach(() => {jest.clearAllMocks(); jest.useFakeTimers();});
afterEach(() => jest.useRealTimers());

it("deduplicates private revisions and aborts the connection and renewal on retirement", async () => {
  /** Provides change behavior. */
  const change = jest.fn(), status = jest.fn();
  jest.mocked(updateLiveRace.stream).mockResolvedValue({data: Promise.resolve(null as never),
    stream: (async function* () {yield {revision: null}; yield {revision}; yield {revision}; yield {revision: "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee"};})()});
  /** Provides stop behavior. */
  const stop = observeFirebaseLiveRace("a".repeat(64), change, status);
  await jest.advanceTimersByTimeAsync(0);
  expect(change).toHaveBeenCalledTimes(2); expect(status).toHaveBeenLastCalledWith(true);
  expect(updateLiveRace.stream).toHaveBeenCalledWith(expect.objectContaining({ticketId: "a".repeat(64), action: "poll"}), expect.anything());
  /** Provides signal behavior. */
  const signal = jest.mocked(updateLiveRace.stream).mock.calls[0]![1]!.signal!;
  stop(); expect(signal.aborted).toBe(true); await jest.advanceTimersByTimeAsync(60000);
  expect(updateLiveRace.stream).toHaveBeenCalledTimes(1);
});

it("falls back and reconnects with bounded backoff, cancelling retries on cleanup", async () => {
  /** Provides status behavior. */
  const status = jest.fn(); jest.mocked(updateLiveRace.stream).mockRejectedValue(new Error("offline"));
  /** Provides stop behavior. */
  const stop = observeFirebaseLiveRace("a".repeat(64), jest.fn(), status);
  await jest.advanceTimersByTimeAsync(0); expect(status).toHaveBeenLastCalledWith(false);
  await jest.advanceTimersByTimeAsync(499); expect(updateLiveRace.stream).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1); expect(updateLiveRace.stream).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(1000); expect(updateLiveRace.stream).toHaveBeenCalledTimes(3);
  stop(); await jest.advanceTimersByTimeAsync(60000); expect(updateLiveRace.stream).toHaveBeenCalledTimes(3);
});

it("marks a silent stream unhealthy while preserving notifications queued after retirement", async () => {
  /** Provides status behavior. */
  const status = jest.fn(), change = jest.fn(); /** Provides release behavior. */
  /** Provides release behavior. */
  let release!: () => void;
  jest.mocked(updateLiveRace.stream).mockResolvedValue({data: Promise.resolve(null as never), stream: (async function* () {
    yield {revision}; await new Promise<void>(resolve => {release = resolve;}); yield {revision: "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee"};
  })()});
  /** Provides stop behavior. */
  const stop = observeFirebaseLiveRace("a".repeat(64), change, status);
  await jest.advanceTimersByTimeAsync(0); expect(status).toHaveBeenLastCalledWith(true);
  await jest.advanceTimersByTimeAsync(15000); expect(status).toHaveBeenLastCalledWith(false);
  stop(); release(); await jest.advanceTimersByTimeAsync(0); expect(change).toHaveBeenCalledTimes(1);
});
