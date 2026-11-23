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
  enablePlayerStateWrites: (playerData: JestPlayerData | null, playerId: string) => JestPlayerData | null | void;
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
      if (!isActive() || !gate.isOpen()) return;
      /** Ignore older multilingual preferences before preparing this English-only target. */
      const englishSession = {...session, preferences: {...session.preferences, locale: "en"}};
      /** Browser preferences match the supported language before hosted play mounts. */
      applyPlayerPreferences(englishSession.preferences);
      /** Content and profile preparation share the locale's download window. */
      const [, readySession] = await Promise.all([
        setLocaleAndWait("en"),
        prepareSession?.(englishSession, "en") ?? englishSession,
      ]);
      if (!isActive() || !gate.isOpen()) return;
      /** The same target player may have a newer unsaved checkpoint from the retiring guest/session visit. */
      const playerData = enablePlayerStateWrites(readySession.playerData, readySession.player.playerId);
      /** Preserve the authority-hydrated session while installing the reconciled client checkpoint. */
      const committedSession = playerData !== undefined && playerData !== readySession.playerData
        ? {...readySession, preferences: {...readySession.preferences, locale: "en"}, playerData}
        : {...readySession, preferences: {...readySession.preferences, locale: "en"}};
      /** Saves d profile. */
      const savedProfile = committedSession.playerData?.profile;
      setEngagementProgress({
        level: savedProfile?.level ?? 1,
        winStreak: savedProfile?.winStreak ?? 0,
        wins: savedProfile?.wins ?? 0,
      });
      setSession(committedSession);
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
