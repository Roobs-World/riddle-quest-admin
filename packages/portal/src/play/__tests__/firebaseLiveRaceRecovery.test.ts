import {initializeApp, deleteApp} from "firebase/app";
import {getFunctions, httpsCallableFromURL} from "firebase/functions";
import type {LiveRaceView, UpdateLiveRace} from "@qwordly/core/race";
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
    new ReadableStream<Uint8Array>({start(controller) {
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({message: {revision}})}\n\n`));
      controller.close();
    }}), {headers: {"content-type": "text/event-stream"}},
  ));
  /** Runs the installed SDK's stream parser, including its separate final-response promise. */
  const callable = httpsCallableFromURL<UpdateLiveRace, LiveRaceView, {revision: string}>(
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

it("renews normally when the real SDK receives its final result frame", async () => {
  /** A complete response is the control for the missing-final-frame failure. */
  const app = initializeApp({projectId: "stream-fixture"}, "live-stream-complete-fixture");
  jest.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(
    `data: ${JSON.stringify({message: {revision}})}\n\ndata: ${JSON.stringify({result: null})}\n\n`,
    {headers: {"content-type": "text/event-stream"}},
  ));
  /** The same installed parser now receives both channels' completion. */
  const callable = httpsCallableFromURL<UpdateLiveRace, LiveRaceView, {revision: string}>(
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
