import * as RNIap from "react-native-iap";
import { ProductPricing } from "../services/ProductPricingService";
import { SupportedLanguage } from "../constants/AppStrings";

// Base modal interface that all modals must implement
export interface BaseModalProps {
  isVisible: boolean;
  onClose: () => void;
}

// Generic modal data interface
export interface ModalData {
  [key: string]: unknown;
}

// Modal configuration for registering modals
export interface ModalConfig<T extends ModalData = ModalData> {
  component: React.ComponentType<BaseModalProps & T>;
  defaultProps?: Partial<T>;
}

// Modal instance representing an active modal
export interface ModalInstance<T extends ModalData = ModalData> {
  id: string;
  type: string;
  data: T;
  priority: number;
  persistent?: boolean; // If true, modal won't close on backdrop press
}

// Modal registry type
export type ModalRegistry = {
  [K: string]: ModalConfig<ModalData>;
};

// Modal context state
export interface ModalContextState {
  modals: ModalInstance[];
  openModal: <T extends ModalData>(
    type: string,
    data?: T,
    options?: ModalOptions
  ) => string;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
  isModalOpen: (type: string) => boolean;
  getModalData: <T extends ModalData>(type: string) => T | null;
  updateModalData: <T extends ModalData>(id: string, data: Partial<T>) => void;
}

// Options for opening modals
export interface ModalOptions {
  priority?: number;
  persistent?: boolean;
  replace?: boolean; // If true, closes all modals of the same type before opening
}

export interface AchievementUnlockFanfareItem {
  name: string;
  description: string;
  icon: string;
}

// Game-specific modal types for type safety
export interface GameModalTypes {
  // Game modals
  victory: {
    attempts: number;
    coinsEarned: number;
    totalCoins?: number;
    guesses: import("../hooks/types").SubmittedGuess[];
    /** Human-readable names of achievements newly unlocked by this win. */
    unlockedAchievementNames?: string[];
    onNext: () => void;
  };

  loss: {
    correctAnswer: string;
    totalCoins?: number;
    onNext: () => void;
    /** Opens the coin shop modal from the loss flow. */
    onOpenShop?: () => void;
    /** If provided, a "Watch Ad to Continue" button is shown. */
    onWatchAdContinue?: () => void | boolean | Promise<void | boolean>;
    /** If provided, a "Use Coins to Continue" button is shown. */
    onCoinContinue?: () => void | boolean | Promise<void | boolean>;
    /** Coin cost displayed on the coin-continue button. */
    coinContinueCost?: number;
    /** Coin cost displayed on the skip-level button. */
    skipLevelCost?: number;
    /** Whether the rewarded ad is ready to show. */
    canWatchAd?: boolean;
    /** Whether the user has enough coins to continue. */
    canUseCoin?: boolean;
  };

  // Settings modals
  settings: {
    isSoundEnabled: boolean;
    isHapticsEnabled: boolean;
    currentLanguage: SupportedLanguage;
    onToggleSound: (enabled: boolean) => void;
    onToggleHaptics: (enabled: boolean) => void;
    onChangeLanguage: (language: SupportedLanguage) => void;
    onPressLogout: () => void;
    onPressHelp: () => void;
    onPressCredits: () => void;
    /** When provided, a "View Achievements" button is shown that opens the achievements modal. */
    playerData?: import("../validation/firestoreSchemas").Player | null;
  };

  fullProfileDetails: {
    playerData: import("../validation/firestoreSchemas").Player | null;
  };

  achievements: {
    playerData: import("../validation/firestoreSchemas").Player | null;
  };

  stats: {
    playerData: import("../validation/firestoreSchemas").Player | null;
  };

  leaderboard: {
    currentUserId: string | null;
  };

  changePassword: {
    onPasswordChanged: () => void;
  };

  updateUsername: {
    currentUsername: string;
    onUsernameUpdated: (newUsername: string) => void;
  };

  avatarOptions: {
    onAvatarSelected: (avatarUrl: string) => void;
  };

  preloadedAvatars: {
    onAvatarSelected: (avatarUrl: string) => void;
  };

  // Help modals
  hint: {
    hintCost: number;
    userCoins: number;
    onShowHint: () => void;
    onOpenShop?: () => void;
  };

  skip: {
    userCoins: number;
    totalCoins?: number;
    skipCost: number;
    onSkipLevel: () => void;
    onOpenShop: () => void;
  };

  welcome: {
    /** Optional callback fired after the welcome modal is dismissed. */
    onDismiss?: () => void;
  };

  welcomeBack: {
    username: string;
    /** Optional callback fired after the welcome-back modal is dismissed. */
    onDismiss?: () => void;
  };

  instructions: Record<string, never>;

  credits: Record<string, never>;

  info: {
    title: string;
    message: string;
    /** Optional extra callback fired when the user presses OK (before the modal closes). */
    onConfirm?: () => void;
    /** Optional secondary action button label (e.g. "Upgrade Account"). */
    actionButtonText?: string;
    /** Optional callback fired when the secondary action button is pressed. */
    onAction?: () => void;
  };

  // Shop modals
  coinShop: {
    products?: RNIap.Product[];
    firestoreProducts?: ProductPricing[];
    currentCoins?: number;
    loading?: boolean;
    error?: string | null;
    onFirstPaint?: () => void;
    onPurchaseProduct: (productId: string) => void;
    onWatchVideo?: () => void;
    onPayAndPlay?: () => void;
  };

  coinPurchaseFanfare: {
    coinsPurchased: number;
    totalCoins: number;
    onConfirm?: () => void;
  };

  achievementUnlockFanfare: {
    coinsEarned: number;
    totalCoins: number;
    achievementNames?: string[];
    achievements?: AchievementUnlockFanfareItem[];
    onContinue?: () => void;
  };

  streakIncreaseFanfare: {
    streakValue: number;
    coinsAwarded: number;
    totalCoins: number;
    onContinue?: () => void;
  };

  levelUpFanfare: {
    newLevel: number;
    coinsAwarded: number;
    totalCoins: number;
    onContinue?: () => void;
  };
}

// Helper type for getting modal data type
export type ModalDataType<T extends keyof GameModalTypes> = GameModalTypes[T];

// Modal action types for reducer
export type ModalAction =
  | { type: "OPEN_MODAL"; payload: ModalInstance }
  | { type: "CLOSE_MODAL"; payload: string }
  | { type: "CLOSE_ALL_MODALS" }
  | {
      type: "UPDATE_MODAL_DATA";
      payload: { id: string; data: Partial<ModalData> };
    };
