import {getFunctions, httpsCallable} from "firebase/functions";
import {z} from "zod";
import {firebaseEnvironment} from "../../platform/firebase/browserEnvironment";
import type {NotificationSetupLink} from "../contracts/notificationProvider";

const RegistrationHandoff = z.object({url: z.string().max(2048), expiresAtMs: z.number().int().positive().safe()}).strict();
const PairingCode = z.string().regex(/^[a-f0-9]{64}$/u);

/** Issues one authenticated manager handoff; device setup and responses stay outside the game. */
export function createFirebaseNotificationRegistration({expectedUid, managerOrigin, locale, isCurrent, run}: {
  expectedUid: string;
  managerOrigin: string;
  locale(): string;
  isCurrent(): boolean;
  run<Result>(operation: () => Promise<Result>): Promise<Result>;
}): () => Promise<NotificationSetupLink> {
  return () => run(async () => {
    if (!isCurrent()) throw new Error("notification-registration-account-changed");
    const origin = new URL(managerOrigin);
    if (origin.protocol !== "https:" || origin.origin !== managerOrigin || origin.username || origin.password)
      throw new Error("notification-manager-origin-invalid");
    const {auth, firebaseApp} = await import("../../platform/firebase/browserClient");
    const current = () => isCurrent() && auth.currentUser?.uid === expectedUid;
    if (!current()) throw new Error("notification-registration-account-changed");
    const functions = getFunctions(firebaseApp, firebaseEnvironment.gameplayRegion || "europe-west1");
    const result = await httpsCallable<{locale: string}, unknown>(functions, "createNotificationEnrollment")({locale: locale()});
    if (!current()) throw new Error("notification-registration-account-changed");
    const handoff = RegistrationHandoff.parse(result.data);
    const destination = new URL(handoff.url);
    const code = PairingCode.parse(destination.hash.replace(/^#pair=/u, ""));
    if (destination.origin !== managerOrigin || destination.pathname !== "/push/" || destination.search ||
      destination.hash !== `#pair=${code}` || destination.username || destination.password || handoff.expiresAtMs <= Date.now())
      throw new Error("notification-registration-handoff-invalid");
    return {url: destination.href, expiresAtMs: handoff.expiresAtMs};
  });
}
