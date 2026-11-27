import type {PlatformResult} from "../../../../src/platform/contracts/capabilities";
import type {FacebookInstantSdk} from "./fbinstant";

/** Provider UI occupancy is scoped to the SDK instance, never another platform. */
const activeDialogs = new WeakSet<FacebookInstantSdk>();
type DialogGuard = {beforeOpen: () => Promise<void>; afterClose: () => void};
const dialogGuards = new WeakMap<FacebookInstantSdk, Set<DialogGuard>>();

/** Persistent native surfaces must be hidden before a transient provider dialog opens. */
export function registerFacebookSdkDialogGuard(sdk: FacebookInstantSdk, guard: DialogGuard): () => void {
  const guards = dialogGuards.get(sdk) ?? new Set<DialogGuard>();
  dialogGuards.set(sdk, guards);
  guards.add(guard);
  return () => {guards.delete(guard); if (guards.size === 0) dialogGuards.delete(sdk);};
}

/** A newly mounted persistent surface must also respect an already-open provider dialog. */
export const isFacebookSdkDialogOpen = (sdk: FacebookInstantSdk): boolean => activeDialogs.has(sdk);

/** Prevents Meta social dialogs, shares, ads and checkouts from overlapping. */
export async function runFacebookSdkDialog<Result = void>(
  sdk: FacebookInstantSdk,
  operation: () => Promise<PlatformResult<Result>>,
): Promise<PlatformResult<Result>> {
  if (activeDialogs.has(sdk)) return {status: "unavailable", message: "facebook-provider-dialog-in-progress"};
  activeDialogs.add(sdk);
  const guards = [...(dialogGuards.get(sdk) ?? [])];
  try {
    try {
      for (const guard of guards) await guard.beforeOpen();
    } catch {
      return {status: "unavailable", message: "facebook-provider-surface-not-hidden"};
    }
    return await operation();
  } finally {
    activeDialogs.delete(sdk);
    for (const guard of guards) {
      try {guard.afterClose();} catch { /* Optional surface restoration cannot change a dialog result. */ }
    }
  }
}
