/**
 * @fileoverview BottomNavigationBar component for game screen navigation in Qwordly.
 *
 * This component provides a fixed bottom navigation bar with three main actions:
 * profile access, hint functionality, and settings access. It's designed to be
 * always visible during gameplay to provide quick access to essential game features.
 * The component uses SVG icons and maintains consistent spacing and accessibility.
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import React from "react";
import { View, TouchableOpacity } from "react-native";
import ProfileIcon from "../icons/ProfileIcon";
import SettingsIcon from "../icons/SettingsIcon";
import LetsPlayIcon from "../../../assets/images/lets-play.svg";

/**
 * Type definition for overlay types that can be triggered from the navigation bar.
 * Currently supports profile and settings overlays.
 */
export type OverlayType = "profile" | "settings";

/**
 * Props interface for the BottomNavigationBar component.
 *
 * All callback functions are required to ensure proper navigation functionality.
 * Each function corresponds to a specific navigation action available in the bar.
 *
 * @property {() => void} onProfilePress - Callback for profile icon press
 * @property {() => void} onSettingsPress - Callback for settings icon press
 * @property {() => void} onHintPress - Callback for hint button press
 */
interface BottomNavigationBarProps {
  /** Function called when the Profile icon is pressed - opens user profile overlay */
  onProfilePress: () => void;

  /** Function called when the Settings icon is pressed - opens settings overlay */
  onSettingsPress: () => void;

  /** Function called when the Hint button (center) is pressed - shows gameplay hint */
  onChangeGameModePress: () => void;
}

/**
 * BottomNavigationBar Component
 *
 * A fixed-position navigation bar displayed at the bottom of the game screen.
 * Provides quick access to three key game features: profile, hints, and settings.
 * The component maintains a consistent height and responsive design across devices.
 *
 * Layout Structure:
 * - Left: Profile icon (user's profile and statistics)
 * - Center: Hint button (gameplay assistance)
 * - Right: Settings icon (game configuration)
 *
 * Visual Design:
 * - Fixed 10% screen height with white background
 * - Horizontal layout with space-between distribution
 * - Padding for comfortable touch targets
 * - Margin adjustments for balanced spacing
 *
 * Features:
 * - Three-button navigation layout
 * - SVG icons for crisp rendering
 * - Proper touch target sizing
 * - Accessibility support with roles and labels
 * - Test ID support for automated testing
 * - Responsive spacing and sizing
 *
 * Accessibility:
 * - Button roles for all interactive elements
 * - Descriptive accessibility labels
 * - Proper touch target sizes (44pt minimum)
 * - Screen reader support
 *
 * Usage Example:
 * ```tsx
 * <BottomNavigationBar
 *   onProfilePress={() => setOverlay('profile')}
 *   onSettingsPress={() => setOverlay('settings')}
 *   onChangeGameModePress={() => onChangeGameModePress()}
 * />
 * ```
 *
 * @param {BottomNavigationBarProps} props - Navigation callback functions
 * @returns {JSX.Element} Rendered bottom navigation bar with three action buttons
 */
const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({
  onProfilePress,
  onSettingsPress,
  onChangeGameModePress,
}) => {
  return (
    <View
      className="flex-row justify-between items-center bg-white px-4 w-full"
      style={{
        height: "10%",
        minHeight: "10%",
        maxHeight: "10%",
      }}
    >
      {/* Left Side - Profile Button */}
      <TouchableOpacity
        className="ml-10"
        onPress={() => onProfilePress()}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        accessibilityHint="View your profile, statistics, and game progress"
      >
        <ProfileIcon />
      </TouchableOpacity>

      {/* Center - Hint Button */}
      <TouchableOpacity
        onPress={() => onChangeGameModePress()}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Show hint"
        accessibilityHint="Get a hint for the current riddle. Costs 50 coins."
      >
        <LetsPlayIcon />
      </TouchableOpacity>

      {/* Right Side - Settings Button */}
      <TouchableOpacity
        className="mr-10"
        onPress={() => onSettingsPress()}
        testID="settings-button"
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        accessibilityHint="Access game settings, sound options, and account management"
      >
        <SettingsIcon />
      </TouchableOpacity>
    </View>
  );
};

export default BottomNavigationBar;
