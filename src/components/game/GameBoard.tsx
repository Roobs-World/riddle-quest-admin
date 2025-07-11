/**
 * @fileoverview GameBoard component - Main game display area for Qwordly riddle gameplay.
 *
 * This component serves as the primary game interface, orchestrating the display
 * of the riddle, guess grid, and keyboard. It follows the Single Responsibility
 * Principle by focusing solely on game board presentation while delegating
 * specific functionality to specialized child components.
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import React from "react";
import { View } from "react-native";
import RiddleText from "./RiddleText";
import GuessGrid from "./GuessGrid";
import Keyboard from "./Keyboard";
import { isTablet } from "../../utils/responsive";
import { styles } from "../../styles";
import QuestionsSvg from "../../../assets/images/questions.svg";

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
 * 1. **Riddle Container (20% height)**: Displays the riddle question with decorative SVG background
 * 2. **Guess Grid (36% height)**: Shows submitted guesses and current input
 * 3. **Keyboard (remaining height)**: Interactive letter input interface
 *
 * Visual Design:
 * - Fixed height percentages for consistent layout
 * - Decorative question mark SVG background for riddle area
 * - Responsive design with tablet-specific styling
 * - Proper z-index layering for visual hierarchy
 *
 * Features:
 * - Responsive layout supporting phones and tablets
 * - Keyboard visibility management based on overlay state
 * - Decorative SVG background for enhanced visual appeal
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
}) => {
  // Use onKeyPress as a fallback if handleKeyPress is not provided
  const keyPressHandler = handleKeyPress || onKeyPress || (() => {});

  return (
    <>
      {/* Riddle Display Container - 20% of screen height */}
      <View
        style={[
          styles.riddleContainer,
          isTablet && styles.riddleContainerTablet,
          {
            maxHeight: "20%",
            height: "20%",
            width: "100%",
            minHeight: "20%",
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        {/* Decorative Background SVG */}
        <QuestionsSvg
          width="90%"
          height="100%"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            top: "0%",
            zIndex: 0,
          }}
        />

        {/* Riddle Text Component */}
        <RiddleText riddleText={riddleText} />
      </View>

      {/* Guess Grid - Shows submitted guesses and current input */}
      <GuessGrid
        guesses={guesses}
        currentGuess={currentGuess}
        answerLength={answerLength}
        setTileRef={setTileRef}
      />

      {/* Interactive Keyboard - Hidden when overlays are visible */}
      <Keyboard
        submitKeyPress={keyPressHandler}
        handleBackspace={handleBackspace}
        isVisible={!isAnyOverlayVisible}
      />
    </>
  );
};

export default GameBoard;
