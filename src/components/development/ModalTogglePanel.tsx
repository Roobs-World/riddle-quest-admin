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
import { scale, verticalScale } from "../../utils/responsive";
import { getFunctions, httpsCallable } from "@react-native-firebase/functions";
import { getApp } from "@react-native-firebase/app";
import { logger } from "../../utils/logger";
import { captureException } from "../../utils/sentry";

/**
 * Type for the updateModalData function
 */
type UpdateModalDataFn = (newData: Record<string, unknown>) => void;

/**
 * Extended Modal Data with server data fetching capability
 */
interface ExtendedModalData extends ModalData {
  __fetchServerData?: (updateFn: UpdateModalDataFn) => Promise<void>;
}

/**
 * Generate Mock Data for Modal Testing
 */
const generateMockData = (
  modalType: string,
  closeModalFn?: (type: string) => void
): ExtendedModalData => {
  const mockPlayer: Player = {
    userId: "test-user-123",
    username: "TestPlayer",
    email: "test@example.com",
    coins: 150,
    progress: {
      classicIndex: 25,
      dailyChallengeIndex: 10,
      dailyChallengeCurrentQuestion: 0,
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
      totalHintsUsed: 0,
    },
    avatarUrl: "https://example.com/avatar.jpg",
    createdAt: Date.now(),
    lastLogin: Date.now(),
    hasPurchasedApp: false,
    unlockedAchievements: [],
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
      id: "coin_pack_small",
      nameAndroid: "Small Coin Pack",
      platform: "android",
      price: 0.99,
      currency: "USD",
      displayPrice: "$0.99",
      title: "Small Coin Pack",
      description: "100 coins for hints and power-ups",
      type: "in-app",
    } as RNIap.ProductAndroid,
  ];

  switch (modalType) {
    case "victory":
      return {
        attempts: 3,
        coinsEarned: 50,
        guesses: mockGuesses,
        onNext: async () => {
          logger.debug("[VictoryModal Debug] Next level button pressed");
          // Close the modal first
          logger.debug("[VictoryModal Debug] Closing modal");
          if (closeModalFn) closeModalFn("victory");

          // Simulate navigation to next level - in debug mode, this just logs the action
          logger.debug(
            "[VictoryModal Debug] Would navigate to next level in real app"
          );

          // You could add additional logic here to actually load the next level
          // For example, if you have access to the navigation context:
          // const { onNextLevel } = useContext(GameContext);
          // if (onNextLevel) await onNextLevel();
        },
        onHome: () => {
          logger.debug("[VictoryModal Debug] Home button pressed");
          if (closeModalFn) closeModalFn("victory");
        },
      };
    case "loss":
      // We'll use an async IIFE to fetch the correct answer from the server
      return {
        correctAnswer: "FETCHING...", // Initial placeholder value
        onNext: async () => {
          logger.debug("[LossModal Debug] Next level button pressed");
          // Close the modal first
          logger.debug("[LossModal Debug] Closing modal");
          if (closeModalFn) closeModalFn("loss");

          // Simulate navigation to next level - in debug mode, this just logs the action
          logger.debug(
            "[LossModal Debug] Would navigate to next level in real app"
          );
        },
        onHome: () => {
          logger.debug("[LossModal Debug] Home button pressed");
          if (closeModalFn) closeModalFn("loss");
        },
        onClose: () => {
          logger.debug("[LossModal Debug] Close button pressed");
          if (closeModalFn) closeModalFn("loss");
        },
        // This property allows the ModalRenderer to know this modal needs server data
        __fetchServerData: async (updateModalData: UpdateModalDataFn) => {
          try {
            logger.debug(
              "[LossModal Debug] Fetching correct answer from server"
            );

            // Use a test riddle ID that should exist in your database
            const testRiddleId = "daily_riddle_1"; // Replace with a valid riddle ID from your database

            // Call the Firebase Function directly
            const submitGuessCallable = httpsCallable(
              getFunctions(getApp()),
              "submitGuess"
            );
            const result = await submitGuessCallable({
              guess: "wrong", // Intentionally wrong guess to get the correct answer
              riddleId: testRiddleId,
              gameMode: "classic",
              attempts: 3, // Final attempt
            });

            // Extract the correct answer from the response
            const { correctAnswer } = result.data as {
              correctAnswer?: string;
              isCorrect: boolean;
            };

            logger.debug(
              `[LossModal Debug] Server returned answer: ${correctAnswer}`
            );

            // Update the modal data with the correct answer
            if (correctAnswer && updateModalData) {
              updateModalData({ correctAnswer });
            }
          } catch (error) {
            logger.error(
              "[LossModal Debug] Error fetching correct answer:",
              error
            );
            captureException(error);
            // If there's an error, use a fallback answer
            if (updateModalData) {
              updateModalData({ correctAnswer: "ANSWER" });
            }
          }
        },
      };
    // outOfAttempts and watchAdForChance cases removed - using loss modal instead
    // dailyChallengeCompletion case removed - using victory modal instead
    case "settings":
      return {
        isSoundEnabled: true,
        isHapticsEnabled: false,
        onToggleSound: (enabled: boolean) => logger.debug("Sound:", enabled),
        onToggleHaptics: (enabled: boolean) => logger.debug("Haptics:", enabled),
        onPressLogout: () => logger.debug("Logout pressed"),
        onPressHelp: () => logger.debug("Help pressed"),
        onPressCredits: () => logger.debug("Credits pressed"),
      };
    case "fullProfileDetails":
      return { playerData: mockPlayer };
    case "changePassword":
      return { onPasswordChanged: () => logger.debug("Password changed") };
    case "updateUsername":
      return {
        currentUsername: "TestPlayer",
        onUsernameUpdated: (username: string) =>
          logger.debug("Username:", username),
      };
    case "avatarOptions":
      return {
        userId: "test-user-123",
        onAvatarSelected: (url: string) => logger.debug("Avatar:", url),
        onOpenPreloadedAvatars: () => logger.debug("Open preloaded avatars"),
      };
    case "preloadedAvatars":
      return {
        onAvatarSelected: (url: string) =>
          logger.debug("Preloaded avatar:", url),
        onCloseAvatarOptions: () => logger.debug("Close avatar options"),
      };
    case "hint":
      return {
        userCoins: 100,
        hintCost: 20,
        onShowHint: () => logger.debug("Show hint pressed"),
      };
    case "skip":
      return {
        userCoins: 100,
        skipCost: 50,
        onSkipLevel: () => logger.debug("Skip level pressed"),
      };
    case "coinShop":
      return {
        products: mockProducts,
        onPurchaseProduct: (productId: string) =>
          logger.debug("Purchase:", productId),
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
  const [modalToggles, setModalToggles] = useState<{
    [key: string]: boolean | Record<string, unknown>;
  }>({});

  // CRITICAL: Only render in development builds
  if (!__DEV__) {
    logger.warn("ModalTogglePanel should not be used in production builds");
    return null;
  }

  const modalTypes = Object.keys(modalRegistry);

  /**
   * Toggle Modal Visibility
   */
  const toggleModal = (modalType: string, isVisible: boolean) => {
    setModalToggles((prev) => {
      const updatedToggles = { ...prev };
      updatedToggles[modalType] = isVisible;
      return updatedToggles;
    });
  };

  /**
   * Close Modal
   */
  const closeModal = (modalType: string) => {
    setModalToggles((prev) => {
      const updatedToggles = { ...prev };
      updatedToggles[modalType] = false;
      return updatedToggles;
    });
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

      // Check if this modal needs to fetch server data
      if (
        mockData.__fetchServerData &&
        typeof mockData.__fetchServerData === "function"
      ) {
        // Create a function to update modal data
        const updateModalData: UpdateModalDataFn = (newData) => {
          logger.debug(`Updating modal data for ${modalType}:`, newData);
          // Re-render the modal with updated data
          setModalToggles((prev) => {
            const updatedToggles = { ...prev };
            updatedToggles[modalType] = false; // First close the modal
            return updatedToggles;
          });

          // Then re-open it with updated data
          setTimeout(() => {
            setModalToggles((prev) => {
              const updatedToggles = { ...prev };
              updatedToggles[modalType] = true; // Re-open the modal
              updatedToggles[`${modalType}_data`] = newData; // Store the updated data
              return updatedToggles;
            });
          }, 100);
        };

        // Call the fetch function
        mockData.__fetchServerData(updateModalData);

        // Remove the __fetchServerData property before passing to the component
        delete mockData.__fetchServerData;
      }

      // Check if we have stored updated data for this modal
      const updatedData = modalToggles[`${modalType}_data`] as
        | Record<string, unknown>
        | undefined;
      if (updatedData) {
        // Merge the updated data with the mock data
        Object.assign(mockData, updatedData);
      }

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
        value={Boolean(modalToggles[modalType])}
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
    maxHeight: verticalScale(400),
    minWidth: scale(200),
    position: "absolute",
    right: scale(10),
    top: verticalScale(100),
    zIndex: 9999,
  },
  content: {
    maxHeight: verticalScale(300),
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

export default React.memo(ModalTogglePanel);
