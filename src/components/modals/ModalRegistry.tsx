/**
 * @fileoverview Modal Registry System
 *
 * Centralized modal management system for the Qwordly application that provides
 * a unified interface for registering, accessing, and rendering modal components.
 * This registry pattern enables consistent modal handling across the entire app
 * while maintaining type safety and component isolation.
 *
 * **Key Features:**
 * - Centralized modal component registration
 * - Type-safe prop mapping and validation
 * - Consistent modal lifecycle management
 * - Dynamic modal loading and rendering
 * - Automated component wrapping and adaptation
 *
 * **Architecture:**
 * The modal registry uses a wrapper pattern to adapt existing modal components
 * to a unified interface. Each modal is registered with a unique identifier and
 * a prop mapping function that translates generic modal data to component-specific props.
 *
 * **Usage Example:**
 * ```typescript
 * // Register a modal
 * modalRegistry.victory = createModalWrapper(VictoryModal, propsMapper);
 *
 * // Render a modal
 * const ModalComponent = getModalComponent('victory');
 * <ModalComponent isVisible={true} {...modalData} />
 * ```
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 *
 * @see {@link ModalProvider} For modal state management
 * @see {@link BaseModalProps} For common modal prop interface
 * @see {@link ModalData} For modal data type definitions
 */

import React from "react";
import { BaseModalProps, ModalData } from "../../types/ModalTypes";
import { SubmittedGuess } from "../../hooks/types";
import { Player } from "../../validation/firestoreSchemas";
import * as RNIap from "react-native-iap";
import { logger } from "../../utils/logger";
import { ProductPricing } from "../../services/ProductPricingService";
import {
  SupportedLanguage,
  getAppLanguage,
} from "../../constants/AppStrings";

// Import all modal components
import VictoryModal from "./game/VictoryModal";
import LossModal from "./game/LossModal";
import GameModeModal from "./game/GameModeModal";
// Note: OutOfAttemptsModal, WatchAdForChanceModal, and DailyChallengeCompletionModal have been removed

import SettingsModal from "./settings/SettingsModal";
import FullProfileDetailsModal from "./settings/FullProfileDetailsModal";
import ChangePasswordModal from "./settings/ChangePasswordModal";
import UpdateUsernameModal from "./settings/UpdateUsernameModal";
import AvatarOptionsModal from "./settings/AvatarOptionsModal";
import PreloadedAvatarsModal from "./settings/PreloadedAvatarsModal";
import AchievementsModal from "./settings/AchievementsModal";
import StatsModal from "./settings/StatsModal";
import LeaderboardModal from "./settings/LeaderboardModal";

import HintModal from "./help/HintModal";
import InfoModal from "./help/InfoModal";
import SkipModal from "./help/SkipModal";
import WelcomeModal from "./help/WelcomeModal";
import InstructionsModal from "./help/InstructionsModal";
import CreditsModal from "./help/CreditsModal";

import CoinShopModal from "../shop/CoinShopModal";
import CoinPurchaseFanfareModal from "./shop/CoinPurchaseFanfareModal";

/**
 * Modal Wrapper Factory Function
 *
 * Creates a standardized wrapper component that adapts existing modal components
 * to the unified modal registry interface. This enables consistent prop handling
 * and lifecycle management across all modal types.
 *
 * **Features:**
 * - Automatic prop mapping and validation
 * - Component name preservation for debugging
 * - Type-safe generic prop handling
 * - Consistent error boundaries and fallbacks
 *
 * @template TProps - The specific props interface of the wrapped modal component
 *
 * @param ModalComponent - The React component to wrap
 * @param propsMapper - Function that maps generic modal data to component-specific props
 *
 * @returns A wrapped modal component with standardized interface
 *
 * @example
 * ```typescript
 * const WrappedModal = createModalWrapper(
 *   VictoryModal,
 *   (props) => ({
 *     isVisible: props.isVisible,
 *     attempts: props.attempts as number,
 *     onNextLevel: props.onNext as () => void
 *   })
 * );
 * ```
 */
const createModalWrapper = <TProps extends Record<string, unknown>>(
  ModalComponent: React.ComponentType<TProps>,
  propsMapper: (props: BaseModalProps & ModalData) => TProps
) => {
  const ModalWrapper = (props: BaseModalProps & ModalData) => {
    const mappedProps = propsMapper(props);
    return <ModalComponent {...mappedProps} />;
  };
  ModalWrapper.displayName = `ModalWrapper(${
    ModalComponent.displayName || ModalComponent.name || "Component"
  })`;
  return ModalWrapper;
};

/**
 * Modal Registry Entry Type
 *
 * Defines the interface for modal components registered in the modal registry.
 * Each entry must be a React functional component that accepts standardized
 * modal props and returns a renderable JSX element.
 */
type ModalRegistryEntry = {
  (props: BaseModalProps & ModalData): React.JSX.Element;
  displayName: string;
};

