/**
 * @fileoverview ModalProvider component - Central modal management system for Qwordly.
 *
 * This component serves as the central orchestrator for all modal dialogs in the
 * application. It provides a unified system for displaying game modals, settings
 * modals, help modals, and shop modals through a context-based architecture.
 * The provider handles modal state management, data passing, and modal rendering
 * with proper TypeScript type safety.
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import React from "react";
import { useModalContext } from "../../contexts/ModalContext";
import { Player } from "../../validation/firestoreSchemas";
import * as RNIap from "react-native-iap";

// Import modal components directly
import VictoryModal from "./game/VictoryModal";
import LossModal from "./game/LossModal";
import GameModeModal from "./game/GameModeModal";
// Note: OutOfAttemptsModal, WatchAdForChanceModal, and DailyChallengeCompletionModal have been removed

import FullProfileDetailsModal from "./settings/FullProfileDetailsModal";
import ChangePasswordModal from "./settings/ChangePasswordModal";
import UpdateUsernameModal from "./settings/UpdateUsernameModal";
import AvatarOptionsModal from "./settings/AvatarOptionsModal";
import PreloadedAvatarsModal from "./settings/PreloadedAvatarsModal";
import SettingsModal from "./settings/SettingsModal";
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
import { logger } from "../../utils/logger";

/**
 * Type definitions for modal-specific data structures.
 * Each modal type has its own data interface to ensure type safety
 * and proper prop passing when rendering modals.
 */

/**
 * Data structure for victory modal when player wins a riddle.
 *
 * @property {number} attempts - Number of attempts taken to solve
 * @property {number} coinsEarned - Coins awarded for solving the riddle
 * @property {() => void} onNext - Callback to proceed to next level
 * @property {() => void} onHome - Callback to return to home screen
 */
interface VictoryModalData {
  attempts: number;
  coinsEarned: number;
  guesses: import("../../hooks/types").SubmittedGuess[];
  onNext: () => void;
  onHome: () => void;
}

/**
 * Data structure for loss modal when player fails to solve a riddle.
 *
 * @property {string} correctAnswer - The correct answer to show player
 * @property {() => void} onNext - Callback to go to next level
 * @property {() => void} onHome - Callback to return to home screen
 */
interface LossModalData {
  correctAnswer: string;
  onNext: () => void;
  onHome: () => void;
}

/**
 * Data structure for game mode selection modal.
 *
 * @property {(mode: "classic" | "daily") => void} onSelectMode - Callback when a mode is selected
 * @property {number} [currentLevel] - Optional current level for display in classic mode
 */
interface GameModeModalData {
  onSelectMode: (mode: "classic" | "daily") => void;
  currentLevel?: number;
}

/**
 * Data structure for settings modal with game preferences.
 *
 * @property {boolean} isSoundEnabled - Current sound setting state
 * @property {boolean} isHapticsEnabled - Current haptics setting state
 * @property {() => void} onToggleSound - Callback to toggle sound on/off
 * @property {() => void} onToggleHaptics - Callback to toggle haptics on/off
 * @property {() => void} onPressLogout - Callback to initiate logout
 * @property {() => void} onPressHelp - Callback to open help section
 * @property {() => void} onPressCredits - Callback to open credits
 */
interface SettingsModalData {
  isSoundEnabled: boolean;
  isHapticsEnabled: boolean;
  isHardMode: boolean;
  onToggleSound: (isEnabled: boolean) => void;
  onToggleHaptics: (isEnabled: boolean) => void;
  onToggleHardMode: (isEnabled: boolean) => void;
  onPressLogout: () => void;
  onPressHelp: () => void;
  onPressCredits: () => void;
  playerData?: import("../../validation/firestoreSchemas").Player | null;
}

/**
 * Data structure for full profile details modal.
 *
 * @property {Player | null} playerData - Complete player data object
 */
interface FullProfileDetailsModalData {
  playerData: Player | null;
}

/**
 * Data structure for username update modal.
 *
 * @property {string} currentUsername - Player's current username
 */
interface UpdateUsernameModalData {
  currentUsername: string;
}

/**
 * Data structure for avatar options modal.
 *
 * @property {string} userId - Player's unique user ID
 * @property {() => void} onOpenPreloadedAvatars - Callback to open avatar gallery
 */
interface AvatarOptionsModalData {
  userId: string;
  onOpenPreloadedAvatars: () => void;
}

