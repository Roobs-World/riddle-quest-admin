import type {BridgeProfile} from "@qwordly/core/bridge";
import type {AuthSnapshot} from "@qwordly/hosted/hostTypes";

/** Restores low-integrity display state only while authoritative profile data loads. */
export const restoreProfileWhileServerLoads = (
  snapshot: AuthSnapshot,
  savedProfile: BridgeProfile | undefined,
): AuthSnapshot =>
  snapshot.user && !snapshot.profile && savedProfile ? {...snapshot, profile: savedProfile} : snapshot;
