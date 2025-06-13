import React from "react";
import {
  HintModal,
  ProfileModal,
  SettingsModal,
  InstructionsModal,
  WelcomeModal,
  FullProfileDetailsModal,
  WatchAdForChanceModal,
} from "../modals";
import CoinShopModal from "../shop/CoinShopModal";

interface GameOverlaysProps {
  // Hint Overlay
  isHintOverlayVisible: boolean;
  onHintClose: () => void;
  onShowHint: () => void;
  hintCost: number;
  userCoins: number;

  // Profile Overlay
  isProfileOverlayVisible: boolean;
  onProfileClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerData: any; // Using any to avoid complex type mismatch for now
  onFullProfilePress: () => void;

  // Settings Overlay
  isSettingsOverlayVisible: boolean;
  onSettingsClose: () => void;
  isSoundEnabled: boolean;
  isHapticsEnabled: boolean;
  onToggleSound: (enabled: boolean) => void;
  onToggleHaptics: (enabled: boolean) => void;
  onPressLogout: () => void;
  onPressHelp: () => void;
  onPressCredits: () => void;

  // Instructions Overlay
  isInstructionsVisible: boolean;
  onCloseInstructions: () => void;

  // Welcome Overlay
  isWelcomeOverlayVisible: boolean;
  onWelcomeClose: () => void;

  // Full Profile Details Overlay
  isFullProfileDetailsOverlayVisible: boolean;
  onCloseFullProfileDetailsOverlay: () => void;

  // Coin Shop Modal
  isCoinShopModalVisible: boolean;
  onCloseCoinShopModal: () => void;
  onPurchaseProduct: (productId: string) => void;

  // Watch Ad Modal
  isWatchAdModalVisible: boolean;
  onWatchAdAccepted: () => void;
  onWatchAdDeclined: () => void;

  // Home/Play Overlays
  onCloseHomeOverlay: () => void;
  onClosePlayOverlay: () => void;
}

const GameOverlays: React.FC<GameOverlaysProps> = ({
  // Hint Overlay
  isHintOverlayVisible,
  onHintClose,
  onShowHint,
  hintCost,
  userCoins,

  // Profile Overlay
  isProfileOverlayVisible,
  onProfileClose,
  playerData,
  onFullProfilePress,

  // Settings Overlay
  isSettingsOverlayVisible,
  onSettingsClose,
  isSoundEnabled,
  isHapticsEnabled,
  onToggleSound,
  onToggleHaptics,
  onPressLogout,
  onPressHelp,
  onPressCredits,

  // Instructions Overlay
  isInstructionsVisible,
  onCloseInstructions,

  // Welcome Overlay
  isWelcomeOverlayVisible,
  onWelcomeClose,

  // Full Profile Details Overlay
  isFullProfileDetailsOverlayVisible,
  onCloseFullProfileDetailsOverlay,

  // Coin Shop Modal
  isCoinShopModalVisible,
  onCloseCoinShopModal,
  onPurchaseProduct,

  // Watch Ad Modal
  isWatchAdModalVisible,
  onWatchAdAccepted,
  onWatchAdDeclined,
}) => {
  return (
    <>
      {/* Hint Modal */}
      <HintModal
        isVisible={isHintOverlayVisible}
        onClose={onHintClose}
        onShowHint={onShowHint}
        hintCost={hintCost}
        userCoins={userCoins}
      />

      <ProfileModal
        isVisible={isProfileOverlayVisible}
        onClose={onProfileClose}
        playerData={playerData}
        onFullProfilePress={onFullProfilePress}
      />

      <SettingsModal
        isVisible={isSettingsOverlayVisible}
        onClose={onSettingsClose}
        isSoundEnabled={isSoundEnabled}
        isHapticsEnabled={isHapticsEnabled}
        onToggleSound={onToggleSound}
        onToggleHaptics={onToggleHaptics}
        onPressLogout={onPressLogout}
        onPressHelp={onPressHelp}
        onPressCredits={onPressCredits}
      />

      <InstructionsModal
        isVisible={isInstructionsVisible}
        onClose={onCloseInstructions}
      />

      <WelcomeModal
        isVisible={isWelcomeOverlayVisible}
        onClose={onWelcomeClose}
      />

      <FullProfileDetailsModal
        isVisible={isFullProfileDetailsOverlayVisible}
        onClose={onCloseFullProfileDetailsOverlay}
        playerData={playerData}
      />

      <CoinShopModal
        isVisible={isCoinShopModalVisible}
        onClose={onCloseCoinShopModal}
        products={[]}
        loading={false}
        error={null}
        onPurchaseProduct={onPurchaseProduct}
      />

      {/* Watch Ad Modal */}
      {isWatchAdModalVisible && (
        <WatchAdForChanceModal
          visible={isWatchAdModalVisible}
          onWatchAd={onWatchAdAccepted}
          onClose={onWatchAdDeclined}
        />
      )}
    </>
  );
};

export default GameOverlays;
