import {createHmac} from "node:crypto";

export const REDDIT_RECOVERY_METADATA_KEY = "riddle-account";

/** Creates a stable opaque account tag without exposing the Reddit user ID or gateway secret. */
export function redditCommerceRecoveryKey(appSlug: string, userId: string, gatewaySecret: string): string {
  if (!/^[a-z0-9-]{1,64}$/.test(appSlug) || !/^t2_[A-Za-z0-9]{1,32}$/.test(userId) ||
    Buffer.byteLength(gatewaySecret, "utf8") < 32) throw new Error("invalid-reddit-recovery-scope");
  return createHmac("sha256", gatewaySecret)
    .update(`riddle-quest\0reddit-commerce-recovery\0v1\0${appSlug}\0${userId}`)
    .digest("base64url");
}
