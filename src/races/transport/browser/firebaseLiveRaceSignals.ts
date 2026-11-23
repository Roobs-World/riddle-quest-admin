import {updateLiveRace} from "../../../platform/firebase/browserClient";
import {createRequestId} from "../../../gameplay/session/requestIds";

/** Streams private wake-up revisions through the existing authenticated callable SDK. */
export function observeFirebaseLiveRace(ticketId: string, onChange: () => void,
  onStatus: (connected: boolean) => void): () => void {
  /** Retirement cancels the current connection, reconnect timer and delayed callbacks. */
  const controller = new AbortController();
  /** Last accepted revision and bounded renewal backoff belong to this observation lifetime. */
  let revision: string | undefined, failures = 0, timer: ReturnType<typeof setTimeout> | undefined;
  /** A bounded stream renews credentials without losing authoritative reconciliation. */
  const connect = async () => {
    if (controller.signal.aborted) return;
    /** A failed connection can retire without aborting its subsequent recovery attempt. */
    const connection = new AbortController();
    /** Settlement invalidates late headers, chunks and final responses from this connection. */
    let owned = true;
    /** Missing headers, heartbeats or final completion share one renewable deadline. */
    let stale: ReturnType<typeof setTimeout> | undefined;
    /** A newer heartbeat invalidates even a deadline callback already queued by its old timer. */
    let deadlineGeneration = 0;
    /** Local settlement remains bounded even when an SDK wait ignores cancellation. */
    let releaseWait: () => void = () => {};
    /** The watchdog rejects the local wait independently of the SDK's two response channels. */
    const cancelled = new Promise<never>((_resolve, reject) => {
      releaseWait = () => reject(new Error("Live observation connection retired"));
    });
    /** Only this still-owned connection can notify the mounted observation lifetime. */
    const current = () => owned && !controller.signal.aborted && !connection.signal.aborted;
    /** Abort the network and release this wait without cancelling the whole observer. */
    const cancel = () => {
      if (!owned) return;
      clearTimeout(stale);
      connection.abort();
      releaseWait();
    };
    /** Each received heartbeat proves another bounded interval of connection health. */
    const renewDeadline = () => {
      clearTimeout(stale);
      /** Only this heartbeat generation may expire the still-owned connection. */
      const generation = ++deadlineGeneration;
      stale = setTimeout(() => {if (generation === deadlineGeneration) cancel();}, 15_000);
    };
    controller.signal.addEventListener("abort", cancel, {once: true});
    try {
      renewDeadline();
      await Promise.race([(async () => {
        /** The existing SDK still owns authenticated transport and App Check. */
        const result = await updateLiveRace.stream({ticketId, action: "poll", requestId: createRequestId("live-observe")},
          {signal: connection.signal});
        // Final response rejection is observed even when reading chunks fails first or retires.
        void result.data.catch(() => {});
        if (!current()) return;
        for await (const chunk of result.stream) {
          if (!current()) return;
          /** Opaque wake-up revisions contain no gameplay or account contents. */
          const next = (chunk as {
            /** Null keeps supported legacy seats on fallback polling. */
            revision?: unknown;
          } | null)?.revision;
          /** Only valid server notifications enable the slower reconciliation watchdog. */
          const connected = typeof next === "string" && /^[a-f0-9-]{36}$/.test(next);
          onStatus(connected);
          if (!current()) return;
          renewDeadline();
          if (connected) {
            failures = 0;
            if (revision !== next) {revision = next; onChange();}
          }
          if (!current()) return;
        }
        await result.data;
      })(), cancelled]);
      if (current()) timer = setTimeout(() => void connect(), 50);
    } catch {
      if (controller.signal.aborted) return;
      onStatus(false);
      if (!controller.signal.aborted)
        timer = setTimeout(() => void connect(), Math.min(8000, 500 * 2 ** Math.min(failures++, 4)));
    } finally {
      owned = false;
      clearTimeout(stale);
      controller.signal.removeEventListener("abort", cancel);
      connection.abort();
    }
  };
  void connect();
  return () => {controller.abort(); clearTimeout(timer);};
}
