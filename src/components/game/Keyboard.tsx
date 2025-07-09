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

import React, { useRef } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import BackspaceIcon from "../icons/BackspaceIcon";
import { scale, moderateScale } from "../../utils/responsive";
import { gameStyles } from "../../styles";

/**
 * Props interface for the Keyboard component.
 *
 * @property {(key: string) => void} submitKeyPress - Function called when a letter key is pressed
 * @property {() => void} handleBackspace - Function called when backspace is pressed
 * @property {boolean} isVisible - Whether the keyboard should be visible/interactive
 */
interface KeyboardProps {
  /** Function called when any letter key is pressed with the letter as parameter */
  submitKeyPress: (key: string) => void;

  /** Function called when the backspace key is pressed */
  handleBackspace: () => void;

  /** Flag controlling keyboard visibility (currently not used but available for future features) */
  isVisible: boolean;
}

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
const Keyboard: React.FC<KeyboardProps> = ({
  submitKeyPress,
  handleBackspace,
}) => {
  /** Standard QWERTY keyboard layout definition */
  const topRow = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
  const midRow = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
  const bottomRow = ["z", "x", "c", "v", "b", "n", "m"];

  /** Refs for keyboard container and individual keys (for potential future enhancements) */
  const keyboardRef = useRef<View>(null);
  const keyRefs = useRef<{ [key: string]: View | null }>({});

  /** Responsive styling calculations based on screen size */
  const keyHeight = scale(36);
  const keyWidth = scale(35);
  const keyMargin = scale(1.65);
  const fontSize = moderateScale(18);

  return (
    <View ref={keyboardRef} style={gameStyles.keyboardContainer}>
      {/* Main keyboard layout container */}
      <View style={gameStyles.keyboardLayer}>
        {/* Top Row - QWERTYUIOP */}
        <View style={gameStyles.keyboardRow}>
          {topRow.map((key) => (
            <TouchableOpacity
              key={key}
              ref={(ref) => {
                keyRefs.current[key] = ref;
              }}
              style={[
                gameStyles.keyButton,
                {
                  borderRadius: scale(6),
                  height: keyHeight,
                  width: keyWidth,
                  margin: keyMargin,
                },
              ]}
              onPressIn={() => submitKeyPress(key)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Letter ${key.toUpperCase()}`}
            >
              <Text
                style={[
                  gameStyles.keyText,
                  {
                    fontSize,
                  },
                ]}
              >
                {key}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Middle Row - ASDFGHJKL with traditional QWERTY offset */}
        <View
          style={[
            gameStyles.keyboardRow,
            {
              marginBottom: scale(5),
            },
          ]}
        >
          {/* Left spacing for QWERTY offset */}
          <View style={{ width: scale(16) }} />
          {midRow.map((key) => (
            <TouchableOpacity
              key={key}
              ref={(ref) => {
                keyRefs.current[key] = ref;
              }}
              style={[
                gameStyles.keyButton,
                {
                  borderRadius: scale(6),
                  height: keyHeight,
                  width: keyWidth,
                  margin: keyMargin,
                },
              ]}
              onPressIn={() => submitKeyPress(key)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Letter ${key.toUpperCase()}`}
            >
              <Text
                style={[
                  gameStyles.keyText,
                  {
                    fontSize,
                  },
                ]}
              >
                {key}
              </Text>
            </TouchableOpacity>
          ))}
          {/* Right spacing for QWERTY balance */}
          <View style={{ width: scale(16) }} />
        </View>

        {/* Bottom Row - ZXCVBNM + Backspace Key */}
        <View style={gameStyles.keyboardRow}>
          {/* Left spacing to center the shorter bottom row */}
          <View style={{ width: scale(48) }} />
          {bottomRow.map((key) => (
            <TouchableOpacity
              key={key}
              ref={(ref) => {
                keyRefs.current[key] = ref;
              }}
              className="rounded-full"
              style={[
                gameStyles.keyButton,
                {
                  borderRadius: scale(6),
                  height: keyHeight,
                  width: keyWidth,
                  margin: keyMargin,
                },
              ]}
              onPressIn={() => submitKeyPress(key)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Letter ${key.toUpperCase()}`}
            >
              <Text
                style={[
                  gameStyles.keyText,
                  {
                    fontSize,
                  },
                ]}
              >
                {key}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Backspace Key with Icon */}
          <TouchableOpacity
            key="delete"
            ref={(ref) => {
              keyRefs.current["DELETE"] = ref;
            }}
            style={{
              height: keyHeight,
              width: scale(48),
              margin: keyMargin,
            }}
            onPressIn={() => handleBackspace()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Backspace"
            accessibilityHint="Delete the last entered letter"
          >
            <BackspaceIcon />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default Keyboard;
