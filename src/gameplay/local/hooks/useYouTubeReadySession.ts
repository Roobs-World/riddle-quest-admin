import {useEffect, useRef, useState} from "react";
import {utcDay} from "../../../progression/economy/localEconomy";
import {type YouTubeCopyKey} from "../../../localization/copy/localGameCopy";
import {LocalSoloAuthority, YouTubeAuthorityError, type YouTubeAuthoritySnapshot} from "../LocalSoloAuthority";
import type {YouTubeSdkPort} from "../types";
import {YouTubeSaveBlockedError} from "../../persistence/YouTubeSaveGate";
/** Milliseconds until the next UTC day, including a small early-timer cushion. */
const millisecondsUntilNextUtcDay = (now: Date): number => {
  /** Start of the following UTC day. */
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, next - now.getTime() + 50);
};
/** Maps authority failures to localized notices without exposing error details to the view. */
const authorityErrorKey = (error: unknown): YouTubeCopyKey => {
  /** Stable authority error code when available. */
  const code = error instanceof YouTubeAuthorityError ? error.code : "";
  if (code === "coins-insufficient") return "insufficientCoins";
  if (code === "answer-incomplete") return "answerIncomplete";
  if (code === "daily-unavailable") return "dailyUnavailable";
  if (error instanceof YouTubeSaveBlockedError) return "saveFailed";
  return "operationFailed";
};
/** Accessibility preferences a host surface renders. */
export type YouTubeAccessibilityPreferences = Readonly<{
  /** Stores reduced motion. */
  reducedMotion: boolean;
}>;
/** Host presentation callbacks for the ready session; every callback is optional. */
export type YouTubeReadySessionHost = Readonly<{
  /** Moves keyboard focus to the answer editor when an answer becomes usable. */
  focusAnswer?: () => void;
  /** Applies accessibility preferences to the host surface and may return a cleanup. */
  applyPreferences?: (preferences: YouTubeAccessibilityPreferences) => (() => void) | undefined;
}>;
/** Observable ready-session state exposed to the view. */
export type YouTubeReadySession = Readonly<{
  /** Latest authority projection. */
  snapshot: YouTubeAuthoritySnapshot;
  /** Current UTC calendar day used for daily availability. */
  today: string;
  /** Latest localized operation failure. */
  notice: YouTubeCopyKey | null;
  /** Runs one authority transition and projects any failure into notice state. */
  run: (action: () => Promise<unknown>) => Promise<void>;
}>;
/** Coordinates authority, platform, accessibility, focus, and UTC lifecycle for the ready view. */
export function useYouTubeReadySession(
  authority: LocalSoloAuthority,
  sdk: YouTubeSdkPort,
  host: YouTubeReadySessionHost = {},
): YouTubeReadySession {
  /** Latest immutable authority projection. */
  const [snapshot, setSnapshot] = useState<YouTubeAuthoritySnapshot>(() => authority.getSnapshot());
  /** Latest operation failure suitable for localized display. */
  const [notice, setNotice] = useState<YouTubeCopyKey | null>(null);
  /** Current UTC calendar day. */
  const [today, setToday] = useState(() => utcDay(new Date()));
  /** Latest host callbacks; identity changes must not retrigger presentation effects. */
  const hostRef = useRef(host);

  useEffect(() => {
    hostRef.current = host;
  });

  useEffect(() => authority.subscribe(() => setSnapshot(authority.getSnapshot())), [authority]);

  /** Preference values drive the host effect; the snapshot object itself changes on every save. */
  const {reducedMotion} = snapshot.save.preferences;
  useEffect(() => hostRef.current.applyPreferences?.({reducedMotion}), [reducedMotion]);

  useEffect(() => {
    if (!snapshot.paused) sdk.gameReady();
  }, [sdk, snapshot.paused]);

  /** Focus only when an answer becomes usable, not when an already editable save receipt arrives. */
  const answerEditable = Boolean(snapshot.activeRiddle) && !snapshot.paused && !snapshot.saveBlocked &&
    !snapshot.save.activeGame?.awaitingContinue && !snapshot.lastResult;
  useEffect(() => {
    if (answerEditable) hostRef.current.focusAnswer?.();
  }, [answerEditable, snapshot.activeRiddle]);

  useEffect(() => {
    if (snapshot.paused) return;
    /** Time used consistently for today's value and rollover delay. */
    const now = new Date();
    setToday(utcDay(now));
    /** Single rollover timer; the next render schedules the following day. */
    const timer = setTimeout(() => setToday(utcDay(new Date())), millisecondsUntilNextUtcDay(now));
    return () => clearTimeout(timer);
  }, [snapshot.paused, today]);
  /** Runs an authority transition and exposes only its stable localized error category. */
  const run = async (action: () => Promise<unknown>): Promise<void> => {
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setNotice(authorityErrorKey(error));
    }
  };

  return {snapshot, today, notice, run};
}
