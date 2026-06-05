/**
 * @fileoverview BackButton component for navigation in Riddle Quest app.
 *
 * This component provides a reusable back button that can either navigate to a
 * specific screen or go back to the previous screen in the navigation stack.
 * It uses an SVG icon and handles both targeted navigation and stack-based
 * navigation patterns.
 *
 * @author Riddle Quest Development Team
 * @version 1.0.0
 * @since 2024
 */

import React from "react";
import {TouchableOpacity} from "react-native";
import BackIcon from "@images/back-icon.svg";
import {NativeStackNavigationProp} from "@react-navigation/native-stack";
import {styles, SPACING} from "../../styles";
import {BACK_ICON_SIZE} from "../../constants/layout";
import {t} from "../../i18n";

/**
 * Props interface for the BackButton component.
 *
 * Supports both generic navigation behavior (going back) and specific
 * screen targeting for custom navigation flows.
 *
 * @template RootStackParamList - Generic type for navigation stack parameters
 * @property {NativeStackNavigationProp<RootStackParamList>} navigation - React Navigation prop for screen navigation
 * @property {keyof RootStackParamList} [targetScreen] - Optional specific screen to navigate to instead of going back
 */
interface BackButtonProps<RootStackParamList extends Record<string, object | undefined>> {
  /** React Navigation prop providing navigation methods and state */
  navigation: NativeStackNavigationProp<RootStackParamList>;

  /**
   * Optional target screen to navigate to. If provided, will navigate to this
   * specific screen instead of using the default back behavior.
   */
  targetScreen?: keyof RootStackParamList;
}

/**
 * BackButton Component
 *
 * A reusable navigation button that provides back functionality with flexible
 * navigation options. The button can either navigate to a specific screen or
 * use the default back navigation behavior.
 *
 * Features:
 * - SVG icon for consistent visual appearance
 * - Flexible navigation: targeted or stack-based
 * - Touch feedback with proper accessibility
 * - Consistent styling across the app
 *
 * Usage Examples:
 * ```tsx
 * // Standard back navigation
 * <BackButton navigation={navigation} />
 *
 * // Navigate to specific screen
 * <BackButton navigation={navigation} targetScreen="Home" />
 * ```
 *
 * @template RootStackParamList - Navigation stack parameter list type
 * @param {BackButtonProps<RootStackParamList>} props - Component props
 * @returns {JSX.Element} Rendered back button component
 */
const BackButton = <RootStackParamList extends Record<string, object | undefined>>({
  navigation,
  targetScreen,
}: BackButtonProps<RootStackParamList>) => {
  /**
   * Handles button press events with navigation logic.
   *
   * If a targetScreen is provided, navigates to that specific screen.
   * Otherwise, uses the default back navigation to return to the previous
   * screen in the navigation stack.
   */
  const handlePress = () => {
    if (targetScreen) {
      // Navigate to specific target screen
      navigation.navigate(targetScreen as never);
    } else {
      // Use standard back navigation
      navigation.goBack();
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[styles.backButton, {padding: SPACING.xs}]}
      accessibilityRole="button"
      accessibilityLabel={
        targetScreen
          ? `${t("Accessibility.NAVIGATE_TO_PREFIX")}${String(targetScreen)}`
          : t("Accessibility.GO_BACK")
      }
      accessibilityHint={t("Accessibility.BACK_BUTTON_HINT")}
    >
      <BackIcon width={BACK_ICON_SIZE} height={BACK_ICON_SIZE} />
    </TouchableOpacity>
  );
};

export default BackButton;
