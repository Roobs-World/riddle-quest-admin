import type {BridgeProfile} from "../../../platform/bridge/messages";
import type {AuthSnapshot} from "../../../platform/contracts/hostServices";

/** Restores low-integrity display state only while authoritative profile data loads. */
export const restoreProfileWhileServerLoads = (
  snapshot: AuthSnapshot,
  savedProfile: BridgeProfile | undefined,
): AuthSnapshot =>
  snapshot.user && !snapshot.profile && savedProfile ? {...snapshot, profile: savedProfile} : snapshot;
