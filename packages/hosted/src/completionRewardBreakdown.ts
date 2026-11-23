import type {CompleteGameResponseData} from "@riddle-quest/core/validation/requestSchemas";

/** Server-settled coin components for one completed solo question. */
export type CompletionRewardBreakdown = NonNullable<CompleteGameResponseData["rewardBreakdown"]>;

/** Coin presentation requires exact nonnegative amounts without loading deferred transport schemas. */
const isCoinAmount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Accepts complete receipt components only when they explain the awarded total exactly. */
export function parseCompletionRewardBreakdown(
  value: unknown,
  coinsEarned: number | undefined,
): CompletionRewardBreakdown | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value) || !isCoinAmount(coinsEarned) || coinsEarned <= 0 ||
    !("baseWinCoins" in value) || !("levelUpBonus" in value) || !("dailyStreakBonus" in value) ||
    !("achievementBonus" in value) || !("totalAwarded" in value) || !("newBalance" in value)) return undefined;
  /** Unknown receipt properties are admitted individually before constructing the canonical typed value. */
  const {baseWinCoins, levelUpBonus, dailyStreakBonus, achievementBonus, totalAwarded, newBalance} = value;
  /** Optional referral awards remain absent on receipts that do not include them. */
  const referralBonus = "referralBonus" in value ? value.referralBonus : undefined;
  if (!isCoinAmount(baseWinCoins) || !isCoinAmount(levelUpBonus) || !isCoinAmount(dailyStreakBonus) ||
    !isCoinAmount(achievementBonus) || !isCoinAmount(totalAwarded) || !isCoinAmount(newBalance) ||
    (referralBonus !== undefined && !isCoinAmount(referralBonus))) return undefined;
  /** This check verifies receipt consistency without inventing missing bonus amounts. */
  const componentTotal = baseWinCoins + levelUpBonus + dailyStreakBonus + achievementBonus + (referralBonus ?? 0);
  return componentTotal === totalAwarded && totalAwarded === coinsEarned
    ? {baseWinCoins, levelUpBonus, dailyStreakBonus, achievementBonus, totalAwarded, newBalance,
        ...(referralBonus === undefined ? {} : {referralBonus})}
    : undefined;
}
