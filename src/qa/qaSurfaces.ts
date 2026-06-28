type QASurfaceKind = "page" | "modal" | "popup";

interface QASurfaceDefinition {
  id: string;
  kind: QASurfaceKind;
  label: string;
}

export const QA_PAGE_SURFACES = [
  {id: "page-app-loading", kind: "page", label: "App loading"},
  {id: "page-landing", kind: "page", label: "Landing"},
  {id: "page-riddle-loading", kind: "page", label: "Riddle loading"},
  {id: "page-initialization-error", kind: "page", label: "Initialization error"},
  {id: "page-game", kind: "page", label: "Game"},
] as const satisfies readonly QASurfaceDefinition[];

export const QA_REGISTRY_MODAL_SURFACES = [
  {id: "modal-welcome", kind: "modal", label: "Welcome modal"},
  {id: "modal-welcome-back", kind: "modal", label: "Welcome back modal"},
  {id: "modal-instructions", kind: "modal", label: "Instructions modal"},
  {id: "modal-info", kind: "modal", label: "Info modal"},
  {id: "modal-hint", kind: "modal", label: "Hint modal"},
  {id: "modal-skip", kind: "modal", label: "Skip modal"},
  {id: "modal-victory", kind: "modal", label: "Victory modal"},
  {id: "modal-loss", kind: "modal", label: "Loss modal"},
  {id: "modal-coin-shop", kind: "modal", label: "Coin shop modal"},
  {id: "modal-coin-purchase-fanfare", kind: "modal", label: "Coin purchase fanfare"},
  {id: "modal-achievement-unlock-fanfare", kind: "modal", label: "Achievement unlock fanfare"},
  {id: "modal-streak-increase-fanfare", kind: "modal", label: "Streak increase fanfare"},
  {id: "modal-level-up-fanfare", kind: "modal", label: "Level up fanfare"},
  {id: "modal-rank-up-fanfare", kind: "modal", label: "Rank up fanfare"},
  {id: "modal-settings", kind: "modal", label: "Settings modal"},
  {id: "modal-full-profile-details", kind: "modal", label: "Full profile details modal"},
  {id: "modal-upgrade-account", kind: "modal", label: "Upgrade account modal"},
  {id: "modal-update-username", kind: "modal", label: "Update username modal"},
  {id: "modal-achievements", kind: "modal", label: "Achievements modal"},
  {id: "modal-stats", kind: "modal", label: "Stats modal"},
  {id: "modal-leaderboard", kind: "modal", label: "Leaderboard modal"},
  {id: "modal-ranks", kind: "modal", label: "Ranks modal"},
  {id: "modal-credits", kind: "modal", label: "Credits modal"},
  {id: "modal-about-legal", kind: "modal", label: "About and legal modal"},
] as const satisfies readonly QASurfaceDefinition[];

export const QA_MODAL_VARIANT_SURFACES = [
  {id: "modal-welcome-onboarding-progress", kind: "modal", label: "Welcome onboarding progress"},
  {id: "modal-instructions-onboarding-progress", kind: "modal", label: "Instructions onboarding progress"},
  {id: "modal-info-onboarding-upgrade-action", kind: "modal", label: "Info onboarding upgrade action"},
  {id: "modal-hint-insufficient-coins", kind: "modal", label: "Hint insufficient coins"},
  {id: "modal-skip-insufficient-coins", kind: "modal", label: "Skip insufficient coins"},
  {id: "modal-loss-no-continue-options", kind: "modal", label: "Loss without continue options"},
  {id: "modal-loss-coin-continue", kind: "modal", label: "Loss coin continue"},
  {id: "modal-coin-shop-loading", kind: "modal", label: "Coin shop loading"},
  {id: "modal-coin-shop-error", kind: "modal", label: "Coin shop error"},
  {id: "modal-coin-shop-empty", kind: "modal", label: "Coin shop empty"},
  {id: "modal-victory-sequence", kind: "modal", label: "Victory sequence breadcrumb"},
  {id: "modal-achievement-unlock-fanfare-sequence", kind: "modal", label: "Achievement sequence breadcrumb"},
  {id: "modal-streak-increase-fanfare-sequence", kind: "modal", label: "Streak sequence breadcrumb"},
  {id: "modal-level-up-fanfare-sequence", kind: "modal", label: "Level up sequence breadcrumb"},
  {id: "modal-rank-up-fanfare-sequence", kind: "modal", label: "Rank up sequence breadcrumb"},
  {id: "modal-settings-language-picker", kind: "modal", label: "Settings language picker"},
  {id: "modal-upgrade-account-existing-account", kind: "modal", label: "Upgrade account existing account prompt"},
] as const satisfies readonly QASurfaceDefinition[];

