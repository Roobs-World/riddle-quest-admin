import type {BridgeRiddle} from "@qwordly/core/bridge";
import type {HostServices} from "./types";
import {riddleLoadDeadline} from "./riddleLoadDeadline";

/** Optional content delivery is loaded only when Skip requests a speculative successor. */
export async function loadOptionalSkipPreview(options: {
  /** Target-owned issued-content request. */ input: Parameters<HostServices["loadRiddle"]>[0] & {
    /** Canonical preparation is a different operation. */
    prepareNext?: true;
  };
  /** Issued predecessor constrains the optional target. */ parent: BridgeRiddle | null;
  /** Admitted account. */ userId: string | undefined;
  /** Admitted content language. */ locale: string;
  /** Provider remains behind its target adapter. */ services: Pick<HostServices, "loadRiddle">;
  /** Dedicated optional delivery slot. */ deliveryRef: {
    /** Latest optional wait. */
    current: AbortController | null;
  };
  /** Admitted account/provider lifetime. */ contextSignal: AbortSignal;
  /** Current canonical delivery and predecessor must still match admission. */ owns: () => boolean;
  /** Publishes only the correlated optional question. */ publish: (riddle: BridgeRiddle) => void;
}): Promise<boolean> {
  /** Eligibility stays in optional code while captured origin ownership survives module loading. */
  const parent = options.parent;
  if (options.contextSignal.aborted || !options.owns() || !options.userId || !parent || parent.gameMode !== "classic" ||
    options.input.gameMode !== "classic" || options.input.locale !== options.locale || !Number.isSafeInteger(parent.index) ||
    options.input.classicIndex !== parent.index! + 1 || options.input.authoritative || options.input.prepareNext) return false;
  /** Optional work owns its own cancellation and deadline. */
  const preview = new AbortController();
  options.deliveryRef.current?.abort();
  options.deliveryRef.current = preview;
  /** Account retirement releases this bounded wait without retiring canonical work. */
  const retire = () => preview.abort();
  options.contextSignal.addEventListener("abort", retire, {once: true});
  try {
    /** Provider work remains observed after a retired or expired delivery wait. */
    const riddle = await riddleLoadDeadline(options.services.loadRiddle(options.input, preview.signal), preview.signal);
    if (preview.signal.aborted || options.contextSignal.aborted || !options.owns() ||
      options.deliveryRef.current !== preview || riddle.gameMode !== "classic" ||
      riddle.index !== options.input.classicIndex || riddle.sessionToken === parent.sessionToken) return false;
    options.publish(riddle);
    return true;
  } catch {
    return false;
  } finally {
    retire();
    options.contextSignal.removeEventListener("abort", retire);
    if (options.deliveryRef.current === preview) options.deliveryRef.current = null;
  }
}
