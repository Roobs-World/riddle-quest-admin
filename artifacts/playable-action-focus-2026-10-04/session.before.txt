import {useEffect, useState, type RefObject} from "react";
import {utcDay} from "./economy";
import {type YouTubeCopyKey} from "./i18n";
import {LocalSoloAuthority, YouTubeAuthorityError, type YouTubeAuthoritySnapshot} from "./LocalSoloAuthority";
import type {YouTubeSdkPort} from "./types";
import {YouTubeSaveBlockedError} from "./YouTubeSaveGate";
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
/** Observable ready-session state exposed to the YouTube view. */
type YouTubeReadySession = Readonly<{
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
  inputRef: RefObject<HTMLInputElement | null>,
): YouTubeReadySession {
  /** Latest immutable authority projection. */
  const [snapshot, setSnapshot] = useState<YouTubeAuthoritySnapshot>(() => authority.getSnapshot());
  /** Latest operation failure suitable for localized display. */
  const [notice, setNotice] = useState<YouTubeCopyKey | null>(null);
  /** Current UTC calendar day. */
  const [today, setToday] = useState(() => utcDay(new Date()));

  useEffect(() => authority.subscribe(() => setSnapshot(authority.getSnapshot())), [authority]);

  useEffect(() => {
    document.documentElement.classList.toggle("youtube-reduced-motion", snapshot.save.preferences.reducedMotion);
    document.documentElement.classList.toggle("youtube-high-contrast", snapshot.save.preferences.highContrast);
    return () => {
      document.documentElement.classList.remove("youtube-reduced-motion", "youtube-high-contrast");
    };
  }, [snapshot.save.preferences.highContrast, snapshot.save.preferences.reducedMotion]);

  useEffect(() => {
    if (!snapshot.paused) sdk.gameReady();
  }, [sdk, snapshot.paused]);

  useEffect(() => {
    if (snapshot.activeRiddle && !snapshot.paused) inputRef.current?.focus();
  }, [inputRef, snapshot.activeRiddle, snapshot.paused]);

  useEffect(() => {
    if (snapshot.paused) return;
    /** Time used consistently for today's value and rollover delay. */
    const now = new Date();
    setToday(utcDay(now));
    /** Single rollover timer; the next render schedules the following day. */
    const timer = window.setTimeout(() => setToday(utcDay(new Date())), millisecondsUntilNextUtcDay(now));
    return () => window.clearTimeout(timer);
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
