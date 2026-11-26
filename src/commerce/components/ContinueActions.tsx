import type {GameModal} from "../../gameplay/session/gameSession";
import {useTranslator} from "../../localization/browser/i18n";
import {CONTINUE_COIN_COST, SKIP_COIN_COST} from "../browser/commerceCosts";
import {isFacebookWebTarget} from "../../platform/browser/webTargetEnvironment";

/** Opens another modal without allowing the null/closed state. */
type OpenModalHandler = (modal: Exclude<GameModal, null>) => void;

/** Props for the continue-after-loss purchase prompt. */
export type ContinueModalPageProps = {
  /** Stores balance. */
  balance: number;
  /** Stores on continue. */
  onContinue: (amount?: number) => void;
  /** Optional provider-funded attempt, composed only by Facebook. */
  onRecoverAttempt?: () => void;
  /** Disables competing choices while a continuation is in progress. */
  pending?: boolean;
  /** Provider requests wait for the final guess's authoritative confirmation. */
  recoveryPending?: boolean;
  /** Requests a paid skip directly from the loss prompt. */
  onSkip: () => void;
  /** Stores on open modal. */
  onOpenModal: OpenModalHandler;
  /** Stores commerce available. */
  commerceAvailable?: boolean;
  /** Paid actions exist only when this hosted session exposes an economy authority. */
  economyAvailable?: boolean;
  /** Declines the final-attempt decision through the existing completion flow. */
  onDecline?: () => void;
};

/** Renders the server-authoritative extra-attempt prompt. */
export function ContinueModalPage({
  balance,
  onContinue,
  onRecoverAttempt,
  pending = false,
  recoveryPending = false,
  onSkip,
  onOpenModal,
  commerceAvailable = true,
  economyAvailable = true,
  onDecline,
}: ContinueModalPageProps) {
  /** Copy changes invalidate compiler caches while preserving local page state. */
  const tr = useTranslator();
  /** Indicates whether can afford. */
  const canAfford = balance >= CONTINUE_COIN_COST;
  /** Indicates whether the player can afford to skip this level. */
  const canAffordSkip = balance >= SKIP_COIN_COST;
  if (!economyAvailable) return (
    <div className="modal-actions continue-actions">
      <button className="play-primary loss-next-action" disabled={!onDecline || pending || recoveryPending} onClick={onDecline}>
        {tr("GameScreenAlerts.NEXT_BUTTON")}
      </button>
    </div>
  );
  return (
    <div className="modal-actions continue-actions">
      <div className="continue-balance">
        <strong>{tr("Profile.TOTAL_COINS_LABEL")}</strong>
        <span>{balance.toLocaleString()}</span>
      </div>
      {isFacebookWebTarget && onRecoverAttempt ? (
        <button className="play-primary loss-video-action" disabled={pending || recoveryPending} aria-busy={pending} onClick={onRecoverAttempt}>
          {tr("LossModal.VIDEO_EXTRA_GO_BUTTON")}
        </button>
      ) : null}
      <button className="play-primary loss-continue-action" disabled={!canAfford || pending} onClick={() => onContinue(CONTINUE_COIN_COST)}>
        {tr("LossModal.USE_COINS_PREFIX")}
        {CONTINUE_COIN_COST}
        {tr("LossModal.USE_COINS_SUFFIX")}
      </button>
      {!canAfford ? <p>{tr("GameScreenAlerts.CONTINUE_NOT_ENOUGH_COINS_MESSAGE")}</p> : null}
      {commerceAvailable && (
        <button className="play-primary loss-shop-action" disabled={pending} onClick={() => onOpenModal("shop")}>
          {tr("LossModal.OPEN_SHOP_BUTTON")}
        </button>
      )}
      {!canAffordSkip ? <p>{tr("GameScreenAlerts.SKIP_NOT_ENOUGH_COINS_MESSAGE")}</p> : null}
      <button className="play-primary loss-skip-action" disabled={!canAffordSkip || pending} onClick={onSkip}>
        {tr("LossModal.SKIP_LEVEL_PREFIX")}
        {SKIP_COIN_COST}
        {tr("LossModal.SKIP_LEVEL_SUFFIX")}
      </button>
    </div>
  );
}
