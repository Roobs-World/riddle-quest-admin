import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  withSequence,
  withTiming,
  withSpring,
} from "react-native-reanimated";

import type { SubmittedGuess, Feedback } from "../../hooks/types"; // Import Feedback type from types.ts
import { useTileCapture } from "../../hooks/useTileCapture";
import ShatteringTiles from "../animations/ShatteringTiles";
import { scale } from "../../utils/responsive";

// Define TileData interface to match the one used in ShatteringTiles
interface TileData {
  letter: string | null;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  x: number; // Absolute position
  y: number; // Absolute position
}

/**
 * Define the structure for the entire guess grid.
 * @property {SubmittedGuess[]} guesses - An array of submitted guesses with their feedback.
 * @property {string[]} currentGuess - The letters of the current guess being entered by the user.
 * @property {number} answerLength - The length of the answer.
 * @property {number} shakeKey - Added shakeKey prop
 * @property {(rowIndex: number, cellIndex: number, ref: View | null) => void} setTileRef - Optional callback to set tile refs for animation capture
 */
type GuessGridProps = {
  guesses: SubmittedGuess[]; // Now accepts SubmittedGuess[]
  currentGuess: string[];
  shakeKey: number; // Added shakeKey prop
  answerLength: number; // Add answerLength prop
  setTileRef?: (rowIndex: number, cellIndex: number, ref: View | null) => void; // Optional tile ref setter
};

/**
 * The component that displays the guess grid for the Wordle-style game.
 * It shows submitted guesses with feedback and the current guess being entered.
 *
 * @param {GuessGridProps} props - The props for the component.
 * @returns {React.FC<GuessGridProps>} The rendered GuessGrid component.
 */
