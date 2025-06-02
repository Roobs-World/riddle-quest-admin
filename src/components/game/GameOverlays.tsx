import React from "react";
import { View } from "react-native";
import HintOverlay from "./HintOverlay";
import ProfileOverlay from "./ProfileOverlay";
import SettingsOverlay from "./SettingsOverlay";
import InstructionsOverlay from "./InstructionsOverlay";
import WelcomeOverlay from "./WelcomeOverlay";
import VictoryLossOverlay from "./VictoryLossOverlay";
import FullProfileDetailsOverlay from "../../screens/main/FullProfileDetailsOverlay";
import CoinShopModal from "../shop/CoinShopModal";
import WatchAdForChanceModal from "../modals/WatchAdForChanceModal";
import HomeOverlay from "./HomeOverlay";
import PlayOverlay from "./PlayOverlay";
import { styles } from "../../styles";

interface SubmittedGuess {
  guess: string[];
  feedback: ("green" | "yellow" | "red")[];
}

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

  // Instructions Overlay
  isInstructionsVisible: boolean;
  onCloseInstructions: () => void;

  // Welcome Overlay
  isWelcomeOverlayVisible: boolean;
  onWelcomeClose: () => void;

  // Victory/Loss Overlay
  gameOver: boolean;
  overlayOutcome: "win" | "loss" | null;
  overlayAttempts: number;
  overlayCorrectAnswer: string | null;
  overlayCoinsEarned: number | null;
  guesses: SubmittedGuess[];
  onOverlayNext: () => void;
  onOverlayRetry: () => void;

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

  // Instructions Overlay
  isInstructionsVisible,
  onCloseInstructions,

  // Welcome Overlay
  isWelcomeOverlayVisible,
  onWelcomeClose,

  // Victory/Loss Overlay
  gameOver,
  overlayOutcome,
  overlayAttempts,
  overlayCorrectAnswer,
  overlayCoinsEarned,
  guesses,
  onOverlayNext,
  onOverlayRetry,

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

  // Home/Play Overlays
  onCloseHomeOverlay,
  onClosePlayOverlay,
}) => {
  return (
    <>
      {/* Victory/Loss Overlays */}
      {gameOver && overlayOutcome === "win" && (
        <View style={styles.overlayContainer}>
          <VictoryLossOverlay
            isVisible={gameOver && overlayOutcome === "win"}
            outcome="win"
            attempts={overlayAttempts}
            correctAnswer={overlayCorrectAnswer}
            coinsEarned={overlayCoinsEarned || 0}
            guesses={guesses}
            onNext={onOverlayNext}
            onRetry={onOverlayRetry}
            onHome={() => {}}
          />
        </View>
      )}

      {gameOver && overlayOutcome === "loss" && (
        <View style={styles.overlayContainer}>
          <VictoryLossOverlay
            isVisible={gameOver && overlayOutcome === "loss"}
            outcome="loss"
            attempts={overlayAttempts}
            correctAnswer={overlayCorrectAnswer}
            coinsEarned={0}
            guesses={guesses}
            onNext={onOverlayNext}
            onRetry={onOverlayRetry}
            onHome={() => {}}
          />
        </View>
      )}

      {/* Hint Overlay */}
      <HintOverlay
        isVisible={isHintOverlayVisible}
        onClose={onHintClose}
        onShowHint={onShowHint}
        hintCost={hintCost}
        userCoins={userCoins}
      />

      {/* Other Overlays */}
      <HomeOverlay isVisible={false} onClose={onCloseHomeOverlay} />
      <PlayOverlay isVisible={false} onClose={onClosePlayOverlay} />

      <ProfileOverlay
        isVisible={isProfileOverlayVisible}
        onClose={onProfileClose}
        playerData={playerData}
        onFullProfilePress={onFullProfilePress}
      />

      <SettingsOverlay
        isVisible={isSettingsOverlayVisible}
        onClose={onSettingsClose}
        isSoundEnabled={isSoundEnabled}
        isHapticsEnabled={isHapticsEnabled}
        onToggleSound={onToggleSound}
        onToggleHaptics={onToggleHaptics}
        onPressLogout={onPressLogout}
        onPressHelp={onPressHelp}
      />

      <InstructionsOverlay
        isVisible={isInstructionsVisible}
        onClose={onCloseInstructions}
      />

      <WelcomeOverlay
        isVisible={isWelcomeOverlayVisible}
        onClose={onWelcomeClose}
      />

      <FullProfileDetailsOverlay
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
