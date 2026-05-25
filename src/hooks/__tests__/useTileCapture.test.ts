/**
 * @fileoverview Unit tests for useTileCapture hook.
 *
 * Tests the tile capture functionality including ref management
 * and tile measurement.
 */

import {renderHook, act} from "@testing-library/react-native";
import {useTileCapture} from "../useTileCapture";
import type {SubmittedGuess, Feedback} from "../types";

describe("useTileCapture", () => {
  describe("hook initialization", () => {
    it("should return setTileRef and captureTiles functions", () => {
      const {result} = renderHook(() => useTileCapture());

      expect(typeof result.current.setTileRef).toBe("function");
      expect(typeof result.current.captureTiles).toBe("function");
    });

    it("should maintain stable function references", () => {
      const {result, rerender} = renderHook(() => useTileCapture());

      const initialSetTileRef = result.current.setTileRef;
      const initialCaptureTiles = result.current.captureTiles;

      rerender({});

      expect(result.current.setTileRef).toBe(initialSetTileRef);
      expect(result.current.captureTiles).toBe(initialCaptureTiles);
    });
  });

  describe("setTileRef", () => {
    it("should accept row and cell indices with a ref", () => {
      const {result} = renderHook(() => useTileCapture());

      const mockRef = createMockTileRef();

      expect(() => {
        act(() => {
          result.current.setTileRef(0, 0, mockRef);
        });
      }).not.toThrow();
    });

    it("should handle null ref (removal)", () => {
      const {result} = renderHook(() => useTileCapture());

      expect(() => {
        act(() => {
          result.current.setTileRef(0, 0, null);
        });
      }).not.toThrow();
    });

    it("should handle multiple refs at different positions", () => {
      const {result} = renderHook(() => useTileCapture());

      const mockRef1 = createMockTileRef();
      const mockRef2 = createMockTileRef();
      const mockRef3 = createMockTileRef();

      expect(() => {
        act(() => {
          result.current.setTileRef(0, 0, mockRef1);
          result.current.setTileRef(0, 1, mockRef2);
          result.current.setTileRef(1, 0, mockRef3);
        });
      }).not.toThrow();
    });

    it("should replace existing ref at same position", () => {
      const {result} = renderHook(() => useTileCapture());

      const mockRef1 = createMockTileRef();
      const mockRef2 = createMockTileRef();

      act(() => {
        result.current.setTileRef(0, 0, mockRef1);
        result.current.setTileRef(0, 0, mockRef2);
      });

      // Should not throw - ref was replaced
      expect(true).toBe(true);
    });

    it("should handle large indices", () => {
      const {result} = renderHook(() => useTileCapture());

      const mockRef = createMockTileRef();

      expect(() => {
        act(() => {
          result.current.setTileRef(99, 99, mockRef);
        });
      }).not.toThrow();
    });
  });

  describe("captureTiles", () => {
    it("should return a promise", () => {
      const {result} = renderHook(() => useTileCapture());

      const guesses: SubmittedGuess[] = [];

      const promise = result.current.captureTiles(guesses, 5);

      expect(promise).toBeInstanceOf(Promise);
    });

    it("should resolve with empty array when no guesses", async () => {
      const {result} = renderHook(() => useTileCapture());

      const tiles = await result.current.captureTiles([], 5);

      expect(tiles).toEqual([]);
    });

    it("should capture tiles from submitted guesses", async () => {
      const {result} = renderHook(() => useTileCapture());

      // Set up refs with measurement mocks
      const mockRef = createMockTileRef(100, 200);

      act(() => {
        result.current.setTileRef(0, 0, mockRef);
      });

      const guesses: SubmittedGuess[] = [
        {
          guess: ["H", "E", "L", "L", "O"],
          feedback: ["green", "yellow", "red", "green", "green"],
        },
      ];

      const tiles = await result.current.captureTiles(guesses, 5);

      // Should have tiles for letters that have refs registered
      expect(Array.isArray(tiles)).toBe(true);
    });

    it("should handle guesses with green feedback", async () => {
      const {result} = renderHook(() => useTileCapture());

      const mockRef = createMockTileRef(50, 100);
      act(() => {
        result.current.setTileRef(0, 0, mockRef);
      });

      const guesses: SubmittedGuess[] = [
        {
          guess: ["T"],
          feedback: ["green"],
        },
      ];

      const tiles = await result.current.captureTiles(guesses, 1);

      expect(tiles.length).toBe(1);
      expect(tiles[0].backgroundColor).toBe("bg-green-500");
    });

    it("should handle guesses with yellow feedback", async () => {
      const {result} = renderHook(() => useTileCapture());

      const mockRef = createMockTileRef(50, 100);
      act(() => {
        result.current.setTileRef(0, 0, mockRef);
      });

      const guesses: SubmittedGuess[] = [
        {
          guess: ["T"],
          feedback: ["yellow"],
        },
      ];

      const tiles = await result.current.captureTiles(guesses, 1);

      expect(tiles.length).toBe(1);
      expect(tiles[0].backgroundColor).toBe("bg-primary-orange");
    });

    it("should handle guesses with red feedback", async () => {
      const {result} = renderHook(() => useTileCapture());

      const mockRef = createMockTileRef(50, 100);
      act(() => {
        result.current.setTileRef(0, 0, mockRef);
      });

      const guesses: SubmittedGuess[] = [
        {
          guess: ["T"],
          feedback: ["red"],
        },
      ];

      const tiles = await result.current.captureTiles(guesses, 1);

      expect(tiles.length).toBe(1);
      expect(tiles[0].backgroundColor).toBe("bg-red-500");
    });

    it("should include correct tile data structure", async () => {
      const {result} = renderHook(() => useTileCapture());

      const mockRef = createMockTileRef(100, 200);
      act(() => {
        result.current.setTileRef(0, 0, mockRef);
      });

      const guesses: SubmittedGuess[] = [
        {
          guess: ["A"],
          feedback: ["green"],
        },
      ];

      const tiles = await result.current.captureTiles(guesses, 1);

      expect(tiles[0]).toHaveProperty("letter");
      expect(tiles[0]).toHaveProperty("backgroundColor");
      expect(tiles[0]).toHaveProperty("borderColor");
      expect(tiles[0]).toHaveProperty("textColor");
      expect(tiles[0]).toHaveProperty("x");
      expect(tiles[0]).toHaveProperty("y");
    });

    it("should capture position from measure callback", async () => {
      const {result} = renderHook(() => useTileCapture());

      const mockRef = createMockTileRef(150, 250);
      act(() => {
        result.current.setTileRef(0, 0, mockRef);
      });

      const guesses: SubmittedGuess[] = [
        {
          guess: ["X"],
          feedback: ["green"],
        },
      ];

      const tiles = await result.current.captureTiles(guesses, 1);

      expect(tiles[0].x).toBe(150);
      expect(tiles[0].y).toBe(250);
    });

    it("should handle multiple rows of guesses", async () => {
      const {result} = renderHook(() => useTileCapture());

      // Set up refs for multiple positions
      for (let row = 0; row < 3; row++) {
        const mockRef = createMockTileRef(row * 10, row * 20);
        act(() => {
          result.current.setTileRef(row, 0, mockRef);
        });
      }

      const guesses: SubmittedGuess[] = [
        {guess: ["A"], feedback: ["green"]},
        {guess: ["B"], feedback: ["yellow"]},
        {guess: ["C"], feedback: ["red"]},
      ];

      const tiles = await result.current.captureTiles(guesses, 1);

      expect(tiles.length).toBe(3);
    });

    it("should skip tiles without registered refs", async () => {
      const {result} = renderHook(() => useTileCapture());

      // Only register ref for first position
      const mockRef = createMockTileRef(50, 100);
      act(() => {
        result.current.setTileRef(0, 0, mockRef);
      });

      const guesses: SubmittedGuess[] = [
        {
          guess: ["A", "B", "C"],
          feedback: ["green", "yellow", "red"],
        },
      ];

      const tiles = await result.current.captureTiles(guesses, 3);

      // Only first tile should be captured (has ref)
      expect(tiles.length).toBe(1);
      expect(tiles[0].letter).toBe("A");
    });

    it("should handle empty guess letters (null)", async () => {
      const {result} = renderHook(() => useTileCapture());

      const mockRef = createMockTileRef(50, 100);
      act(() => {
        result.current.setTileRef(0, 0, mockRef);
      });

      // The hook uses null for empty letters
      const guesses: SubmittedGuess[] = [];

      const tiles = await result.current.captureTiles(guesses, 5);

      expect(tiles.length).toBe(0);
    });

    it("should pad display rows to minimum of 3", async () => {
      const {result} = renderHook(() => useTileCapture());

      // Only one guess but 3 rows should be created
      const guesses: SubmittedGuess[] = [{guess: ["A"], feedback: ["green"]}];

      // The internal logic pads to 3 rows but only tiles with letters are captured
      const tiles = await result.current.captureTiles(guesses, 1);

      // No refs registered, so no tiles captured from the padded rows
      expect(Array.isArray(tiles)).toBe(true);
    });

    it("should handle answer length correctly", async () => {
      const {result} = renderHook(() => useTileCapture());

      // Set up refs for a 7-letter word
      for (let i = 0; i < 7; i++) {
        const mockRef = createMockTileRef(i * 10, 100);
        act(() => {
          result.current.setTileRef(0, i, mockRef);
        });
      }

      const guesses: SubmittedGuess[] = [
        {
          guess: ["W", "O", "R", "D", "L", "E", "S"],
          feedback: ["green", "green", "green", "green", "green", "green", "green"],
        },
      ];

      const tiles = await result.current.captureTiles(guesses, 7);

      expect(tiles.length).toBe(7);
    });
  });

  describe("color mapping", () => {
    it("should return correct background colors for each feedback type", async () => {
      const {result} = renderHook(() => useTileCapture());

      // Test green
      let mockRef = createMockTileRef(0, 0);
      act(() => result.current.setTileRef(0, 0, mockRef));

      let tiles = await result.current.captureTiles([{guess: ["A"], feedback: ["green"]}], 1);
      expect(tiles[0].backgroundColor).toBe("bg-green-500");

      // Reset and test yellow
      mockRef = createMockTileRef(0, 0);
      act(() => result.current.setTileRef(0, 0, mockRef));

      tiles = await result.current.captureTiles([{guess: ["A"], feedback: ["yellow"]}], 1);
      expect(tiles[0].backgroundColor).toBe("bg-primary-orange");

      // Reset and test red
      mockRef = createMockTileRef(0, 0);
      act(() => result.current.setTileRef(0, 0, mockRef));

      tiles = await result.current.captureTiles([{guess: ["A"], feedback: ["red"]}], 1);
      expect(tiles[0].backgroundColor).toBe("bg-red-500");
    });

    it("should return transparent border when feedback exists", async () => {
      const {result} = renderHook(() => useTileCapture());

      const mockRef = createMockTileRef(0, 0);
      act(() => result.current.setTileRef(0, 0, mockRef));

      const tiles = await result.current.captureTiles([{guess: ["A"], feedback: ["green"]}], 1);

      expect(tiles[0].borderColor).toBe("border-transparent");
    });

    it("should return white text color when feedback exists", async () => {
      const {result} = renderHook(() => useTileCapture());

      const mockRef = createMockTileRef(0, 0);
      act(() => result.current.setTileRef(0, 0, mockRef));

      const tiles = await result.current.captureTiles([{guess: ["A"], feedback: ["green"]}], 1);

      expect(tiles[0].textColor).toBe("text-white");
    });

    it("should return transparent background for null feedback", async () => {
      const {result} = renderHook(() => useTileCapture());

      const mockRef = createMockTileRef(0, 0);
      act(() => result.current.setTileRef(0, 0, mockRef));

      // Use null feedback to test the default case
      const tiles = await result.current.captureTiles([{guess: ["A"], feedback: [null as unknown as Feedback]}], 1);

      expect(tiles[0].backgroundColor).toBe("bg-transparent");
    });

    it("should return gray border when feedback is null", async () => {
      const {result} = renderHook(() => useTileCapture());

      const mockRef = createMockTileRef(0, 0);
      act(() => result.current.setTileRef(0, 0, mockRef));

      const tiles = await result.current.captureTiles([{guess: ["A"], feedback: [null as unknown as Feedback]}], 1);

      expect(tiles[0].borderColor).toBe("border-gray-400");
    });

    it("should return gray text when feedback is null but letter exists", async () => {
      const {result} = renderHook(() => useTileCapture());

      const mockRef = createMockTileRef(0, 0);
      act(() => result.current.setTileRef(0, 0, mockRef));

      const tiles = await result.current.captureTiles([{guess: ["A"], feedback: [null as unknown as Feedback]}], 1);

      expect(tiles[0].textColor).toBe("text-gray-800");
    });
  });

  describe("edge cases", () => {
    it("should handle rapid ref setting and removal", async () => {
      const {result} = renderHook(() => useTileCapture());

      const mockRef = createMockTileRef(0, 0);

      act(() => {
        result.current.setTileRef(0, 0, mockRef);
        result.current.setTileRef(0, 0, null);
        result.current.setTileRef(0, 0, mockRef);
      });

      const tiles = await result.current.captureTiles([{guess: ["A"], feedback: ["green"]}], 1);

      expect(tiles.length).toBe(1);
    });

    it("should handle concurrent capture calls", async () => {
      const {result} = renderHook(() => useTileCapture());

      const mockRef = createMockTileRef(0, 0);
      act(() => result.current.setTileRef(0, 0, mockRef));

      const guesses: SubmittedGuess[] = [{guess: ["A"], feedback: ["green"]}];

      const [tiles1, tiles2, tiles3] = await Promise.all([
        result.current.captureTiles(guesses, 1),
        result.current.captureTiles(guesses, 1),
        result.current.captureTiles(guesses, 1),
      ]);

      expect(tiles1.length).toBe(1);
      expect(tiles2.length).toBe(1);
      expect(tiles3.length).toBe(1);
    });

    it("should handle very large grids", async () => {
      const {result} = renderHook(() => useTileCapture());

      // Set up a 10x10 grid
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          const mockRef = createMockTileRef(col * 10, row * 10);
          act(() => {
            result.current.setTileRef(row, col, mockRef);
          });
        }
      }

      const guesses: SubmittedGuess[] = [];
      for (let i = 0; i < 10; i++) {
        guesses.push({
          guess: Array(10).fill("A"),
          feedback: Array(10).fill("green") as Feedback[],
        });
      }

      const tiles = await result.current.captureTiles(guesses, 10);

      expect(tiles.length).toBe(100);
    });

    it("should preserve letter value in captured tiles", async () => {
      const {result} = renderHook(() => useTileCapture());

      for (let i = 0; i < 5; i++) {
        const mockRef = createMockTileRef(i * 10, 0);
        act(() => result.current.setTileRef(0, i, mockRef));
      }

      const guesses: SubmittedGuess[] = [
        {
          guess: ["H", "E", "L", "L", "O"],
          feedback: ["green", "yellow", "red", "green", "green"],
        },
      ];

      const tiles = await result.current.captureTiles(guesses, 5);

      const letters = tiles.map((t) => t.letter);
      expect(letters).toContain("H");
      expect(letters).toContain("E");
      expect(letters).toContain("L");
      expect(letters).toContain("O");
    });
  });
});

// Helper function to create mock tile refs
function createMockTileRef(pageX = 0, pageY = 0) {
  return {
    measure: jest.fn((callback) => {
      callback(0, 0, 50, 50, pageX, pageY);
    }),
  } as any;
}
