import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {CompletionPresentation} from "../../../../src/gameplay/session/completion/completionPresentation";
import {tr} from "../../../../src/localization/browser/i18n";
import {captureBrowserException} from "../../../../src/observability/browserErrorReporter";
import type {JestBackendPort} from "./backend";
import {createRegistrationEntryPayload, type RegistrationSource} from "./registrationAttribution";
import type {JestPlatformPort, JestRegistrationOverlayHandle, JestSession} from "./types";
import {applyPlayerPreferences} from "../../../../src/settings/browser/playerPreferences";
/** Records one registration-funnel event with optional low-cardinality context. */
type TrackFunnel = (eventName: string, params?: Record<string, string | number | boolean>) => void;
/** Runs an asynchronous operation while the shared platform activity indicator is active. */
type WithPlatformActivity = <Result>(operation: () => Promise<Result>) => Promise<Result>;
/** Collaborators required by the Jest registration flow. */
type UseJestRegistrationOptions = {
  /** Jest SDK boundary used for player identity, profile, preferences, and registration UI. */
  platform: JestPlatformPort;
  /** Server-authoritative identity exchange boundary. */
  backend: JestBackendPort;
  /** Current session reference used by asynchronous SDK callbacks. */
  sessionRef: MutableRefObject<JestSession | null>;
  /** Updates the active Jest session after registration or preference changes. */
  setSession: Dispatch<SetStateAction<JestSession | null>>;
  /** Publishes a user-facing error when registration recovery fails. */
  setError: Dispatch<SetStateAction<string | null>>;
  /** Authenticates Firebase with a server-issued custom token. */
  authenticateIdentity: (token: string) => Promise<void>;
  /** Reads canonical notification preference before publishing the registered session. */
  loadNotificationPreference?: (uid: string) => Promise<boolean | undefined>;
  /** Retires registration work when the account operation gate closes. */
  isCurrent?: () => boolean;
  /** Completes cleanup when identity exchange reports a deleted player. */
  completeDeletedPlayerCleanup: (playerSigned: string) => Promise<void>;
  /** Wraps SDK work in the shared platform activity lifecycle. */
  withPlatformActivity: WithPlatformActivity;
  /** Records registration and login funnel outcomes. */
  trackFunnel: TrackFunnel;
};
/** Owns the complete Jest registration overlay, login fallback, and identity resynchronization flow. */
export function useJestRegistration({
  platform,
  backend,
  sessionRef,
  setSession,
  setError,
  authenticateIdentity,
  loadNotificationPreference,
  isCurrent = () => true,
  completeDeletedPlayerCleanup,
  withPlatformActivity,
  trackFunnel,
}: UseJestRegistrationOptions) {
  /** Provides [show registration, set show registration] behavior. */
  const [showRegistration, setShowRegistration] = useState(false);
  /** Provides [registration pending, set registration pending] behavior. */
  const [registrationPending, setRegistrationPending] = useState(false);
  /** Provides [registration failure, set registration failure] behavior. */
  const [registrationFailure, setRegistrationFailure] = useState<string | null>(null);
  /** Provides overlay ref behavior. */
  const overlayRef = useRef<JestRegistrationOverlayHandle | null>(null);
  const promptOpenRef = useRef(false);
  const loginPendingRef = useRef(false);
  const guidanceReadyOwnerRef = useRef<string | null>(null);
  const automaticPromptPlayerRef = useRef<string | null>(null);
  const restartingSessionRef = useRef(false);
  /** Provides completing ref behavior. */
  const completingRef = useRef(false);
  /** Provides source ref behavior. */
  const sourceRef = useRef<RegistrationSource>("profile");
  /** Holds the automatic prompt until the player finishes the reward sequence. */
  const completionPresentationRef = useRef(new CompletionPresentation());
  const active = useRef(false);
  useLayoutEffect(() => {
    active.current = true;
    return () => {active.current = false;};
  }, []);
  /** A host-side logout must repeat signed startup before the new guest can play. */
  const restartChangedGuestSession = useCallback((player: JestSession["player"]) => {
    const session = sessionRef.current;
    if (!session || player.registered ||
      (!session.player.registered && player.playerId === session.player.playerId)) return false;
    if (!restartingSessionRef.current) {
      restartingSessionRef.current = true;
      window.location.reload();
    }
    return true;
  }, [sessionRef]);
  /** Provides complete behavior. */
  const complete = useCallback(() => {
    if (!active.current || !isCurrent() || !sessionRef.current || completingRef.current) return;
    completingRef.current = true;
    /** Deletes d player signed. */
    let deletedPlayerSigned: string | null = null;
    void withPlatformActivity(async () => {
      /** Provides previous session behavior. */
      const previousSession = sessionRef.current;
      const ownsSession = () => active.current && isCurrent() && !restartingSessionRef.current && previousSession !== null &&
        sessionRef.current?.firebaseUid === previousSession.firebaseUid && sessionRef.current?.player.playerId === previousSession.player.playerId;
      /** Provides registered behavior. */
      let registered = false;
      /** Provides completion succeeded behavior. */
      let completionSucceeded = false;
      try {
        /** Provides player behavior. */
        const player = platform.getPlayer();
        if (restartChangedGuestSession(player)) return;
        registered = player.registered;
        if (registered) {
          /** Provides signed behavior. */
          const signed = await platform.getPlayerSigned();
          /** Provides identity behavior. */
          const identity = await backend.exchangeIdentity(signed.playerSigned);
          if (identity.status === "account-deleted") {
            deletedPlayerSigned = signed.playerSigned;
            return;
          }
          if (!ownsSession()) return;
          await authenticateIdentity(identity.customToken);
          if (!ownsSession()) return;
          const enabled = await loadNotificationPreference?.(identity.uid);
          if (!ownsSession()) return;
          const storedPreferences = player.playerId === previousSession?.player.playerId
            ? previousSession.preferences : platform.readPreferences();
          const preferences = {...storedPreferences, locale: "en", notificationsEnabled: enabled ?? storedPreferences.notificationsEnabled ?? true};
          /** Provides profile behavior. */
          let profile = previousSession?.profile ?? null;
          try {
            profile = await platform.getProfile();
          } catch (profileError) {
            console.warn("[riddle-quest] Jest profile refresh after registration failed", profileError);
          }
          if (!ownsSession()) return;
          applyPlayerPreferences(preferences);
          setSession((current) => (current ? {...current, firebaseUid: identity.uid, player, profile, preferences} : current));
          trackFunnel("registration_completed", {
            playerContinuity: player.playerId === previousSession?.player.playerId,
            source: sourceRef.current,
          });
          if (previousSession?.entryIntent.inviteKind) {
            trackFunnel("viral_invite_registered", {
              inviteKind: previousSession.entryIntent.inviteKind,
              campaign: previousSession.entryIntent.campaign ?? "unknown",
            });
          }
          completionSucceeded = true;
        } else if (previousSession) {
          automaticPromptPlayerRef.current = player.playerId;
          /** Provides preferences behavior. */
          const preferences = {...previousSession.preferences, registrationPromptDismissedAt: Date.now()};
          await platform.writePreferences(preferences);
          if (!ownsSession()) return;
          setSession((current) => (current ? {...current, preferences} : current));
          trackFunnel("registration_prompt_dismissed", {source: sourceRef.current});
          completionSucceeded = true;
        }
      } catch (error) {
        if (!ownsSession()) return;
        console.warn("[riddle-quest] Jest registration completion failed", error);
        captureBrowserException(error, {component: "jest_registration", operation: "synchronize_registered_identity"});
        trackFunnel("registration_completion_failed", {source: sourceRef.current});
        setError(tr("ErrorMessages.GENERIC_UNEXPECTED_ERROR"));
      } finally {
        overlayRef.current = null;
        promptOpenRef.current = false;
        loginPendingRef.current = false;
        completingRef.current = false;
        setRegistrationPending(false);
        setShowRegistration(false);
        window.dispatchEvent(
          new CustomEvent("riddle-quest:registration-prompt-closed", {
            detail: {registered: completionSucceeded && registered},
          }),
        );
      }
    })
      .then(async () => {
        if (deletedPlayerSigned) await completeDeletedPlayerCleanup(deletedPlayerSigned);
      })
      .catch((error) => {
        captureBrowserException(error, {component: "jest_registration", operation: "deleted_identity_cleanup"});
        setError(tr("ErrorMessages.GENERIC_UNEXPECTED_ERROR"));
      });
  }, [
    authenticateIdentity,
    isCurrent,
    loadNotificationPreference,
    backend,
    completeDeletedPlayerCleanup,
    platform,
    restartChangedGuestSession,
    sessionRef,
    setError,
    setSession,
    trackFunnel,
    withPlatformActivity,
  ]);
  /** Opens Jest's built-in login and keeps cancellation separate from provider failure. */
  const login = useCallback(() => {
    const session = sessionRef.current;
    if (!session || !active.current || !isCurrent() || restartingSessionRef.current || loginPendingRef.current || completingRef.current) return;
    loginPendingRef.current = true;
    setRegistrationFailure(null);
    setRegistrationPending(true);
    setShowRegistration(false);
    const ownsSession = () => active.current && isCurrent() && !restartingSessionRef.current &&
      sessionRef.current?.firebaseUid === session.firebaseUid &&
      sessionRef.current?.player.playerId === session.player.playerId;
    const failed = (status: string) => {
      loginPendingRef.current = false;
      if (!ownsSession()) return;
      setRegistrationPending(false);
      setShowRegistration(true);
      setRegistrationFailure(tr("ErrorMessages.CHECK_INTERNET_AND_TRY_AGAIN"));
      trackFunnel("registration_login_failed", {source: sourceRef.current, status});
    };
    void withPlatformActivity(() =>
      platform.login(createRegistrationEntryPayload(sourceRef.current, session.entryIntent)),
    ).then((result) => {
      if (!ownsSession()) return;
      if (result.status !== "success" && result.status !== "cancelled") {
        failed(result.status);
        return;
      }
      automaticPromptPlayerRef.current = session.player.playerId;
      complete();
    }).catch((error: unknown) => {
      if (ownsSession()) captureBrowserException(error, {component: "jest_registration", operation: "platform_login"});
      failed("error");
    });
  }, [complete, isCurrent, platform, sessionRef, trackFunnel, withPlatformActivity]);
  /** Shows registration after the current completion sequence has ended. */
  const showPrompt = useCallback(
    (source: RegistrationSource, showGamePrompt: boolean) => {
      if (!active.current || !isCurrent() || restartingSessionRef.current || promptOpenRef.current || completingRef.current) return;
      /** Provides session behavior. */
      const session = sessionRef.current;
      if (!session) return;
      sourceRef.current = source;
      setRegistrationFailure(null);
      try {
        const player = platform.getPlayer();
        if (restartChangedGuestSession(player)) return;
        if (player.registered) {
          if (!session.player.registered || player.playerId !== session.player.playerId) complete();
          else window.dispatchEvent(new CustomEvent("riddle-quest:registration-prompt-closed", {detail: {registered: true}}));
          return;
        }
      } catch (error) {
        captureBrowserException(error, {component: "jest_registration", operation: "check_guest_before_prompt"});
        setRegistrationFailure(tr("ErrorMessages.CHECK_INTERNET_AND_TRY_AGAIN"));
        trackFunnel("registration_prompt_failed", {source});
        return;
      }
      promptOpenRef.current = true;
      trackFunnel("registration_prompt_shown", {after: source});
      if (source !== "profile") {
        login();
        return;
      }
      if (!overlayRef.current) {
        /** Provides overlay behavior. */
        const overlay = platform.showRegistrationOverlay({
          theme: "dark",
          message: "Keep my Riddle Quest progress! {{registrationCode}} is my registration code.",
          entryPayload: createRegistrationEntryPayload(source, session.entryIntent),
          onClose: complete,
        });
        if (overlay.status === "success") {
          overlayRef.current = overlay.value;
          automaticPromptPlayerRef.current = session.player.playerId;
        }
        else trackFunnel("registration_overlay_failed", {source, status: overlay.status});
      }
      setShowRegistration(showGamePrompt);
    },
    [complete, isCurrent, login, platform, restartChangedGuestSession, sessionRef, trackFunnel],
  );
  /** Queues win prompts behind the victory and achievement popups. */
  const open = useCallback(
    (source: RegistrationSource, showGamePrompt: boolean, outcomeKey?: string) => {
      if (source === "authoritative_win") {
        if (outcomeKey && completionPresentationRef.current.confirm(outcomeKey)) showPrompt(source, showGamePrompt);
        return;
      }
      showPrompt(source, showGamePrompt);
    },
    [showPrompt],
  );
  /** Provides dismiss behavior. */
  const dismiss = useCallback(() => {
    setRegistrationFailure(null);
    setRegistrationPending(true);
    if (!overlayRef.current) return complete();
    try {
      overlayRef.current.closeButtonAction();
    } catch (error) {
      console.warn("[riddle-quest] Jest registration close action failed", error);
      complete();
    }
  }, [complete]);
  /** Provides register behavior. */
  const register = useCallback(() => {
    if (!active.current || !isCurrent() || restartingSessionRef.current || !sessionRef.current || completingRef.current || loginPendingRef.current) return;
    setRegistrationFailure(null);
    try {
      const player = platform.getPlayer();
      if (restartChangedGuestSession(player)) return;
      if (player.registered) {
        if (overlayRef.current) overlayRef.current.closeButtonAction();
        complete();
        return;
      }
    } catch (error) {
      captureBrowserException(error, {component: "jest_registration", operation: "check_guest_before_login"});
      setRegistrationFailure(tr("ErrorMessages.CHECK_INTERNET_AND_TRY_AGAIN"));
      return;
    }
    if (overlayRef.current) {
      loginPendingRef.current = true;
      setRegistrationPending(true);
      try {
        overlayRef.current.loginButtonAction();
      } catch (error) {
        console.warn("[riddle-quest] Jest registration login action failed", error);
        loginPendingRef.current = false;
        setRegistrationPending(false);
        setRegistrationFailure(tr("ErrorMessages.CHECK_INTERNET_AND_TRY_AGAIN"));
        trackFunnel("registration_login_failed", {source: sourceRef.current, status: "failure"});
      }
      return;
    }
    login();
  }, [complete, isCurrent, login, platform, restartChangedGuestSession, sessionRef, trackFunnel]);

  useLayoutEffect(() => {
    /** Opens signup after a voluntary profile action. */
    const openFromProfile = () => open("profile", true);
    const openAfterInstructions = () => open("post_instructions", true);
    const openForReturningPlayer = () => open("returning_player", true);
    /** Provides on completion popups dismissed behavior. */
    const onCompletionPopupsDismissed = (event: Event) => {
      /** Provides key behavior. */
      const key: unknown = (
        event as CustomEvent<{
          /** Stores outcome key. */
          outcomeKey?: unknown;
        }>
      ).detail?.outcomeKey;
      if (typeof key === "string" && completionPresentationRef.current.dismiss(key))
        showPrompt("authoritative_win", true);
    };
    window.addEventListener("riddle-quest:completion-popups-dismissed", onCompletionPopupsDismissed);
    window.addEventListener("riddle-quest:registration-prompt-opened", openFromProfile);
    window.addEventListener("riddle-quest:onboarding-completed", openAfterInstructions);
    window.addEventListener("riddle-quest:returning-player-play", openForReturningPlayer);
    window.addEventListener("riddle-quest:register-player", register);
    window.addEventListener("riddle-quest:dismiss-registration", dismiss);
    return () => {
      window.removeEventListener("riddle-quest:completion-popups-dismissed", onCompletionPopupsDismissed);
      window.removeEventListener("riddle-quest:registration-prompt-opened", openFromProfile);
      window.removeEventListener("riddle-quest:onboarding-completed", openAfterInstructions);
      window.removeEventListener("riddle-quest:returning-player-play", openForReturningPlayer);
      window.removeEventListener("riddle-quest:register-player", register);
      window.removeEventListener("riddle-quest:dismiss-registration", dismiss);
    };
  }, [dismiss, open, register, sessionRef, showPrompt]);

  useLayoutEffect(() => {
    /** Recheck the SDK when the player returns from host controls or resumes play. */
    const resume = (event?: Event) => {
      const session = sessionRef.current;
      if (!active.current || !isCurrent() || !session ||
        guidanceReadyOwnerRef.current !== session.firebaseUid ||
        document.visibilityState === "hidden") return;
      try {
        const player = platform.getPlayer();
        if (restartChangedGuestSession(player)) {
          event?.preventDefault();
          event?.stopImmediatePropagation();
          return;
        }
        if (promptOpenRef.current || completingRef.current || loginPendingRef.current) return;
        if (player.registered) {
          if (!session.player.registered || player.playerId !== session.player.playerId) complete();
          return;
        }
        if (automaticPromptPlayerRef.current !== player.playerId) showPrompt("returning_player", true);
      } catch (error) {
        captureBrowserException(error, {component: "jest_registration", operation: "check_guest_after_guidance"});
      }
    };
    const onGuidanceReady = (event: Event) => {
      const uid: unknown = (event as CustomEvent<{uid?: unknown}>).detail?.uid;
      if (typeof uid !== "string" || uid !== sessionRef.current?.firebaseUid) return;
      guidanceReadyOwnerRef.current = uid;
      resume();
    };
    window.addEventListener("riddle-quest:guidance-ready", onGuidanceReady);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pointerdown", resume, true);
    window.addEventListener("keydown", resume, true);
    return () => {
      window.removeEventListener("riddle-quest:guidance-ready", onGuidanceReady);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pointerdown", resume, true);
      window.removeEventListener("keydown", resume, true);
    };
  }, [complete, isCurrent, platform, restartChangedGuestSession, sessionRef, showPrompt]);

  return {showRegistration, registrationPending, registrationFailure, open, dismiss, register};
}
