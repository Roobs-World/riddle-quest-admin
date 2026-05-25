import {useRef, useCallback} from "react";
import {View} from "react-native";
import type {SubmittedGuess, Feedback} from "./types";

/**
 * Serializable snapshot of a rendered guess tile, used by share/capture flows.
 */
interface TileData {
  /** Rendered letter content for the tile. */
  letter: string | null;
  /** Tailwind-like token describing the tile background. */
  backgroundColor: string;
  /** Tailwind-like token describing the tile border. */
  borderColor: string;
  /** Tailwind-like token describing the letter color. */
  textColor: string;
  /** Absolute X page position measured from the native view tree. */
  x: number;
  /** Absolute Y page position measured from the native view tree. */
  y: number;
}

/**
 * Minimal shape required to measure a tile's on-screen position.
 */
interface TileRef {
  /** Measures the underlying native view and invokes `callback` with geometry. */
  measure: (
    /** Receives local + absolute coordinates from React Native `measure`. */
    callback: (
      /** X relative to parent (unused by capture flow). */
      x: number,
      /** Y relative to parent (unused by capture flow). */
      y: number,
      /** Measured tile width in points. */
      width: number,
      /** Measured tile height in points. */
      height: number,
      /** Absolute X position on screen/page. */
      pageX: number,
      /** Absolute Y position on screen/page. */
      pageY: number,
    ) => void,
  ) => void;
}

/**
 * Tracks guess-grid tile refs and captures positioned tile snapshots.
 *
 * @returns Ref-registration callback and async tile capture helper.
 */
export const useTileCapture = () => {
  const tileRefs = useRef<{[key: string]: TileRef}>({});

  const setTileRef = useCallback((rowIndex: number, cellIndex: number, ref: View | null) => {
    const key = `${rowIndex}-${cellIndex}`;
    if (ref) {
      tileRefs.current[key] = ref;
    } else {
      delete tileRefs.current[key];
    }
  }, []);

  const captureTiles = useCallback((guesses: SubmittedGuess[], answerLength: number): Promise<TileData[]> => {
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

      const getCellBorderColor = (feedback: Feedback) => {
        if (feedback) return "border-transparent";
        return "border-gray-400";
      };

      const getCellTextColor = (feedback: Feedback, letter: string | null) => {
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

      while (displayRows.length < 3) {
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
                tileRef.measure((_x, _y, _width, _height, pageX, pageY) => {
                  const feedback = row.feedback[cellIndex];

                  tiles.push({
                    letter,
                    backgroundColor: getCellBackgroundColor(feedback),
                    borderColor: getCellBorderColor(feedback),
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
  }, []);

  return {
    setTileRef,
    captureTiles,
  };
};
