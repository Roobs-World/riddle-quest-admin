export type QASurfaceKind = "page" | "modal";

export interface QASurfaceDefinition {
  id: string;
  kind: QASurfaceKind;
  label: string;
}

export const QA_PAGE_SURFACES = [
  { id: "page-app-loading", kind: "page", label: "App loading" },
  { id: "page-landing", kind: "page", label: "Landing" },
  { id: "page-login", kind: "page", label: "Login" },
  { id: "page-sign-up", kind: "page", label: "Sign up" },
  { id: "page-forgot-password", kind: "page", label: "Forgot password" },
  { id: "page-new-password", kind: "page", label: "New password" },
  { id: "page-riddle-loading", kind: "page", label: "Riddle loading" },
  { id: "page-initialization-error", kind: "page", label: "Initialization error" },
  { id: "page-game", kind: "page", label: "Game" },
] as const satisfies readonly QASurfaceDefinition[];

export const QA_MODAL_SURFACES = [
  { id: "modal-welcome", kind: "modal", label: "Welcome modal" },
  { id: "modal-welcome-back", kind: "modal", label: "Welcome back modal" },
  { id: "modal-instructions", kind: "modal", label: "Instructions modal" },
  { id: "modal-info", kind: "modal", label: "Info modal" },
  { id: "modal-hint", kind: "modal", label: "Hint modal" },
  { id: "modal-skip", kind: "modal", label: "Skip modal" },
  { id: "modal-victory", kind: "modal", label: "Victory modal" },
  { id: "modal-loss", kind: "modal", label: "Loss modal" },
  { id: "modal-coin-shop", kind: "modal", label: "Coin shop modal" },
  { id: "modal-coin-purchase-fanfare", kind: "modal", label: "Coin purchase fanfare" },
  { id: "modal-achievement-unlock-fanfare", kind: "modal", label: "Achievement unlock fanfare" },
  { id: "modal-streak-increase-fanfare", kind: "modal", label: "Streak increase fanfare" },
  { id: "modal-level-up-fanfare", kind: "modal", label: "Level up fanfare" },
  { id: "modal-settings", kind: "modal", label: "Settings modal" },
  { id: "modal-full-profile-details", kind: "modal", label: "Full profile details modal" },
  { id: "modal-upgrade-account", kind: "modal", label: "Upgrade account modal" },
  { id: "modal-update-username", kind: "modal", label: "Update username modal" },
  { id: "modal-achievements", kind: "modal", label: "Achievements modal" },
  { id: "modal-stats", kind: "modal", label: "Stats modal" },
  { id: "modal-leaderboard", kind: "modal", label: "Leaderboard modal" },
  { id: "modal-credits", kind: "modal", label: "Credits modal" },
  { id: "modal-about-legal", kind: "modal", label: "About and legal modal" },
  { id: "modal-delete-account-confirmation", kind: "modal", label: "Delete account confirmation modal" },
  { id: "modal-offline-blocking", kind: "modal", label: "Offline blocking modal" },
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
  "modal-settings": "settings",
  "modal-full-profile-details": "fullProfileDetails",
  "modal-upgrade-account": "upgradeAccount",
  "modal-update-username": "updateUsername",
  "modal-achievements": "achievements",
  "modal-stats": "stats",
  "modal-leaderboard": "leaderboard",
  "modal-credits": "credits",
  "modal-about-legal": "aboutLegal",
} as const;

export const QA_SURFACES = [
  ...QA_PAGE_SURFACES,
  ...QA_MODAL_SURFACES,
] as const satisfies readonly QASurfaceDefinition[];

export type QASurfaceId = (typeof QA_SURFACES)[number]["id"];

export const QA_SURFACE_IDS = QA_SURFACES.map((surface) => surface.id);

export const isQASurfaceId = (value: string): value is QASurfaceId =>
  (QA_SURFACE_IDS as readonly string[]).includes(value);

export const getQASurface = (id: QASurfaceId) =>
  QA_SURFACES.find((surface) => surface.id === id) ?? QA_SURFACES[0];