/**
 * Modal Registry
 *
 * Central registry containing all modal components available in the application.
 * Each modal is identified by a unique string key and provides a standardized
 * interface for rendering with type-safe prop mapping.
 *
 * **Modal Categories:**
 *
 * **Game Modals:**
 * - `victory` - Success celebration and progression options
 * - `loss` - Failure state with retry and navigation options
 *
 * **Settings Modals:**
 * - `settings` - App preferences and account management
 * - `fullProfileDetails` - Complete user profile information
 * - `changePassword` - Password update functionality
 * - `updateUsername` - Username modification interface
 * - `avatarOptions` - Avatar selection and customization
 * - `preloadedAvatars` - Preset avatar gallery
 *
 * **Help Modals:**
 * - `hint` - Game hint purchase and display
 * - `skip` - Level skip purchase and confirmation
 * - `welcome` - First-time user onboarding
 * - `instructions` - Game rules and tutorial
 * - `credits` - App credits and attribution
 *
 * **Shop Modals:**
 * - `coinShop` - In-app purchase interface for coins
 *
 * @example
 * ```typescript
 * // Access a specific modal
 * const VictoryModalComponent = modalRegistry.victory;
 *
 * // Render with props
 * <VictoryModalComponent
 *   isVisible={true}
 *   attempts={3}
 *   coinsEarned={50}
 *   onClose={() => {}}
 * />
 * ```
 */
export const modalRegistry: Record<string, ModalRegistryEntry> = {
  /**
   * Game Modals
   *
   * Modals related to game progression, outcomes, and player decisions.
   */
  victory: createModalWrapper(
    VictoryModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      attempts: (props.attempts as number) || 0,
      coinsEarned: (props.coinsEarned as number) || 0,
      unlockedAchievementNames:
        (props.unlockedAchievementNames as string[] | undefined) ?? [],
      onNextLevel: (props.onNext as () => void) || (() => {}),
      onHome: (props.onHome as () => void) || (() => {}),
      guesses: (props.guesses as SubmittedGuess[]) || [],
      onClose: props.onClose,
    })
  ),

  loss: createModalWrapper(LossModal, (props: BaseModalProps & ModalData) => ({
    isVisible: props.isVisible,
    correctAnswer: (props.correctAnswer as string) || "",
    onNext: (props.onNext as () => void) || (() => {}),
    onHome: (props.onHome as () => void) || (() => {}),
    onClose: props.onClose,
    onWatchAdContinue: props.onWatchAdContinue as (() => void) | undefined,
    onCoinContinue: props.onCoinContinue as (() => void) | undefined,
    coinContinueCost: props.coinContinueCost as number | undefined,
    canWatchAd: props.canWatchAd as boolean | undefined,
    canUseCoin: props.canUseCoin as boolean | undefined,
  })),

  gameMode: createModalWrapper(
    GameModeModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
      onSelectMode:
        (props.onSelectMode as (mode: "classic" | "daily") => void) ||
        (() => {}),
      currentLevel: props.currentLevel as number | undefined,
    })
  ),

  /**
   * Settings Modals
   *
   * Modals for user preferences, account management, and profile customization.
   */
  settings: createModalWrapper(
    SettingsModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
      isSoundEnabled: (props.isSoundEnabled as boolean) || false,
      isHapticsEnabled: (props.isHapticsEnabled as boolean) || false,
      isHardMode: (props.isHardMode as boolean) || false,
      currentLanguage:
        (props.currentLanguage as SupportedLanguage) ?? getAppLanguage(),
      onToggleSound:
        (props.onToggleSound as (enabled: boolean) => void) || (() => {}),
      onToggleHaptics:
        (props.onToggleHaptics as (enabled: boolean) => void) || (() => {}),
      onToggleHardMode:
        (props.onToggleHardMode as (enabled: boolean) => void) || (() => {}),
      onChangeLanguage:
        (props.onChangeLanguage as (language: SupportedLanguage) => void) ||
        (() => {}),
      onPressLogout: (props.onPressLogout as () => void) || (() => {}),
      onPressHelp: (props.onPressHelp as () => void) || (() => {}),
      onPressCredits: (props.onPressCredits as () => void) || (() => {}),
      playerData: (props.playerData as Player) ?? null,
    })
  ),

  fullProfileDetails: createModalWrapper(
    FullProfileDetailsModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
      playerData: (props.playerData as Player) || null,
    })
  ),

  achievements: createModalWrapper(
    AchievementsModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
      playerData: (props.playerData as Player) ?? null,
    })
  ),

  stats: createModalWrapper(
    StatsModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
      playerData: (props.playerData as Player) ?? null,
    })
  ),

  leaderboard: createModalWrapper(
    LeaderboardModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
      currentUserId: (props.currentUserId as string | null) ?? null,
    })
  ),

  changePassword: createModalWrapper(
    ChangePasswordModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
      onPasswordChanged: (props.onPasswordChanged as () => void) || (() => {}),
    })
  ),

  updateUsername: createModalWrapper(
    UpdateUsernameModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
      currentUsername: (props.currentUsername as string) || "",
      onUsernameUpdated:
        (props.onUsernameUpdated as (username: string) => void) || (() => {}),
    })
  ),

  avatarOptions: createModalWrapper(
    AvatarOptionsModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
      onAvatarSelected:
        (props.onAvatarSelected as (url: string) => void) || (() => {}),
      onOpenPreloadedAvatars:
        (props.onOpenPreloadedAvatars as () => void) || (() => {}),
      userId: (props.userId as string) || "",
    })
  ),

  preloadedAvatars: createModalWrapper(
    PreloadedAvatarsModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
      onAvatarSelected:
        (props.onAvatarSelected as (url: string) => void) || (() => {}),
      onCloseAvatarOptions: props.onClose,
    })
  ),

  /**
   * Help Modals
   *
   * Modals providing assistance, tutorials, and informational content.
   */
  info: createModalWrapper(InfoModal, (props: BaseModalProps & ModalData) => ({
    isVisible: props.isVisible,
    title: (props.title as string) || "",
    message: (props.message as string) || "",
    onClose: () => {
      if (typeof props.onConfirm === "function") (props.onConfirm as () => void)();
      props.onClose();
    },
  })),

  hint: createModalWrapper(HintModal, (props: BaseModalProps & ModalData) => ({
    isVisible: props.isVisible,
    onClose: props.onClose,
    userCoins: (props.userCoins as number) || 0,
    hintCost: (props.hintCost as number) || 0,
    onShowHint: (props.onShowHint as () => void) || (() => {}),
  })),

  skip: createModalWrapper(SkipModal, (props: BaseModalProps & ModalData) => ({
    isVisible: props.isVisible,
    onClose: props.onClose,
    userCoins: (props.userCoins as number) || 0,
    skipCost: (props.skipCost as number) || 0,
    onSkipLevel: (props.onSkipLevel as () => void) || (() => {}),
  })),

  welcome: createModalWrapper(
    WelcomeModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
      onStartTutorial: (props as { onStartTutorial?: () => void }).onStartTutorial,
    })
  ),

  instructions: createModalWrapper(
    InstructionsModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
    })
  ),

  credits: createModalWrapper(
    CreditsModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
    })
  ),

  /**
   * Shop Modals
   *
   * Modals for in-app purchases and monetization features.
   */
  coinShop: createModalWrapper(
    CoinShopModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
      products: (props.products as RNIap.Product[]) || [],
      firestoreProducts:
        (props.firestoreProducts as ProductPricing[] | undefined) || [],
      currentCoins: (props.currentCoins as number | undefined) ?? 0,
      onPurchaseProduct:
        (props.onPurchaseProduct as (productId: string) => void) || (() => {}),
      loading: (props.loading as boolean) || false,
      error: (props.error as string | null) || null,
      onWatchVideo: (props.onWatchVideo as () => void) || undefined,
      onPayAndPlay: (props.onPayAndPlay as () => void) || undefined,
    })
  ),

  coinPurchaseFanfare: createModalWrapper(
    CoinPurchaseFanfareModal,
    (props: BaseModalProps & ModalData) => ({
      isVisible: props.isVisible,
      onClose: props.onClose,
      coinsPurchased: (props.coinsPurchased as number) || 0,
    })
  ),
};

