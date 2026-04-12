/**
 * @fileoverview Keyboard component - Interactive on-screen keyboard for Qwordly gameplay.
 *
 * This component provides a customizable QWERTY keyboard layout optimized for
 * mobile game input. It handles letter input and backspace functionality with
 * responsive sizing, visual feedback, and proper touch interactions. The keyboard
 * follows standard QWERTY layout with three rows and includes a backspace key.
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, LayoutChangeEvent } from "react-native";
import BackspaceIcon from "../icons/BackspaceIcon";
import { gameStyles, TYPOGRAPHY } from "../../styles";
import {
  KEYBOARD_KEY_HEIGHT,
  KEYBOARD_KEY_MARGIN,
  KEYBOARD_KEY_BORDER_RADIUS,
  KEYBOARD_MID_ROW_MARGIN_BOTTOM,
  KEYBOARD_ROW_SPACER,
  KEYBOARD_BOTTOM_OFFSET,
} from "../../constants/layout";
import { dimensions } from "../../utils/responsive";
import type { Feedback } from "../../hooks/types";
import { AppStrings } from "../../constants/AppStrings";

/** QWERTY keyboard layout — defined at module scope so they are never reallocated */
const TOP_ROW = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
const MID_ROW = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
const BOTTOM_ROW = ["z", "x", "c", "v", "b", "n", "m"];

/**
 * Props interface for the Keyboard component.
 *
 * @property {(key: string) => void} submitKeyPress - Function called when a letter key is pressed
 * @property {() => void} handleBackspace - Function called when backspace is pressed
 * @property {boolean} isVisible - Whether the keyboard should be visible/interactive
 * @property {(key: string) => void} onKeyPress - Alternative function for key press (for backward compatibility)
 */
interface KeyboardProps {
  /** Function called when any letter key is pressed with the letter as parameter */
  submitKeyPress: (key: string) => void;

  /** Function called when the backspace key is pressed */
  handleBackspace: () => void;

  /** Flag controlling keyboard visibility (currently not used but available for future features) */
  isVisible: boolean;

  /** Alternative function for key press (for backward compatibility) */
  onKeyPress?: (key: string) => void;

  /** Best known feedback state per letter, derived from submitted guesses. */
  letterStates?: Record<string, Feedback>;
}

/** Returns background/text colours for a keyboard key based on its feedback state. */
const getKeyColors = (
  state: Feedback | undefined
): { bg: string; text: string } => {
  switch (state) {
    case "green":
      return { bg: "#22C55E", text: "#FFFFFF" };
    case "yellow":
      return { bg: "#EAB308", text: "#FFFFFF" };
    case "red":
      return { bg: "rgba(90,90,90,0.65)", text: "#BBBBBB" };
    default:
      return { bg: "transparent", text: "#FFFFFF" };
  }
};

/**
 * Keyboard Component
 *
 * An interactive on-screen keyboard component designed specifically for mobile
 * game input. The keyboard provides a standard QWERTY layout with responsive
 * sizing and visual feedback optimized for touch interactions.
 *
 * Layout Structure:
 * - **Top Row**: Q W E R T Y U I O P (10 keys)
 * - **Middle Row**: A S D F G H J K L (9 keys, offset for traditional QWERTY feel)
 * - **Bottom Row**: Z X C V B N M + Backspace (7 letters + 1 action key)
 *
 * Visual Design:
 * - Responsive key sizing based on screen dimensions
 * - Consistent spacing and margins between keys
 * - Rounded key corners for modern appearance
 * - Visual press feedback with opacity changes
 * - Proper key grouping and alignment
 *
 * Features:
 * - Standard QWERTY layout familiar to users
 * - Responsive design adapting to different screen sizes
 * - Visual press feedback for better user experience
 * - Backspace functionality with custom icon
 * - Ref-based key tracking for potential future enhancements
 * - Optimized touch targets for mobile interaction
 *
 * Technical Implementation:
 * - Uses refs for individual key tracking
 * - Responsive sizing with scale utilities
 * - Custom game styles for consistent theming
 * - Touch-optimized interaction areas
 * - Proper keyboard row alignment and spacing
 *
 * Accessibility:
 * - Touch-friendly key sizes
 * - Visual feedback on key presses
 * - Clear key distinction and spacing
 * - Standard keyboard layout for familiarity
 *
 * Usage Examples:
 * ```tsx
 * // Basic keyboard for game input
 * <Keyboard
 *   submitKeyPress={(letter) => addToGuess(letter)}
 *   handleBackspace={() => removeLastLetter()}
 *   isVisible={true}
 * />
 *
 * // Keyboard in game context
 * <Keyboard
 *   submitKeyPress={handleLetterInput}
 *   handleBackspace={handleLetterDelete}
 *   isVisible={!isModalOpen}
 * />
 * ```
 *
 * @param {KeyboardProps} props - Component props
 * @returns {JSX.Element} Interactive on-screen keyboard with QWERTY layout
 */

