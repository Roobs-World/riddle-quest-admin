/** Removes the persisted Firebase session after authoritative Jest account deletion. */
export async function clearJestFirebaseAuthentication(): Promise<void> {
  /** Provides [{sign out}, {auth}] behavior. */
  const [{signOut}, {auth}] = await Promise.all([import("firebase/auth"), import("../../../../packages/web-game/src/firebase")]);
  await signOut(auth);
}
