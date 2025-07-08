import React from "react";
import { useModalContext } from "../../contexts/ModalContext";

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

import CoinShopModal from "../shop/CoinShopModal";

// Modal renderer component
const ModalRenderer: React.FC<{
  modalType: string;
  modalData: any;
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
          attempts={modalData.attempts}
          coinsEarned={modalData.coinsEarned}
          onNextLevel={modalData.onNext}
          onHome={modalData.onHome}
          guesses={[]}
        />
      );

    case "loss":
      return (
        <LossModal
          {...commonProps}
          correctAnswer={modalData.correctAnswer}
          onRetry={modalData.onNext}
          onHome={modalData.onHome}
        />
      );

    case "outOfAttempts":
      return (
        <OutOfAttemptsModal
          {...commonProps}
          userCoins={modalData.userCoins}
          continueCost={modalData.continueCost}
          onWatchAd={modalData.onWatchAd}
          onSpendCoins={modalData.onSpendCoins}
        />
      );

    case "watchAdForChance":
      return (
        <WatchAdForChanceModal
          isVisible={true}
          onClose={onClose}
          onWatchAd={modalData.onWatchAd}
        />
      );

    case "dailyChallengeCompletion":
      return (
        <DailyChallengeCompletionModal
          {...commonProps}
          totalCoinsEarned={modalData.coinsEarned}
          questionsCompleted={modalData.questionsCompleted}
          onContinue={modalData.onContinue}
          onHome={modalData.onHome}
        />
      );

    case "settings":
      return (
        <SettingsModal
          {...commonProps}
          isSoundEnabled={modalData.isSoundEnabled}
          isHapticsEnabled={modalData.isHapticsEnabled}
          onToggleSound={modalData.onToggleSound}
          onToggleHaptics={modalData.onToggleHaptics}
          onPressLogout={modalData.onPressLogout}
          onPressHelp={modalData.onPressHelp}
          onPressCredits={modalData.onPressCredits}
        />
      );

    case "fullProfileDetails":
      return (
        <FullProfileDetailsModal
          {...commonProps}
          playerData={modalData.playerData}
        />
      );

    case "changePassword":
      return (
        <ChangePasswordModal
          {...commonProps}
          onPasswordChanged={modalData.onPasswordChanged}
        />
      );

    case "updateUsername":
      return (
        <UpdateUsernameModal
          {...commonProps}
          currentUsername={modalData.currentUsername}
          onUsernameUpdated={modalData.onUsernameUpdated}
        />
      );

    case "avatarOptions":
      return (
        <AvatarOptionsModal
          {...commonProps}
          onAvatarSelected={modalData.onAvatarSelected}
          onOpenPreloadedAvatars={() => {}}
          userId=""
        />
      );

    case "preloadedAvatars":
      return (
        <PreloadedAvatarsModal
          {...commonProps}
          onAvatarSelected={modalData.onAvatarSelected}
          onCloseAvatarOptions={onClose}
        />
      );

    case "hint":
      return (
        <HintModal
          {...commonProps}
          hintCost={modalData.hintCost}
          userCoins={modalData.userCoins}
          onShowHint={modalData.onShowHint}
        />
      );

    case "skip":
      return (
        <SkipModal
          {...commonProps}
          userCoins={modalData.userCoins}
          skipCost={modalData.skipCost}
          onShowHint={modalData.onShowHint}
        />
      );

    case "welcome":
      return <WelcomeModal {...commonProps} />;

    case "instructions":
      return <InstructionsModal {...commonProps} />;

    case "coinShop":
      return (
        <CoinShopModal
          {...commonProps}
          products={modalData.products || []}
          loading={modalData.loading || false}
          error={modalData.error || null}
          onPurchaseProduct={modalData.onPurchaseProduct}
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
