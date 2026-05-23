import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getTooltipSeenStorageKey,
  hasSeenTooltip,
  markTooltipSeen,
} from "../tooltipStorage";

describe("tooltipStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("scopes tooltip storage by user and tooltip id", () => {
    expect(getTooltipSeenStorageKey("submitAnswer", "user-1")).toBe(
      "tooltipSeen:user-1:submitAnswer"
    );
  });

  it("falls back to anonymous when no user id is available", () => {
    expect(getTooltipSeenStorageKey("submitAnswer", null)).toBe(
      "tooltipSeen:anonymous:submitAnswer"
    );
  });

  it("reads and writes seen state", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

    await expect(hasSeenTooltip("hintAfterWrongGuess", "user-1")).resolves.toBe(
      false
    );

    await markTooltipSeen("hintAfterWrongGuess", "user-1");

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "tooltipSeen:user-1:hintAfterWrongGuess",
      "true"
    );
  });

  it("returns true only for persisted true values", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("true");

    await expect(hasSeenTooltip("shopOutOfCoins", "user-1")).resolves.toBe(true);
  });
});