/**
 * Data structure for hint modal.
 *
 * @property {number} hintCost - Cost in coins for the hint
 * @property {number} userCoins - Player's current coin balance
 * @property {() => void} onShowHint - Callback to purchase and show hint
 */
interface InfoModalData {
  title: string;
  message: string;
  onConfirm?: () => void;
}

interface HintModalData {
  hintCost: number;
  userCoins: number;
  onShowHint: () => void;
}

/**
 * Data structure for skip level modal.
 *
 * @property {number} userCoins - Player's current coin balance
 * @property {number} skipCost - Cost in coins to skip the level
 * @property {() => void} onSkipLevel - Callback to skip current level
 */
interface SkipModalData {
  userCoins: number;
  skipCost: number;
  onSkipLevel: () => void;
}

/**
 * Data structure for coin shop modal with IAP products.
 *
 * @property {RNIap.Product[]} products - Available in-app purchase products
 * @property {boolean} loading - Loading state for product fetching
 * @property {string | null} error - Error message if product loading fails
 * @property {(productId: string) => void} onPurchaseProduct - Callback to purchase product
 */
interface CoinShopModalData {
  products: RNIap.Product[];
  loading: boolean;
  error: string | null;
  onPurchaseProduct: (productId: string) => void;
  onWatchVideo?: () => void;
  onPayAndPlay?: () => void;
}

/**
 * Union type combining all possible modal data structures.
 * Includes a fallback type for extensibility and unknown modal types.
 */
type ModalData =
  | VictoryModalData
  | LossModalData
  | GameModeModalData
  | SettingsModalData
  | FullProfileDetailsModalData
  | UpdateUsernameModalData
  | AvatarOptionsModalData
  | InfoModalData
  | HintModalData
  | SkipModalData
  | CoinShopModalData
  | Record<string, unknown>; // Fallback for other modal types

/**
 * ModalRenderer Component
 *
 * Internal component responsible for rendering the appropriate modal based on
 * the modal type and data. It acts as a switch statement to instantiate the
 * correct modal component with properly typed props.
 *
 * @param {Object} props - Modal renderer props
 * @param {string} props.modalType - Type identifier for the modal to render
 * @param {ModalData} props.modalData - Data to pass to the modal component
 * @param {() => void} props.onClose - Callback to close the modal
 * @returns {JSX.Element} The rendered modal component
 */
