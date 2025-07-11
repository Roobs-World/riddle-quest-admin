/**
 * @fileoverview Modal Toggle Panel
 *
 * Simple development tool for testing modals with boolean toggles.
 * Provides a floating panel with switches to turn modals on/off instantly.
 *
 * **Features:**
 * - Boolean toggle switches for each modal
 * - Floating overlay that doesn't interfere with app flow
 * - Collapsible interface to save screen space
 * - Mock data generation for realistic testing
 *
 * **Usage:**
 * ```tsx
 * // DEVELOPMENT ONLY - Add to any screen for testing
 * {__DEV__ && <ModalTogglePanel />}
 *
 * // Component automatically prevents rendering in production builds
 * ```
 *
 * **⚠️ IMPORTANT: This component is for development only and will not render in production builds.**
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
  StyleSheet,
} from "react-native";
import { modalRegistry, getModalComponent } from "../modals/ModalRegistry";
import { ModalData } from "../../types/ModalTypes";
import { SubmittedGuess } from "../../hooks/types";
import { Player } from "../../validation/firestoreSchemas";
import * as RNIap from "react-native-iap";
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from "../../styles";

/**
 * Modal Toggle State Interface
 */
interface ModalToggleState {
  [key: string]: boolean;
}

/**
 * Generate Mock Data for Modal Testing
 */
const generateMockData = (
  modalType: string,
  closeModalFn?: (type: string) => void
): ModalData => {
  const mockPlayer: Player = {
    userId: "test-user-123",
    username: "TestPlayer",
    email: "test@example.com",
    coins: 150,
    progress: {
      classicIndex: 25,
      dailyChallengeIndex: 10,
      tutorialIndex: 5,
    },
    stats: {
      gamesPlayed: 100,
      wins: 75,
      totalScore: 2500,
      bestStreak: 10,
      winStreak: 3,
      averageGuesses: 3.2,
      dailyPuzzlesCompleted: 15,
      totalWordsGuessed: 300,
      winRate: 0.75,
      highestLevelClassic: 25,
      challengeWins: 10,
      totalWins: 75,
      totalGuessesInWins: 240,
    },
    avatarUrl: "https://example.com/avatar.jpg",
    createdAt: Date.now(),
    lastLogin: Date.now(),
    hasPurchasedApp: false,
  };

  const mockGuesses: SubmittedGuess[] = [
    {
      guess: ["H", "O", "U", "S", "E"],
      feedback: ["green", "green", "yellow", "red", "green"],
    },
    {
      guess: ["H", "O", "R", "S", "E"],
      feedback: ["green", "green", "red", "yellow", "green"],
    },
    {
      guess: ["M", "O", "U", "S", "E"],
      feedback: ["red", "green", "green", "yellow", "green"],
    },
  ];

  const mockProducts: RNIap.Product[] = [
    {
      productId: "coin_pack_small",
      price: "$0.99",
      currency: "USD",
      localizedPrice: "$0.99",
      title: "Small Coin Pack",
      description: "100 coins for hints and power-ups",
      type: "iap",
    },
  ];

  const commonCallbacks = {
    onNext: () => console.log(`[${modalType}] Next pressed`),
    onHome: () => console.log(`[${modalType}] Home pressed`),
    onClose: () => console.log(`[${modalType}] Close pressed`),
  };

  switch (modalType) {
    case "victory":
      return {
        attempts: 3,
        coinsEarned: 50,
        guesses: mockGuesses,
        onNext: async () => {
          console.log("[VictoryModal Debug] Next level button pressed");
          // Close the modal first
          console.log("[VictoryModal Debug] Closing modal");
          if (closeModalFn) closeModalFn("victory");

          // Simulate navigation to next level - in debug mode, this just logs the action
          console.log(
            "[VictoryModal Debug] Would navigate to next level in real app"
          );

          // You could add additional logic here to actually load the next level
          // For example, if you have access to the navigation context:
          // const { onNextLevel } = useContext(GameContext);
          // if (onNextLevel) await onNextLevel();
        },
        onHome: () => {
          console.log("[VictoryModal Debug] Home button pressed");
          if (closeModalFn) closeModalFn("victory");
        },
      };
    case "loss":
      return { correctAnswer: "MOUSE", ...commonCallbacks };
    case "outOfAttempts":
      return {
        userCoins: 75,
        continueCost: 25,
        onWatchAd: () => console.log("Watch ad pressed"),
        onSpendCoins: () => console.log("Spend coins pressed"),
      };
    case "watchAdForChance":
      return { onWatchAd: () => console.log("Watch ad for chance pressed") };
    case "dailyChallengeCompletion":
      return {
        questionsCompleted: 4,
        totalQuestions: 5,
        coinsEarned: 80,
        ...commonCallbacks,
      };
    case "settings":
      return {
        isSoundEnabled: true,
        isHapticsEnabled: false,
        onToggleSound: (enabled: boolean) => console.log("Sound:", enabled),
        onToggleHaptics: (enabled: boolean) => console.log("Haptics:", enabled),
        onPressLogout: () => console.log("Logout pressed"),
        onPressHelp: () => console.log("Help pressed"),
        onPressCredits: () => console.log("Credits pressed"),
      };
    case "fullProfileDetails":
      return { playerData: mockPlayer };
    case "changePassword":
      return { onPasswordChanged: () => console.log("Password changed") };
    case "updateUsername":
      return {
        currentUsername: "TestPlayer",
        onUsernameUpdated: (username: string) =>
          console.log("Username:", username),
      };
    case "avatarOptions":
      return {
        userId: "test-user-123",
        onAvatarSelected: (url: string) => console.log("Avatar:", url),
        onOpenPreloadedAvatars: () => console.log("Open preloaded avatars"),
      };
    case "preloadedAvatars":
      return {
        onAvatarSelected: (url: string) =>
          console.log("Preloaded avatar:", url),
        onCloseAvatarOptions: () => console.log("Close avatar options"),
      };
    case "hint":
      return {
        userCoins: 100,
        hintCost: 20,
        onShowHint: () => console.log("Show hint pressed"),
      };
    case "skip":
      return {
        userCoins: 100,
        skipCost: 50,
        onSkipLevel: () => console.log("Skip level pressed"),
      };
    case "coinShop":
      return {
        products: mockProducts,
        onPurchaseProduct: (productId: string) =>
          console.log("Purchase:", productId),
        loading: false,
        error: null,
      };
    default:
      return {};
  }
};

