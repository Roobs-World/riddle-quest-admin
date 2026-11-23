import {getDatabase, type Database} from "firebase-admin/database";

/** Defines the facebook presence feature gate path value. */
export const FACEBOOK_PRESENCE_FEATURE_GATE_PATH = "featureGates/facebookPresence";

/** Mirrors the deployed provider switch into the server-only RTDB rules boundary. */
export async function syncFacebookPresenceFeatureGate(
  enabled: boolean,
  database: Database = getDatabase(),
): Promise<void> {
  if (typeof enabled !== "boolean") throw new Error("invalid-facebook-presence-feature-gate");
  await database.ref(FACEBOOK_PRESENCE_FEATURE_GATE_PATH).set(enabled);
}
