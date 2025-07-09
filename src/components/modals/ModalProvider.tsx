import React from "react";
import { useModalContext } from "../../contexts/ModalContext";
import { Player } from "../../validation/firestoreSchemas";
import * as RNIap from "react-native-iap";

// Import modal components directly
import VictoryModal from "./game/VictoryModal";
import LossModal from "./game/LossModal";
import OutOfAttemptsModal from "./game/OutOfAttemptsModal";
import WatchAdForChanceModal from "./game/WatchAdForChanceModal";
import DailyChallengeCompletionModal from "./game/DailyChallengeCompletionModal";

import SettingsModal from "./settings/SettingsModal";
import FullProfileDetailsModal from "./settings/FullProfileDetailsModal";
import ChangePasswordModal from "./settings/ChangePasswordModal";
import UpdateUsernameModal from "./settings/UpdateUsernameModal";
import AvatarOptionsModal from "./settings/AvatarOptionsModal";
import PreloadedAvatarsModal from "./settings/PreloadedAvatarsModal";

import HintModal from "./help/HintModal";
import SkipModal from "./help/SkipModal";
import WelcomeModal from "./help/WelcomeModal";
import InstructionsModal from "./help/InstructionsModal";
import CreditsModal from "./help/CreditsModal";

import CoinShopModal from "../shop/CoinShopModal";

// Type definitions for modal data
interface VictoryModalData {
  attempts: number;
  coinsEarned: number;
  onNext: () => void;
  onHome: () => void;
}

interface LossModalData {
  correctAnswer: string;
  onNext: () => void;
  onHome: () => void;
}

interface OutOfAttemptsModalData {
  userCoins: number;
  continueCost: number;
  onWatchAd: () => void;
  onSpendCoins: () => void;
}

interface WatchAdForChanceModalData {
  onWatchAd: () => void;
}

interface DailyChallengeCompletionModalData {
  coinsEarned: number;
  questionsCompleted: number;
  onContinue: () => void;
  onHome: () => void;
}

interface SettingsModalData {
  isSoundEnabled: boolean;
  isHapticsEnabled: boolean;
  onToggleSound: () => void;
  onToggleHaptics: () => void;
  onPressLogout: () => void;
  onPressHelp: () => void;
  onPressCredits: () => void;
}

interface FullProfileDetailsModalData {
  playerData: Player | null;
}

interface UpdateUsernameModalData {
  currentUsername: string;
}

interface AvatarOptionsModalData {
  userId: string;
  onOpenPreloadedAvatars: () => void;
}

interface HintModalData {
  hintCost: number;
  userCoins: number;
  onShowHint: () => void;
}

interface SkipModalData {
  userCoins: number;
  skipCost: number;
  onSkipLevel: () => void;
}

interface CoinShopModalData {
  products: RNIap.Product[];
  loading: boolean;
  error: string | null;
  onPurchaseProduct: (productId: string) => void;
}

// Union type for all modal data
type ModalData =
  | VictoryModalData
  | LossModalData
  | OutOfAttemptsModalData
  | WatchAdForChanceModalData
  | DailyChallengeCompletionModalData
  | SettingsModalData
  | FullProfileDetailsModalData
  | UpdateUsernameModalData
  | AvatarOptionsModalData
  | HintModalData
  | SkipModalData
  | CoinShopModalData
  | Record<string, unknown>; // Fallback for other modal types

// Modal renderer component
const ModalRenderer: React.FC<{
  modalType: string;
  modalData: ModalData;
  onClose: () => void;
}> = ({ modalType, modalData, onClose }) => {
  const commonProps = {
    isVisible: true,
    onClose,
  };

  switch (modalType) {
    case "victory":
      return (
        <VictoryModal
          {...commonProps}
          attempts={(modalData as VictoryModalData).attempts}
          coinsEarned={(modalData as VictoryModalData).coinsEarned}
          onNextLevel={(modalData as VictoryModalData).onNext}
          onHome={(modalData as VictoryModalData).onHome}
          guesses={[]}
        />
      );

    case "loss":
      return (
        <LossModal
          {...commonProps}
          correctAnswer={(modalData as LossModalData).correctAnswer}
          onRetry={(modalData as LossModalData).onNext}
          onHome={(modalData as LossModalData).onHome}
        />
      );

    case "outOfAttempts":
      return (
        <OutOfAttemptsModal
          {...commonProps}
          userCoins={(modalData as OutOfAttemptsModalData).userCoins}
          continueCost={(modalData as OutOfAttemptsModalData).continueCost}
          onWatchAd={(modalData as OutOfAttemptsModalData).onWatchAd}
          onSpendCoins={(modalData as OutOfAttemptsModalData).onSpendCoins}
        />
      );

    case "watchAdForChance":
      return (
        <WatchAdForChanceModal
          visible={true}
          onClose={onClose}
          onWatchAd={(modalData as WatchAdForChanceModalData).onWatchAd}
        />
      );

    case "dailyChallengeCompletion":
      return (
        <DailyChallengeCompletionModal
          {...commonProps}
          totalCoinsEarned={
            (modalData as DailyChallengeCompletionModalData).coinsEarned
          }
          questionsCompleted={
            (modalData as DailyChallengeCompletionModalData).questionsCompleted
          }
          onContinue={
            (modalData as DailyChallengeCompletionModalData).onContinue
          }
          onHome={(modalData as DailyChallengeCompletionModalData).onHome}
        />
      );

    case "settings":
      return (
        <SettingsModal
          {...commonProps}
          isSoundEnabled={(modalData as SettingsModalData).isSoundEnabled}
          isHapticsEnabled={(modalData as SettingsModalData).isHapticsEnabled}
          onToggleSound={(modalData as SettingsModalData).onToggleSound}
          onToggleHaptics={(modalData as SettingsModalData).onToggleHaptics}
          onPressLogout={(modalData as SettingsModalData).onPressLogout}
          onPressHelp={(modalData as SettingsModalData).onPressHelp}
          onPressCredits={(modalData as SettingsModalData).onPressCredits}
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

    case "welcome":
      return <WelcomeModal {...commonProps} />;

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
        />
      );

    default:
      console.warn(`Unknown modal type: ${modalType}`);
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
