import {Component, useEffect, useId, useLayoutEffect, useRef, type ErrorInfo, type ReactNode} from "react";
import {captureBrowserException} from "../observability/browserErrorReporter";
import {tr} from "./i18n";
import {ContinueModalPage, type ContinueModalPageProps} from "./modalPages/commerce/ContinueActions";
import {HintModalPage, SkipModalPage, type CoinActionModalPageProps} from "./modalPages/commerce/GameplayCoinActions";
import "../styles.surface-recovery.css";

/** Keeps failed optional interactive code retired across close/reopen in this account visit. */
export class GameSurfaceBoundary extends Component<{
  /** Failed component category, without provider or account identifiers. */
  surface: "modal" | "multiplayer";
  /** Hidden surfaces neither render their children nor expose recovery controls. */
  visible: boolean;
  /** Lazy or target-owned interactive content. */
  children: ReactNode;
  /** Frame-owned recovery cannot depend on the failed surface's code. */
  recovery: ReactNode;
  /** Lets the frame keep terminal recovery visible after the original modal closes. */
  onUnavailable?: () => void;
}, {
  /** A failed native import remains failed for this document's module map. */
  failed: boolean;
}> {
  /** Account-scoped retirement prevents repeated errors on ordinary reopens. */
  override state = {failed: false};

  /** Only the optional surface is replaced; the frame and authority remain mounted. */
  static getDerivedStateFromError() { return {failed: true}; }

  /** Reports once for this boundary lifetime through the target-owned adapter. */
  override componentDidCatch(error: Error, info: ErrorInfo): void {
    captureBrowserException(error, {component: "game_frame", operation: "render_interactive_surface", surface: this.props.surface, componentStack: info.componentStack});
    this.props.onUnavailable?.();
  }

  /** Closing retains the failure while restoring the existing puzzle's interaction. */
  override render() {
    return this.props.visible ? (this.state.failed ? this.props.recovery : this.props.children) : null;
  }
}

/** Accessible recovery retains authoritative continuation and terminal navigation. */
export function GameSurfaceRecovery({onClose, closeBlocked = false, onNext, nextBlocked = false, continuation, coinAction}: {
  /** Uses the frame's existing close/decline action; no result is inferred from an error. */
  onClose: () => void;
  /** Pending paid actions and unreconciled terminal guesses cannot be dismissed. */
  closeBlocked?: boolean;
  /** A confirmed terminal puzzle still needs a path to its next question. */
  onNext?: () => void;
  /** Keeps Next unavailable until the authoritative completion has arrived. */
  nextBlocked?: boolean;
  /** Reuses the original server-authoritative Continue/Skip controls when needed. */
  continuation?: ContinueModalPageProps;
  /** Existing hint and classic Skip confirmations survive failure of the full modal module. */
  coinAction?: CoinActionModalPageProps & {
    /** Chooses the existing localized action and authoritative price. */
    kind: "hint" | "skip";
  };
}) {
  /** Stable localized heading reference avoids collisions with provider dialogs. */
  const titleId = useId();
  /** Focus belongs to this recovery dialog while the underlying puzzle is inert. */
  const dialogRef = useRef<HTMLElement>(null);
  /** Keyboard dismissal follows the committed pending state and frame callback. */
  const closeRef = useRef({onClose, closeBlocked});
  useLayoutEffect(() => {
    closeRef.current = {onClose, closeBlocked};
  }, [onClose, closeBlocked]);

  useLayoutEffect(() => {
    /** Retired native callbacks cannot reclaim a later interactive surface. */
    let listening = true;
    /** Traps focus inside the active recovery and respects locked continuation. */
    const keyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" && event.key !== "Tab") return;
      /** Covered or removed panels and composing editors retain their own key ownership. */
      const dialog = dialogRef.current;
      if (!listening || !dialog?.isConnected || dialog.closest("[inert]") || event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (!closeRef.current.closeBlocked) closeRef.current.onClose();
      } else if (event.key === "Tab") {
        /** Only enabled controls participate in the current dialog's tab loop. */
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? []);
        /** First available action or the panel itself when all actions are pending. */
        const first = controls[0] ?? dialogRef.current;
        /** Last available action closes the reverse traversal loop. */
        const last = controls.at(-1) ?? dialogRef.current;
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
          event.preventDefault(); first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keyDown);
    return () => { listening = false; document.removeEventListener("keydown", keyDown); };
  }, []);

  useEffect(() => {
    /** Returns focus to the original still-connected game control after dismissal. */
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);

  return <div className="surface-recovery-backdrop">
    <section ref={dialogRef} className="surface-recovery" role="alertdialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <h2 id={titleId}>{tr("CommonAlerts.ERROR_TITLE")}</h2>
      <p role="status">{tr("ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE")}</p>
      {continuation && <ContinueModalPage {...continuation} />}
      {coinAction && (coinAction.kind === "hint" ? <HintModalPage {...coinAction} /> : <SkipModalPage {...coinAction} />)}
      {onNext && <button className="play-primary" disabled={nextBlocked} onClick={onNext}>{tr("GameScreenAlerts.NEXT_BUTTON")}</button>}
      <button disabled={closeBlocked} onClick={onClose}>{tr("CommonAlerts.CLOSE_BUTTON")}</button>
    </section>
  </div>;
}
