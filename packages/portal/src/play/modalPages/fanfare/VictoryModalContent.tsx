import {useEffect, useRef, useState} from "react";
import type {GameSessionState} from "@qwordly/hosted/play/gameSession";
import {useTranslator} from "../../i18n";
import {isCompletionAdvancePending} from "@qwordly/hosted/play/completionPresentation";
import {useReferralSharing} from "../../sharing/ReferralSharingCapability";
import {CoinFlight} from "../../CoinFlight";
import type {CompletionRewardBreakdown} from "@qwordly/hosted/completionRewardBreakdown";
import chestClosedUrl from "../../../../../../assets/images-web/chest-closed.png";
import chestOpenUrl from "../../../../../../assets/images-web/chest-open.webp";
import "../../../styles.victory.css";

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

/** Explains the current receipt using only nonzero server-awarded coin components. */
function VictoryRewardBreakdown({breakdown, gameMode}: {
  /** Components validated when the authoritative completion entered the game. */ breakdown: CompletionRewardBreakdown;
  /** Immutable mode of the completed question determines its base reward label. */ gameMode: GameSessionState["gameMode"];
}) {
  /** Receipt labels translated for the active interface locale. */
  const tr = useTranslator();
  /** Each displayed amount comes directly from its named receipt field. */
  const components = [
    {label: gameMode === "classic" ? "VictoryModal.REWARD_CLASSIC" : "VictoryModal.REWARD_DAILY", amount: breakdown.baseWinCoins},
    {label: "VictoryModal.REWARD_STREAK_BONUS", amount: breakdown.dailyStreakBonus},
    {label: "VictoryModal.REWARD_LEVEL_BONUS", amount: breakdown.levelUpBonus},
    {label: "VictoryModal.REWARD_ACHIEVEMENT_BONUS", amount: breakdown.achievementBonus},
    {label: "VictoryModal.REWARD_REFERRAL_BONUS", amount: breakdown.referralBonus ?? 0},
  ];
  return <dl className="victory-reward-breakdown">
    {components.filter(component => component.amount > 0).map(component => <div key={component.label}>
      <dt>{tr(component.label)}</dt><dd><bdi dir="ltr">+{component.amount.toLocaleString()}</bdi></dd>
    </div>)}
  </dl>;
}

/** Keeps the win action available while milestone tabs advance automatically. */
export function VictoryModalContent({state, onAdvance, onBalancePreview}: {
  /** The current completion and its confirmed rewards. */ state: GameSessionState;
  /** Advances to the next playable round. */ onAdvance: () => void;
  /** Updates only the decorative balance. */ onBalancePreview: (balance: number | null) => void;
}) {
  /** Translated win and reward labels for the active locale. */
  const tr = useTranslator();
  /** Referral actions supplied by the active platform. */
  const sharing = useReferralSharing();
  /** Presentation and native activation share the same authoritative advancement policy. */
  const advancePending = isCompletionAdvancePending(state);
  return <>
    <h2 id="game-modal-title">{tr("VictoryModal.TITLE")}</h2>
    <div className="fanfare-content">
      <>
        <strong className="fanfare-title" aria-live="polite">{tr("VictoryModal.YOU_WON_TITLE")}</strong>
        {state.lastRewards && state.lastRewards.coinsEarned > 0 && <VictoryChestAward
          key={state.lastOutcome?.id} amount={state.lastRewards.coinsEarned}
          total={state.profile?.coins ?? state.lastRewards.totalCoins ?? 0} onBalancePreview={onBalancePreview} />}
        {state.completionAcknowledged && state.lastOutcome?.kind === "win" && state.lastRewards?.rewardBreakdown &&
          <VictoryRewardBreakdown breakdown={state.lastRewards.rewardBreakdown} gameMode={state.lastOutcome.gameMode} />}
        {state.lastRewards && <div className="reward-summary reward-details">
          {state.lastRewards.newXp !== undefined && <span>{state.lastRewards.newXp} {tr("StatsModal.XP")}</span>}
          {state.lastRewards.newWinStreak !== undefined && <span>🔥 {state.lastRewards.newWinStreak}</span>}
        </div>}
      </>
      {state.lastOutcome?.kind === "win" && <button className="play-primary reward-continue"
        disabled={advancePending} onClick={onAdvance}>
        {tr(state.riddle?.gameMode !== "classic" ? "GameScreenAlerts.NEXT_BUTTON" : "VictoryModal.NEXT_LEVEL_BUTTON")}
      </button>}
      {state.lastRewards && sharing && <button className="play-secondary" onClick={() => sharing.shareResult({
        gameMode: state.riddle?.gameMode, riddleId: state.riddle?.riddleId, attempts: state.guesses.length,
        emojiGrid: state.guesses.map(guess => guess.feedback.map(feedback =>
          feedback === "green" ? "🟩" : feedback === "yellow" ? "🟨" : "⬛").join("")).join("\n"),
      })}>{sharing.inviteLabel ?? tr("VictoryModal.SHARE_TEXT", {coins: sharing.rewardCoins})}</button>}
    </div>
  </>;
}
