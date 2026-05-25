import type {IRiddleDataService} from "../IRiddleDataService";
import type {FirestoreRiddle} from "../../../validation/firestoreSchemas";

describe("IRiddleDataService", () => {
  it("should allow implementing the interface", () => {
    class TestRiddleDataService implements IRiddleDataService {
      async fetchDailyRiddle(): Promise<FirestoreRiddle | null> {
        return null;
      }

      async fetchClassicRiddle(level: number): Promise<FirestoreRiddle | null> {
        return null;
      }

      async fetchRiddleById(riddleId: string): Promise<FirestoreRiddle | null> {
        return null;
      }

      async getClassicRiddleCount(): Promise<number> {
        return 0;
      }
    }

    const service = new TestRiddleDataService();
    expect(service).toBeInstanceOf(TestRiddleDataService);
    expect(typeof service.fetchDailyRiddle).toBe("function");
    expect(typeof service.fetchClassicRiddle).toBe("function");
    expect(typeof service.fetchRiddleById).toBe("function");
    expect(typeof service.getClassicRiddleCount).toBe("function");
  });

  it("should define methods that return correct promise types", async () => {
    const mockRiddle: FirestoreRiddle = {
      riddleId: "test-riddle",
      text: "Test riddle",
      answer: "TEST",
      category: "test",
      classicIndex: 1,
    };

    const mockService: IRiddleDataService = {
      fetchDailyRiddle: jest.fn().mockResolvedValue(mockRiddle),
      fetchClassicRiddle: jest.fn().mockResolvedValue(mockRiddle),
      fetchRiddleById: jest.fn().mockResolvedValue(mockRiddle),
      getClassicRiddleCount: jest.fn().mockResolvedValue(100),
    };

    await expect(mockService.fetchDailyRiddle()).resolves.toEqual(mockRiddle);
    await expect(mockService.fetchClassicRiddle(1)).resolves.toEqual(mockRiddle);

    await expect(mockService.fetchRiddleById("test")).resolves.toEqual(mockRiddle);
    await expect(mockService.getClassicRiddleCount()).resolves.toBe(100);
  });

  it("should handle method parameters correctly", () => {
    const mockService: IRiddleDataService = {
      fetchDailyRiddle: jest.fn(),
      fetchClassicRiddle: jest.fn(),
      fetchRiddleById: jest.fn(),
      getClassicRiddleCount: jest.fn(),
    };

    mockService.fetchDailyRiddle();
    mockService.fetchClassicRiddle(5);
    mockService.fetchRiddleById("riddle-123");
    mockService.getClassicRiddleCount();

    expect(mockService.fetchDailyRiddle).toHaveBeenCalledWith();
    expect(mockService.fetchClassicRiddle).toHaveBeenCalledWith(5);
    expect(mockService.fetchRiddleById).toHaveBeenCalledWith("riddle-123");
    expect(mockService.getClassicRiddleCount).toHaveBeenCalledWith();
  });

  it("should work with null return values", async () => {
    const mockService: IRiddleDataService = {
      fetchDailyRiddle: jest.fn().mockResolvedValue(null),
      fetchClassicRiddle: jest.fn().mockResolvedValue(null),
      fetchRiddleById: jest.fn().mockResolvedValue(null),
      getClassicRiddleCount: jest.fn().mockResolvedValue(0),
    };

    await expect(mockService.fetchDailyRiddle()).resolves.toBeNull();
    await expect(mockService.fetchClassicRiddle(1)).resolves.toBeNull();
    await expect(mockService.fetchRiddleById("nonexistent")).resolves.toBeNull();
    await expect(mockService.getClassicRiddleCount()).resolves.toBe(0);
  });
});
