import type {PlatformResult} from "../../../../src/platform/contracts/capabilities";
import type {FacebookInstantSdk} from "./fbinstant";

/** Provider UI occupancy is scoped to the SDK instance, never another platform. */
const activeDialogs = new WeakSet<FacebookInstantSdk>();

/** Prevents Meta social dialogs, shares, ads and subscription prompts from overlapping. */
export async function runFacebookSdkDialog<Result = void>(
  sdk: FacebookInstantSdk,
  operation: () => Promise<PlatformResult<Result>>,
): Promise<PlatformResult<Result>> {
  if (activeDialogs.has(sdk)) return {status: "unavailable", message: "facebook-provider-dialog-in-progress"};
  activeDialogs.add(sdk);
  try {
    return await operation();
  } finally {
    activeDialogs.delete(sdk);
  }
}
