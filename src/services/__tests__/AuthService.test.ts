// Create mock auth instance before any imports
const mockAuthInstance = {
  currentUser: null,
  onAuthStateChanged: jest.fn((callback) => {
    setTimeout(() => callback(null), 0);
    return jest.fn();
  }),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  signInWithCredential: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
};

// Mock Firebase auth module completely before imports
jest.mock("@react-native-firebase/auth", () => ({
  __esModule: true,
  default: () => mockAuthInstance, // Return the auth instance directly
  GoogleAuthProvider: {
    credential: jest.fn((idToken) => ({
      type: "google.com",
      token: idToken,
      providerId: "google.com",
    })),
  },
  FacebookAuthProvider: {
    credential: jest.fn((accessToken) => ({
      type: "facebook.com",
      token: accessToken,
      providerId: "facebook.com",
    })),
  },
}));

// Mock Google Sign-In
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
  },
  statusCodes: { PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE" },
}));

// Mock Facebook SDK
jest.mock("react-native-fbsdk-next", () => ({
  LoginManager: {
    logInWithPermissions: jest.fn(),
  },
  AccessToken: {
    getCurrentAccessToken: jest.fn(),
  },
}));

// Mock React Native InteractionManager
jest.mock("react-native", () => ({
  InteractionManager: {
    runAfterInteractions: jest.fn((callback) => {
      // Run callback immediately in tests
      return Promise.resolve().then(callback);
    }),
  },
}));

// Now import after mocks are set up
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { AccessToken, LoginManager } from "react-native-fbsdk-next";
import { AuthService } from "../AuthService";

describe("AuthService", () => {
  const mockEmail = "test@example.com";
  const mockPassword = "password123";
  const mockUserCredential = { user: { uid: "test-uid" } } as any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup auth instance mocks with default resolved values
    mockAuthInstance.createUserWithEmailAndPassword.mockResolvedValue(
      mockUserCredential
    );
    mockAuthInstance.signInWithEmailAndPassword.mockResolvedValue(
      mockUserCredential
    );
    mockAuthInstance.sendPasswordResetEmail.mockResolvedValue(undefined);
    mockAuthInstance.signOut.mockResolvedValue(undefined);
    mockAuthInstance.signInWithCredential.mockResolvedValue(mockUserCredential);

    // Mock GoogleSignin specifics
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
      data: { idToken: "mockGoogleIdToken" },
      user: { email: "user@google.com" },
    });

    // Mock Facebook specifics
    (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValue({
      isCancelled: false,
      grantedPermissions: ["email"],
    });
    (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValue({
      accessToken: "mockFbAccessToken",
    });
  });

  describe("signUpWithEmail", () => {
    it("should call createUserWithEmailAndPassword and return user credential", async () => {
      const result = await AuthService.signUpWithEmail(mockEmail, mockPassword);

      expect(
        mockAuthInstance.createUserWithEmailAndPassword
      ).toHaveBeenCalledWith(mockEmail, mockPassword);
      expect(result).toEqual(mockUserCredential);
    });

    it("should throw an error if createUserWithEmailAndPassword fails", async () => {
      const errorMessage = "Sign up failed";
      mockAuthInstance.createUserWithEmailAndPassword.mockRejectedValueOnce(
        new Error(errorMessage)
      );

      await expect(
        AuthService.signUpWithEmail(mockEmail, mockPassword)
      ).rejects.toThrow(errorMessage);
    });
  });

  describe("loginWithEmail", () => {
    it("should call signInWithEmailAndPassword and return user credential", async () => {
      const result = await AuthService.loginWithEmail(mockEmail, mockPassword);

      expect(mockAuthInstance.signInWithEmailAndPassword).toHaveBeenCalledWith(
        mockEmail,
        mockPassword
      );
      expect(result).toEqual(mockUserCredential);
    });

    it("should throw an error if signInWithEmailAndPassword fails", async () => {
      const errorMessage = "Login failed";
      mockAuthInstance.signInWithEmailAndPassword.mockRejectedValueOnce(
        new Error(errorMessage)
      );

      await expect(
        AuthService.loginWithEmail(mockEmail, mockPassword)
      ).rejects.toThrow(errorMessage);
    });
  });

  describe("sendPasswordResetEmail", () => {
    it("should call sendPasswordResetEmail", async () => {
      await AuthService.sendPasswordResetEmail(mockEmail);

      expect(mockAuthInstance.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockEmail
      );
    });

    it("should throw an error if sendPasswordResetEmail fails", async () => {
      const errorMessage = "Reset email failed";
      mockAuthInstance.sendPasswordResetEmail.mockRejectedValueOnce(
        new Error(errorMessage)
      );

      await expect(
        AuthService.sendPasswordResetEmail(mockEmail)
      ).rejects.toThrow(errorMessage);
    });
  });

  describe("logout", () => {
    it("should call signOut", async () => {
      await AuthService.logout();

      expect(mockAuthInstance.signOut).toHaveBeenCalledTimes(1);
    });

    it("should throw an error if signOut fails", async () => {
      const errorMessage = "Sign out failed";
      mockAuthInstance.signOut.mockRejectedValueOnce(new Error(errorMessage));

      await expect(AuthService.logout()).rejects.toThrow(errorMessage);
    });
  });
});
