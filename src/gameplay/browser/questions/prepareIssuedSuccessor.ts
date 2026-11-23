import type {BridgeRiddle} from "../../../platform/bridge/messages";
import type {HostServices} from "../../../platform/contracts/hostServices";
import {riddleLoadDeadline} from "./riddleLoadDeadline";

/** One optional issued successor remains bound to its canonical predecessor. */
type PreparedSuccessor<Scope> = {
  /** Admitted account/provider scope. */ scope: Scope;
  /** Committed scope generation. */ version: number;
  /** Issued predecessor token. */ parentToken: string;
  /** Requested successor position. */ index: number;
  /** Time the provider result became ready. */ readyAt: number;
  /** Prepared provider result, or an unresolved admitted read. */ riddle: BridgeRiddle | null;
};

/** Defers optional Next preparation code until a predecessor actually requests it. */
export async function prepareIssuedSuccessor<Scope>(options: {
  /** Current optional preparation slot. */ ref: {
    /** Latest admitted preparation. */ current: PreparedSuccessor<Scope> | null;
  };
  /** Admitted account/provider scope. */ scope: Scope;
  /** Committed scope generation. */ version: number;
  /** Captured canonical predecessor. */ parent: BridgeRiddle | null;
  /** Current account admission. */ userId: string | undefined;
  /** Admitted content language. */ locale: string;
  /** Exact bound preparation request. */ input: Parameters<HostServices["loadRiddle"]>[0];
  /** Target-owned content adapter. */ services: Pick<HostServices, "loadRiddle">;
  /** Account/provider retirement. */ signal: AbortSignal;
  /** Rechecks the admitted account and canonical predecessor. */ owns: (entry: PreparedSuccessor<Scope>) => boolean;
  /** Target-owned optional preparation admission. */ canUse?: () => boolean;
}): Promise<boolean> {
  /** Cleanup may remove only the preparation reserved by this invocation. */
  let entry: PreparedSuccessor<Scope> | null = null;
  try {
    /** All optional eligibility stays outside the initial resource set. */
    const parent = options.parent;
    if (options.signal.aborted || !options.userId || !parent || parent.gameMode !== "classic" ||
      options.input.gameMode !== "classic" || options.input.locale !== options.locale || options.input.authoritative ||
      !Number.isSafeInteger(parent.index) || !Number.isSafeInteger(parent.index! + 1) ||
      options.input.classicIndex !== parent.index! + 1 || options.input.sessionToken !== parent.sessionToken ||
      options.input.riddleId !== parent.riddleId || (options.canUse && !options.canUse())) return false;
    entry = {scope: options.scope, version: options.version, parentToken: parent.sessionToken,
      index: options.input.classicIndex, readyAt: 0, riddle: null};
    if (!options.owns(entry)) return false;
    /** Repeated requests share a fresh preparation from the same predecessor. */
    const previous = options.ref.current;
    if (previous && options.owns(previous) && previous.index === options.input.classicIndex &&
      (!previous.riddle || (Date.now() - previous.readyAt >= 0 && Date.now() - previous.readyAt < 15_000))) return true;
    options.ref.current = entry;
    /** Origin identity constrains preparation and never becomes a successor resume identity. */
    const riddle = await riddleLoadDeadline(options.services.loadRiddle({gameMode: "classic",
      locale: options.locale, classicIndex: entry.index}, options.signal), options.signal);
    if (options.ref.current !== entry || !options.owns(entry)) return false;
    if (riddle.gameMode !== "classic" || riddle.index !== entry.index || riddle.sessionToken === parent.sessionToken) {
      options.ref.current = null;
      return false;
    }
    entry.riddle = riddle;
    entry.readyAt = Date.now();
    return true;
  } catch {
    if (entry && options.ref.current === entry) options.ref.current = null;
    return false;
  }
}