export const QA_STANDALONE_MODAL_SURFACES = [
  {id: "modal-delete-account-confirmation", kind: "modal", label: "Delete account confirmation modal"},
  {id: "modal-offline-blocking", kind: "modal", label: "Offline blocking modal"},
] as const satisfies readonly QASurfaceDefinition[];

export const QA_MODAL_SURFACES = [
  ...QA_REGISTRY_MODAL_SURFACES,
  ...QA_MODAL_VARIANT_SURFACES,
  ...QA_STANDALONE_MODAL_SURFACES,
] as const satisfies readonly QASurfaceDefinition[];

export const QA_POPUP_SURFACES = [
  {id: "popup-tooltip-submit-answer", kind: "popup", label: "Submit answer tooltip popup"},
  {id: "popup-global-mute-overlay", kind: "popup", label: "Global mute overlay popup"},
] as const satisfies readonly QASurfaceDefinition[];

export const QA_MODAL_SURFACE_TO_REGISTRY_TYPE = {
  "modal-welcome": "welcome",
  "modal-welcome-back": "welcomeBack",
  "modal-instructions": "instructions",
  "modal-info": "info",
  "modal-hint": "hint",
  "modal-skip": "skip",
  "modal-victory": "victory",
  "modal-loss": "loss",
  "modal-coin-shop": "coinShop",
  "modal-coin-purchase-fanfare": "coinPurchaseFanfare",
  "modal-achievement-unlock-fanfare": "achievementUnlockFanfare",
  "modal-streak-increase-fanfare": "streakIncreaseFanfare",
  "modal-level-up-fanfare": "levelUpFanfare",
  "modal-rank-up-fanfare": "rankUpFanfare",
  "modal-settings": "settings",
  "modal-full-profile-details": "fullProfileDetails",
  "modal-upgrade-account": "upgradeAccount",
  "modal-update-username": "updateUsername",
  "modal-achievements": "achievements",
  "modal-stats": "stats",
  "modal-leaderboard": "leaderboard",
  "modal-ranks": "ranks",
  "modal-credits": "credits",
  "modal-about-legal": "aboutLegal",
  "modal-welcome-onboarding-progress": "welcome",
  "modal-instructions-onboarding-progress": "instructions",
  "modal-info-onboarding-upgrade-action": "info",
  "modal-hint-insufficient-coins": "hint",
  "modal-skip-insufficient-coins": "skip",
  "modal-loss-no-continue-options": "loss",
  "modal-loss-coin-continue": "loss",
  "modal-coin-shop-loading": "coinShop",
  "modal-coin-shop-error": "coinShop",
  "modal-coin-shop-empty": "coinShop",
  "modal-victory-sequence": "victory",
  "modal-achievement-unlock-fanfare-sequence": "achievementUnlockFanfare",
  "modal-streak-increase-fanfare-sequence": "streakIncreaseFanfare",
  "modal-level-up-fanfare-sequence": "levelUpFanfare",
  "modal-rank-up-fanfare-sequence": "rankUpFanfare",
  "modal-settings-language-picker": "settings",
  "modal-upgrade-account-existing-account": "upgradeAccount",
} as const;

export const QA_SURFACES = [
  ...QA_PAGE_SURFACES,
  ...QA_MODAL_SURFACES,
  ...QA_POPUP_SURFACES,
] as const satisfies readonly QASurfaceDefinition[];

export type QASurfaceId = (typeof QA_SURFACES)[number]["id"];

export const QA_SURFACE_IDS = QA_SURFACES.map((surface) => surface.id);

export const isQASurfaceId = (value: string): value is QASurfaceId =>
  (QA_SURFACE_IDS as readonly string[]).includes(value);

const SURFACE_QUERY_PATTERN = /[?&]surface=([^&]+)/;
const QA_PATH_PATTERN = /:\/\/qa\/?([^?]*)/;

export const extractQASurfaceIdFromUrl = (url: string | null): QASurfaceId | null => {
  if (!url) {
    return null;
  }

  const queryMatch = url.match(SURFACE_QUERY_PATTERN);
  const querySurface = queryMatch ? decodeURIComponent(queryMatch[1]) : null;
  if (querySurface && isQASurfaceId(querySurface)) {
    return querySurface;
  }

  const pathMatch = url.match(QA_PATH_PATTERN);
  const pathSurface = pathMatch?.[1]?.replace(/^\/+|\/+$/g, "");
  if (pathSurface && isQASurfaceId(pathSurface)) {
    return pathSurface;
  }

  return null;
};

export const getQASurface = (id: QASurfaceId) => QA_SURFACES.find((surface) => surface.id === id) ?? QA_SURFACES[0];
