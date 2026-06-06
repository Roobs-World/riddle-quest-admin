import AsyncStorage from "@react-native-async-storage/async-storage";
import {authSessionFacade} from "../AuthSessionFacade";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe("AuthSessionFacade", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("persists and restores the full active game session riddle payload", async () => {
    const player = {
      userId: "user-123",
      progress: {
        classicIndex: 10,
        dailyChallengeIndex: 4,
        dailyChallengeCurrentQuestion: 0,
      },
    } as any;
    const riddle = {
      riddleId: "classic-10",
      canonicalKey: "classic:10",
      locale: "en",
      classicIndex: 10,
      text: "Question?",
      answer: "ANSWER",
      category: "classic",
    } as any;

    await authSessionFacade.saveActiveGameSession(player, "classic", riddle);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "@active_game_session_v1",
      expect.stringContaining('"riddleId":"classic-10"'),
    );

    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({
        version: 1,
        userId: "user-123",
        gameMode: "classic",
        savedAt: 123,
        savedUtcDate: new Date().toISOString().slice(0, 10),
        riddle,
        riddleId: "classic-10",
        classicIndex: 10,
      }),
    );

    const restored = await authSessionFacade.loadActiveGameSession("user-123");

    expect(restored?.riddle).toEqual(riddle);
    expect(restored?.riddleId).toBe("classic-10");
    expect(restored?.classicIndex).toBe(10);
  });
});
