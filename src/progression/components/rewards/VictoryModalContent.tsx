import {useRef} from "react";
import type {GameSessionState} from "../../../gameplay/session/gameSession";
import {isCompletionAdvancePending} from "../../../gameplay/session/completion/completionPresentation";
import {useTranslator} from "../../../localization/browser/i18n";
import {SpinningWheelLoader} from "../../../app/components/feedback/SpinningWheelLoader";
import {CoinFlight} from "./CoinFlight";
import chestClosedUrl from "../../../../assets/images-web/chest-closed.webp";
import chestOpenUrl from "../../../../assets/images-web/chest-open.webp";
import "../../styles/victory.css";

/** Keeps the chest visible while its authoritative award is pending. */
function VictoryChestAward({amount, total, onBalancePreview}: {
  /** Coins already granted by the active target, or pending confirmation. */ amount: number | null;
  /** Confirmed balance after the grant. */ total: number;
  /** Updates only the decorative balance. */ onBalancePreview: (balance: number | null) => void;
}) {
  /** Translated win and reward labels for the active locale. */
  const tr = useTranslator();
  /** Chest bounds anchor the decorative coin flight. */
  const chest = useRef<HTMLDivElement>(null);
  const collecting = amount !== null;
  return <div className="coin-award">
    <div ref={chest} className={`reward-chest ${collecting ? "collecting" : "waiting"}`} aria-hidden="true">
      <img src={collecting ? chestOpenUrl : chestClosedUrl} alt="" width="230" height="180" />
    </div>
    <strong aria-hidden={amount === null}>{amount === null ? "\u00a0" :
      `+${Math.max(0, Math.round(amount)).toLocaleString()}${tr("CoinPurchase.COINS_SUFFIX")}`}</strong>
    <span>{Math.max(0, Math.round(total)).toLocaleString()} {tr("CoinShop.COINS_SUFFIX")}</span>
    {collecting && <CoinFlight source={chest} amount={amount} total={total} onBalancePreview={onBalancePreview} />}
  </div>;
}

/** Presents the win immediately while confirmed milestones continue independently. */
export function VictoryModalContent({state, onAdvance, onBalancePreview}: {
  /** The current completion and its confirmed rewards. */ state: GameSessionState;
  /** Advances to the next playable round. */ onAdvance: () => void;
  /** Updates only the decorative balance. */ onBalancePreview: (balance: number | null) => void;
}) {
  /** Translated win and reward labels for the active locale. */
  const tr = useTranslator();
  /** Only progression authority can delay navigation; decorative milestones never do. */
  const advancePending = isCompletionAdvancePending(state);
  const reward = state.lastRewards;
  return <>
    <h2 id="game-modal-title">{tr("VictoryModal.TITLE")}</h2>
    <div className="fanfare-content">
      <VictoryChestAward key={state.lastOutcome?.id} amount={reward?.coinsEarned ?? null}
        total={state.profile?.coins ?? reward?.totalCoins ?? 0} onBalancePreview={onBalancePreview} />
      {state.lastOutcome?.kind === "win" && (advancePending
        ? <SpinningWheelLoader className="reward-continue-loading" />
        : <button className="play-primary reward-continue" onClick={onAdvance}>
          {tr(state.riddle?.gameMode !== "classic" ? "GameScreenAlerts.NEXT_BUTTON" : "VictoryModal.NEXT_LEVEL_BUTTON")}
        </button>)}
    </div>
  </>;
}