const ModalRenderer: React.FC<{
  modalType: string;
  modalData: ModalData;
  onClose: () => void;
}> = ({ modalType, modalData, onClose }) => {
  /** Common props shared by all modal components */
  const commonProps = {
    isVisible: true,
    onClose,
  };

  switch (modalType) {
    case "victory": {
      logger.debug("Rendering VictoryModal with data:", {
        attempts: (modalData as VictoryModalData).attempts,
        coinsEarned: (modalData as VictoryModalData).coinsEarned,
        onNext: typeof (modalData as VictoryModalData).onNext === "function",
        onHome: typeof (modalData as VictoryModalData).onHome === "function",
        guessesLength: ((modalData as VictoryModalData).guesses || []).length,
        onClose: typeof onClose === "function",
      });

      // Debug the onNext function
      const onNextFn = (modalData as VictoryModalData).onNext;
      logger.debug("VictoryModal onNext function details:", {
        isDefined: !!onNextFn,
        type: typeof onNextFn,
        functionToString: onNextFn
          ? onNextFn.toString().substring(0, 100) + "..."
          : "undefined",
      });

      return (
        <VictoryModal
          {...commonProps}
          attempts={(modalData as VictoryModalData).attempts}
          coinsEarned={(modalData as VictoryModalData).coinsEarned}
          onNextLevel={(modalData as VictoryModalData).onNext}
          onHome={(modalData as VictoryModalData).onHome}
          guesses={(modalData as VictoryModalData).guesses || []}
          onClose={onClose}
        />
      );
    }

    case "loss":
      return (
        <LossModal
          {...commonProps}
          correctAnswer={(modalData as LossModalData).correctAnswer}
          onNext={(modalData as LossModalData).onNext}
          onHome={(modalData as LossModalData).onHome}
          onClose={onClose}
        />
      );

    case "gameMode":
      return (
        <GameModeModal
          {...commonProps}
          onSelectMode={(modalData as GameModeModalData).onSelectMode}
        />
      );

    case "settings":
      return (
        <SettingsModal
          {...commonProps}
          isSoundEnabled={(modalData as SettingsModalData).isSoundEnabled}
          isHapticsEnabled={(modalData as SettingsModalData).isHapticsEnabled}
          isHardMode={(modalData as SettingsModalData).isHardMode ?? false}
          onToggleSound={(modalData as SettingsModalData).onToggleSound}
          onToggleHaptics={(modalData as SettingsModalData).onToggleHaptics}
          onToggleHardMode={(modalData as SettingsModalData).onToggleHardMode ?? (() => {})}
          onPressLogout={(modalData as SettingsModalData).onPressLogout}
          onPressHelp={(modalData as SettingsModalData).onPressHelp}
          onPressCredits={(modalData as SettingsModalData).onPressCredits}
          playerData={(modalData as SettingsModalData).playerData ?? null}
        />
      );

    case "fullProfileDetails":
      return (
        <FullProfileDetailsModal
          {...commonProps}
          playerData={(modalData as FullProfileDetailsModalData).playerData}
        />
      );

    case "changePassword":
      return <ChangePasswordModal {...commonProps} />;

    case "updateUsername":
      return (
        <UpdateUsernameModal
          {...commonProps}
          currentUsername={
            (modalData as UpdateUsernameModalData).currentUsername
          }
        />
      );

    case "avatarOptions":
      return (
        <AvatarOptionsModal
          {...commonProps}
          onOpenPreloadedAvatars={
            (modalData as AvatarOptionsModalData).onOpenPreloadedAvatars
          }
          userId={(modalData as AvatarOptionsModalData).userId}
        />
      );

    case "preloadedAvatars":
      return (
        <PreloadedAvatarsModal
          {...commonProps}
          onCloseAvatarOptions={onClose}
        />
      );

    case "info": {
      const infoData = modalData as InfoModalData;
      const handleInfoClose = () => {
        if (infoData.onConfirm) infoData.onConfirm();
        onClose();
      };
      return (
        <InfoModal
          isVisible={true}
          title={infoData.title}
          message={infoData.message}
          onClose={handleInfoClose}
        />
      );
    }

    case "hint":
      return (
        <HintModal
          {...commonProps}
          hintCost={(modalData as HintModalData).hintCost}
          userCoins={(modalData as HintModalData).userCoins}
          onShowHint={(modalData as HintModalData).onShowHint}
        />
      );

    case "skip":
      return (
        <SkipModal
          {...commonProps}
          userCoins={(modalData as SkipModalData).userCoins}
          skipCost={(modalData as SkipModalData).skipCost}
          onSkipLevel={(modalData as SkipModalData).onSkipLevel}
        />
      );

    case "welcome": {
      const welcomeData = modalData as {
        onStartTutorial?: () => void;
        showStartTutorial?: boolean;
      };
      return (
        <WelcomeModal
          {...commonProps}
          onStartTutorial={welcomeData.onStartTutorial}
          showStartTutorial={welcomeData.showStartTutorial}
        />
      );
    }

    case "instructions":
      return <InstructionsModal {...commonProps} />;

    case "credits":
      return <CreditsModal {...commonProps} />;

    case "coinShop":
      return (
        <CoinShopModal
          {...commonProps}
          products={(modalData as CoinShopModalData).products || []}
          loading={(modalData as CoinShopModalData).loading || false}
          error={(modalData as CoinShopModalData).error || null}
          onPurchaseProduct={(modalData as CoinShopModalData).onPurchaseProduct}
          onWatchVideo={(modalData as CoinShopModalData).onWatchVideo}
          onPayAndPlay={(modalData as CoinShopModalData).onPayAndPlay}
        />
      );

    case "achievements":
      return (
        <AchievementsModal
          {...commonProps}
          playerData={(modalData as { playerData: Player | null }).playerData ?? null}
        />
      );

    case "stats":
      return (
        <StatsModal
          {...commonProps}
          playerData={(modalData as { playerData: Player | null }).playerData ?? null}
        />
      );

    case "leaderboard":
      return (
        <LeaderboardModal
          {...commonProps}
          currentUserId={(modalData as { currentUserId: string | null }).currentUserId ?? null}
        />
      );

    default:
      logger.warn(`Unknown modal type: ${modalType}`);
      return null;
  }
};

// Main ModalProvider component
export const ModalProvider: React.FC = () => {
  const { modals, closeModal } = useModalContext();

  return (
    <>
      {modals.map((modal) => (
        <ModalRenderer
          key={modal.id}
          modalType={modal.type}
          modalData={modal.data}
          onClose={() => closeModal(modal.id)}
        />
      ))}
    </>
  );
};

export default ModalProvider;
