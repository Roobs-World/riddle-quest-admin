/** Existing Auth profile returned by the deletion sentinel helper. */
let existingUser: {providerData: Array<{providerId: string}>} | undefined;
/** Reads the deterministic Auth UID. */
const mockGetUser = jest.fn(async () => {
  if (!existingUser) throw {code: "auth/user-not-found"};
  return existingUser;
});
/** Creates a missing disabled Auth sentinel. */
const mockCreateUser = jest.fn(async () => ({uid: "jest-user"}));
/** Minimizes and disables an existing Auth profile. */
const mockUpdateUser = jest.fn(async () => ({uid: "jest-user"}));
/** Clears stored custom claims. */
const mockSetCustomUserClaims = jest.fn(async () => undefined);
/** Revokes all older refresh tokens. */
const mockRevokeRefreshTokens = jest.fn(async () => undefined);

jest.mock("../shared/firebaseAdmin", () => ({
  admin: {
    auth: () => ({
      getUser: mockGetUser,
      createUser: mockCreateUser,
      updateUser: mockUpdateUser,
      setCustomUserClaims: mockSetCustomUserClaims,
      revokeRefreshTokens: mockRevokeRefreshTokens,
    }),
  },
}));

import {deletedJestAuthEmail, preserveDeletedJestAuthUser} from "../jest/jestDeletedAuthUser";

describe("deleted Jest Auth sentinel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    existingUser = {providerData: [{providerId: "google.com"}, {providerId: "google.com"}]};
  });

  it("disables and minimizes an existing record before revoking sessions", async () => {
    await preserveDeletedJestAuthUser("jest-user");

    expect(mockUpdateUser).toHaveBeenCalledWith("jest-user", {
      disabled: true,
      displayName: null,
      email: "deleted-jest-user@players.jest.invalid",
      emailVerified: false,
      phoneNumber: null,
      photoURL: null,
      multiFactor: {enrolledFactors: null},
      providersToUnlink: ["google.com"],
    });
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("jest-user", null);
    expect(mockRevokeRefreshTokens).toHaveBeenCalledWith("jest-user");
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("creates an idempotent disabled record when the Auth user is missing", async () => {
    existingUser = undefined;

    await preserveDeletedJestAuthUser("jest-missing");

    expect(mockCreateUser).toHaveBeenCalledWith({
      uid: "jest-missing",
      disabled: true,
      email: deletedJestAuthEmail("jest-missing"),
      emailVerified: false,
    });
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("jest-missing", null);
    expect(mockRevokeRefreshTokens).toHaveBeenCalledWith("jest-missing");
  });

  it("converges when token redemption creates the UID during sentinel creation", async () => {
    existingUser = undefined;
    mockCreateUser.mockImplementationOnce(async () => {
      existingUser = {providerData: []};
      throw {code: "auth/uid-already-exists"};
    });

    await preserveDeletedJestAuthUser("jest-raced");

    expect(mockGetUser).toHaveBeenCalledTimes(2);
    expect(mockUpdateUser).toHaveBeenCalledWith(
      "jest-raced",
      expect.objectContaining({disabled: true, email: deletedJestAuthEmail("jest-raced")}),
    );
    expect(mockRevokeRefreshTokens).toHaveBeenCalledWith("jest-raced");
  });

  it("recreates the disabled sentinel if a concurrent legacy deletion removes it", async () => {
    mockSetCustomUserClaims.mockRejectedValueOnce({code: "auth/user-not-found"});
    existingUser = {providerData: []};
    mockGetUser.mockImplementationOnce(async () => existingUser!)
      .mockImplementationOnce(async () => { throw {code: "auth/user-not-found"}; });

    await preserveDeletedJestAuthUser("jest-retry");

    expect(mockCreateUser).toHaveBeenCalledWith(expect.objectContaining({uid: "jest-retry", disabled: true}));
    expect(mockSetCustomUserClaims).toHaveBeenCalledTimes(2);
    expect(mockRevokeRefreshTokens).toHaveBeenCalledTimes(1);
  });
});
