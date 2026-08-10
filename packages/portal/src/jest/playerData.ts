import type {BridgeProfile} from "@qwordly/core/bridge";
import type {AuthSnapshot} from "../play/types";

/** Provides restore jest profile while server loads behavior. */
export const restoreJestProfileWhileServerLoads = (
  snapshot: AuthSnapshot,
  savedProfile: BridgeProfile | undefined,
): AuthSnapshot =>
  snapshot.user && !snapshot.profile && savedProfile
    ? {...snapshot, profile: savedProfile}
    : snapshot;
