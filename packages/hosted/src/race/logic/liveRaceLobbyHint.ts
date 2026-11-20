/** Shared storage key for an acknowledged private lobby or public waiting seat. */
export const LIVE_RACE_LOBBY_KEY = "riddleQuest:liveRaceLobby";

/** Startup only opens multiplayer; its lazy reader validates the complete seat selection. */
export function hasLiveRaceLobby(ownerId?: string, locale?: string,
  read: () => string | null | undefined = () => null, now = Date.now): boolean {
  if (!ownerId) return false;
  /** Untrusted local selection hint, bounded before parsing. */
  const raw = read();
  if (!raw) return false;
  try {
    /** Untrusted parsed hint inspected only to decide whether multiplayer should open. */
    const saved: unknown = raw.length <= 1024 ? JSON.parse(raw) : null;
    if (typeof saved === "object" && saved !== null && "ownerId" in saved && saved.ownerId === ownerId &&
      "locale" in saved && typeof saved.locale === "string" && (!locale || saved.locale === locale) &&
      (("challengeId" in saved && typeof saved.challengeId === "string" && /^live_[a-f0-9]{64}$/.test(saved.challengeId)) ||
        ("ticketId" in saved && typeof saved.ticketId === "string" && /^[a-f0-9]{64}$/.test(saved.ticketId))) &&
      "expiresAtMs" in saved && typeof saved.expiresAtMs === "number" && Number.isFinite(saved.expiresAtMs) &&
      saved.expiresAtMs > now()) return true;
  } catch { /* The lazy lobby never receives an invalid startup selection. */ }
  return false;
}
