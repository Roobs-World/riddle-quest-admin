import {initializeApp, deleteApp} from "firebase/app";
import {getFunctions, httpsCallableFromURL} from "firebase/functions";
import type {LiveRaceView, UpdateLiveRace} from "../../../core/race";
import {observeFirebaseLiveRace} from "../firebaseLiveRaceSignals";
import {updateLiveRace} from "../../firebase";

jest.mock("../../firebase", () => ({updateLiveRace: {stream: jest.fn()}}));
/** Private fixture revisions contain no authoritative play state. */
const revision = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
beforeEach(() => {jest.clearAllMocks(); jest.useFakeTimers();});
afterEach(() => {jest.restoreAllMocks(); jest.useRealTimers();});

it("reconnects after the real SDK reaches EOF without a final result frame", async () => {
  /** Named dummy app has no credentials or real endpoint; fetch is intercepted below. */
  const app = initializeApp({projectId: "stream-fixture"}, "live-stream-eof-fixture");
  /** A valid notification followed by EOF reproduces an incomplete callable response. */
  const fetch = jest.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(
    new ReadableStream<Uint8Array>({
      /** Emits a notification and ends without a result frame. */
      start(controller) {
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({message: {revision}})}\n\n`));
      controller.close();
    }}), {headers: {"content-type": "text/event-stream"}},
  ));
  /** Runs the installed SDK's stream parser, including its separate final-response promise. */
  const callable = httpsCallableFromURL<UpdateLiveRace, LiveRaceView, {
    /** Opaque change token emitted by the fixture. */
    revision: string;
  }>(
    getFunctions(app), "http://127.0.0.1:1/fixture-stream",
  );
  jest.mocked(updateLiveRace.stream).mockImplementation((input, options) => callable.stream(input, options));
  /** Connection status drives the real game's foreground polling policy. */
  const status = jest.fn(), change = jest.fn();
  /** Current observation lifetime is always retired, including the failing baseline. */
  const stop = observeFirebaseLiveRace("a".repeat(64), change, status);
  try {
    await jest.advanceTimersByTimeAsync(0);
    expect(change).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenLastCalledWith(true);
    await jest.advanceTimersByTimeAsync(15_000);
    expect(status).toHaveBeenLastCalledWith(false);
    await jest.advanceTimersByTimeAsync(499);
    expect(updateLiveRace.stream).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(updateLiveRace.stream).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(change).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenLastCalledWith(true);
  } finally {
    stop();
    await jest.advanceTimersByTimeAsync(0);
    await deleteApp(app);
  }
});

it("bounds connection setup even when the SDK request ignores local cancellation", async () => {
  /** A pending fetch never returns a chunk iterator or final-response channel. */
  jest.mocked(updateLiveRace.stream).mockImplementationOnce(() => new Promise(() => {}))
    .mockRejectedValue(new Error("still offline"));
  /** Status updates must restore fallback observation without waiting for headers. */
  const status = jest.fn();
  /** This lifetime owns both the connection attempt and its retry. */
  const stop = observeFirebaseLiveRace("a".repeat(64), jest.fn(), status);
  try {
    await jest.advanceTimersByTimeAsync(15_000);
    expect(status).toHaveBeenLastCalledWith(false);
    expect(jest.mocked(updateLiveRace.stream).mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    await jest.advanceTimersByTimeAsync(500);
    expect(updateLiveRace.stream).toHaveBeenCalledTimes(2);
  } finally {stop(); await jest.advanceTimersByTimeAsync(0);}
});

it("reconnects after a chunk iterator stops producing heartbeats", async () => {
  /** Late chunks are still observed but cannot revive a retired connection. */
  let release: (() => void) | undefined;
  jest.mocked(updateLiveRace.stream).mockResolvedValueOnce({data: new Promise<LiveRaceView>(() => {}),
    stream: (async function* () {yield {revision}; await new Promise<void>(resolve => {release = resolve;});
      yield {revision: "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee"};})()})
    .mockRejectedValue(new Error("still offline"));
  /** Only the first valid revision reaches this player lifetime. */
  const status = jest.fn(), change = jest.fn();
  /** Cleanup remains authoritative if a late chunk arrives after timeout. */
  const stop = observeFirebaseLiveRace("a".repeat(64), change, status);
  try {
    await jest.advanceTimersByTimeAsync(0);expect(change).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(15_000);expect(status).toHaveBeenLastCalledWith(false);
    await jest.advanceTimersByTimeAsync(500);expect(updateLiveRace.stream).toHaveBeenCalledTimes(2);
    release?.();await jest.advanceTimersByTimeAsync(0);expect(change).toHaveBeenCalledTimes(1);
  } finally {stop();release?.();await jest.advanceTimersByTimeAsync(0);}
});

it("extends a healthy connection deadline only when another heartbeat arrives", async () => {
  /** A stalled iterator remains open after three valid, unchanged revisions. */
  let release: (() => void) | undefined;
  jest.mocked(updateLiveRace.stream).mockResolvedValueOnce({data: new Promise<LiveRaceView>(() => {}),
    stream: (async function* () {yield {revision};for (let index = 0; index < 3; index++) {
      await new Promise(resolve => setTimeout(resolve, 10_000));yield {revision};
    }await new Promise<void>(resolve => {release = resolve;});})()})
    .mockRejectedValue(new Error("offline after silence"));
  /** Unchanged revisions still prove connection health without duplicate changes. */
  const status = jest.fn(), change = jest.fn();
  /** Retires all heartbeat and reconnect ownership after the assertions. */
  const stop = observeFirebaseLiveRace("a".repeat(64), change, status);
  try {
    await jest.advanceTimersByTimeAsync(30_000);expect(updateLiveRace.stream).toHaveBeenCalledTimes(1);
    expect(change).toHaveBeenCalledTimes(1);expect(status).toHaveBeenLastCalledWith(true);
    await jest.advanceTimersByTimeAsync(14_999);expect(status).toHaveBeenLastCalledWith(true);
    await jest.advanceTimersByTimeAsync(1);expect(status).toHaveBeenLastCalledWith(false);
    await jest.advanceTimersByTimeAsync(500);expect(updateLiveRace.stream).toHaveBeenCalledTimes(2);
  } finally {stop();release?.();await jest.advanceTimersByTimeAsync(0);}
});

it("cancels a pending setup without retrying or retaining a deadline", async () => {
  jest.mocked(updateLiveRace.stream).mockImplementationOnce(() => new Promise(() => {}));
  /** Retirement must not publish a connection failure to an obsolete player. */
  const status = jest.fn();
  /** Owns the pending setup before any SDK response exists. */
  const stop = observeFirebaseLiveRace("a".repeat(64), jest.fn(), status);
  stop();await jest.advanceTimersByTimeAsync(60_000);
  expect(updateLiveRace.stream).toHaveBeenCalledTimes(1);expect(status).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

it("ignores an old queued deadline after a newer heartbeat renews the connection", async () => {
  /** Captures native deadline callbacks without replacing their actual fake-timer scheduling. */
  const timers = jest.spyOn(globalThis, "setTimeout");
  /** Releases a fresh heartbeat after the earlier deadline was scheduled. */
  let release: (() => void) | undefined;
  jest.mocked(updateLiveRace.stream).mockResolvedValueOnce({data: new Promise<LiveRaceView>(() => {}),
    stream: (async function* () {yield {revision};await new Promise<void>(resolve => {release = resolve;});
      yield {revision};await new Promise(() => {});})()});
  /** A queued timeout must not demote a newly healthy connection. */
  const status = jest.fn();
  /** Retires the current wait even if the obsolete callback assertion fails. */
  const stop = observeFirebaseLiveRace("a".repeat(64), jest.fn(), status);
  try {
    await jest.advanceTimersByTimeAsync(0);
    /** This actual timer belongs to the previous received heartbeat. */
    const previous = timers.mock.calls.filter(([, delay]) => delay === 15_000).at(-1)?.[0];
    expect(typeof previous).toBe("function");
    release?.();await jest.advanceTimersByTimeAsync(0);
    if (typeof previous === "function") previous();
    await jest.advanceTimersByTimeAsync(0);
    expect(status).toHaveBeenLastCalledWith(true);
    expect(jest.mocked(updateLiveRace.stream).mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    expect(updateLiveRace.stream).toHaveBeenCalledTimes(1);
  } finally {stop();await jest.advanceTimersByTimeAsync(0);}
});

it("does not notify or retain a heartbeat after a status callback retires its owner", async () => {
  jest.mocked(updateLiveRace.stream).mockResolvedValueOnce({data: new Promise<LiveRaceView>(() => {}),
    stream: (async function* () {yield {revision};})()});
  /** Reentrant retirement occurs before the same chunk's change notification. */
  const change = jest.fn(), status = jest.fn(() => stop());
  /** The asynchronous SDK response reaches this assigned cleanup callback. */
  const stop = observeFirebaseLiveRace("a".repeat(64), change, status);
  await jest.advanceTimersByTimeAsync(0);
  expect(status).toHaveBeenCalledTimes(1);expect(change).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
  await jest.advanceTimersByTimeAsync(60_000);expect(updateLiveRace.stream).toHaveBeenCalledTimes(1);
});

it("renews normally when the real SDK receives its final result frame", async () => {
  /** A complete response is the control for the missing-final-frame failure. */
  const app = initializeApp({projectId: "stream-fixture"}, "live-stream-complete-fixture");
  jest.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(
    `data: ${JSON.stringify({message: {revision}})}\n\ndata: ${JSON.stringify({result: null})}\n\n`,
    {headers: {"content-type": "text/event-stream"}},
  ));
  /** The same installed parser now receives both channels' completion. */
  const callable = httpsCallableFromURL<UpdateLiveRace, LiveRaceView, {
    /** Opaque change token emitted by the fixture. */
    revision: string;
  }>(
    getFunctions(app), "http://127.0.0.1:1/fixture-stream",
  );
  jest.mocked(updateLiveRace.stream).mockImplementation((input, options) => callable.stream(input, options));
  /** Revisions remain deduplicated across a normal credential renewal. */
  const status = jest.fn(), change = jest.fn();
  /** Cleanup owns all SDK signals, including a failed assertion. */
  const stop = observeFirebaseLiveRace("a".repeat(64), change, status);
  try {
    await jest.advanceTimersByTimeAsync(0);
    expect(change).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(49);
    expect(updateLiveRace.stream).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(updateLiveRace.stream).toHaveBeenCalledTimes(2);
    expect(change).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenLastCalledWith(true);
  } finally {
    stop(); await jest.advanceTimersByTimeAsync(0); await deleteApp(app);
  }
});
