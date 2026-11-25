import {beforeEach, describe, expect, jest, test} from "@jest/globals";
import {getFunctions, httpsCallable} from "firebase/functions";
import {createFirebaseNotificationRegistration} from "../firebaseRegistration";

const mockCreate = jest.fn<(input: unknown) => Promise<{data: unknown}>>();
let mockUid = "verified-account";
jest.mock("firebase/functions", () => ({
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(() => (input: unknown) => mockCreate(input)),
}));
jest.mock("../../../platform/firebase/browserEnvironment", () => ({firebaseEnvironment: {gameplayRegion: "europe-west1"}}));
jest.mock("../../../platform/firebase/browserClient", () => ({
  auth: {get currentUser() {return mockUid ? {uid: mockUid} : null;}}, firebaseApp: {},
}));

const origin = "https://notifications.example";
const code = "a".repeat(64);
const validLink = () => ({url: `${origin}/push/#pair=${code}`, expiresAtMs: Date.now() + 600_000});
const run = <Result,>(operation: () => Promise<Result>) => operation();
const registration = (isCurrent = () => true, managerOrigin = origin) => createFirebaseNotificationRegistration({
  expectedUid: "verified-account", managerOrigin, locale: () => "en", isCurrent, run,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUid = "verified-account";
  mockCreate.mockResolvedValue({data: validLink()});
});

describe("authenticated notification manager registration", () => {
  test("only issues a validated registration handoff through the existing authenticated callable", async () => {
    const link = validLink();
    mockCreate.mockResolvedValue({data: link});
    await expect(registration()()).resolves.toEqual(link);
    expect(getFunctions).toHaveBeenCalledWith(expect.anything(), "europe-west1");
    expect(httpsCallable).toHaveBeenCalledTimes(1);
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "createNotificationEnrollment");
    expect(mockCreate).toHaveBeenCalledWith({locale: "en"});
  });

  test.each([
    {label: "foreign origin", data: () => ({...validLink(), url: `https://foreign.example/push/#pair=${code}`})},
    {label: "unexpected path", data: () => ({...validLink(), url: `${origin}/other/#pair=${code}`})},
    {label: "query parameters", data: () => ({...validLink(), url: `${origin}/push/?tracking=1#pair=${code}`})},
    {label: "invalid connection code", data: () => ({...validLink(), url: `${origin}/push/#pair=invalid`})},
    {label: "expired handoff", data: () => ({...validLink(), expiresAtMs: Date.now() - 1})},
  ])("does not return a handoff with $label", async ({data}) => {
    mockCreate.mockResolvedValue({data: data()});
    await expect(registration()()).rejects.toThrow();
  });

  test("reports invalid public configuration from the action without crashing construction", async () => {
    const registerAccount = registration(() => true, "not-an-origin");
    await expect(registerAccount()).rejects.toThrow();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("does not call Firebase after account retirement or for a different authenticated UID", async () => {
    await expect(registration(() => false)()).rejects.toThrow("notification-registration-account-changed");
    mockUid = "other-account";
    await expect(registration()()).rejects.toThrow("notification-registration-account-changed");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("rejects a response that arrives after the registration's account changes", async () => {
    let current = true;
    mockCreate.mockImplementationOnce(async () => {current = false; return {data: validLink()};});
    await expect(registration(() => current)()).rejects.toThrow("notification-registration-account-changed");
  });
});
