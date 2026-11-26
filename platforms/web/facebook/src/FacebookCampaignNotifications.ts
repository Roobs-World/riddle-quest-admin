import {z} from "zod";
import type {LocalAccountDeletionGate} from "../../../../src/accounts/browser/deletion/LocalAccountDeletionGate";
import {createManagerNotificationProvider} from "../../../../src/notifications/controllers/managerNotificationProvider";
import {auth, setNotificationPreference} from "../../../../src/platform/firebase/browserClient";
import {setPlayerNotificationsEnabled} from "../../../../src/settings/browser/playerPreferences";

const preferenceResponse = z.object({enabled: z.boolean(), facebookConsent: z.boolean()});
type PreferenceRequest = {initialize: true} | {enabled: true; facebookConsent: "a2u-v1"} | {enabled: false};

/** Restores the signed player's A2U choice and records affirmative consent only from Settings. */
export async function createFacebookCampaignNotifications(
  userId: string, gate: LocalAccountDeletionGate, isActive: () => boolean,
) {
  const ownsSession = () => isActive() && gate.isOpen() && auth.currentUser?.uid === userId;
  const save = (request: PreferenceRequest) => gate.run(async () => {
    if (!ownsSession()) throw new Error("facebook-notification-account-changed");
    const {data} = await setNotificationPreference(request);
    if (!ownsSession()) throw new Error("facebook-notification-account-changed");
    return preferenceResponse.parse(data);
  });
  const restored = await save({initialize: true});
  let facebookEnabled = restored.enabled && restored.facebookConsent;
  return createManagerNotificationProvider({
    available: true,
    preferences: {
      getEnabled: () => facebookEnabled,
      setEnabled: enabled => {facebookEnabled = enabled;},
      // The controller publishes changes. Facebook-specific consent belongs to this signed session.
      subscribe: () => () => undefined,
    },
    async saveConsent(enabled) {
      const saved = await save(enabled ? {enabled: true, facebookConsent: "a2u-v1"} : {enabled: false});
      if (saved.enabled !== enabled || saved.facebookConsent !== enabled || !ownsSession()) return false;
      setPlayerNotificationsEnabled(saved.enabled);
      return true;
    },
  });
}
