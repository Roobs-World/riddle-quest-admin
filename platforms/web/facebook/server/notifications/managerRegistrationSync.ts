import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {managerOrigin, notificationBridgeSecret, pushDigest} from "../../../../../firebase-functions/src/notifications/notificationBridge";
import {FacebookRegistrationReceipt} from "./managerProtocol";
import {facebookRegistration} from "./managerRegistration";

/** Retry delivery of account changes independently from the player's sign-in or Settings request. */
export const syncFacebookManagerRegistration = onDocumentWritten({document: "providerIdentities/{recipientHash}",
  region: "europe-west1", retry: true, timeoutSeconds: 30, secrets: [notificationBridgeSecret]}, async event => {
  const change = event.data;
  if (!change || !/^[a-f0-9]{64}$/u.test(event.params.recipientHash)) return;
  const registration = facebookRegistration(change.after, change.before);
  if (!registration || (registration.enabled && registration.expiresAtMs <= Date.now())) return;
  const response = await fetch(`${managerOrigin()}/api/devices/facebook/registration`, {method: "POST",
    redirect: "error", signal: AbortSignal.timeout(8000),
    headers: {Authorization: `Bearer ${notificationBridgeSecret.value()}`, "Content-Type": "application/json"},
    body: JSON.stringify(registration)});
  if (!response.ok) {await response.body?.cancel(); throw new Error("facebook-manager-registration-unavailable");}
  const receipt = FacebookRegistrationReceipt.parse(await response.json());
  if (receipt.installationId !== pushDigest(`facebook:${registration.recipientHash}`) || receipt.revision < registration.revision)
    throw new Error("facebook-manager-registration-receipt-invalid");
});
