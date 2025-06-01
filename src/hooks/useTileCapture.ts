import { useRef, useCallback } from "react";
import { View } from "react-native";
import type { SubmittedGuess, Feedback } from "./types";

interface TileData {
  letter: string | null;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  x: number; // Absolute position
  y: number; // Absolute position
}

interface TileRef {
  measure: (
    callback: (
      x: number,
      y: number,
      width: number,
      height: number,
      pageX: number,
      pageY: number
    ) => void
  ) => void;
}

export const useTileCapture = () => {
  const tileRefs = useRef<{ [key: string]: TileRef }>({});

  const setTileRef = useCallback(
    (rowIndex: number, cellIndex: number, ref: View | null) => {
      const key = `${rowIndex}-${cellIndex}`;
      if (ref) {
        tileRefs.current[key] = ref;
      } else {
        delete tileRefs.current[key];
      }
    },
    []
  );

  const captureTiles = useCallback(
    (
      guesses: SubmittedGuess[],
      currentGuess: string[],
      answerLength: number
    ): Promise<TileData[]> => {
      return new Promise((resolve) => {
        const tiles: TileData[] = [];
        const measurePromises: Promise<void>[] = [];

        // Helper functions (same as GuessGrid)
        const getCellBackgroundColor = (feedback: Feedback) => {
          switch (feedback) {
            case "green":
              return "bg-green-500";
            case "yellow":
              return "bg-primary-orange";
            case "red":
              return "bg-red-500";
            default:
              return "bg-transparent";
          }
        };

        const getCellBorderColor = (
          feedback: Feedback,
          letter: string | null,
          isCurrentGuessRow: boolean
        ) => {
          if (feedback) return "border-transparent";
          if (isCurrentGuessRow && letter !== null) return "border-gray-600";
          return "border-gray-400";
        };

        const getCellTextColor = (
          feedback: Feedback,
          letter: string | null
        ) => {
          if (feedback) return "text-white";
          if (letter !== null) return "text-gray-800";
          return "text-gray-800";
        };

        // Build display rows (same logic as GuessGrid)
        const displayRows: {
          letters: (string | null)[];
          feedback: Feedback[];
        }[] = guesses.map((sg) => ({
          letters: sg.guess,
          feedback: sg.feedback,
        }));

        if (displayRows.length < 6) {
          const currentRowLetters: (string | null)[] =
            Array(answerLength).fill(null);
          currentGuess.forEach((letter, index) => {
            currentRowLetters[index] = letter;
          });
          const currentRowFeedback: Feedback[] = Array(answerLength).fill(null);
          displayRows.push({
            letters: currentRowLetters,
            feedback: currentRowFeedback,
          });
        }

        while (displayRows.length < 6) {
          displayRows.push({
            letters: Array(answerLength).fill(null),
            feedback: Array(answerLength).fill(null),
          });
        }

        // Measure each tile that has a letter
        displayRows.forEach((row, rowIndex) => {
          row.letters.forEach((letter, cellIndex) => {
            if (letter) {
              // Only capture tiles with letters
              const key = `${rowIndex}-${cellIndex}`;
              const tileRef = tileRefs.current[key];

              if (tileRef) {
                const measurePromise = new Promise<void>((resolveMeasure) => {
                  tileRef.measure((x, y, width, height, pageX, pageY) => {
                    const isCurrentGuessRow =
                      rowIndex === guesses.length && guesses.length < 6;
                    const feedback = row.feedback[cellIndex];

                    tiles.push({
                      letter,
                      backgroundColor: getCellBackgroundColor(feedback),
                      borderColor: getCellBorderColor(
                        feedback,
                        letter,
                        isCurrentGuessRow
                      ),
                      textColor: getCellTextColor(feedback, letter),
                      x: pageX,
                      y: pageY,
                    });
                    resolveMeasure();
                  });
                });
                measurePromises.push(measurePromise);
              }
            }
          });
        });

        // Wait for all measurements to complete
        Promise.all(measurePromises).then(() => {
          resolve(tiles);
        });
      });
    },
    []
  );

  return {
    setTileRef,
    captureTiles,
  };
};
