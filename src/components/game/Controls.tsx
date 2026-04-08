/**
 * @fileoverview Controls component for game progression actions in Qwordly.
 *
 * This component provides context-sensitive control buttons that appear based on
 * game state. Currently manages the "Next Level" button that appears after winning
 * a level, allowing players to progress to subsequent challenges.
 *
m * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import { SPACING, TYPOGRAPHY } from "../../styles";
import { scale } from "../../utils/responsive";

/**
 * Props interface for the Controls component.
 *
 * @property {() => void} onNextPress - Callback function for next level button press
 * @property {boolean} isWin - Whether the current level has been won
 */
interface ControlsProps {
  /** Function called when the "Next Level" button is pressed */
  onNextPress: () => void;

  /** Flag indicating if the current level has been won (shows next button) */
  isWin: boolean;
}

/**
 * Controls Component
 *
 * Provides context-sensitive control buttons for game progression. The component
 * currently displays a "Next Level" button that appears only after successfully
 * completing a level. This approach maintains a clean UI by only showing relevant
 * actions when they're needed.
 *
 * Visual Design:
 * - Center-aligned button layout
 * - Green success color for positive action
 * - Rounded corners for modern appearance
 * - Proper padding for comfortable touch targets
 *
 * Features:
 * - Conditional button display based on game state
 * - Success-themed styling for progression actions
 * - Accessible button implementation
 * - Responsive layout and spacing
 * - Clear visual hierarchy and feedback
 *
 * Game States:
 * - Game in progress: No buttons shown (clean gameplay)
 * - Game won: "Next Level" button appears for progression
 * - Future: Could support additional controls like "Retry" or "Menu"
 *
 * Usage Examples:
 * ```tsx
 * // During active gameplay (no controls shown)
 * <Controls onNextPress={handleNextLevel} isWin={false} />
 *
 * // After winning a level (shows next button)
 * <Controls onNextPress={advanceToNextLevel} isWin={true} />
 *
 * // In a game results screen
 * <Controls
 *   onNextPress={() => navigation.navigate('NextLevel')}
 *   isWin={gameState.isWon}
 * />
 * ```
 *
 * @param {ControlsProps} props - Component props
 * @returns {JSX.Element} Rendered controls container with context-appropriate buttons
 */
const Controls: React.FC<ControlsProps> = ({ onNextPress, isWin }) => {
  /** Determine if the next button should be visible based on win state */
  const isNextVisible = isWin;

  return (
    <View className="flex-row justify-center w-full" style={{ marginTop: SPACING.md }}>
      {/* Next Level Button - Only visible after winning */}
      {isNextVisible && (
        <TouchableOpacity
          className="bg-green-500 rounded-lg"
          style={{ padding: scale(12) }}
          onPress={onNextPress}
          accessibilityRole="button"
          accessibilityLabel="Next Level"
          accessibilityHint="Advance to the next level after completing this one"
        >
          <Text style={{ color: "white", fontFamily: TYPOGRAPHY.fontPrimary }}>Next Level</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default React.memo(Controls);
