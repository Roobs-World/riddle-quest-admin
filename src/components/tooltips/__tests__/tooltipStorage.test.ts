import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearTooltipSeenMemoryCache,
  getTooltipSeenStorageKey,
  getTooltipSequenceSeenStorageKey,
  hasSeenTooltip,
  hasSeenTooltipSequence,
  markTooltipSeen,
  markTooltipSequenceSeen,
} from "../tooltipStorage";

describe("tooltipStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearTooltipSeenMemoryCache();
  });

  it("scopes tooltip storage by user and tooltip id", () => {
    expect(getTooltipSeenStorageKey("submitAnswer", "user-1")).toBe("tooltipSeen:user-1:submitAnswer");
  });

  it("falls back to anonymous when no user id is available", () => {
    expect(getTooltipSeenStorageKey("submitAnswer", null)).toBe("tooltipSeen:anonymous:submitAnswer");
  });

  it("scopes tooltip sequence storage by user and sequence id", () => {
    expect(getTooltipSequenceSeenStorageKey("profileTour", "user-1")).toBe(
      "tooltipSequenceSeen:user-1:profileTour",
    );
  });

  it("reads and writes seen state", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

    await expect(hasSeenTooltip("hintAfterWrongGuess", "user-1")).resolves.toBe(false);

    await markTooltipSeen("hintAfterWrongGuess", "user-1");

    expect(AsyncStorage.setItem).toHaveBeenCalledWith("tooltipSeen:user-1:hintAfterWrongGuess", "true");
  });

  it("returns true only for persisted true values", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("true");

    await expect(hasSeenTooltip("shopOutOfCoins", "user-1")).resolves.toBe(true);
  });

  it("remembers seen state in memory before the async write settles", async () => {
    let resolveSetItem: (() => void) | undefined;
    (AsyncStorage.setItem as jest.Mock).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveSetItem = resolve;
      }),
    );

    const markPromise = markTooltipSeen("profileProgression", "user-1");

    await expect(hasSeenTooltip("profileProgression", "user-1")).resolves.toBe(true);
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();

    resolveSetItem?.();
    await markPromise;
  });

  it("remembers sequence completion in memory before the async write settles", async () => {
    let resolveSetItem: (() => void) | undefined;
    (AsyncStorage.setItem as jest.Mock).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveSetItem = resolve;
      }),
    );

    const markPromise = markTooltipSequenceSeen("profileTour", "user-1");

    await expect(hasSeenTooltipSequence("profileTour", "user-1")).resolves.toBe(true);
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();

    resolveSetItem?.();
    await markPromise;
  });
});
