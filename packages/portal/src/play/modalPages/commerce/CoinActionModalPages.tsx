import treasureChestUrl from "../../../../../../assets/images-web/chest-open.webp";
import type {GameModal} from "../../gameSession";
import {tr} from "../../i18n";
import {CONTINUE_COIN_COST, HINT_COIN_COST, SKIP_COIN_COST} from "./commerceCosts";

/** Opens another modal without allowing the null/closed state. */
type OpenModalHandler = (modal: Exclude<GameModal, null>) => void;

/** Props for the continue-after-loss purchase prompt. */
export type ContinueModalPageProps = {
  /** Stores balance. */
  balance: number;
  /** Stores on continue. */
  onContinue: (amount?: number) => void;
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
export function ContinueModalPage({balance, onContinue, onOpenModal, commerceAvailable = true}: ContinueModalPageProps) {
  const canAfford = balance >= CONTINUE_COIN_COST;
  return (
    <div className="modal-actions continue-actions">
      <p>{tr("LossModal.EXTRA_GO_PROMPT")}</p>
      <div className="continue-balance">
        <img src={treasureChestUrl} alt="" />
        <strong>{tr("Profile.TOTAL_COINS_LABEL")}</strong>
        <span>{balance.toLocaleString()}</span>
      </div>
      <button
        className="play-primary"
        disabled={!canAfford}
        onClick={() => onContinue(CONTINUE_COIN_COST)}
      >
        {tr("LossModal.USE_COINS_PREFIX")}{CONTINUE_COIN_COST}{tr("LossModal.USE_COINS_SUFFIX")}
      </button>
      {!canAfford ? <p>{tr("GameScreenAlerts.CONTINUE_NOT_ENOUGH_COINS_MESSAGE")}</p> : null}
      {commerceAvailable && <button className="play-primary" onClick={() => onOpenModal("shop")}>
        {tr("LossModal.OPEN_SHOP_BUTTON")}
      </button>}
      <button className="play-primary" onClick={() => onOpenModal("skip")}>
        {tr("LossModal.SKIP_PUZZLE_BUTTON")}
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
      <strong>{balance.toLocaleString()} {tr("CoinShop.COINS_SUFFIX")}</strong>
      {commerceAvailable && <button className="play-primary" onClick={() => onOpenModal("shop")}>
        {tr("Navigation.BUY_COINS_BUTTON")}
      </button>}
    </div>
  );
}

/** Internal inputs shared by the hint and skip confirmation pages. */
type CoinActionPromptProps = CoinActionModalPageProps & {
  cost: number;
  insufficientFundsKey: string;
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
  const canAfford = balance >= cost;

  /** Requests the authoritative action before closing its confirmation modal. */
  const requestAction = () => {
    onRequestAction();
    onClose();
  };

  return (
    <div className="modal-actions">
      <p>{tr("GameScreenAlerts.COST_COINS_PREFIX")}{cost}{tr("GameScreenAlerts.COST_COINS_SUFFIX")}</p>
      {canAfford ? (
        <button className="play-primary" onClick={requestAction}>{tr(actionLabelKey)}</button>
      ) : (
        <>
          <p>{tr(insufficientFundsKey)}</p>
          {commerceAvailable && <button className="play-primary" onClick={() => onOpenModal("shop")}>
            {tr("LossModal.OPEN_SHOP_BUTTON")}
          </button>}
        </>
      )}
    </div>
  );
}
