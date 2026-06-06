import {riddleSessionService} from "../RiddleSessionService";
import {fetchClassicRiddleFromFirestore, fetchDailyRiddleFromFirestore} from "../../../services/FirestoreService";
import {authSessionFacade} from "../AuthSessionFacade";
import {RiddleInitializationService} from "../../../services/RiddleInitializationService";

jest.mock("../../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import {logger} from "../../../utils/logger";

jest.mock("../../../utils/firebaseFunctions", () => ({
  callValidatedFunction: jest.fn(),
}));

jest.mock("../../../services/FirestoreService", () => ({
  fetchClassicRiddleFromFirestore: jest.fn(),
  fetchDailyRiddleFromFirestore: jest.fn(),
}));

jest.mock("../AuthSessionFacade", () => ({
  authSessionFacade: {
    hasCompletedDailyChallengeToday: jest.fn(),
  },
}));

jest.mock("../../../services/RiddleInitializationService", () => ({
  RiddleInitializationService: {
    getInitializationStatus: jest.fn(() => ({
      isInitializing: false,
      hasInitialized: false,
      initializationFailed: true,
    })),
  },
}));

const mockedGetInitializationStatus = RiddleInitializationService.getInitializationStatus as jest.Mock;

describe("RiddleSessionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetInitializationStatus.mockReturnValue({
      isInitializing: false,
      hasInitialized: false,
      initializationFailed: true,
    });
  });

  it("routes daily startup through the hardened daily fetch helper instead of a direct Firestore read", async () => {
    (authSessionFacade.hasCompletedDailyChallengeToday as jest.Mock).mockResolvedValue(false);
    (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue({
      riddleId: "current",
      canonicalKey: "daily:2026-06-06",
      challengeKey: "2026-06-06",
      locale: "en",
      dailyIndex: 4,
      text: "Question 1?",
      answer: "ANSWER",
      category: "daily",
    });

    const sink = {
      setCurrentRiddle: jest.fn(),
      setIsDailyChallengeAvailable: jest.fn(),
      setGameMode: jest.fn(),
      setIsRiddlesInitializing: jest.fn(),
    };

    await riddleSessionService.fetchCurrentRiddle(
      {
        userId: "user-1",
        progress: {
          classicIndex: 7,
          dailyChallengeIndex: 4,
          dailyChallengeCurrentQuestion: 0,
        },
      } as any,
      "daily",
      sink,
      {
        completedDailyOverride: false,
        isStaleRequest: () => false,
        locale: "en",
      },
    );

    expect(fetchDailyRiddleFromFirestore).toHaveBeenCalledWith(4, "en");
    expect(fetchClassicRiddleFromFirestore).not.toHaveBeenCalled();
    expect(sink.setCurrentRiddle).toHaveBeenCalledWith(
      expect.objectContaining({
        riddleId: "current",
        text: "Question 1?",
        answer: "ANSWER",
        category: "daily",
      }),
    );
  });

  it("warns instead of erroring when no riddle is available during a non-fatal startup state", async () => {
    mockedGetInitializationStatus.mockReturnValue({
      isInitializing: false,
      hasInitialized: true,
      initializationFailed: false,
    });
    (fetchClassicRiddleFromFirestore as jest.Mock).mockResolvedValue(null);
    const setTimeoutSpy = jest.spyOn(global, "setTimeout").mockImplementation(((callback: (...args: any[]) => void) => {
      callback();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);

    const sink = {
      setCurrentRiddle: jest.fn(),
      setIsDailyChallengeAvailable: jest.fn(),
      setGameMode: jest.fn(),
      setIsRiddlesInitializing: jest.fn(),
    };

    await riddleSessionService.fetchCurrentRiddle(
      {
        userId: "user-1",
        progress: {
          classicIndex: 7,
          dailyChallengeIndex: 4,
          dailyChallengeCurrentQuestion: 0,
        },
      } as any,
      "classic",
      sink,
      {
        completedDailyOverride: true,
        isStaleRequest: () => false,
        locale: "en",
      },
    );

    expect(logger.warn).toHaveBeenCalledWith(
      "No riddle loaded after startup attempts; continuing with fallback state.",
    );
    expect(logger.error).not.toHaveBeenCalledWith("❌ Failed to load any riddle after all attempts");
    setTimeoutSpy.mockRestore();
  });
});
