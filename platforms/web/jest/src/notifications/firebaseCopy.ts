import {doc, getDoc} from "firebase/firestore/lite";
import {firebaseFirestore} from "../../../../../src/platform/firebase/browserClient";
import {parseNotificationCopyDocument, type NotificationCopy} from "./copy";

/** Loads Jest notification copy from the connected-game authority. */
export async function loadNotificationCopy(locale: string): Promise<NotificationCopy> {
  /** Provides snapshot behavior. */
  const snapshot = await getDoc(doc(firebaseFirestore, "config", "notifications"));
  if (!snapshot.exists()) throw new Error("Firestore notification copy is not configured.");
  return parseNotificationCopyDocument(snapshot.data(), locale);
}
