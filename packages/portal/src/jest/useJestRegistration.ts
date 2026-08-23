import {useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction} from "react";
import {tr} from "../play/i18n";
import {captureBrowserException} from "../observability/browserErrorReporter";
import type {JestBackendPort} from "./backend";
import {createRegistrationEntryPayload, type RegistrationSource} from "./registrationAttribution";
import type {JestPlatformPort, JestRegistrationOverlayHandle, JestSession} from "./types";

type TrackFunnel = (eventName: string, params?: Record<string, string | number | boolean>) => void;
type WithPlatformActivity = <Result>(operation: () => Promise<Result>) => Promise<Result>;

type UseJestRegistrationOptions = {
  platform: JestPlatformPort;
  backend: JestBackendPort;
  sessionRef: MutableRefObject<JestSession | null>;
  setSession: Dispatch<SetStateAction<JestSession | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  authenticateIdentity: (token: string) => Promise<void>;
  completeDeletedPlayerCleanup: (playerSigned: string) => Promise<void>;
  withPlatformActivity: WithPlatformActivity;
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
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationPending, setRegistrationPending] = useState(false);
  const [registrationFailure, setRegistrationFailure] = useState<string | null>(null);
  const overlayRef = useRef<JestRegistrationOverlayHandle | null>(null);
  const completingRef = useRef(false);
  const sourceRef = useRef<RegistrationSource>("post_instructions");

  const complete = useCallback(() => {
    if (completingRef.current) return;
    completingRef.current = true;
    let deletedPlayerSigned: string | null = null;
    void withPlatformActivity(async () => {
      const previousSession = sessionRef.current;
      let registered = false;
      let completionSucceeded = false;
      try {
        const player = platform.getPlayer();
        registered = player.registered;
        if (registered) {
          const signed = await platform.getPlayerSigned();
          const identity = await backend.exchangeIdentity(signed.playerSigned);
          if (identity.status === "account-deleted") {
            deletedPlayerSigned = signed.playerSigned;
            return;
          }
          await authenticateIdentity(identity.customToken);
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
        window.dispatchEvent(new CustomEvent("riddle-quest:registration-prompt-closed", {
          detail: {registered: completionSucceeded && registered},
        }));
      }
    }).then(async () => {
      if (deletedPlayerSigned) await completeDeletedPlayerCleanup(deletedPlayerSigned);
    }).catch((error) => {
      captureBrowserException(error, {component: "jest_registration", operation: "deleted_identity_cleanup"});
      setError(tr("ErrorMessages.GENERIC_UNEXPECTED_ERROR"));
    });
  }, [authenticateIdentity, backend, completeDeletedPlayerCleanup, platform, sessionRef, setError, setSession, trackFunnel, withPlatformActivity]);

  const open = useCallback((source: RegistrationSource, showGamePrompt: boolean) => {
    const session = sessionRef.current;
    if (!session || session.player.registered) {
      window.dispatchEvent(new CustomEvent("riddle-quest:registration-prompt-closed", {detail: {registered: true}}));
      return;
    }
    sourceRef.current = source;
    if (!overlayRef.current) {
      const overlay = platform.showRegistrationOverlay({
        theme: "dark",
        entryPayload: createRegistrationEntryPayload(source, session.entryIntent),
        onClose: complete,
      });
      if (overlay.status === "success") overlayRef.current = overlay.value;
      else trackFunnel("registration_overlay_failed", {source, status: overlay.status});
    }
    setShowRegistration(showGamePrompt);
    trackFunnel("registration_prompt_shown", {after: source});
  }, [complete, platform, sessionRef, trackFunnel]);

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
    void withPlatformActivity(() => platform.login(
      createRegistrationEntryPayload(sourceRef.current, sessionRef.current?.entryIntent ?? {}),
    )).then((result) => {
      if (result.status !== "success") {
        setRegistrationPending(false);
        setRegistrationFailure(tr("ErrorMessages.CHECK_INTERNET_AND_TRY_AGAIN"));
        trackFunnel("registration_login_failed", {source: sourceRef.current, status: result.status});
        return;
      }
      complete();
    });
  }, [complete, platform, sessionRef, trackFunnel, withPlatformActivity]);

  const login = useCallback(() => {
    setRegistrationFailure(null);
    setRegistrationPending(true);
    void withPlatformActivity(() => platform.login(
      createRegistrationEntryPayload(sourceRef.current, sessionRef.current?.entryIntent ?? {}),
    )).then((result) => {
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
    const openAfterInstructions = () => open("post_instructions", false);
    window.addEventListener("riddle-quest:registration-prompt-opened", openAfterInstructions);
    window.addEventListener("riddle-quest:register-player", register);
    window.addEventListener("riddle-quest:login-player", login);
    window.addEventListener("riddle-quest:dismiss-registration", dismiss);
    return () => {
      window.removeEventListener("riddle-quest:registration-prompt-opened", openAfterInstructions);
      window.removeEventListener("riddle-quest:register-player", register);
      window.removeEventListener("riddle-quest:login-player", login);
      window.removeEventListener("riddle-quest:dismiss-registration", dismiss);
    };
  }, [dismiss, login, open, register]);

  return {showRegistration, registrationPending, registrationFailure, open, dismiss, register, login};
}
