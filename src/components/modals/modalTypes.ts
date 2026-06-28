export const FANFARE_SEQUENCE_BACKGROUND_MODAL_TYPE = "fanfareSequenceBackground";

export const MODAL_REGISTRY_TYPES = [
  "victory",
  "loss",
  "settings",
  "fullProfileDetails",
  "upgradeAccount",
  "achievements",
  "stats",
  "leaderboard",
  "ranks",
  "updateUsername",
  "info",
  "hint",
  "skip",
  "welcome",
  "welcomeBack",
  "instructions",
  "credits",
  "aboutLegal",
  "coinShop",
  "coinPurchaseFanfare",
  "achievementUnlockFanfare",
  "streakIncreaseFanfare",
  "levelUpFanfare",
  "rankUpFanfare",
] as const;

export type ModalRegistryType = (typeof MODAL_REGISTRY_TYPES)[number];
