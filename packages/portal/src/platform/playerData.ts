import type {BridgeProfile} from "@riddle-quest/core/bridge";
import type {AuthSnapshot} from "@riddle-quest/hosted/hostTypes";

/** Restores low-integrity display state only while authoritative profile data loads. */
export const restoreProfileWhileServerLoads = (
  snapshot: AuthSnapshot,
  savedProfile: BridgeProfile | undefined,
): AuthSnapshot =>
  snapshot.user && !snapshot.profile && savedProfile ? {...snapshot, profile: savedProfile} : snapshot;
