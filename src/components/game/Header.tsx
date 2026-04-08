/**
 * @fileoverview
 * Game header component showing the Qwordly logo, coin balance, and optional
 * tutorial progress indicator.
 *
 * This header is used at the top of the main `GameScreen` and is responsible
 * for providing quick access to the coin shop as well as surfacing tutorial
 * context when the user is in guided onboarding.
 */
import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import CoinsDisplay from "./CoinsDisplay";
import LogoIcon from "../icons/LogoIcon";
import { TYPOGRAPHY, SPACING } from "../../styles";
import { HEADER_LOGO_SIZE } from "../../constants/layout";

/**
 * Props for the Header component.
 * @property {number} userCoins - The current user's coin balance.
 * @property {() => void} onCoinsPress - Function to call when the coins are pressed (opens shop).
 * @property {() => void} onHintPress - Function to call when the hint button is pressed.
 * @property {boolean} isTutorial - When true, shows "Tutorial" and step indicator in the center.
 * @property {number} tutorialStep - 1-based current tutorial step (only when isTutorial).
 * @property {number} tutorialTotalSteps - Total tutorial steps for "Step X of Y" (optional).
 */
interface HeaderProps {
  userCoins: number;
  onCoinsPress: () => void;
  onHintPress?: () => void;
  isTutorial?: boolean;
  tutorialStep?: number;
  tutorialTotalSteps?: number;
}

/**
 * Header component for the main game screen.
 *
 * Renders the Qwordly logo, current coin balance, and — when in tutorial
 * mode — a centered label and step indicator (e.g. "Step 2 of 5"). Callers
 * are expected to wire `onCoinsPress` to open the coin shop and may use
 * `onHintPress` for future logo interactions.
 *
 * @param props Props controlling coin display and optional tutorial UI.
 */
const Header: React.FC<HeaderProps> = ({
  userCoins,
  onCoinsPress,
  onHintPress,
  isTutorial = false,
  tutorialStep = 1,
  tutorialTotalSteps,
}) => {
  const showTutorialCues = isTutorial && tutorialStep >= 1;

  return (
    <View
      className="w-full flex-row items-center justify-between relative"
      style={{
        minHeight: "8%",
        maxHeight: "8%",
        height: "8%",
        paddingHorizontal: SPACING.md,
      }}
      testID="header"
      accessible={true}
      accessibilityRole="none"
      accessibilityLabel={
        showTutorialCues
          ? `Tutorial step ${tutorialStep} of ${tutorialTotalSteps ?? "?"}`
          : "Game header with logo and coin balance"
      }
    >
      {/* Logo Icon in top-left corner - positioned absolutely like CloseButton */}
      <View
        style={{ position: "absolute", top: SPACING.md, left: SPACING.md, zIndex: 10 }}
        testID="header-left-side"
      >
        <TouchableOpacity
          className="items-center"
          testID="logo-button"
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="logo"
          onPress={onHintPress}
        >
          <LogoIcon width={HEADER_LOGO_SIZE} height={HEADER_LOGO_SIZE} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Center: Tutorial label and step indicator when in tutorial mode */}
      {showTutorialCues && (
        <View
          className="absolute left-0 right-0 items-center justify-center z-0"
          style={{ top: SPACING.xs }}
          testID="header-tutorial-cues"
        >
          <Text
            style={{
              fontFamily: TYPOGRAPHY.fontPrimary,
              fontSize: TYPOGRAPHY.fontSize.sm,
              color: "#ffffff",
            }}
            testID="header-tutorial-label"
          >
            Tutorial
          </Text>
          <Text
            style={{
              fontFamily: TYPOGRAPHY.fontSecondary,
              fontSize: TYPOGRAPHY.fontSize.xs,
              color: "rgba(255,255,255,0.9)",
            }}
            testID="header-tutorial-step-text"
          >
            {tutorialTotalSteps != null && tutorialTotalSteps > 0
              ? `Step ${tutorialStep} of ${tutorialTotalSteps}`
              : `Step ${tutorialStep}`}
          </Text>
        </View>
      )}

      {/* Right side: Coins */}
      <View
        style={{ position: "absolute", top: SPACING.md, right: SPACING.md, zIndex: 10 }}
        testID="header-right-side"
      >
        <CoinsDisplay coins={userCoins} onPress={onCoinsPress} />
      </View>
    </View>
  );
};

export default React.memo(Header);