/**
 * Get Modal Component
 *
 * Retrieves a modal component from the registry by its unique identifier.
 * Returns null if the modal type is not found or not registered.
 *
 * **Features:**
 * - Type-safe modal retrieval
 * - Null safety for unregistered modals
 * - Runtime validation of modal existence
 *
 * @param type - The unique identifier of the modal to retrieve
 * @returns The modal component if found, null otherwise
 *
 * @example
 * ```typescript
 * const VictoryModal = getModalComponent('victory');
 * if (VictoryModal) {
 *   return <VictoryModal isVisible={true} {...props} />;
 * }
 * ```
 */
export const getModalComponent = (type: string): ModalRegistryEntry | null => {
  const component = modalRegistry[type];
  if (!component) {
    logger.warn(`[ModalRegistry] Modal type "${type}" not found in registry`);
    return null;
  }
  return component;
};

/**
 * Check Modal Registration
 *
 * Verifies whether a modal type is registered in the modal registry.
 * Useful for conditional rendering and validation logic.
 *
 * @param type - The modal type to check
 * @returns True if the modal is registered, false otherwise
 *
 * @example
 * ```typescript
 * if (isModalRegistered('victory')) {
 *   showModal('victory', { attempts: 3, coinsEarned: 50 });
 * }
 * ```
 */
export const isModalRegistered = (type: string): boolean => {
  return type in modalRegistry && typeof modalRegistry[type] === "function";
};
