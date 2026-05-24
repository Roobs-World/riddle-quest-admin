// Mock getApp for modular Firebase API
jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn(() => ({})),
}));

// Avoid real requestAnimationFrame/setTimeout from safeTimeout (prevents Jest teardown "access after torn down")
jest.mock("../../utils/timing", () => ({
  safeTimeout: jest.fn(() => jest.fn()),
  safeDelay: jest.fn(() => Promise.resolve()),
}));

// Mock logger to suppress output and track calls
jest.mock("../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock sentry to track captureException calls
jest.mock("../../utils/sentry", () => ({
  captureException: jest.fn(),
}));

// Mock React Native first - this must be done before any other imports
jest.mock("react-native", () => ({
  InteractionManager: {
    runAfterInteractions: jest.fn((callback) => {
      return Promise.resolve().then(callback);
    }),
  },
  AppState: {
    addEventListener: jest.fn(() => ({
      remove: jest.fn(),
    })),
    removeEventListener: jest.fn(),
    currentState: "active",
  },
}));

// Mock Facebook SDK before any imports
jest.mock("react-native-fbsdk-next", () => ({
  LoginManager: {
    logInWithPermissions: jest.fn(),
    logOut: jest.fn(),
  },
  AccessToken: {
    getCurrentAccessToken: jest.fn(),
  },
}));

// Mock Google Sign-In
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
  },
  statusCodes: {
    PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
    SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
    IN_PROGRESS: "IN_PROGRESS",
  },
}));

// Mock global fetch for Facebook Graph API calls
global.fetch = jest.fn();

// Create mock auth instance before any imports
const mockAuthInstance = {
  currentUser: null as any,
  onAuthStateChanged: jest.fn((callback) => {
    // Call synchronously to avoid Jest teardown "access after torn down" (no setTimeout)
    callback(null);
    return jest.fn();
  }),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  signInWithCredential: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  signInAnonymously: jest.fn(),
  fetchSignInMethodsForEmail: jest.fn(),
};

// Mock Firebase auth module completely before imports (modular API: getAuth(getApp()))
jest.mock("@react-native-firebase/auth", () => ({
  __esModule: true,
  getAuth: jest.fn(() => mockAuthInstance),
  signOut: jest.fn((auth) => auth.signOut()),
  default: () => mockAuthInstance,
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
  OAuthProvider: jest.fn().mockImplementation((providerId) => ({
    providerId,
  })),
  signInWithPopup: jest.fn(),
}));

// Now import after mocks are set up
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { AccessToken, LoginManager } from "react-native-fbsdk-next";
import {
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
} from "@react-native-firebase/auth";
import { InteractionManager, AppState } from "react-native";
import { AuthService } from "../AuthService";
import { logger } from "../../utils/logger";
import { captureException } from "../../utils/sentry";

