import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {CompletionPresentation} from "../play/completionPresentation";
import {tr} from "../play/i18n";
import {captureBrowserException} from "../observability/browserErrorReporter";
import type {JestBackendPort} from "./backend";
import {createRegistrationEntryPayload, type RegistrationSource} from "./registrationAttribution";
import type {JestPlatformPort, JestRegistrationOverlayHandle, JestSession} from "./types";
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
  /** Provides completing ref behavior. */
  const completingRef = useRef(false);
  /** Provides source ref behavior. */
  const sourceRef = useRef<RegistrationSource>("profile");
  /** Holds the automatic prompt until the player finishes the reward sequence. */
  const completionPresentationRef = useRef(new CompletionPresentation());
  /** Provides complete behavior. */
  const complete = useCallback(() => {
    if (completingRef.current) return;
    completingRef.current = true;
    /** Deletes d player signed. */
    let deletedPlayerSigned: string | null = null;
    void withPlatformActivity(async () => {
      /** Provides previous session behavior. */
      const previousSession = sessionRef.current;
      /** Provides registered behavior. */
      let registered = false;
      /** Provides completion succeeded behavior. */
      let completionSucceeded = false;
      try {
        /** Provides player behavior. */
        const player = platform.getPlayer();
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
          await authenticateIdentity(identity.customToken);
          /** Provides profile behavior. */
          let profile = previousSession?.profile ?? null;
          try {
            profile = await platform.getProfile();
          } catch (profileError) {
            console.warn("[riddle-quest] Jest profile refresh after registration failed", profileError);
          }
          setSession((current) => (current ? {...current, firebaseUid: identity.uid, player, profile} : current));
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
          /** Provides preferences behavior. */
          const preferences = {...previousSession.preferences, registrationPromptDismissedAt: Date.now()};
          await platform.writePreferences(preferences);
          setSession((current) => (current ? {...current, preferences} : current));
          trackFunnel("registration_prompt_dismissed", {source: sourceRef.current});
          completionSucceeded = true;
        }
      } catch (error) {
        console.warn("[riddle-quest] Jest registration completion failed", error);
        captureBrowserException(error, {component: "jest_registration", operation: "synchronize_registered_identity"});
        trackFunnel("registration_completion_failed", {source: sourceRef.current});
        setError(tr("ErrorMessages.GENERIC_UNEXPECTED_ERROR"));
      } finally {
        overlayRef.current = null;
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
    backend,
    completeDeletedPlayerCleanup,
    platform,
    sessionRef,
    setError,
    setSession,
    trackFunnel,
    withPlatformActivity,
  ]);
  /** Shows registration after the current completion sequence has ended. */
  const showPrompt = useCallback(
    (source: RegistrationSource, showGamePrompt: boolean) => {
      /** Provides session behavior. */
      const session = sessionRef.current;
      if (!session || session.player.registered) {
        window.dispatchEvent(new CustomEvent("riddle-quest:registration-prompt-closed", {detail: {registered: true}}));
        return;
      }
      sourceRef.current = source;
      if (!overlayRef.current) {
        /** Provides overlay behavior. */
        const overlay = platform.showRegistrationOverlay({
          theme: "dark",
          message: "Keep my Riddle Quest progress! {{registrationCode}} is my registration code.",
          entryPayload: createRegistrationEntryPayload(source, session.entryIntent),
          onClose: complete,
        });
        if (overlay.status === "success") overlayRef.current = overlay.value;
        else trackFunnel("registration_overlay_failed", {source, status: overlay.status});
      }
      setShowRegistration(showGamePrompt);
      trackFunnel("registration_prompt_shown", {after: source});
    },
    [complete, platform, sessionRef, trackFunnel],
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
    setRegistrationFailure(null);
    setRegistrationPending(true);
    if (overlayRef.current) {
      try {
        overlayRef.current.loginButtonAction();
      } catch (error) {
        console.warn("[riddle-quest] Jest registration login action failed", error);
        setRegistrationPending(false);
        setRegistrationFailure(tr("ErrorMessages.CHECK_INTERNET_AND_TRY_AGAIN"));
        trackFunnel("registration_login_failed", {source: sourceRef.current, status: "failure"});
      }
      return;
    }
    void withPlatformActivity(() =>
      platform.login(createRegistrationEntryPayload(sourceRef.current, sessionRef.current?.entryIntent ?? {})),
    ).then((result) => {
      if (result.status !== "success") {
        setRegistrationPending(false);
        setRegistrationFailure(tr("ErrorMessages.CHECK_INTERNET_AND_TRY_AGAIN"));
        trackFunnel("registration_login_failed", {source: sourceRef.current, status: result.status});
        return;
      }
      complete();
    });
  }, [complete, platform, sessionRef, trackFunnel, withPlatformActivity]);
  /** Provides login behavior. */
  const login = useCallback(() => {
    setRegistrationFailure(null);
    setRegistrationPending(true);
    void withPlatformActivity(() =>
      platform.login(createRegistrationEntryPayload(sourceRef.current, sessionRef.current?.entryIntent ?? {})),
    ).then((result) => {
      if (result.status !== "success") {
        setRegistrationPending(false);
        trackFunnel("login_failed", {status: result.status});
        return;
      }
      if (!overlayRef.current) return complete();
      try {
        overlayRef.current.closeButtonAction();
      } catch (error) {
        console.warn("[riddle-quest] Jest registration overlay close after login failed", error);
        complete();
      }
    });
  }, [complete, platform, sessionRef, trackFunnel, withPlatformActivity]);

  useEffect(() => {
    /** Opens signup only after a voluntary profile action. */
    const openFromProfile = () => open("profile", true);
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
    window.addEventListener("riddle-quest:register-player", register);
    window.addEventListener("riddle-quest:login-player", login);
    window.addEventListener("riddle-quest:dismiss-registration", dismiss);
    return () => {
      window.removeEventListener("riddle-quest:completion-popups-dismissed", onCompletionPopupsDismissed);
      window.removeEventListener("riddle-quest:registration-prompt-opened", openFromProfile);
      window.removeEventListener("riddle-quest:register-player", register);
      window.removeEventListener("riddle-quest:login-player", login);
      window.removeEventListener("riddle-quest:dismiss-registration", dismiss);
    };
  }, [dismiss, login, open, register, showPrompt]);

  return {showRegistration, registrationPending, registrationFailure, open, dismiss, register, login};
}
