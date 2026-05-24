/**
 * @fileoverview
 * Presentational guess grid component for the Riddle Quest game.
 *
 * This component renders a fixed number of rows representing past guesses,
 * the current in-progress guess, and any remaining empty rows. It is kept
 * animation-free for performance and focuses solely on layout and visual
 * feedback based on server-provided guess results.
 */
import React, { memo, useMemo } from "react";
import { View, Text, Pressable } from "react-native";

import type { SubmittedGuess, Feedback } from "../../hooks/types"; // Import Feedback type from types.ts
import {
  GUESS_TILE_MAX_SIZE,
  GUESS_GRID_H_PADDING,
  GUESS_TILE_MARGIN,
  GUESS_TILE_ROW_GAP,
  GUESS_GRID_EFFECTIVE_WIDTH,
  GUESS_GRID_SLOT_HEIGHT,
} from "../../constants/layout";
import { TYPOGRAPHY } from "../../styles/tokens/typography";
import { NUM_GUESSES } from "../../utils/constants";

/**
 * Returns background + text colour for a tile.
 * - Empty (no letter, no feedback): transparent so the solar system shows through.
 * - Being typed (has letter, no feedback): semi-transparent cream so the letter is readable.
 * - Submitted: solid Figma brand colour.
 *
 * Defined at module level so it is not recreated on every render.
 */
const getCellColors = (
  feedback: Feedback | null,
  hasLetter: boolean
): { bg: string; text: string; border: string } => {
  switch (feedback) {
    case "green":
      return { bg: "#22C55E", text: "#FFFFFF", border: "#22C55E" };
    case "yellow":
      return { bg: "#EAB308", text: "#FFFFFF", border: "#EAB308" };
    case "red":
      return { bg: "#EF4444", text: "#FFFFFF", border: "#EF4444" };
    default:
      return hasLetter
        ? { bg: "rgba(252,250,244,0.88)", text: "#401F40", border: "#401F40" }
        : { bg: "transparent", text: "#FFFFFF", border: "rgba(252,250,244,0.45)" };
  }
};

/**
 * Define the structure for the entire guess grid.
 * @property {SubmittedGuess[]} guesses - An array of submitted guesses with their feedback.
 * @property {string[]} currentGuess - The current guess being typed by the user.
 * @property {number} answerLength - The length of the answer.
 */
type GuessGridProps = {
  /** Submitted guesses with finalized feedback rows. */
  guesses: SubmittedGuess[];
  /** Current in-progress guess row. */
  currentGuess: string[];
  /** Required answer length (tile count per row). */
  answerLength: number;
  /** Optional ref setter used by tile-capture/sharing flows. */
  setTileRef?: (rowIndex: number, cellIndex: number, ref: View | null) => void;
  /** Indices revealed by hints that should render as green in the current row. */
  hintRevealedIndices?: number[];
  /** Currently selected slot in the in-progress row. */
  activeSlotIndex?: number;
  /** Invoked when a slot in current row is tapped. */
  onSelectCurrentGuessSlot?: (slotIndex: number) => void;
};

/**
 * The component that displays the guess grid for the Wordle-style game.
 * It shows submitted guesses with feedback and the current guess being entered.
 * Optimized version without animations for better performance.
 *
 * @param {GuessGridProps} props - The props for the component.
 * @returns {React.FC<GuessGridProps>} The rendered GuessGrid component.
 */
