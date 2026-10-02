import treasureChestUrl from "../../../../../../assets/images-web/chest-open.webp";
import type {GameModal} from "../../gameSession";
import {tr} from "../../i18n";
import {CONTINUE_COIN_COST, HINT_COIN_COST, SKIP_COIN_COST} from "./commerceCosts";
import {isFacebookWebTarget} from "../../../platform/webTargetEnvironment";

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
};

/** Props for a coin-funded gameplay action prompt. */
export type CoinActionModalPageProps = {
  /** Stores balance. */
  balance: number;
  /** Stores on close. */
  onClose: () => void;
  /** Stores on open modal. */
  onOpenModal: OpenModalHandler;
  /** Stores on request action. */
  onRequestAction: () => void;
  /** Stores commerce available. */
  commerceAvailable?: boolean;
};

/** Props for the profile treasure balance page. */
export type TreasureModalPageProps = {
  /** Stores balance. */
  balance: number;
  /** Stores on open modal. */
  onOpenModal: OpenModalHandler;
  /** Stores commerce available. */
  commerceAvailable?: boolean;
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
}: ContinueModalPageProps) {
  /** Indicates whether can afford. */
  const canAfford = balance >= CONTINUE_COIN_COST;
  /** Indicates whether the player can afford to skip this level. */
  const canAffordSkip = balance >= SKIP_COIN_COST;
  return (
    <div className="modal-actions continue-actions">
      <p>{tr("LossModal.EXTRA_GO_PROMPT")}</p>
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

/** Renders the server-authoritative hint purchase prompt. */
export function HintModalPage({
  balance,
  onClose,
  onOpenModal,
  onRequestAction,
  commerceAvailable,
}: CoinActionModalPageProps) {
  return (
    <CoinActionPrompt
      balance={balance}
      cost={HINT_COIN_COST}
      insufficientFundsKey="GameScreenAlerts.HINT_NOT_ENOUGH_COINS_MESSAGE"
      actionLabelKey="GameScreenAlerts.HINT_SHOW_BUTTON"
      onClose={onClose}
      onOpenModal={onOpenModal}
      onRequestAction={onRequestAction}
      commerceAvailable={commerceAvailable}
    />
  );
}

/** Renders the server-authoritative classic-riddle skip prompt. */
export function SkipModalPage({
  balance,
  onClose,
  onOpenModal,
  onRequestAction,
  commerceAvailable,
}: CoinActionModalPageProps) {
  return (
    <CoinActionPrompt
      balance={balance}
      cost={SKIP_COIN_COST}
      insufficientFundsKey="GameScreenAlerts.SKIP_NOT_ENOUGH_COINS_MESSAGE"
      actionLabelKey="GameScreenAlerts.SKIP_LEVEL_BUTTON"
      onClose={onClose}
      onOpenModal={onOpenModal}
      onRequestAction={onRequestAction}
      commerceAvailable={commerceAvailable}
    />
  );
}

/** Renders the current coin balance and a route to the platform shop. */
export function TreasureModalPage({balance, onOpenModal, commerceAvailable = true}: TreasureModalPageProps) {
  return (
    <div className="treasure-chest">
      <img src={treasureChestUrl} alt="" />
      <strong>
        {balance.toLocaleString()} {tr("CoinShop.COINS_SUFFIX")}
      </strong>
      {commerceAvailable && (
        <button className="play-primary" onClick={() => onOpenModal("shop")}>
          {tr("Navigation.BUY_COINS_BUTTON")}
        </button>
      )}
    </div>
  );
}

/** Internal inputs shared by the hint and skip confirmation pages. */
type CoinActionPromptProps = CoinActionModalPageProps & {
  /** Stores cost. */
  cost: number;
  /** Stores insufficient funds key. */
  insufficientFundsKey: string;
  /** Stores action label key. */
  actionLabelKey: string;
};

/** Renders a reusable coin-spend confirmation without mutating the balance locally. */
function CoinActionPrompt({
  actionLabelKey,
  balance,
  cost,
  insufficientFundsKey,
  onClose,
  onOpenModal,
  onRequestAction,
  commerceAvailable = true,
}: CoinActionPromptProps) {
  /** Indicates whether can afford. */
  const canAfford = balance >= cost;

  /** Requests the authoritative action before closing its confirmation modal. */
  const requestAction = () => {
    onRequestAction();
    onClose();
  };

  return (
    <div className="modal-actions">
      <p>
        {tr("GameScreenAlerts.COST_COINS_PREFIX")}
        {cost}
        {tr("GameScreenAlerts.COST_COINS_SUFFIX")}
      </p>
      {canAfford ? (
        <button className="play-primary" onClick={requestAction}>
          {tr(actionLabelKey)}
        </button>
      ) : (
        <>
          <p>{tr(insufficientFundsKey)}</p>
          {commerceAvailable && (
            <button className="play-primary" onClick={() => onOpenModal("shop")}>
              {tr("LossModal.OPEN_SHOP_BUTTON")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