const GuessGrid: React.FC<GuessGridProps> = ({
  guesses,
  currentGuess,
  shakeKey,
  answerLength,
  setTileRef,
}) => {
  const previousGuessCountRef = useRef(guesses.length);

  // Responsive sizes
  const TILE_SIZE = scale(56); // Base size 56px
  const TILE_MARGIN = scale(2); // Base margin 2px
  const ROW_HEIGHT = TILE_SIZE + TILE_MARGIN * 2 + scale(4); // Tile + margins + mb-1 (4px)
  const SLIDE_DISTANCE = ROW_HEIGHT * 2; // Distance to slide rows up
  const ANIMATION_DURATION = 800; // Duration of slide animation
  const SHATTER_THRESHOLD = -40; // Y position where top row should shatter (when going under question)

  // Tile capture system for shattering animation
  const { setTileRef: setInternalTileRef, captureTiles } = useTileCapture();
  const [shatteringTiles, setShatteringTiles] = useState<TileData[]>([]);
  const [shouldStartShattering, setShouldStartShattering] = useState(false);
  const [topRowShattering, setTopRowShattering] = useState(false);

  // Animation shared values for each row (create outside of useRef)
  const row0TranslateY = useSharedValue(0);
  const row0Opacity = useSharedValue(1);
  const row1TranslateY = useSharedValue(0);
  const row1Opacity = useSharedValue(1);
  const row2TranslateY = useSharedValue(0);
  const row2Opacity = useSharedValue(1);

  const rowAnimations = useRef([
    { translateY: row0TranslateY, opacity: row0Opacity },
    { translateY: row1TranslateY, opacity: row1Opacity },
    { translateY: row2TranslateY, opacity: row2Opacity },
  ]).current;

  // Combine submitted guesses and the current guess for display
  const displayRows: { letters: (string | null)[]; feedback: Feedback[] }[] =
    guesses.map((sg) => ({ letters: sg.guess, feedback: sg.feedback }));

  // Add the current guess to the next available row if there are less than 3 submitted guesses
  if (displayRows.length < 3) {
    const currentRowLetters: (string | null)[] = Array(answerLength).fill(null);
    currentGuess.forEach((letter, index) => {
      currentRowLetters[index] = letter;
    });
    // For the current guess row, feedback is null for all cells initially
    const currentRowFeedback: Feedback[] = Array(answerLength).fill(null);
    displayRows.push({
      letters: currentRowLetters,
      feedback: currentRowFeedback,
    });
  }

  // Fill the remaining rows with empty cells up to 3 rows
  while (displayRows.length < 3) {
    displayRows.push({
      letters: Array(answerLength).fill(null),
      feedback: Array(answerLength).fill(null),
    });
  }

  // Animation shared value for shaking
  const shakeAnimation = useSharedValue(0);

  // Function to capture top row tiles for shattering
  const captureTopRowForShattering = useCallback(async () => {
    try {
      // Only capture if top row has content and has feedback (completed guess)
      const topRow = displayRows[0];
      if (
        topRow &&
        topRow.letters.some((letter) => letter !== null) &&
        topRow.feedback.some((feedback) => feedback !== null)
      ) {
        const tiles = await captureTiles(guesses, currentGuess, answerLength);
        // Filter to only get tiles from row 0
        const topRowTiles = tiles.filter((_, index) => {
          // Tiles are captured in order, so first answerLength tiles are from row 0
          return index < answerLength;
        });

        if (topRowTiles.length > 0) {
          console.log(
            `🎆 Captured ${topRowTiles.length} tiles from top row for shattering`
          );
          setShatteringTiles(topRowTiles);
          setShouldStartShattering(true);
          setTopRowShattering(true);

          // Hide the original top row immediately when shattering starts
          rowAnimations[0].opacity.value = withTiming(0, { duration: 100 });
        }
      }
    } catch (error) {
      console.warn("⚠️ Failed to capture top row tiles for shattering:", error);
    }
  }, [
    displayRows,
    captureTiles,
    guesses,
    currentGuess,
    answerLength,
    rowAnimations,
  ]);

  // Effect to trigger slide animation when new guess is submitted
  useEffect(() => {
    const currentGuessCount = guesses.length;
    const previousGuessCount = previousGuessCountRef.current;

    // If a new guess was submitted (guess count increased)
    if (currentGuessCount > previousGuessCount && currentGuessCount > 1) {
      // Animate completed rows upward with masking effect
      const completedRows = currentGuessCount - 1; // Number of completed rows (excluding current)

      for (let i = 0; i < completedRows; i++) {
        const distanceFromTop = i; // How far from the top this row is
        const slideDistance =
          SLIDE_DISTANCE * (completedRows - distanceFromTop);

        // Slide row up and fade out based on distance from top
        rowAnimations[i].translateY.value = withTiming(-slideDistance, {
          duration: ANIMATION_DURATION,
        });

        // Fade out rows that slide up more (earlier guesses fade more)
        const fadeAmount = Math.min(0.3 + distanceFromTop * 0.2, 1);
        rowAnimations[i].opacity.value = withTiming(fadeAmount, {
          duration: ANIMATION_DURATION,
        });

        // Check if top row (i === 0) has reached the shatter threshold
        if (
          i === 0 &&
          -slideDistance <= SHATTER_THRESHOLD &&
          !topRowShattering
        ) {
          // Trigger shattering animation for the top row
          setTimeout(() => {
            captureTopRowForShattering();
          }, ANIMATION_DURATION * 0.6); // Trigger at 60% through the slide animation
        }
      }

      // Reset animation for the current guess row (ensure it's visible)
      if (currentGuessCount < 3) {
        rowAnimations[currentGuessCount].translateY.value = withTiming(0, {
          duration: ANIMATION_DURATION,
        });
        rowAnimations[currentGuessCount].opacity.value = withTiming(1, {
          duration: ANIMATION_DURATION,
        });
      }

      // Reset any rows below current guess to normal state
      for (let i = currentGuessCount + 1; i < 3; i++) {
        rowAnimations[i].translateY.value = withTiming(0, {
          duration: ANIMATION_DURATION,
        });
        rowAnimations[i].opacity.value = withTiming(1, {
          duration: ANIMATION_DURATION,
        });
      }
    }

    // Update the previous guess count
    previousGuessCountRef.current = currentGuessCount;
  }, [
    guesses.length,
    rowAnimations,
    answerLength,
    topRowShattering,
    SHATTER_THRESHOLD,
    SLIDE_DISTANCE,
    captureTopRowForShattering,
  ]);

  // Effect to trigger shake animation when shakeKey changes
  useEffect(() => {
    shakeAnimation.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withSpring(10, { damping: 8, stiffness: 100 }),
      withSpring(-10, { damping: 8, stiffness: 100 }),
      withSpring(0, { damping: 8, stiffness: 100 })
    );
  }, [shakeKey, shakeAnimation]);

  // Reset shattering state when guesses reset (new game)
  useEffect(() => {
    if (guesses.length === 0) {
      setTopRowShattering(false);
      setShouldStartShattering(false);
      setShatteringTiles([]);
    }
  }, [guesses.length]);

  /**
   * Function to determine cell background color based on feedback.
   * @param {Feedback} feedback - The feedback for a specific letter cell.
   * @returns {string} The Tailwind CSS class string for the background color.
   */
  const getCellBackgroundColor = (feedback: Feedback) => {
    switch (feedback) {
      case "green":
        return "bg-green-500"; // Green for correct letter and position
      case "yellow":
        return "bg-primary-orange"; // Primary Orange for correct letter wrong position
      case "red":
        return "bg-red-500"; // Red for incorrect letter
      default:
        return "bg-transparent"; // Default background for empty or current cells
    }
  };

  /**
   * Function to determine cell border color.
   * @param {Feedback} feedback - The feedback for a specific letter cell.
   * @param {string | null} letter - The letter in the cell.
   * @param {boolean} isCurrentGuessRow - Indicates if the cell is in the current guess row.
   * @returns {string} The Tailwind CSS class string for the border color.
   */
  const getCellBorderColor = (
    feedback: Feedback,
    letter: string | null,
    isCurrentGuessRow: boolean
  ) => {
    if (feedback) return "border-transparent"; // No border if there's feedback
    if (isCurrentGuessRow && letter !== null) return "border-gray-600"; // Darker border for cells with letters in current guess
    return "border-gray-400"; // Default border for empty cells or submitted without feedback yet
  };

  /**
   * Function to determine text color based on feedback.
   * @param {Feedback} feedback - The feedback for a specific letter cell.
   * @param {string | null} letter - The letter in the cell.
   * @returns {string} The Tailwind CSS class string for the text color.
   */
  const getCellTextColor = (feedback: Feedback, letter: string | null) => {
    if (feedback) return "text-white"; // White text for colored feedback cells
    if (letter !== null) return "text-gray-800"; // Dark text for letters in current guess
    return "text-gray-800"; // Default text color for empty cells (shouldn't be visible)
  };

  // Handle both internal tile refs and external setTileRef prop
  const handleTileRef = (
    rowIndex: number,
    cellIndex: number,
    ref: View | null
  ) => {
    // Set ref for internal tile capture system
    setInternalTileRef(rowIndex, cellIndex, ref);

    // Also call external setTileRef if provided (for other shattering animations)
    if (setTileRef) {
      setTileRef(rowIndex, cellIndex, ref);
    }
  };

  const handleShatteringComplete = () => {
    console.log("🎆 Top row shattering animation completed");
    // Reset shattering state
    setShouldStartShattering(false);
    setShatteringTiles([]);
    // Note: We keep topRowShattering true to prevent the original row from reappearing
  };

  return (
    <View className="w-full items-center py-4 flex-grow">
      {/* Masking container that clips content sliding upward */}
      <View className="w-full relative" style={styles.maskingContainer}>
        {displayRows.map((row, rowIndex) => {
          const isCurrentGuessRow =
            rowIndex === guesses.length && guesses.length < 3;

          // Hide top row if it's shattering
          const shouldHideRow = rowIndex === 0 && topRowShattering;

          // Combine slide animation with shake animation for current guess row
          const combinedAnimatedStyle = {
            transform: [
              { translateY: rowAnimations[rowIndex].translateY },
              ...(isCurrentGuessRow ? [{ translateX: shakeAnimation }] : []),
            ],
            opacity: shouldHideRow ? 0 : rowAnimations[rowIndex].opacity,
          };

          return (
            <Animated.View
              key={rowIndex}
              className="flex-row justify-center mb-1"
              style={[
                combinedAnimatedStyle,
                { height: ROW_HEIGHT }, // Fixed height for consistent spacing
              ]}
            >
              {row.letters.map((letter, cellIndex) => {
                const feedback = row.feedback[cellIndex];
                const backgroundColor = getCellBackgroundColor(feedback);
                const borderColor = getCellBorderColor(
                  feedback,
                  letter,
                  isCurrentGuessRow
                );
                const textColor = getCellTextColor(feedback, letter);
                return (
                  <View
                    key={cellIndex}
                    ref={(ref) => handleTileRef(rowIndex, cellIndex, ref)}
                    className={`border ${borderColor} items-center justify-center rounded ${backgroundColor}`}
                    style={{
                      width: TILE_SIZE,
                      height: TILE_SIZE,
                      margin: TILE_MARGIN,
                    }}
                  >
                    <Text
                      className={`font-bold uppercase ${textColor}`}
                      style={{
                        fontSize: scale(24), // Responsive font size
                      }}
                    >
                      {letter}
                    </Text>
                  </View>
                );
              })}
            </Animated.View>
          );
        })}
      </View>

      {/* Shattering Tiles Animation for Top Row */}
      {shatteringTiles.length > 0 && (
        <ShatteringTiles
          tiles={shatteringTiles}
          startAnimation={shouldStartShattering}
          onAnimationComplete={handleShatteringComplete}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  maskingContainer: {
    minHeight: scale(56) * 3 + scale(2) * 6 + scale(4) * 3,
    overflow: "hidden", // ROW_HEIGHT * 3
  },
});

export default GuessGrid;
