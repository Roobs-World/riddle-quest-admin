const mockGetDoc = jest.fn();
const mockDoc = jest.fn((_firestore: unknown, collection: string, id: string) => ({collection, id}));
const mockFirestore = {name: "firestore"};

jest.mock("firebase/firestore/lite", () => ({
  doc: (...args: unknown[]) => mockDoc(...args as [unknown, string, string]),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));
jest.mock("../../firebase", () => ({firebaseFirestore: mockFirestore}));

import {loadNotificationCopy} from "../notifications/firebaseCopy";

describe("Jest Firebase notification copy adapter", () => {
  beforeEach(() => {
    mockDoc.mockClear();
    mockGetDoc.mockReset();
  });

  it("requires notification configuration", async () => {
    mockGetDoc.mockResolvedValue({exists: () => false});

    await expect(loadNotificationCopy("en")).rejects.toThrow(
      "Firestore notification copy is not configured.",
    );
    expect(mockDoc).toHaveBeenCalledWith(mockFirestore, "config", "notifications");
  });

  it("parses localized notification configuration", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({locales: {en: {
        dailyBody: "A new puzzle is ready",
        dailyCta: "Play",
        streakBody: "Keep your streak alive",
        streakCta: "Continue",
        weeklyBody: "A weekly puzzle is ready",
        weeklyCta: "Solve",
        raceTitle: "Race to 10",
        raceBody: "A race result is ready",
        raceCta: "View",
      }}}),
    });

    await expect(loadNotificationCopy("en")).resolves.toEqual(expect.any(Object));
    expect(mockDoc).toHaveBeenCalledWith(mockFirestore, "config", "notifications");
  });
});
