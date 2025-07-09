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

// Game-specific modal types for type safety
export interface GameModalTypes {
  // Game modals
  victory: {
    attempts: number;
    coinsEarned: number;
    onNext: () => void;
    onHome: () => void;
  };

  loss: {
    correctAnswer: string;
    onNext: () => void;
    onHome: () => void;
  };

  outOfAttempts: {
    userCoins: number;
    continueCost: number;
    onWatchAd: () => void;
    onSpendCoins: () => void;
  };

  watchAdForChance: {
    onWatchAd: () => void;
  };

  dailyChallengeCompletion: {
    questionsCompleted: number;
    totalQuestions: number;
    coinsEarned: number;
    onContinue: () => void;
  };

  // Settings modals
  settings: {
    isSoundEnabled: boolean;
    isHapticsEnabled: boolean;
    onToggleSound: (enabled: boolean) => void;
    onToggleHaptics: (enabled: boolean) => void;
    onPressLogout: () => void;
    onPressHelp: () => void;
    onPressCredits: () => void;
  };

  fullProfileDetails: {
    playerData: Record<string, unknown>; // Could be more strictly typed based on your user data model
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
  };

  skip: {
    userCoins: number;
    skipCost: number;
    onSkipLevel: () => void;
  };

  welcome: Record<string, never>;

  instructions: Record<string, never>;

  // Shop modals
  coinShop: {
    onPurchaseProduct: (productId: string) => void;
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
