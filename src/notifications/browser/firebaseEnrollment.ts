import {z} from "zod";
import {readBrowserStorage, writeBrowserStorage} from "../../platform/browser/storage/browserStorage";
import type {NotificationDelivery, NotificationSetupLink} from "../contracts/notificationProvider";

const PairingCode = z.string().regex(/^[a-f0-9]{64}$/u);
const Enrollment = z.object({url: z.string().max(2048), expiresAtMs: z.number().int().positive().safe()}).strict();
const EnrollmentStatus = z.object({registeredDevices: z.number().int().nonnegative().safe(), enrollmentComplete: z.boolean()}).strict();
const EnrollmentMessage = z.object({kind: z.literal("riddle-quest-notification-enrolled"), pairHash: PairingCode}).strict();

export type FirebaseEnrollmentBackend = {
  createEnrollment(input: {locale: string}): Promise<unknown>;
  getEnrollmentStatus(input: {pairingCode?: string}): Promise<unknown>;
};

/** The signed-in game's authority pairs a separately consented, top-level browser device. */
export function createFirebaseNotificationEnrollment({accountId, managerOrigin, locale, isCurrent, backend}: {
  accountId: string;
  managerOrigin: string;
  locale(): string;
  isCurrent(): boolean;
  backend: FirebaseEnrollmentBackend;
}) {
  const origin = new URL(managerOrigin);
  if (origin.protocol !== "https:" || origin.origin !== managerOrigin || origin.username || origin.password)
    throw new Error("notification-enrollment-origin-invalid");
  const storageKey = `riddleQuest:notificationEnrollment:${accountId}`;
  const stored = PairingCode.safeParse(readBrowserStorage("local", storageKey));
  let pairingCode: string | undefined = stored.success ? stored.data : undefined;
  let active = false;
  let generation = 0;
  let opening = false;
  let popup: Window | null = null;
  let pairHash: string | null = null;
  let setupLink: NotificationSetupLink | null = null;
  let lifetimeTimer: ReturnType<typeof setInterval> | undefined;
  const current = () => active && isCurrent();
  const closePopup = () => {
    try {popup?.close();} catch { /* The external window may already be unavailable. */ }
    popup = null;
    pairHash = null;
    if (lifetimeTimer !== undefined) clearInterval(lifetimeTimer);
    lifetimeTimer = undefined;
  };
  const restoreDelivery = async (): Promise<NotificationDelivery> => {
    if (!current()) return "inactive";
    const operation = generation;
    const queriedPairingCode = pairingCode;
    const result = EnrollmentStatus.parse(await backend.getEnrollmentStatus(queriedPairingCode ? {pairingCode: queriedPairingCode} : {}));
    if (!current() || generation !== operation) return "inactive";
    if (queriedPairingCode !== pairingCode) return "permission-required";
    if (queriedPairingCode && result.enrollmentComplete) {
      setupLink = null;
      return "ready";
    }
    return "permission-required";
  };
  const onMessage = (event: MessageEvent<unknown>) => {
    if (!current() || !popup || event.origin !== managerOrigin || event.source !== popup || !pairHash) return;
    const result = EnrollmentMessage.safeParse(event.data);
    if (!result.success || result.data.pairHash !== pairHash) return;
    void restoreDelivery().then(delivery => {
      if (current() && delivery === "ready") closePopup();
    }).catch(() => undefined);
  };
  return {
    activate() {
      if (active) return;
      active = true;
      generation += 1;
      window.addEventListener("message", onMessage);
    },
    restoreDelivery,
    getSetupLink: () => current() && setupLink && setupLink.expiresAtMs > Date.now() ? setupLink : null,
    requestPermission(): Promise<boolean> {
      if (!current() || opening) return Promise.resolve(false);
      if (popup && !popup.closed) {
        try {popup.focus(); return Promise.resolve(true);} catch {closePopup(); return Promise.resolve(false);}
      }
      // Sandboxed hosts can deny popups. The same account-bound link remains usable through manual browser setup.
      try {popup = window.open("about:blank", "_blank", "popup,width=520,height=720");}
      catch {popup = null;}
      opening = true;
      const opened = popup;
      const operation = generation;
      const ownsRequest = () => current() && generation === operation && popup === opened;
      const closeRequestPopup = () => {
        if (generation === operation && popup === opened) closePopup();
      };
      const open = async () => {
        try {
          const enrollment = Enrollment.parse(await backend.createEnrollment({locale: locale()}));
          if (!ownsRequest()) {closeRequestPopup(); return false;}
          const destination = new URL(enrollment.url);
          const code = PairingCode.parse(destination.hash.replace(/^#pair=/u, ""));
          if (destination.origin !== managerOrigin || destination.pathname !== "/push/" || destination.search ||
              destination.hash !== `#pair=${code}` || destination.username || destination.password || enrollment.expiresAtMs <= Date.now())
            throw new Error("notification-enrollment-url-invalid");
          const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
          if (!ownsRequest()) {closeRequestPopup(); return false;}
          pairingCode = code;
          pairHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
          writeBrowserStorage("local", storageKey, code);
          setupLink = {url: destination.href, expiresAtMs: enrollment.expiresAtMs};
          if (opened && !opened.closed) {
            try {opened.location.replace(destination.href);} catch {closePopup();}
            if (popup) lifetimeTimer = setInterval(() => {
              if (!current() || opened.closed || Date.now() > enrollment.expiresAtMs) closePopup();
            }, 500);
          } else closePopup();
          return true;
        } catch {
          closeRequestPopup();
          return false;
        } finally {if (generation === operation) opening = false;}
      };
      return open();
    },
    retire() {
      active = false;
      generation += 1;
      opening = false;
      setupLink = null;
      closePopup();
      window.removeEventListener("message", onMessage);
    },
  };
}
