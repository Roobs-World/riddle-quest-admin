import {applyPlayerPreferences} from "../play/playerPreferences";
import {setLocaleAndWait, type Locale} from "../play/i18n";
import type {NotificationOperationGate} from "./notifications/operationGate";
import type {JestEngagementProgress, JestPlayerData, JestSession} from "./types";

/** Commits a successful startup while deletion still holds a shared cross-tab lock. */
export async function commitJestStartupSession({
  gate,
  isActive,
  session,
  prepareSession,
  enablePlayerStateWrites,
  setEngagementProgress,
  setSession,
  trackFunnel,
}: {
  /** Stores gate. */
  gate: NotificationOperationGate;
  /** Stores is active. */
  isActive: () => boolean;
  /** Stores session. */
  session: JestSession;
  /** Starts authenticated content preparation and hydrates authoritative progress alongside translations. */
  prepareSession?: (session: JestSession, locale: Locale) => Promise<JestSession>;
  /** Stores enable player state writes. */
  enablePlayerStateWrites: (playerData: JestPlayerData | null) => void;
  /** Stores set engagement progress. */
  setEngagementProgress: (progress: JestEngagementProgress) => void;
  /** Stores set session. */
  setSession: (session: JestSession) => void;
  /** Stores track funnel. */
  trackFunnel: (eventName: string, params: Record<string, string | number | boolean>) => void;
}): Promise<boolean> {
  /** Keeps nonessential analytics failures from invalidating committed player state. */
  const trackFunnelSafely = (
    eventName: string,
    params: Record<string, string | number | boolean>,
  ): void => {
    try {
      trackFunnel(eventName, params);
    } catch {
      // Startup state is authoritative; analytics sinks are best-effort only.
    }
  };
  /** Provides committed behavior. */
  let committed = false;
  try {
    await gate.run(async () => {
      if (!isActive()) return;
      /** Restored preferences select the language before the hosted game mounts. */
      const preferences = applyPlayerPreferences(session.preferences);
      /** Content and profile preparation share the locale's download window. */
      const [, readySession] = await Promise.all([
        setLocaleAndWait(preferences.locale as Locale),
        prepareSession?.(session, preferences.locale as Locale) ?? session,
      ]);
      if (!isActive()) return;
      enablePlayerStateWrites(readySession.playerData);
      /** Saves d profile. */
      const savedProfile = readySession.playerData?.profile;
      setEngagementProgress({
        level: savedProfile?.level ?? 1,
        winStreak: savedProfile?.winStreak ?? 0,
        wins: savedProfile?.wins ?? 0,
      });
      setSession(readySession);
      trackFunnelSafely("session_started", {
        registered: session.player.registered,
        campaign: session.entryIntent.campaign ?? "direct",
        reference: session.entryIntent.reference ?? "none",
        notificationTemplate: session.entryIntent.notificationTemplate ?? "none",
        notificationOffset: session.entryIntent.notificationOffset ?? "none",
        utm_source: session.entryIntent.utmSource ?? "none",
        utm_medium: session.entryIntent.utmMedium ?? "none",
        utm_campaign: session.entryIntent.utmCampaign ?? "none",
        utm_term: session.entryIntent.utmTerm ?? "none",
        utm_content: session.entryIntent.utmContent ?? "none",
      });
      if (session.entryIntent.inviteKind) {
        trackFunnelSafely("viral_invite_opened", {
          inviteKind: session.entryIntent.inviteKind,
          campaign: session.entryIntent.campaign ?? "unknown",
          hasInviterName: Boolean(session.entryIntent.inviterName),
        });
      }
      committed = true;
    });
  } catch (error) {
    if (!isActive() || !gate.isOpen()) return false;
    throw error;
  }
  return committed;
}
