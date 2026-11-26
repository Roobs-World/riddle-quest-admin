import {useEffect, useRef, useState} from "react";
import type {GameSessionState} from "../../../gameplay/session/gameSession";
import {useTranslator} from "../../../localization/browser/i18n";
import {isCompletionAdvancePending} from "../../../gameplay/session/completion/completionPresentation";
import {CoinFlight} from "./CoinFlight";
import chestClosedUrl from "../../../../assets/images-web/chest-closed.webp";
import chestOpenUrl from "../../../../assets/images-web/chest-open.webp";
import "../../styles/victory.css";

/** Celebrates a confirmed award without requiring a chest tap. */
function VictoryChestAward({amount, total, onBalancePreview}: {
  /** Coins already granted by the active target. */ amount: number;
  /** Confirmed balance after the grant. */ total: number;
  /** Updates only the decorative balance. */ onBalancePreview: (balance: number | null) => void;
}) {
  /** Translated win and reward labels for the active locale. */
  const tr = useTranslator();
  /** Chest bounds anchor the decorative coin flight. */
  const chest = useRef<HTMLDivElement>(null);
  /** Chest opens automatically after its entrance. */
  const [collecting, setCollecting] = useState(false);
  useEffect(() => {
    /** Retired with this win so a later dialog cannot receive its animation. */
    const timer = window.setTimeout(() => setCollecting(true), 280);
    return () => window.clearTimeout(timer);
  }, []);
  return <div className="coin-award">
    <div ref={chest} className={`reward-chest ${collecting ? "collecting" : "waiting"}`} aria-hidden="true">
      <img src={collecting ? chestOpenUrl : chestClosedUrl} alt="" />
    </div>
    <strong>+{Math.max(0, Math.round(amount)).toLocaleString()}{tr("CoinPurchase.COINS_SUFFIX")}</strong>
    <span>{`${Math.max(0, Math.round(total)).toLocaleString()} ${tr("CoinShop.COINS_SUFFIX")}`}</span>
    {collecting && <CoinFlight source={chest} amount={amount} total={total} onBalancePreview={onBalancePreview} />}
  </div>;
}

/** Keeps the win action available while milestone tabs advance automatically. */
export function VictoryModalContent({state, onAdvance, onBalancePreview}: {
  /** The current completion and its confirmed rewards. */ state: GameSessionState;
  /** Advances to the next playable round. */ onAdvance: () => void;
  /** Updates only the decorative balance. */ onBalancePreview: (balance: number | null) => void;
}) {
  /** Translated win and reward labels for the active locale. */
  const tr = useTranslator();
  /** Presentation and native activation share the same authoritative advancement policy. */
  const advancePending = isCompletionAdvancePending(state);
  return <>
    <h2 id="game-modal-title">{tr("VictoryModal.TITLE")}</h2>
    <div className="fanfare-content">
      {state.lastRewards && state.lastRewards.coinsEarned > 0 && <VictoryChestAward
        key={state.lastOutcome?.id} amount={state.lastRewards.coinsEarned}
        total={state.profile?.coins ?? state.lastRewards.totalCoins ?? 0} onBalancePreview={onBalancePreview} />}
      {state.lastOutcome?.kind === "win" && <button className="play-primary reward-continue"
        disabled={advancePending} onClick={onAdvance}>
        {tr(state.riddle?.gameMode !== "classic" ? "GameScreenAlerts.NEXT_BUTTON" : "VictoryModal.NEXT_LEVEL_BUTTON")}
      </button>}
    </div>
  </>;
}
