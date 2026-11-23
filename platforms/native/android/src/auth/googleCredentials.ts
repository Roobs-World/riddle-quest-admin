import {NativeModules} from "react-native";
/** Native token acquisition is optional until OAuth setup is complete. */
export function googleCredentialsAvailable(clientId?: string): boolean {
  /** Native modules are unknown values until their callable methods are checked. */
  const module: unknown = NativeModules.RiddleQuestGoogleCredentials;
  return typeof clientId === "string" && /^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/u.test(clientId) &&
    typeof module === "object" && module !== null && "getIdToken" in module && typeof module.getIdToken === "function";
}
/** Google verifies native selection; Firebase subsequently verifies the ID token before accepting identity. */
export async function pickGoogleCredential(clientId: string): Promise<string | null> {
  /** Native data is never interpreted as a trusted game-account identity. */
  const module: unknown = NativeModules.RiddleQuestGoogleCredentials;
  if (!googleCredentialsAvailable(clientId) || typeof module !== "object" || module === null || !("getIdToken" in module) || typeof module.getIdToken !== "function")
    throw new Error("google-sign-in-unavailable");
  /** Cancellation is a normal outcome; tokens are never persisted or logged by this bridge. */
  const value: unknown = await module.getIdToken(clientId);
  if (value === null) return null;
  if (typeof value !== "string" || value.length > 20_000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(value)) throw new Error("google-credential-invalid");
  return value;
}
/** Clearing the provider's session permits another account choice at the next explicit sign-in. */
export async function clearGoogleCredentialState(): Promise<void> {
  /** Missing native identity support must not prevent Firebase sign-out or account deletion. */
  const module: unknown = NativeModules.RiddleQuestGoogleCredentials;
  if (typeof module === "object" && module !== null && "clearSession" in module && typeof module.clearSession === "function") await module.clearSession();
}
