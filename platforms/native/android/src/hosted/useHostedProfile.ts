import {trackEvent} from "../../../../../src/observability/analytics/eventsRuntime";
import type {BridgeLeaderboardEntry} from "../../../../../src/platform/bridge/messages";
import type {HostServices, LeaderboardType} from "../../../../../src/platform/contracts/hostServices";
import {useCallback, useEffect, useRef, useState} from "react";
/** Leaderboards the profile shows, in tab order. */
export const PROFILE_LEADERBOARDS: readonly LeaderboardType[] = ["xp", "totalWins", "bestStreak"];
/** Shortest username the backend accepts. */
const MIN_USERNAME_LENGTH = 3;
/** Leaderboard state for the selected tab. */
export type LeaderboardState =
  | {
      /** Rows are loading. */
      kind: "loading";
    }
  | {
      /** Rows could not be loaded. */
      kind: "failed";
    }
  | {
      /** Loaded rows, best first. */
      kind: "ready";
      /** Rows. */
      entries: readonly BridgeLeaderboardEntry[];
    };
/** Result of the latest username edit. */
export type UsernameNotice = "updated" | "taken" | "tooShort" | "failed";
/** Account deletion progress. */
export type DeletionState = "idle" | "confirming" | "deleting" | "failed";
/** State and actions of the profile screen. */
export type HostedProfileController = Readonly<{
  /** Selected leaderboard. */
  board: LeaderboardType;
  /** Rows for the selected leaderboard. */
  leaderboard: LeaderboardState;
  /** Selects and loads a leaderboard. */
  selectBoard: (board: LeaderboardType) => void;
  /** Whether a username edit is running. */
  savingUsername: boolean;
  /** Result of the latest username edit. */
  usernameNotice: UsernameNotice | null;
  /** Changes the username. */
  saveUsername: (username: string) => void;
  /** Deletion progress. */
  deletion: DeletionState;
  /** Opens or closes the deletion confirmation. */
  setConfirmingDeletion: (confirming: boolean) => void;
  /** Deletes the account after confirmation. */
  confirmDeletion: () => void;
}>;
/** Reads a stable code from a callable or host error, without the SDK's `functions/` prefix. */
const errorCode = (error: unknown): string =>
  typeof error === "object" && error !== null && "code" in error
    ? String((error as {
    /** Stores code. */
    code: unknown}).code).replace(/^functions\//u, "")
    : "";
/**
 * Drives the hosted profile: leaderboards, username edits and account deletion through the shared host services.
 *
 * @param onDeleted - Called once the backend deleted the account, so the root can provision a fresh one.
 */
export function useHostedProfile(services: HostServices, onDeleted: () => void): HostedProfileController {
  /** Selected leaderboard. */
  const [board, setBoard] = useState<LeaderboardType>("xp");
  /** Rows for it. */
  const [leaderboard, setLeaderboard] = useState<LeaderboardState>({kind: "loading"});
  /** Username edit in flight. */
  const [savingUsername, setSavingUsername] = useState(false);
  /** Latest username result. */
  const [usernameNotice, setUsernameNotice] = useState<UsernameNotice | null>(null);
  /** Deletion progress. */
  const [deletion, setDeletion] = useState<DeletionState>("idle");
  /** Latest requested board, so slower responses for older tabs are ignored. */
  const requested = useRef<LeaderboardType>("xp");
  /** Whether the screen is mounted. */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  /** Loads one leaderboard. */
  const selectBoard = useCallback(
    (next: LeaderboardType) => {
      trackEvent("leaderboard_viewed", {board: next});
      requested.current = next;
      setBoard(next);
      setLeaderboard({kind: "loading"});
      services.loadLeaderboard(next).then(
        (entries) => {
          if (mounted.current && requested.current === next) setLeaderboard({kind: "ready", entries});
        },
        () => {
          if (mounted.current && requested.current === next) setLeaderboard({kind: "failed"});
        },
      );
    },
    [services],
  );
  useEffect(() => selectBoard("xp"), [selectBoard]);
  /** Changes the username; the shared services republish the profile on success. */
  const saveUsername = useCallback(
    (username: string) => {
      /** Name as submitted. */
      const trimmed = username.trim();
      if (trimmed.length < MIN_USERNAME_LENGTH) {
        setUsernameNotice("tooShort");
        return;
      }
      trackEvent("profile_update_requested", {field: "username"});
      setSavingUsername(true);
      setUsernameNotice(null);
      services.updateUsername(trimmed).then(
        () => {
          if (!mounted.current) return;
          setSavingUsername(false);
          trackEvent("profile_update_result", {field: "username", status: "success"});
          setUsernameNotice("updated");
        },
        (error: unknown) => {
          if (!mounted.current) return;
          setSavingUsername(false);
          trackEvent("profile_update_result", {field: "username", status: "failed"});
          setUsernameNotice(errorCode(error) === "already-exists" ? "taken" : "failed");
        },
      );
    },
    [services],
  );
  /** Deletes the account. */
  const confirmDeletion = useCallback(() => {
    trackEvent("account_delete_requested");
    setDeletion("deleting");
    services.deleteAccount().then(
      () => {
        if (mounted.current) setDeletion("idle");
        trackEvent("account_delete_result", {status: "success"});
        onDeleted();
      },
      () => {
        trackEvent("account_delete_result", {status: "failed"});
        if (mounted.current) setDeletion("failed");
      },
    );
  }, [onDeleted, services]);
  /** Opens or closes the confirmation. */
  const setConfirmingDeletion = useCallback((confirming: boolean) => setDeletion(confirming ? "confirming" : "idle"), []);
  return {board, leaderboard, selectBoard, savingUsername, usernameNotice, saveUsername, deletion, setConfirmingDeletion, confirmDeletion};
}
