import type {GameModal, GameSessionState} from "../../gameplay/session/gameSession";
import {useTranslator} from "../../localization/browser/i18n";
import {HINT_COIN_COST, SKIP_COIN_COST} from "../browser/commerceCosts";

/** Opens another modal without allowing the null/closed state. */
type OpenModalHandler = (modal: Exclude<GameModal, null>) => void;

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
  /** Disables a paid choice until the ordered recovery queue can accept it. */
  pending?: boolean;
  /** Stores commerce available. */
  commerceAvailable?: boolean;
};

/** Renders the server-authoritative hint purchase prompt. */
export function HintModalPage({
  balance,
  onClose,
  onOpenModal,
  onRequestAction,
  commerceAvailable,
  pending,
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
      pending={pending}
    />
  );
}

/** Confirms a paid Classic skip or leaving an unfinished Daily riddle. */
export function SkipModalPage({
  gameMode,
  balance,
  onClose,
  onOpenModal,
  onRequestAction,
  commerceAvailable,
  pending,
}: CoinActionModalPageProps & {
  /** Selects paid Classic skipping or the Daily mode-change warning. */
  gameMode: GameSessionState["gameMode"];
}) {
  /** Copy follows the active locale while the warning remains open. */
  const tr = useTranslator();
  if (gameMode === "challenge") {
    return <div className="modal-actions">
      <p>{tr("GameScreenAlerts.DAILY_SKIP_MESSAGE")}</p>
      <button className="play-primary" disabled={pending} onClick={() => {onRequestAction(); onClose();}}>
        {tr("GameScreenAlerts.DAILY_SKIP_CONTINUE_BUTTON")}
      </button>
      <button className="play-secondary" onClick={onClose}>{tr("CommonAlerts.CANCEL_BUTTON")}</button>
    </div>;
  }
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
      pending={pending}
    />
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
  pending = false,
}: CoinActionPromptProps) {
  /** Copy changes invalidate compiler caches while preserving local page state. */
  const tr = useTranslator();
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
        <button className="play-primary" disabled={pending} onClick={requestAction}>
          {tr(actionLabelKey)}
        </button>
      ) : (
        <>
          <p>{tr(insufficientFundsKey)}</p>
          {commerceAvailable && (
            <button className="play-primary" disabled={pending} onClick={() => onOpenModal("shop")}>
              {tr("LossModal.OPEN_SHOP_BUTTON")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
