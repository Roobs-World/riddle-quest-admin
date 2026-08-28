import {applyPlayerPreferences} from "../play/playerPreferences";
import type {NotificationOperationGate} from "./notifications/operationGate";
import type {JestEngagementProgress, JestPlayerData, JestSession} from "./types";

/** Commits a successful startup while deletion still holds a shared cross-tab lock. */
export async function commitJestStartupSession({
  gate,
  isActive,
  session,
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
  /** Stores enable player state writes. */
  enablePlayerStateWrites: (playerData: JestPlayerData | null) => void;
  /** Stores set engagement progress. */
  setEngagementProgress: (progress: JestEngagementProgress) => void;
  /** Stores set session. */
  setSession: (session: JestSession) => void;
  /** Stores track funnel. */
  trackFunnel: (eventName: string, params: Record<string, string | number | boolean>) => void;
}): Promise<boolean> {
  /** Provides committed behavior. */
  let committed = false;
  try {
    await gate.run(async () => {
      if (!isActive()) return;
      applyPlayerPreferences(session.preferences);
      enablePlayerStateWrites(session.playerData);
      /** Saves d profile. */
      const savedProfile = session.playerData?.profile;
      setEngagementProgress({
        level: savedProfile?.level ?? 1,
        winStreak: savedProfile?.winStreak ?? 0,
        wins: savedProfile?.wins ?? 0,
      });
      setSession(session);
      trackFunnel("session_started", {
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
        trackFunnel("viral_invite_opened", {
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
