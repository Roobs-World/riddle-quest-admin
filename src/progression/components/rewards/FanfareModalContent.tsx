import {ACHIEVEMENT_DEFINITIONS} from "../../achievements/browser/achievements";
import {useTranslator} from "../../../localization/browser/i18n";
import {CoinAwardSequence} from "./CoinAwardSequence";
import type {FanfareCoinAward, FanfareStep} from "../../browser/fanfareSequence";

/** Renders the full achievement details used by the profile and localization checks. */
export function AchievementFanfare({achievementId}: {
  /** Stable achievement identifier. */ achievementId: string;
}) {
  /** Translated milestone labels for the active locale. */
  const tr = useTranslator();
  /** Canonical achievement supplies its translated name and icon. */
  const achievement = ACHIEVEMENT_DEFINITIONS.find(item => item.id === achievementId);
  return <div className="achievement-unlock">
    <span className="achievement-icon large" aria-hidden="true">{achievement?.icon ?? "🏆"}</span>
    <strong>{achievement ? (achievement.nameKey ? tr(achievement.nameKey) : achievement.name) : achievementId}</strong>
    {achievement && <p>{achievement.descriptionKey ? tr(achievement.descriptionKey) : achievement.description}</p>}
  </div>;
}

/** A short milestone label and its optional, already-granted coin award. */
export function FanfareTabContent({step, level, award, collecting, onBalancePreview}: {
  /** Milestone represented by this tab. */ step: FanfareStep;
  /** Confirmed player level, when applicable. */ level: number | undefined;
  /** Confirmed award associated with this step. */ award: FanfareCoinAward | null;
  /** Only the front tab may start a coin flight. */ collecting: boolean;
  /** Updates the decorative header counter. */ onBalancePreview: (balance: number | null) => void;
}) {
  /** Translated milestone labels for the active locale. */
  const tr = useTranslator();
  /** Canonical achievement supplies its translated name and icon. */
  const achievement = step.kind === "achievement"
    ? ACHIEVEMENT_DEFINITIONS.find(item => item.id === step.achievementId) : undefined;
  /** Short translated title for this milestone kind. */
  let title: string;
  /** Default milestone icon when no achievement icon applies. */
  let icon = "✦";
  switch (step.kind) {
    case "victory": title = tr("VictoryModal.YOU_WON_TITLE"); break;
    case "level": title = `${tr("LevelUpFanfare.LEVEL_PREFIX")}${level ?? ""}`; break;
    case "achievement":
      title = achievement ? (achievement.nameKey ? tr(achievement.nameKey) : achievement.name) : step.achievementId;
      icon = achievement?.icon ?? "🏆";
      break;
    case "referral": title = tr("VictoryModal.REFERRAL_REWARD_TITLE"); break;
    case "purchase":
    case "coins": title = tr("CoinPurchase.TITLE"); break;
    default: step satisfies never; return null;
  }
  return <>
    {step.kind !== "level" && <span className="fanfare-tab-icon" aria-hidden="true">{icon}</span>}
    <div className="fanfare-tab-copy">
      {step.kind === "achievement" && <small>{tr("Achievements.NEW_ACHIEVEMENT")}</small>}
      <strong>{title}</strong>
    </div>
    {award && award.amount > 0 && <CoinAwardSequence key={award.id} amount={award.amount} total={award.total}
      collecting={collecting} onBalancePreview={onBalancePreview} />}
  </>;
}
