/** Removes the persisted Firebase session after authoritative Jest account deletion. */
export async function clearJestFirebaseAuthentication(): Promise<void> {
  /** Provides [{sign out}, {auth}] behavior. */
  const [{signOut}, {auth}] = await Promise.all([import("firebase/auth"), import("../firebase")]);
  await signOut(auth);
}
