/**
 * @fileoverview GameBoard component - Main game display area for Riddle Quest riddle gameplay.
 *
 * This component serves as the primary game interface, orchestrating the display
 * of the riddle, guess grid, and keyboard. It follows the Single Responsibility
 * Principle by focusing solely on game board presentation while delegating
 * specific functionality to specialized child components.
 *
 * @author Riddle Quest Development Team
 * @version 1.0.0
 * @since 2024
 */

import React from "react";
import {View} from "react-native";
import RiddleText from "./RiddleText";
import GuessGrid from "./GuessGrid";
import Keyboard from "./Keyboard";
import {GAME_BOARD_VERTICAL_GAP, RIDDLE_CONTAINER_SLOT_HEIGHT} from "../../constants/layout";
import {isTablet, isLargeTablet} from "../../utils/responsive";
import {styles} from "../../styles";
import type {Feedback} from "../../hooks/types";

/**
 * Structure representing a submitted guess with feedback.
 *
 * @property {string[]} guess - Array of letters in the submitted guess
 * @property {("green" | "yellow" | "red")[]} feedback - Color feedback for each letter
 */
interface SubmittedGuess {
  /** Array of individual letters in the guess */
  guess: string[];

  /** Feedback array indicating correctness: green (correct), yellow (wrong position), red (incorrect) */
  feedback: ("green" | "yellow" | "red")[];
}

/**
 * Props interface for the GameBoard component.
 *
 * @property {string} riddleText - The riddle question text to display
 * @property {SubmittedGuess[]} guesses - Array of previously submitted guesses with feedback
 * @property {string[]} currentGuess - Current guess being typed by the user
 * @property {number} answerLength - Expected length of the answer
 * @property {() => void} handleBackspace - Function to handle backspace key press
 * @property {(key: string) => void} handleKeyPress - Function to handle letter key presses
 * @property {boolean} isAnyOverlayVisible - Whether any overlay (modal) is currently visible
 * @property {(rowIndex: number, cellIndex: number, ref: View | null) => void} setTileRef - Function to set refs for tiles
 * @property {object} animatedStyle - Style object for animations (for backward compatibility)
 * @property {(key: string) => void} onKeyPress - Alternative function to handle key presses (for backward compatibility)
 */
interface GameBoardProps {
  /** The riddle question text displayed to the player */
  riddleText: string;

  /** Array of previously submitted guesses with their color-coded feedback */
  guesses: SubmittedGuess[];

  /** The current guess being entered by the player (array of letters) */
  currentGuess: string[];

  /** The expected length of the correct answer */
  answerLength: number;

  /** Function called when the backspace key is pressed */
  handleBackspace: () => void;

  /** Function called when a letter key is pressed */
  handleKeyPress: (key: string) => void;

  /** Flag indicating if any overlay (modal) is currently visible */
  isAnyOverlayVisible: boolean;

  /** Function to set refs for tiles */
  setTileRef?: (rowIndex: number, cellIndex: number, ref: View | null) => void;

  /** Style object for animations (for backward compatibility) */
  animatedStyle?: object;

  /** Alternative function to handle key presses (for backward compatibility) */
  onKeyPress?: (key: string) => void;

  /** Best known feedback state per letter, passed to the keyboard for key colouring. */
  letterStates?: Record<string, Feedback>;

  /** Indices of positions revealed by hints in the current guess (shown as green). */
  hintRevealedIndices?: number[];

  /** Active slot index for the current guess row. */
  activeSlotIndex?: number;

  /** Selects the slot index in the current guess row for the next letter placement. */
  onSelectCurrentGuessSlot?: (slotIndex: number) => void;
}

/**
 * GameBoard Component
 *
 * The main game interface component that orchestrates the display of all game
 * elements. It maintains a clear separation of concerns by delegating specific
 * functionality to specialized child components while managing the overall
 * layout and responsive behavior.
 *
 * Layout Structure:
 * 1. **Riddle Container (20% height)**: Displays the riddle question
 * 2. **Guess Grid (36% height)**: Shows submitted guesses and current input
 * 3. **Keyboard (remaining height)**: Interactive letter input interface
 *
 * Visual Design:
 * - Fixed height percentages for consistent layout
 * - Responsive design with tablet-specific styling
 * - Proper z-index layering for visual hierarchy
 *
 * Features:
 * - Responsive layout supporting phones and tablets
 * - Keyboard visibility management based on overlay state
 * - Proper component composition following React best practices
 * - Fixed height sections for consistent user experience
 *
 * Component Architecture:
 * - **RiddleText**: Displays the riddle question with proper typography
 * - **GuessGrid**: Manages guess display and feedback visualization
 * - **Keyboard**: Handles user input and letter selection
 *
 * Accessibility:
 * - Proper keyboard navigation support
 * - Screen reader compatibility through child components
 * - Touch-friendly interface design
 *
 * Usage Example:
 * ```tsx
 * <GameBoard
 *   riddleText="What has keys but no locks?"
 *   guesses={previousGuesses}
 *   currentGuess={['p', 'i', 'a', 'n', 'o']}
 *   answerLength={5}
 *   handleBackspace={removeLastLetter}
 *   handleKeyPress={addLetterToGuess}
 *   isAnyOverlayVisible={modalOpen}
 * />
 * ```
 *
 * @param {GameBoardProps} props - Component props
 * @returns {JSX.Element} Complete game board with riddle, grid, and keyboard
 */
const GameBoard: React.FC<GameBoardProps> = ({
  riddleText,
  guesses,
  currentGuess,
  answerLength,
  handleBackspace,
  handleKeyPress,
  isAnyOverlayVisible,
  setTileRef,
  onKeyPress,
  letterStates,
  hintRevealedIndices,
  activeSlotIndex,
  onSelectCurrentGuessSlot,
}) => {
  // Use onKeyPress as a fallback if handleKeyPress is not provided
  const keyPressHandler = handleKeyPress || onKeyPress || (() => {});

  return (
    <View style={{flex: 1, width: "100%", alignItems: "center", justifyContent: "flex-start"}}>
      <View
        style={[
          styles.riddleContainer,
          isTablet && styles.riddleContainerTablet,
          isLargeTablet && styles.riddleContainerLargeTablet,
          {
            width: "100%",
            height: RIDDLE_CONTAINER_SLOT_HEIGHT,
            minHeight: RIDDLE_CONTAINER_SLOT_HEIGHT,
            maxHeight: RIDDLE_CONTAINER_SLOT_HEIGHT,
            justifyContent: "center",
            alignItems: "center",
            flexShrink: 0,
          },
        ]}
      >
        <RiddleText riddleText={riddleText} />
      </View>

      <View style={{height: GAME_BOARD_VERTICAL_GAP, minHeight: GAME_BOARD_VERTICAL_GAP, flexShrink: 0}} />

      <GuessGrid
        guesses={guesses}
        currentGuess={currentGuess}
        answerLength={answerLength}
        setTileRef={setTileRef}
        hintRevealedIndices={hintRevealedIndices}
        activeSlotIndex={activeSlotIndex}
        onSelectCurrentGuessSlot={onSelectCurrentGuessSlot}
      />

      <View style={{height: GAME_BOARD_VERTICAL_GAP, minHeight: GAME_BOARD_VERTICAL_GAP, flexShrink: 0}} />

      <Keyboard
        submitKeyPress={keyPressHandler}
        handleBackspace={handleBackspace}
        isVisible={!isAnyOverlayVisible}
        letterStates={letterStates}
      />
    </View>
  );
};

export default React.memo(GameBoard);
