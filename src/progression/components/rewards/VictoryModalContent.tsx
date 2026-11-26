import {useEffect, useRef, useState} from "react";
import type {GameSessionState} from "../../../gameplay/session/gameSession";
import {useTranslator} from "../../../localization/browser/i18n";
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
  /** Confirmed coins can animate after the chest's entrance. */
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    /** Retired with this win so a later dialog cannot receive its animation. */
    const timer = window.setTimeout(() => setEntered(true), 280);
    return () => window.clearTimeout(timer);
  }, []);
  const collecting = entered && amount !== null;
  return <div className="coin-award">
    <div ref={chest} className={`reward-chest ${collecting ? "collecting" : "waiting"}`} aria-hidden="true">
      <img src={collecting ? chestOpenUrl : chestClosedUrl} alt="" />
    </div>
    <strong aria-hidden={amount === null}>{amount === null ? "\u00a0" :
      `+${Math.max(0, Math.round(amount)).toLocaleString()}${tr("CoinPurchase.COINS_SUFFIX")}`}</strong>
    <span aria-hidden={amount === null}>{amount === null ? "\u00a0" :
      `${Math.max(0, Math.round(total)).toLocaleString()} ${tr("CoinShop.COINS_SUFFIX")}`}</span>
    {collecting && <CoinFlight source={chest} amount={amount} total={total} onBalancePreview={onBalancePreview} />}
  </div>;
}

/** Keeps the win visible until confirmed milestones have finished. */
export function VictoryModalContent({state, milestonesPending, onAdvance, onBalancePreview}: {
  /** The current completion and its confirmed rewards. */ state: GameSessionState;
  /** Every earned level and achievement must finish before advancing. */ milestonesPending: boolean;
  /** Advances to the next playable round. */ onAdvance: () => void;
  /** Updates only the decorative balance. */ onBalancePreview: (balance: number | null) => void;
}) {
  /** Translated win and reward labels for the active locale. */
  const tr = useTranslator();
  /** The action waits for confirmed rewards and every visible milestone. */
  const advancePending = !state.completionAcknowledged || milestonesPending;
  const reward = state.lastRewards && state.lastRewards.coinsEarned > 0 ? state.lastRewards : null;
  return <>
    <h2 id="game-modal-title">{tr("VictoryModal.TITLE")}</h2>
    <div className="fanfare-content">
      <VictoryChestAward key={state.lastOutcome?.id} amount={reward?.coinsEarned ?? null}
        total={state.profile?.coins ?? reward?.totalCoins ?? 0} onBalancePreview={onBalancePreview} />
      {state.lastOutcome?.kind === "win" && <button className="play-primary reward-continue"
        disabled={advancePending} onClick={onAdvance}>
        {tr(state.riddle?.gameMode !== "classic" ? "GameScreenAlerts.NEXT_BUTTON" : "VictoryModal.NEXT_LEVEL_BUTTON")}
      </button>}
    </div>
  </>;
}