/**
 * Modal Toggle Panel Component
 */
const ModalTogglePanel: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [modalToggles, setModalToggles] = useState<ModalToggleState>({});

  // CRITICAL: Only render in development builds
  if (!__DEV__) {
    console.warn("ModalTogglePanel should not be used in production builds");
    return null;
  }

  const modalTypes = Object.keys(modalRegistry);

  /**
   * Toggle Modal Visibility
   */
  const toggleModal = (modalType: string, isVisible: boolean) => {
    setModalToggles((prev) => ({
      ...prev,
      [modalType]: isVisible,
    }));
  };

  /**
   * Close Modal
   */
  const closeModal = (modalType: string) => {
    setModalToggles((prev) => ({
      ...prev,
      [modalType]: false,
    }));
  };

  /**
   * Render Active Modals
   */
  const renderActiveModals = () => {
    return modalTypes.map((modalType) => {
      if (!modalToggles[modalType]) return null;

      const ModalComponent = getModalComponent(modalType);
      if (!ModalComponent) return null;

      const mockData = generateMockData(modalType, closeModal);

      return (
        <ModalComponent
          key={modalType}
          isVisible={true}
          onClose={() => closeModal(modalType)}
          {...mockData}
        />
      );
    });
  };

  /**
   * Render Toggle Switch
   */
  const renderToggleSwitch = (modalType: string) => (
    <View key={modalType} style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>
        {modalType.charAt(0).toUpperCase() + modalType.slice(1)}
      </Text>
      <Switch
        value={modalToggles[modalType] || false}
        onValueChange={(value) => toggleModal(modalType, value)}
        trackColor={{ false: COLORS.gray300, true: COLORS.primaryOrange }}
        thumbColor={modalToggles[modalType] ? COLORS.white : COLORS.gray400}
      />
    </View>
  );

  return (
    <>
      {/* Floating Toggle Panel */}
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.header}
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <Text style={styles.headerTitle}>
            🔧 Modal Testing {isExpanded ? "▼" : "▶"}
          </Text>
        </TouchableOpacity>

        {isExpanded && (
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {modalTypes.map(renderToggleSwitch)}

            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setModalToggles({})}
            >
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      {/* Render Active Modals */}
      {renderActiveModals()}
    </>
  );
};

/**
 * Component Styles
 */
const styles = StyleSheet.create({
  clearButton: {
    alignItems: "center",
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.sm,
    padding: SPACING.xs,
  },
  clearButtonText: {
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontSecondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "600",
  },
  container: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.gray300,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    elevation: 10,
    maxHeight: 400,
    minWidth: 200,
    position: "absolute",
    right: 10,
    top: 100,
    zIndex: 9999,
  },
  content: {
    maxHeight: 300,
    padding: SPACING.sm,
  },
  header: {
    backgroundColor: COLORS.primaryOrange,
    borderTopLeftRadius: BORDER_RADIUS.md,
    borderTopRightRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  headerTitle: {
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontSecondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "600",
  },
  toggleLabel: {
    color: COLORS.textPrimary,
    flex: 1,
    fontFamily: TYPOGRAPHY.fontSecondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  toggleRow: {
    alignItems: "center",
    borderBottomColor: COLORS.gray200,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: SPACING.xs,
  },
});

export default ModalTogglePanel;
