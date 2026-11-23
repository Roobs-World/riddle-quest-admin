import {LiveRaceViewSchema, RetireLiveRaceJoinResponseSchema, type LiveRaceCapability, type LiveRaceView, type UpdateLiveRace} from "../contracts/index";
import {liveRaceDeliveryDeadline} from "./liveRaceDeliveryDeadline";

/** A retired seat gets an initial leave and three bounded outage retries. */
const MAX_ATTEMPTS = 4;

/** Authority denial cannot be repaired by another retired-account delivery. */
function definitiveFailure(failure: unknown): boolean {
  if (!failure || typeof failure !== "object" || !("code" in failure) || typeof failure.code !== "string") return false;
  return ["permission-denied", "unauthenticated", "not-found", "invalid-argument", "failed-precondition"]
    .includes(failure.code.replace(/^functions\//, ""));
}

/** Captures one journey's transport and leave key without retaining any React callbacks or gameplay state. */
export function createLiveRaceRetirement(transport: Pick<LiveRaceCapability, "update" | "retireJoin">, requestId: string, joinRequestId?: string, expectedOwnerId?: string) {
  /** Method ownership survives replacement or mutation of the caller's capability object. */
  const update = transport.update.bind(transport);
  /** Approved modern adapters retire the original request even before its ticket receipt arrives. */
  const retireJoin = joinRequestId ? transport.retireJoin?.bind(transport) : undefined;
  /** Duplicate late receipts share one cleanup job for each original server ticket. */
  const seats = new Map<string, {
    /** Confirmation or definitive rejection permanently stops this cleanup. */
    stopped: boolean;
    /** Only a validated authority receipt permits an explicit close to finish. */
    confirmed: boolean;
    /** Every observer of this cleanup waits for the same finite job. */
    completion: Promise<boolean>;
    /** Local deadline and retry wait can be released by a late terminal receipt. */
    owner: AbortController;
  }>();
  return (view: LiveRaceView | null, {retry = false}: {
    /** An explicit retry may reopen only an exhausted cleanup for the original join. */
    retry?: boolean;
  } = {}): Promise<boolean> => {
    if (!retireJoin && !view) return Promise.resolve(true);
    /** Terminal observations cannot reopen a completed cleanup after an older response arrives. */
    const terminal = !retireJoin && Boolean(view && (view.phase === "result" || view.phase === "cancelled" || view.run?.status === "completed"));
    /** Modern observations share the original intent even if a late response names a recovered canonical ticket. */
    const key = retireJoin ? joinRequestId! : view!.ticketId;
    /** Existing ownership coalesces late joins, polls and unmount cleanup. */
    const existing = seats.get(key);
    if (existing) {
      if (terminal) {existing.confirmed = true; existing.stopped = true; existing.owner.abort();}
      if (existing.confirmed) return Promise.resolve(true);
      if (!retry || !existing.stopped) return existing.completion;
    }
    /** The finite job stays detached from the retired component's effects and setters. */
    const seat = {stopped: terminal, confirmed: terminal, completion: Promise.resolve(terminal), owner: new AbortController()};
    seats.set(key, seat);
    if (terminal) return seat.completion;
    /** All retries address only this originally observed ticket with the same idempotency key. */
    const command: UpdateLiveRace | null = view ? {ticketId: view.ticketId, action: "leave", requestId} : null;
    /** A validated terminal receipt, including one after timeout, releases every local wait. */
    const confirm = (value: unknown): boolean => {
      /** A different or malformed receipt cannot confirm retirement of this seat. */
      if (retireJoin) {
        if (!RetireLiveRaceJoinResponseSchema.safeParse(value).success) return false;
      } else {
        /** Legacy injected capabilities retain the bounded ticket leave behavior. */
        const parsed = LiveRaceViewSchema.safeParse(value);
        if (!parsed.success || parsed.data.ticketId !== command!.ticketId ||
          !["result", "cancelled"].includes(parsed.data.phase) && parsed.data.run?.status !== "completed") return false;
      }
      seat.confirmed = true;
      seat.stopped = true;
      seat.owner.abort();
      return true;
    };
    /** Retirement retries have finite deadlines and no listeners on the replacement game. */
    const run = async () => {
      for (let attempt = 0; attempt < MAX_ATTEMPTS && !seat.stopped; attempt++) {
        if (attempt) {
          await new Promise<void>(resolve => {
            /** One abortable backoff avoids retaining a timer after late confirmation. */
            const timer = setTimeout(done, 1000 * 2 ** (attempt - 1));
            /** Both timeout and terminal confirmation release the same owned resources. */
            function done() {clearTimeout(timer); seat.owner.signal.removeEventListener("abort", done); resolve();}
            seat.owner.signal.addEventListener("abort", done, {once: true});
          });
        }
        if (seat.stopped) break;
        try {
          if (confirm(await liveRaceDeliveryDeadline(retireJoin ? retireJoin({requestId: joinRequestId!, ...(expectedOwnerId ? {expectedOwnerId} : {})}) : update({...command!}), false, confirm, seat.owner.signal))) break;
        } catch (failure) {
          if (definitiveFailure(failure)) {seat.stopped = true; seat.owner.abort();}
        }
      }
      // Retain the deduplication marker even when the finite recovery budget is exhausted.
      seat.stopped = true;
      seat.owner.abort();
      return seat.confirmed;
    };
    // Publish the shared promise before a synchronous adapter can reenter cleanup.
    seat.completion = Promise.resolve().then(run);
    return seat.completion;
  };
}