const GuessGrid: React.FC<GuessGridProps> = memo(function GuessGrid({
  guesses,
  currentGuess,
  answerLength,
  setTileRef,
  hintRevealedIndices = [],
  activeSlotIndex = 0,
  onSelectCurrentGuessSlot,
}) {
  const slotCount = Math.max(0, answerLength);
  // Tile sizing — only recalculate when answerLength changes.
  const { TILE_SIZE, ROW_HEIGHT } = useMemo(() => {
    if (slotCount <= 0) {
      return {
        TILE_SIZE: 0,
        ROW_HEIGHT: GUESS_TILE_ROW_GAP,
      };
    }

    const availableWidth = GUESS_GRID_EFFECTIVE_WIDTH - GUESS_GRID_H_PADDING;
    const maxTileFromWidth = Math.floor(availableWidth / slotCount) - GUESS_TILE_MARGIN * 2;
    const tileSize = Math.min(GUESS_TILE_MAX_SIZE, maxTileFromWidth);
    return {
      TILE_SIZE: tileSize,
      ROW_HEIGHT: tileSize + GUESS_TILE_MARGIN * 2 + GUESS_TILE_ROW_GAP,
    };
  }, [slotCount]);

  // Build display rows — recalculates when guesses or currentGuess change.
  const displayRows = useMemo(() => {
    const buildFixedLengthRow = <T,>(values: T[], filler: T): T[] => {
      const row = values.slice(0, slotCount);
      while (row.length < slotCount) row.push(filler);
      return row;
    };
    const rows: { letters: (string | null)[]; feedback: (Feedback | null)[] }[] =
      guesses.map((sg: SubmittedGuess) => ({
        letters: buildFixedLengthRow<string | null>(sg.guess, null),
        feedback: buildFixedLengthRow<Feedback | null>(sg.feedback, null),
      }));

    if (rows.length < NUM_GUESSES && currentGuess.length > 0) {
      const currentGuessRow = buildFixedLengthRow<string | null>(
        currentGuess,
        null
      );
      const currentGuessFeedback: (Feedback | null)[] = Array(slotCount)
        .fill(null)
        .map((_, i) => (hintRevealedIndices.includes(i) ? "green" : null));
      rows.push({ letters: currentGuessRow, feedback: currentGuessFeedback });
    }

    while (rows.length < NUM_GUESSES) {
      rows.push({
        letters: Array(slotCount).fill(null),
        feedback: Array(slotCount).fill(null),
      });
    }
    return rows;
  }, [guesses, currentGuess, slotCount, hintRevealedIndices]);

  return (
    <View
      className="w-full items-center justify-center"
      style={{
        height: GUESS_GRID_SLOT_HEIGHT,
        minHeight: GUESS_GRID_SLOT_HEIGHT,
        maxHeight: GUESS_GRID_SLOT_HEIGHT,
        width: "100%",
      }}
    >
      {/* Container for the grid rows with proper vertical alignment */}
      <View className="w-full items-center">
        {displayRows.map((row, rowIndex) => (
          <View
            key={rowIndex}
            className="flex-row justify-center items-center"
            style={{ height: ROW_HEIGHT }}
          >
            {row.letters.map((letter, cellIndex) => {
              const feedback = row.feedback[cellIndex];
              const { bg, text, border } = getCellColors(feedback, !!letter);
              const isCurrentGuessRow =
                rowIndex === guesses.length && rowIndex < NUM_GUESSES;
              const isSelectable =
                isCurrentGuessRow && typeof onSelectCurrentGuessSlot === "function";
              const tileBorderColor =
                isSelectable && cellIndex === activeSlotIndex ? "#FCFAF4" : border;
              const tileBorderWidth =
                isSelectable && cellIndex === activeSlotIndex ? 3 : 2;

              if (isSelectable) {
                return (
                  <Pressable
                    key={cellIndex}
                    testID={`guess-cell-${rowIndex}-${cellIndex}`}
                    className="items-center justify-center rounded-full"
                    style={{
                      width: TILE_SIZE,
                      height: TILE_SIZE,
                      margin: GUESS_TILE_MARGIN,
                      backgroundColor: bg,
                      borderWidth: tileBorderWidth,
                      borderColor: tileBorderColor,
                    }}
                    onPress={() => onSelectCurrentGuessSlot(cellIndex)}
                    ref={
                      setTileRef
                        ? (ref) => setTileRef(rowIndex, cellIndex, ref)
                        : undefined
                    }
                  >
                    <Text
                      className="font-bold uppercase"
                      style={{
                        color: text,
                        fontSize: TYPOGRAPHY.fontSize["2xl"],
                        lineHeight: TYPOGRAPHY.fontSize["2xl"] * TYPOGRAPHY.lineHeight.snug,
                      }}
                    >
                      {letter}
                    </Text>
                  </Pressable>
                );
              }

              return (
                <View
                  key={cellIndex}
                  testID={`guess-cell-${rowIndex}-${cellIndex}`}
                  className="items-center justify-center rounded-full"
                  style={{
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                    margin: GUESS_TILE_MARGIN,
                    backgroundColor: bg,
                    borderWidth: tileBorderWidth,
                    borderColor: tileBorderColor,
                  }}
                  ref={
                    setTileRef
                      ? (ref) => setTileRef(rowIndex, cellIndex, ref)
                      : undefined
                  }
                >
                  <Text
                    className="font-bold uppercase"
                    style={{
                      color: text,
                      fontSize: TYPOGRAPHY.fontSize["2xl"],
                      lineHeight: TYPOGRAPHY.fontSize["2xl"] * TYPOGRAPHY.lineHeight.snug,
                    }}
                  >
                    {letter}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
});

export default GuessGrid;