describe("AuthService", () => {
  const mockEmail = "test@example.com";
  const mockPassword = "password123";
  const mockUserCredential = {
    user: {
      uid: "test-uid",
      email: mockEmail,
      displayName: "Test User",
      emailVerified: true,
      photoURL: "https://example.com/photo.jpg",
      providerData: [{ providerId: "password", email: mockEmail }],
      reload: jest.fn().mockResolvedValue(undefined),
    },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default successful responses
    mockAuthInstance.createUserWithEmailAndPassword.mockResolvedValue(
      mockUserCredential
    );
    mockAuthInstance.signInWithEmailAndPassword.mockResolvedValue(
      mockUserCredential
    );
    mockAuthInstance.sendPasswordResetEmail.mockResolvedValue(undefined);
    mockAuthInstance.signOut.mockResolvedValue(undefined);
    mockAuthInstance.signInWithCredential.mockResolvedValue(mockUserCredential);
    mockAuthInstance.signInAnonymously.mockResolvedValue(mockUserCredential);
    mockAuthInstance.fetchSignInMethodsForEmail.mockResolvedValue([]);
    mockAuthInstance.currentUser = mockUserCredential.user;

    // Setup Google Sign-In defaults
    (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
      type: "success",
      data: {
        idToken: "mockGoogleIdToken",
        user: { email: "user@google.com", name: "Test Google User" },
      },
    });

    // Setup Facebook defaults
    (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValue({
      isCancelled: false,
      grantedPermissions: ["public_profile", "email"],
    });
    (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValue({
      accessToken: "mockFbAccessToken",
      permissions: ["public_profile", "email"],
      userID: "123456",
      expirationTime: Date.now() + 3600000,
      applicationID: "1249521063516632",
    });

    // Setup InteractionManager default
    (InteractionManager.runAfterInteractions as jest.Mock).mockImplementation(
      (callback) => {
        return Promise.resolve().then(callback);
      }
    );

    // Setup AppState mock
    (AppState.addEventListener as jest.Mock).mockReturnValue({
      remove: jest.fn(),
    });

    // Setup Firebase provider credential mocks
    (GoogleAuthProvider.credential as jest.Mock).mockReturnValue({
      providerId: "google.com",
      token: "mockGoogleIdToken",
    });
    (FacebookAuthProvider.credential as jest.Mock).mockReturnValue({
      providerId: "facebook.com",
      token: "mockFbAccessToken",
    });

    // Setup signInWithPopup mock for Twitter
    (signInWithPopup as jest.Mock).mockResolvedValue(mockUserCredential);

    // Setup fetch mock for Facebook Graph API
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: "123456",
        name: "Test User",
        email: "test@facebook.com",
      }),
    });
  });

  describe("signUpWithEmail", () => {
    it("should successfully create user with email and password", async () => {
      const result = await AuthService.signUpWithEmail(mockEmail, mockPassword);

      expect(
        mockAuthInstance.createUserWithEmailAndPassword
      ).toHaveBeenCalledWith(mockEmail, mockPassword);
      expect(result).toEqual(mockUserCredential);
    });

    it("should handle Firebase auth/email-already-in-use error", async () => {
      const firebaseError = {
        code: "auth/email-already-in-use",
        message: "The email address is already in use by another account.",
      };
      mockAuthInstance.createUserWithEmailAndPassword.mockRejectedValueOnce(
        firebaseError
      );

      await expect(
        AuthService.signUpWithEmail(mockEmail, mockPassword)
      ).rejects.toEqual(firebaseError);
      expect(logger.error).toHaveBeenCalledWith(
        "Error signing up with email:",
        firebaseError
      );
      expect(captureException).toHaveBeenCalledWith(firebaseError);
    });

    it("should handle Firebase auth/weak-password error", async () => {
      const firebaseError = {
        code: "auth/weak-password",
        message: "The password is too weak.",
      };
      mockAuthInstance.createUserWithEmailAndPassword.mockRejectedValueOnce(
        firebaseError
      );

      await expect(
        AuthService.signUpWithEmail(mockEmail, mockPassword)
      ).rejects.toEqual(firebaseError);
      expect(logger.error).toHaveBeenCalledWith(
        "Error signing up with email:",
        firebaseError
      );
    });

    it("should handle Firebase auth/invalid-email error", async () => {
      const firebaseError = {
        code: "auth/invalid-email",
        message: "The email address is not valid.",
      };
      mockAuthInstance.createUserWithEmailAndPassword.mockRejectedValueOnce(
        firebaseError
      );

      await expect(
        AuthService.signUpWithEmail("invalid-email", mockPassword)
      ).rejects.toEqual(firebaseError);
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network request failed");
      mockAuthInstance.createUserWithEmailAndPassword.mockRejectedValueOnce(
        networkError
      );

      await expect(
        AuthService.signUpWithEmail(mockEmail, mockPassword)
      ).rejects.toThrow("Network request failed");
      expect(logger.error).toHaveBeenCalledWith(
        "Error signing up with email:",
        networkError
      );
    });

    it("should handle empty email", async () => {
      const emptyEmailError = {
        code: "auth/invalid-email",
        message: "The email address is not valid.",
      };
      mockAuthInstance.createUserWithEmailAndPassword.mockRejectedValueOnce(
        emptyEmailError
      );

      await expect(
        AuthService.signUpWithEmail("", mockPassword)
      ).rejects.toEqual(emptyEmailError);
    });

    it("should handle empty password", async () => {
      const emptyPasswordError = {
        code: "auth/missing-password",
        message: "Password is required.",
      };
      mockAuthInstance.createUserWithEmailAndPassword.mockRejectedValueOnce(
        emptyPasswordError
      );

      await expect(AuthService.signUpWithEmail(mockEmail, "")).rejects.toEqual(
        emptyPasswordError
      );
    });
  });

  describe("loginWithEmail", () => {
    it("should successfully sign in with email and password", async () => {
      const result = await AuthService.loginWithEmail(mockEmail, mockPassword);

      expect(mockAuthInstance.signInWithEmailAndPassword).toHaveBeenCalledWith(
        mockEmail,
        mockPassword
      );
      expect(result).toEqual(mockUserCredential);
    });

    it("should handle Firebase auth/user-not-found error", async () => {
      const firebaseError = {
        code: "auth/user-not-found",
        message: "There is no user record corresponding to this identifier.",
      };
      mockAuthInstance.signInWithEmailAndPassword.mockRejectedValueOnce(
        firebaseError
      );

      await expect(
        AuthService.loginWithEmail(mockEmail, mockPassword)
      ).rejects.toEqual(firebaseError);
      expect(logger.error).toHaveBeenCalledWith(
        "Error logging in with email:",
        firebaseError
      );
      expect(captureException).toHaveBeenCalledWith(firebaseError);
    });

    it("should handle Firebase auth/wrong-password error", async () => {
      const firebaseError = {
        code: "auth/wrong-password",
        message: "The password is invalid.",
      };
      mockAuthInstance.signInWithEmailAndPassword.mockRejectedValueOnce(
        firebaseError
      );

      await expect(
        AuthService.loginWithEmail(mockEmail, "wrongpassword")
      ).rejects.toEqual(firebaseError);
    });

    it("should handle Firebase auth/invalid-email error", async () => {
      const firebaseError = {
        code: "auth/invalid-email",
        message: "The email address is not valid.",
      };
      mockAuthInstance.signInWithEmailAndPassword.mockRejectedValueOnce(
        firebaseError
      );

      await expect(
        AuthService.loginWithEmail("invalid-email", mockPassword)
      ).rejects.toEqual(firebaseError);
    });

    it("should handle Firebase auth/user-disabled error", async () => {
      const firebaseError = {
        code: "auth/user-disabled",
        message: "The user account has been disabled by an administrator.",
      };
      mockAuthInstance.signInWithEmailAndPassword.mockRejectedValueOnce(
        firebaseError
      );

      await expect(
        AuthService.loginWithEmail(mockEmail, mockPassword)
      ).rejects.toEqual(firebaseError);
    });

    it("should handle too-many-requests error", async () => {
      const firebaseError = {
        code: "auth/too-many-requests",
        message:
          "Too many unsuccessful login attempts. Please try again later.",
      };
      mockAuthInstance.signInWithEmailAndPassword.mockRejectedValueOnce(
        firebaseError
      );

      await expect(
        AuthService.loginWithEmail(mockEmail, mockPassword)
      ).rejects.toEqual(firebaseError);
    });

    it("should handle operation-not-allowed error", async () => {
      const firebaseError = {
        code: "auth/operation-not-allowed",
        message: "Email/password accounts are not enabled.",
      };
      mockAuthInstance.signInWithEmailAndPassword.mockRejectedValueOnce(
        firebaseError
      );

      await expect(
        AuthService.loginWithEmail(mockEmail, mockPassword)
      ).rejects.toEqual(firebaseError);
    });
  });

  describe("sendPasswordResetEmail", () => {
    it("should successfully send password reset email", async () => {
      await AuthService.sendPasswordResetEmail(mockEmail);

      expect(mockAuthInstance.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockEmail
      );
      expect(logger.debug).toHaveBeenCalledWith(
        "Password reset email sent successfully."
      );
    });

    it("should handle Firebase auth/user-not-found error", async () => {
      const firebaseError = {
        code: "auth/user-not-found",
        message: "There is no user record corresponding to this identifier.",
      };
      mockAuthInstance.sendPasswordResetEmail.mockRejectedValueOnce(
        firebaseError
      );

      await expect(
        AuthService.sendPasswordResetEmail(mockEmail)
      ).rejects.toEqual(firebaseError);
      expect(logger.error).toHaveBeenCalledWith(
        "Error sending password reset email:",
        firebaseError
      );
      expect(captureException).toHaveBeenCalledWith(firebaseError);
    });

    it("should handle Firebase auth/invalid-email error", async () => {
      const firebaseError = {
        code: "auth/invalid-email",
        message: "The email address is not valid.",
      };
      mockAuthInstance.sendPasswordResetEmail.mockRejectedValueOnce(
        firebaseError
      );

      await expect(
        AuthService.sendPasswordResetEmail("invalid-email")
      ).rejects.toEqual(firebaseError);
    });

    it("should handle Firebase auth/too-many-requests error", async () => {
      const firebaseError = {
        code: "auth/too-many-requests",
        message: "Too many requests. Try again later.",
      };
      mockAuthInstance.sendPasswordResetEmail.mockRejectedValueOnce(
        firebaseError
      );

      await expect(
        AuthService.sendPasswordResetEmail(mockEmail)
      ).rejects.toEqual(firebaseError);
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network request failed");
      mockAuthInstance.sendPasswordResetEmail.mockRejectedValueOnce(
        networkError
      );

      await expect(
        AuthService.sendPasswordResetEmail(mockEmail)
      ).rejects.toThrow("Network request failed");
      expect(logger.error).toHaveBeenCalledWith(
        "Error sending password reset email:",
        networkError
      );
    });
  });

  describe("signInWithGoogle", () => {
    it("should successfully sign in with Google", async () => {
      const result = await AuthService.signInWithGoogle();

      expect(InteractionManager.runAfterInteractions).toHaveBeenCalled();
      expect(GoogleSignin.hasPlayServices).toHaveBeenCalledWith({
        showPlayServicesUpdateDialog: true,
      });
      expect(GoogleSignin.signIn).toHaveBeenCalled();
      expect(GoogleAuthProvider.credential).toHaveBeenCalledWith(
        "mockGoogleIdToken"
      );
      expect(mockAuthInstance.signInWithCredential).toHaveBeenCalled();
      expect(result).toEqual(mockUserCredential);
    });

    it("should handle Google Play Services not available", async () => {
      const playServicesError = {
        code: "PLAY_SERVICES_NOT_AVAILABLE",
        message: "Google Play Services not available",
      };
      (GoogleSignin.hasPlayServices as jest.Mock).mockRejectedValueOnce(
        playServicesError
      );

      await expect(AuthService.signInWithGoogle()).rejects.toEqual(
        playServicesError
      );
      expect(logger.error).toHaveBeenCalledWith(
        "Error signing in with Google:",
        playServicesError
      );
      expect(captureException).toHaveBeenCalledWith(playServicesError);
    });

    it("should handle Google sign-in cancellation (v14+ style)", async () => {
      (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
        type: "cancelled",
      });

      await expect(AuthService.signInWithGoogle()).rejects.toThrow(
        "Google sign-in cancelled by user."
      );
    });

    it("should handle Google sign-in cancellation error with correct code", async () => {
      (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
        type: "cancelled",
      });

      try {
        await AuthService.signInWithGoogle();
      } catch (error: any) {
        expect(error.code).toBe("auth/auth-popup-closed-by-user");
      }
    });

    it("should handle Google sign-in rejection error", async () => {
      const cancelledError = {
        code: "SIGN_IN_CANCELLED",
        message: "User cancelled the login flow",
      };
      (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce(cancelledError);

      await expect(AuthService.signInWithGoogle()).rejects.toEqual(
        cancelledError
      );
    });

    it("should handle Google sign-in in progress error", async () => {
      const inProgressError = {
        code: "IN_PROGRESS",
        message: "Operation already in progress",
      };
      (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce(inProgressError);

      await expect(AuthService.signInWithGoogle()).rejects.toEqual(
        inProgressError
      );
    });

    it("should handle missing ID token from Google", async () => {
      (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
        type: "success",
        data: { idToken: null, user: { email: "user@google.com" } },
      });

      await expect(AuthService.signInWithGoogle()).rejects.toThrow(
        "No ID token received from Google Sign-In"
      );
      expect(logger.error).toHaveBeenCalledWith(
        "Error signing in with Google:",
        expect.any(Error)
      );
    });

    it("should handle missing data object from Google", async () => {
      (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
        type: "success",
        data: null,
      });

      await expect(AuthService.signInWithGoogle()).rejects.toThrow(
        "No ID token received from Google Sign-In"
      );
    });

    it("should handle undefined idToken in data object", async () => {
      (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
        type: "success",
        data: { idToken: undefined, user: { email: "user@google.com" } },
      });

      await expect(AuthService.signInWithGoogle()).rejects.toThrow(
        "No ID token received from Google Sign-In"
      );
    });

    it("should handle missing email from Google sign-in", async () => {
      (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
        type: "success",
        data: { idToken: "mockGoogleIdToken", user: { email: null } },
      });

      await expect(AuthService.signInWithGoogle()).rejects.toThrow(
        "Email address not provided by Google"
      );
    });

    it("should handle missing user object from Google sign-in", async () => {
      (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
        type: "success",
        data: { idToken: "mockGoogleIdToken", user: null },
      });

      await expect(AuthService.signInWithGoogle()).rejects.toThrow(
        "Email address not provided by Google"
      );
    });

    it("should handle Firebase credential sign-in failure", async () => {
      const firebaseError = {
        code: "auth/invalid-credential",
        message: "The supplied auth credential is invalid.",
      };
      mockAuthInstance.signInWithCredential.mockRejectedValueOnce(
        firebaseError
      );

      await expect(AuthService.signInWithGoogle()).rejects.toEqual(
        firebaseError
      );
      expect(logger.error).toHaveBeenCalledWith(
        "Error signing in with Google:",
        firebaseError
      );
    });

    it("should log successful authentication details", async () => {
      await AuthService.signInWithGoogle();

      expect(logger.debug).toHaveBeenCalledWith(
        "✅ Google authentication successful:",
        expect.objectContaining({
          uid: "test-uid",
          email: mockEmail,
          displayName: "Test User",
        })
      );
    });
  });

  describe("signInWithTwitter", () => {
    it("should successfully sign in with Twitter", async () => {
      const result = await AuthService.signInWithTwitter();

      expect(signInWithPopup).toHaveBeenCalled();
      expect(result).toEqual(mockUserCredential);
      expect(logger.debug).toHaveBeenCalledWith(
        "✅ Twitter/X authentication successful:",
        expect.objectContaining({
          uid: "test-uid",
        })
      );
    });

    it("should handle Twitter sign-in errors", async () => {
      const twitterError = new Error("Twitter sign-in failed");
      (signInWithPopup as jest.Mock).mockRejectedValueOnce(twitterError);

      await expect(AuthService.signInWithTwitter()).rejects.toThrow(
        "Twitter sign-in failed"
      );
      expect(logger.error).toHaveBeenCalledWith(
        "Error signing in with Twitter/X:",
        twitterError
      );
      expect(captureException).toHaveBeenCalledWith(twitterError);
    });

    it("should handle Twitter popup closed error", async () => {
      const popupClosedError = {
        code: "auth/popup-closed-by-user",
        message: "The popup has been closed by the user",
      };
      (signInWithPopup as jest.Mock).mockRejectedValueOnce(popupClosedError);

      await expect(AuthService.signInWithTwitter()).rejects.toEqual(
        popupClosedError
      );
    });

    it("should handle network errors during Twitter sign-in", async () => {
      const networkError = {
        code: "auth/network-request-failed",
        message: "A network error has occurred",
      };
      (signInWithPopup as jest.Mock).mockRejectedValueOnce(networkError);

      await expect(AuthService.signInWithTwitter()).rejects.toEqual(
        networkError
      );
    });
  });

  describe("signInWithFacebook", () => {
    it("should successfully sign in with Facebook", async () => {
      const result = await AuthService.signInWithFacebook();

      expect(LoginManager.logInWithPermissions).toHaveBeenCalledWith([
        "public_profile",
        "email",
      ]);
      expect(AccessToken.getCurrentAccessToken).toHaveBeenCalled();
      expect(FacebookAuthProvider.credential).toHaveBeenCalledWith(
        "mockFbAccessToken"
      );
      expect(mockAuthInstance.signInWithCredential).toHaveBeenCalled();
      expect(result).toEqual(mockUserCredential);
    });

    it("should handle Facebook login cancellation via isCancelled flag", async () => {
      (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({
        isCancelled: true,
      });

      await expect(AuthService.signInWithFacebook()).resolves.toBeNull();
      expect(AccessToken.getCurrentAccessToken).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
      expect(captureException).not.toHaveBeenCalled();
    });

    it("should handle Facebook login cancellation via rejection", async () => {
      (LoginManager.logInWithPermissions as jest.Mock).mockRejectedValueOnce(
        new Error("User cancelled the login process")
      );

      await expect(AuthService.signInWithFacebook()).resolves.toBeNull();
      expect(logger.error).not.toHaveBeenCalled();
      expect(captureException).not.toHaveBeenCalled();
    });

    it("should handle Facebook access token retrieval failure", async () => {
      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValueOnce(
        null
      );

      await expect(AuthService.signInWithFacebook()).rejects.toThrow(
        "Facebook access token error. Please try again."
      );
    });

    it("should handle Facebook SDK not properly configured", async () => {
      const originalLogInWithPermissions = LoginManager.logInWithPermissions;
      // Temporarily override to simulate SDK issue
      (LoginManager as any).logInWithPermissions = undefined;

      await expect(AuthService.signInWithFacebook()).rejects.toThrow(
        "Facebook SDK not properly initialized"
      );

      // Restore
      (LoginManager as any).logInWithPermissions = originalLogInWithPermissions;
    });

    it("should handle missing email permission", async () => {
      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValueOnce({
        accessToken: "mockFbAccessToken",
        permissions: ["public_profile"], // Missing email permission
        userID: "123456",
      });

      await expect(AuthService.signInWithFacebook()).rejects.toThrow(
        "Email permission not granted"
      );
      expect(LoginManager.logOut).toHaveBeenCalled();
    });

    it("should handle App Access Token (GG| prefix)", async () => {
      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValueOnce({
        accessToken: "GG|invalid_app_token",
        permissions: ["public_profile", "email"],
        userID: "123456",
      });

      await expect(AuthService.signInWithFacebook()).rejects.toThrow(
        "Invalid token type: received App Access Token instead of User Access Token"
      );
    });

    it("should handle auth/account-exists-with-different-credential error with Google linking", async () => {
      const firebaseError = {
        code: "auth/account-exists-with-different-credential",
        message: "Account exists with different credential",
        email: "test@example.com",
      };
      mockAuthInstance.signInWithCredential.mockRejectedValueOnce(
        firebaseError
      );
      mockAuthInstance.fetchSignInMethodsForEmail.mockResolvedValueOnce([
        "google.com",
      ]);

      // Mock successful Google sign-in for linking
      (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
        type: "success",
        data: { idToken: "mockGoogleIdToken", user: { email: "test@example.com" } },
      });

      const linkedUserCredential = {
        user: {
          ...mockUserCredential.user,
          linkWithCredential: jest.fn().mockResolvedValue(mockUserCredential),
        },
      };
      mockAuthInstance.signInWithCredential.mockResolvedValueOnce(
        linkedUserCredential
      );

      const result = await AuthService.signInWithFacebook();
      expect(result).toEqual(mockUserCredential);
    });

    it("should handle auth/account-exists-with-different-credential error with password account", async () => {
      const firebaseError = {
        code: "auth/account-exists-with-different-credential",
        message: "Account exists with different credential",
      };
      mockAuthInstance.signInWithCredential.mockRejectedValueOnce(
        firebaseError
      );
      mockAuthInstance.fetchSignInMethodsForEmail.mockResolvedValueOnce([
        "password",
      ]);

      await expect(AuthService.signInWithFacebook()).rejects.toThrow(
        "Account exists with email/password"
      );
    });

    it("should handle auth/auth-popup-closed-by-user error as a quiet cancellation", async () => {
      const firebaseError = {
        code: "auth/auth-popup-closed-by-user",
        message: "User closed popup",
      };
      mockAuthInstance.signInWithCredential.mockRejectedValueOnce(
        firebaseError
      );

      await expect(AuthService.signInWithFacebook()).resolves.toBeNull();
      expect(logger.error).not.toHaveBeenCalled();
      expect(captureException).not.toHaveBeenCalled();
    });

    it("should handle auth/operation-not-supported-in-this-environment error", async () => {
      const firebaseError = {
        code: "auth/operation-not-supported-in-this-environment",
        message: "Operation not supported",
      };
      mockAuthInstance.signInWithCredential.mockRejectedValueOnce(
        firebaseError
      );

      await expect(AuthService.signInWithFacebook()).rejects.toThrow(
        "Facebook login is not supported in this environment."
      );
    });

    it("should handle auth/network-request-failed error", async () => {
      const firebaseError = {
        code: "auth/network-request-failed",
        message: "Network request failed",
      };
      mockAuthInstance.signInWithCredential.mockRejectedValueOnce(
        firebaseError
      );

      await expect(AuthService.signInWithFacebook()).rejects.toThrow(
        "Network error during Facebook login"
      );
    });

    it("should handle auth/invalid-credential error", async () => {
      const firebaseError = {
        code: "auth/invalid-credential",
        message: "Invalid credential",
      };
      mockAuthInstance.signInWithCredential.mockRejectedValueOnce(
        firebaseError
      );

      await expect(AuthService.signInWithFacebook()).rejects.toThrow(
        "Invalid Facebook credentials. Please try again."
      );
    });

    it("should handle unknown Firebase errors by rethrowing", async () => {
      const firebaseError = {
        code: "auth/unknown-error",
        message: "Unknown error occurred",
      };
      mockAuthInstance.signInWithCredential.mockRejectedValueOnce(
        firebaseError
      );

      await expect(AuthService.signInWithFacebook()).rejects.toEqual(
        firebaseError
      );
    });

    it("should handle non-Firebase errors by rethrowing", async () => {
      const networkError = new Error("Network connection failed");
      (LoginManager.logInWithPermissions as jest.Mock).mockRejectedValueOnce(
        networkError
      );

      await expect(AuthService.signInWithFacebook()).rejects.toThrow(
        "Network connection failed"
      );
    });

    it("should proceed with sign-in when LoginManager.logOut throws during session clear", async () => {
      (LoginManager.logOut as jest.Mock).mockImplementationOnce(() => {
        throw new Error("Logout failed");
      });

      const result = await AuthService.signInWithFacebook();

      expect(result).toEqual(mockUserCredential);
      expect(logger.warn).toHaveBeenCalledWith(
        "⚠️ Facebook logout warning:",
        expect.any(Error)
      );
    });

    it("should log permission warnings when no permissions granted", async () => {
      (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({
        isCancelled: false,
        grantedPermissions: [],
        declinedPermissions: ["email", "public_profile"],
      });

      // Still provide valid access token with email permission for this path
      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValueOnce({
        accessToken: "mockFbAccessToken",
        permissions: ["public_profile", "email"],
        userID: "123456",
      });

      await AuthService.signInWithFacebook();
      expect(logger.warn).toHaveBeenCalledWith(
        "⚠️ No permissions granted by Facebook"
      );
    });

    it("should log declined permissions warning", async () => {
      (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({
        isCancelled: false,
        grantedPermissions: ["public_profile"],
        declinedPermissions: ["email"],
      });

      // Mock with email permission in token for this test path
      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValueOnce({
        accessToken: "mockFbAccessToken",
        permissions: ["public_profile", "email"],
        userID: "123456",
      });

      await AuthService.signInWithFacebook();
      expect(logger.warn).toHaveBeenCalledWith(
        "❌ Some permissions were declined:",
        ["email"]
      );
    });

    it("should attempt Facebook Graph API when Firebase user has no email", async () => {
      const userCredentialNoEmail = {
        user: {
          uid: "test-uid",
          email: null,
          displayName: "Test User",
          emailVerified: false,
          providerData: [],
          reload: jest.fn().mockResolvedValue(undefined),
        },
      };
      mockAuthInstance.signInWithCredential.mockResolvedValueOnce(
        userCredentialNoEmail
      );
      mockAuthInstance.currentUser = { ...userCredentialNoEmail.user, email: null };

      await AuthService.signInWithFacebook();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("https://graph.facebook.com/me")
      );
    });

    it("should handle Facebook Graph API error gracefully", async () => {
      const userCredentialNoEmail = {
        user: {
          uid: "test-uid",
          email: null,
          displayName: "Test User",
          reload: jest.fn().mockResolvedValue(undefined),
        },
      };
      mockAuthInstance.signInWithCredential.mockResolvedValueOnce(
        userCredentialNoEmail
      );
      mockAuthInstance.currentUser = { ...userCredentialNoEmail.user, email: null };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      });

      // Should not throw, just log the error
      const result = await AuthService.signInWithFacebook();
      expect(result).toEqual(userCredentialNoEmail);
      expect(logger.error).toHaveBeenCalledWith(
        "❌ Facebook Graph API call failed:",
        expect.any(Error)
      );
    });

    it("should handle Facebook Graph API returning no email", async () => {
      const userCredentialNoEmail = {
        user: {
          uid: "test-uid",
          email: null,
          displayName: "Test User",
          reload: jest.fn().mockResolvedValue(undefined),
        },
      };
      mockAuthInstance.signInWithCredential.mockResolvedValueOnce(
        userCredentialNoEmail
      );
      mockAuthInstance.currentUser = { ...userCredentialNoEmail.user, email: null };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: "123456",
          name: "Test User",
          // No email field
        }),
      });

      await AuthService.signInWithFacebook();
      expect(logger.warn).toHaveBeenCalledWith(
        "⚠️ Facebook Graph API also didn't provide email address"
      );
    });

    it("should handle account linking cancellation by user", async () => {
      const firebaseError = {
        code: "auth/account-exists-with-different-credential",
        message: "Account exists with different credential",
      };
      mockAuthInstance.signInWithCredential.mockRejectedValueOnce(
        firebaseError
      );
      mockAuthInstance.fetchSignInMethodsForEmail.mockResolvedValueOnce([]);

      // User cancels Google sign-in during linking
      (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce(
        new Error("User cancelled the login flow")
      );

      await expect(AuthService.signInWithFacebook()).resolves.toBeNull();
    });
  });

  describe("signInAnonymously", () => {
    it("should successfully sign in anonymously", async () => {
      const anonymousUserCredential = {
        user: {
          uid: "anonymous-uid",
          isAnonymous: true,
        },
      };
      mockAuthInstance.signInAnonymously.mockResolvedValueOnce(
        anonymousUserCredential
      );

      const result = await AuthService.signInAnonymously();

      expect(mockAuthInstance.signInAnonymously).toHaveBeenCalled();
      expect(result).toEqual(anonymousUserCredential);
      expect(logger.debug).toHaveBeenCalledWith(
        "✅ Anonymous sign-in successful:",
        "anonymous-uid"
      );
    });

    it("should handle anonymous sign-in errors", async () => {
      const signInError = {
        code: "auth/operation-not-allowed",
        message: "Anonymous sign-in is not enabled",
      };
      mockAuthInstance.signInAnonymously.mockRejectedValueOnce(signInError);

      await expect(AuthService.signInAnonymously()).rejects.toEqual(
        signInError
      );
      expect(logger.error).toHaveBeenCalledWith(
        "Error signing in anonymously:",
        signInError
      );
      expect(captureException).toHaveBeenCalledWith(signInError);
    });

    it("should handle network errors during anonymous sign-in", async () => {
      const networkError = new Error("Network request failed");
      mockAuthInstance.signInAnonymously.mockRejectedValueOnce(networkError);

      await expect(AuthService.signInAnonymously()).rejects.toThrow(
        "Network request failed"
      );
    });

    it("should handle too-many-requests error during anonymous sign-in", async () => {
      const rateLimitError = {
        code: "auth/too-many-requests",
        message: "Too many requests",
      };
      mockAuthInstance.signInAnonymously.mockRejectedValueOnce(rateLimitError);

      await expect(AuthService.signInAnonymously()).rejects.toEqual(
        rateLimitError
      );
    });
  });

  describe("logout", () => {
    it("should successfully sign out", async () => {
      await AuthService.logout();

      expect(mockAuthInstance.signOut).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith("User signed out successfully.");
    });

    it("should handle Firebase signOut errors", async () => {
      const signOutError = {
        code: "auth/network-request-failed",
        message: "Network error during sign out",
      };
      mockAuthInstance.signOut.mockRejectedValueOnce(signOutError);

      await expect(AuthService.logout()).rejects.toEqual(signOutError);
      expect(logger.error).toHaveBeenCalledWith(
        "Error signing out:",
        signOutError
      );
      expect(captureException).toHaveBeenCalledWith(signOutError);
    });

    it("should handle unknown signOut errors", async () => {
      const unknownError = new Error("Unknown error during logout");
      mockAuthInstance.signOut.mockRejectedValueOnce(unknownError);

      await expect(AuthService.logout()).rejects.toThrow(
        "Unknown error during logout"
      );
      expect(logger.error).toHaveBeenCalledWith(
        "Error signing out:",
        unknownError
      );
    });
  });

  describe("diagnoseFacebookSetup", () => {
    it("should return configured status when SDK is properly set up", async () => {
      const result = await AuthService.diagnoseFacebookSetup();

      expect(result.isConfigured).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.recommendations).toHaveLength(0);
      expect(logger.debug).toHaveBeenCalledWith(
        "🔍 Running Facebook SDK diagnostic..."
      );
    });

    it("should detect missing LoginManager", async () => {
      // Temporarily remove LoginManager
      const originalLoginManager = LoginManager.logInWithPermissions;
      (LoginManager as any).logInWithPermissions = undefined;

      const result = await AuthService.diagnoseFacebookSetup();

      expect(result.isConfigured).toBe(false);
      expect(result.issues).toContain(
        "Facebook LoginManager not properly configured"
      );
      expect(result.recommendations).toContain(
        "Check Facebook app configuration in app.config.js"
      );

      // Restore
      (LoginManager as any).logInWithPermissions = originalLoginManager;
    });

    it("should handle diagnostic failure gracefully", async () => {
      // Force an error by making the diagnostic throw
      const originalLoginManager = LoginManager;
      jest.replaceProperty(
        require("react-native-fbsdk-next"),
        "LoginManager",
        null
      );

      const result = await AuthService.diagnoseFacebookSetup();

      // Restore
      jest.replaceProperty(
        require("react-native-fbsdk-next"),
        "LoginManager",
        originalLoginManager
      );

      // Should still return a valid result object
      expect(result).toHaveProperty("isConfigured");
      expect(result).toHaveProperty("issues");
      expect(result).toHaveProperty("recommendations");
    });
  });

  describe("troubleshootFacebookLogin", () => {
    it("should return comprehensive troubleshooting information", async () => {
      const result = await AuthService.troubleshootFacebookLogin();

      expect(result.configurationStatus).toBe("✅ SDK Configured");
      expect(result.commonIssues).toBeInstanceOf(Array);
      expect(result.commonIssues.length).toBeGreaterThan(0);
      expect(result.troubleshootingSteps).toBeInstanceOf(Array);
      expect(result.troubleshootingSteps.length).toBeGreaterThan(0);
      expect(result.keyHashInfo).toContain("Xo8WBi6jzSxKDVR4drqm84yr9iU=");
    });

    it("should include Android Key Hash in troubleshooting info", async () => {
      const result = await AuthService.troubleshootFacebookLogin();

      expect(result.keyHashInfo).toContain("Xo8WBi6jzSxKDVR4drqm84yr9iU=");
      expect(result.keyHashInfo).toContain("Facebook Developer Console");
    });

    it("should include OAuth Redirect URI in troubleshooting info", async () => {
      const result = await AuthService.troubleshootFacebookLogin();

      expect(result.keyHashInfo).toContain("OAuth Redirect URI");
    });

    it("should list common Facebook integration issues", async () => {
      const result = await AuthService.troubleshootFacebookLogin();

      expect(result.commonIssues).toContainEqual(
        expect.stringContaining("Missing Android Key Hash")
      );
      expect(result.commonIssues).toContainEqual(
        expect.stringContaining("Development mode")
      );
    });

    it("should provide step-by-step troubleshooting guidance", async () => {
      const result = await AuthService.troubleshootFacebookLogin();

      expect(result.troubleshootingSteps).toContainEqual(
        expect.stringContaining("Verify Facebook app")
      );
      expect(result.troubleshootingSteps).toContainEqual(
        expect.stringContaining("Add Android Key Hash")
      );
    });

    it("should handle diagnostic failure in troubleshooting", async () => {
      // Temporarily break the diagnostic
      const originalLoginManager = LoginManager.logInWithPermissions;
      (LoginManager as any).logInWithPermissions = undefined;

      const result = await AuthService.troubleshootFacebookLogin();

      expect(result.configurationStatus).toBe("❌ Configuration Issues");

      // Restore
      (LoginManager as any).logInWithPermissions = originalLoginManager;
    });
  });

  describe("runOnMainThread utility", () => {
    it("should execute callback on main thread via InteractionManager", async () => {
      await AuthService.signInWithGoogle();

      expect(InteractionManager.runAfterInteractions).toHaveBeenCalled();
      expect(GoogleSignin.signIn).toHaveBeenCalled();
    });

    it("should handle callback rejections in runOnMainThread", async () => {
      const callbackError = new Error("Callback failed");
      (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce(callbackError);

      await expect(AuthService.signInWithGoogle()).rejects.toEqual(
        callbackError
      );
    });

    it("should propagate callback results in runOnMainThread", async () => {
      const customUserCredential = {
        user: { uid: "custom-uid", email: "custom@test.com" },
      } as any;
      mockAuthInstance.signInWithCredential.mockResolvedValueOnce(
        customUserCredential
      );

      const result = await AuthService.signInWithGoogle();
      expect(result).toEqual(customUserCredential);
    });
  });

  describe("Edge Cases and Error Boundaries", () => {
    it("should handle null/undefined email gracefully", async () => {
      const nullEmailError = {
        code: "auth/invalid-email",
        message: "Email is required",
      };
      mockAuthInstance.signInWithEmailAndPassword.mockRejectedValueOnce(
        nullEmailError
      );

      await expect(
        AuthService.loginWithEmail(null as any, mockPassword)
      ).rejects.toEqual(nullEmailError);
    });

    it("should handle null/undefined password gracefully", async () => {
      const nullPasswordError = {
        code: "auth/missing-password",
        message: "Password is required",
      };
      mockAuthInstance.signInWithEmailAndPassword.mockRejectedValueOnce(
        nullPasswordError
      );

      await expect(
        AuthService.loginWithEmail(mockEmail, null as any)
      ).rejects.toEqual(nullPasswordError);
    });

    it("should handle simultaneous authentication attempts", async () => {
      const promises = [
        AuthService.loginWithEmail(mockEmail, mockPassword),
        AuthService.signInWithGoogle(),
        AuthService.signInWithFacebook(),
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toEqual(mockUserCredential);
      });
    });

    it("should handle very long email addresses", async () => {
      const longEmail = "a".repeat(300) + "@example.com";

      await AuthService.loginWithEmail(longEmail, mockPassword);
      expect(mockAuthInstance.signInWithEmailAndPassword).toHaveBeenCalledWith(
        longEmail,
        mockPassword
      );
    });

    it("should handle special characters in passwords", async () => {
      const specialPassword = "p@ssw0rd!#$%^&*()_+-=[]{}|;:,.<>?";

      await AuthService.loginWithEmail(mockEmail, specialPassword);
      expect(mockAuthInstance.signInWithEmailAndPassword).toHaveBeenCalledWith(
        mockEmail,
        specialPassword
      );
    });

    it("should handle empty string inputs", async () => {
      const emptyStringError = {
        code: "auth/invalid-email",
        message: "The email address is not valid.",
      };
      mockAuthInstance.signInWithEmailAndPassword.mockRejectedValueOnce(
        emptyStringError
      );

      await expect(AuthService.loginWithEmail("", "")).rejects.toEqual(
        emptyStringError
      );
    });

    it("should handle unicode characters in credentials", async () => {
      const unicodeEmail = "用户@example.com";
      const unicodePassword = "密码123!";

      await AuthService.loginWithEmail(unicodeEmail, unicodePassword);
      expect(mockAuthInstance.signInWithEmailAndPassword).toHaveBeenCalledWith(
        unicodeEmail,
        unicodePassword
      );
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle complete sign-up to sign-in flow", async () => {
      // First sign up
      await AuthService.signUpWithEmail(mockEmail, mockPassword);
      expect(
        mockAuthInstance.createUserWithEmailAndPassword
      ).toHaveBeenCalledWith(mockEmail, mockPassword);

      // Then sign in
      await AuthService.loginWithEmail(mockEmail, mockPassword);
      expect(mockAuthInstance.signInWithEmailAndPassword).toHaveBeenCalledWith(
        mockEmail,
        mockPassword
      );

      // Then logout
      await AuthService.logout();
      expect(mockAuthInstance.signOut).toHaveBeenCalled();
    });

    it("should handle password reset flow", async () => {
      // Attempt login with wrong password
      const wrongPasswordError = {
        code: "auth/wrong-password",
        message: "The password is invalid.",
      };
      mockAuthInstance.signInWithEmailAndPassword.mockRejectedValueOnce(
        wrongPasswordError
      );

      await expect(
        AuthService.loginWithEmail(mockEmail, "wrongpassword")
      ).rejects.toEqual(wrongPasswordError);

      // Request password reset
      await AuthService.sendPasswordResetEmail(mockEmail);
      expect(mockAuthInstance.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockEmail
      );
    });

    it("should handle social login fallback to email", async () => {
      // First try Google login but fail
      const googleError = new Error("Google login failed");
      (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce(googleError);

      await expect(AuthService.signInWithGoogle()).rejects.toEqual(googleError);

      // Fallback to email login
      await AuthService.loginWithEmail(mockEmail, mockPassword);
      expect(mockAuthInstance.signInWithEmailAndPassword).toHaveBeenCalledWith(
        mockEmail,
        mockPassword
      );
    });

    it("should handle anonymous to authenticated user upgrade flow", async () => {
      // Start as anonymous
      const anonymousCredential = {
        user: { uid: "anon-uid", isAnonymous: true },
      };
      mockAuthInstance.signInAnonymously.mockResolvedValueOnce(
        anonymousCredential
      );

      await AuthService.signInAnonymously();
      expect(mockAuthInstance.signInAnonymously).toHaveBeenCalled();

      // Then sign up with email
      await AuthService.signUpWithEmail(mockEmail, mockPassword);
      expect(
        mockAuthInstance.createUserWithEmailAndPassword
      ).toHaveBeenCalledWith(mockEmail, mockPassword);
    });

    it("should handle multiple social provider attempts", async () => {
      // Try Google first - fails
      const googleError = new Error("Google sign-in failed");
      (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce(googleError);

      await expect(AuthService.signInWithGoogle()).rejects.toThrow(
        "Google sign-in failed"
      );

      // Try Facebook next - fails
      const facebookError = new Error("Facebook sign-in failed");
      (LoginManager.logInWithPermissions as jest.Mock).mockRejectedValueOnce(
        facebookError
      );

      await expect(AuthService.signInWithFacebook()).rejects.toThrow(
        "Facebook sign-in failed"
      );

      // Try Twitter - succeeds
      const result = await AuthService.signInWithTwitter();
      expect(result).toEqual(mockUserCredential);
    });
  });

  describe("linkAnonymousWithGoogle", () => {
    it("links the current anonymous user with Google credentials", async () => {
      const linkedCredential = { user: { uid: "linked-uid" } };
      const linkWithCredential = jest.fn().mockResolvedValue(linkedCredential);

      mockAuthInstance.currentUser = {
        isAnonymous: true,
        linkWithCredential,
      };

      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValueOnce(true);
      (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
        type: "success",
        data: { idToken: "GOOGLE_ID_TOKEN", user: { email: "a@b.com" } },
      });

      const result = await AuthService.linkAnonymousWithGoogle();

      expect(GoogleAuthProvider.credential).toHaveBeenCalledWith("GOOGLE_ID_TOKEN");
      expect(linkWithCredential).toHaveBeenCalled();
      expect(result).toEqual(linkedCredential);
    });
  });

  describe("linkAnonymousWithFacebook", () => {
    it("returns null without logging when Facebook linking is cancelled", async () => {
      const linkWithCredential = jest.fn();
      mockAuthInstance.currentUser = {
        isAnonymous: true,
        linkWithCredential,
      };

      (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({
        isCancelled: true,
      });

      await expect(AuthService.linkAnonymousWithFacebook()).resolves.toBeNull();
      expect(AccessToken.getCurrentAccessToken).not.toHaveBeenCalled();
      expect(linkWithCredential).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
      expect(captureException).not.toHaveBeenCalled();
    });
  });
});