/** Number of keys in the widest (top) row — used to compute key width. */
const TOP_ROW_KEY_COUNT = TOP_ROW.length; // 10

const Keyboard: React.FC<KeyboardProps> = React.memo(function Keyboard({
  submitKeyPress,
  handleBackspace,
  isVisible = true,
  onKeyPress,
  letterStates,
}) {
  const fontSize = TYPOGRAPHY.fontSize.lg;

  // Track the actual rendered container width so keys never overflow the x axis.
  const [containerWidth, setContainerWidth] = useState(dimensions.screenWidth);
  const onContainerLayout = useCallback(
    (e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width),
    []
  );

  // Key width derived from container width so the top row (10 keys) always fits.
  const keyWidth = Math.floor(
    containerWidth / TOP_ROW_KEY_COUNT - 2 * KEYBOARD_KEY_MARGIN
  );

  // Use onKeyPress as a fallback if submitKeyPress is not provided
  const keyPressHandler = submitKeyPress || onKeyPress || (() => {});

  if (!isVisible) {
    return null;
  }

  const renderKey = (key: string) => {
    const { bg, text } = getKeyColors(letterStates?.[key]);
    return (
      <TouchableOpacity
        key={key}
        style={[
          gameStyles.keyButton,
          {
            borderRadius: KEYBOARD_KEY_BORDER_RADIUS,
            height: KEYBOARD_KEY_HEIGHT,
            width: keyWidth,
            margin: KEYBOARD_KEY_MARGIN,
            backgroundColor: bg,
          },
        ]}
        onPressIn={() => keyPressHandler(key)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${AppStrings.Accessibility.LETTER_PREFIX}${key.toUpperCase()}`}
      >
        <Text
          style={[
            gameStyles.keyText,
            { fontSize, color: text },
          ]}
        >
          {key}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={gameStyles.keyboardContainer} onLayout={onContainerLayout}>
      {/* Main keyboard layout container */}
      <View style={gameStyles.keyboardLayer}>
        {/* Top Row - QWERTYUIOP */}
        <View style={gameStyles.keyboardRow}>
          {TOP_ROW.map(renderKey)}
        </View>

        {/* Middle Row - ASDFGHJKL with traditional QWERTY offset */}
        <View
          style={[
            gameStyles.keyboardRow,
            {
              marginBottom: KEYBOARD_MID_ROW_MARGIN_BOTTOM,
            },
          ]}
        >
          {/* Left spacing for QWERTY offset */}
          <View style={{ width: KEYBOARD_ROW_SPACER }} />
          {MID_ROW.map(renderKey)}
          {/* Right spacing for QWERTY balance */}
          <View style={{ width: KEYBOARD_ROW_SPACER }} />
        </View>

        {/* Bottom Row - ZXCVBNM + Backspace Key */}
        <View style={gameStyles.keyboardRow}>
          {/* Left spacing to center the shorter bottom row */}
          <View style={{ width: KEYBOARD_BOTTOM_OFFSET }} />
          {BOTTOM_ROW.map(renderKey)}

          {/* Backspace Key with Icon */}
          <TouchableOpacity
            key="delete"
            style={{
              height: KEYBOARD_KEY_HEIGHT,
              width: KEYBOARD_BOTTOM_OFFSET,
              margin: KEYBOARD_KEY_MARGIN,
            }}
            onPressIn={() => handleBackspace()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={AppStrings.Accessibility.BACKSPACE}
            accessibilityHint={AppStrings.Accessibility.DELETE_LAST_LETTER}
          >
            <BackspaceIcon />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

export default Keyboard;

