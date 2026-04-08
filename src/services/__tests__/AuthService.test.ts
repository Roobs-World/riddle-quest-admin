// Mock getApp for modular Firebase API
jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn(() => ({})),
}));

// Avoid real requestAnimationFrame/setTimeout from safeTimeout (prevents Jest teardown "access after torn down")
jest.mock("../../utils/timing", () => ({
  safeTimeout: jest.fn(() => jest.fn()),
  safeDelay: jest.fn(() => Promise.resolve()),
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

// Create mock auth instance before any imports
const mockAuthInstance = {
  currentUser: null,
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
};

// Mock Firebase auth module completely before imports (modular API: getAuth(getApp()))
jest.mock("@react-native-firebase/auth", () => ({
  __esModule: true,
  getAuth: jest.fn(() => mockAuthInstance),
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
}));

// Mock console methods to reduce noise
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

// Now import after mocks are set up
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { AccessToken, LoginManager } from "react-native-fbsdk-next";
import {
  GoogleAuthProvider,
  FacebookAuthProvider,
} from "@react-native-firebase/auth";
import { InteractionManager, AppState } from "react-native";
import { AuthService } from "../AuthService";

describe("AuthService", () => {
  const mockEmail = "test@example.com";
  const mockPassword = "password123";
  const mockUserCredential = {
    user: {
      uid: "test-uid",
      email: mockEmail,
      displayName: "Test User",
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

    // Setup Google Sign-In defaults
    (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
      data: { idToken: "mockGoogleIdToken" },
      user: { email: "user@google.com", name: "Test Google User" },
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
      expect(console.error).toHaveBeenCalledWith(
        "Error signing up with email:",
        firebaseError
      );
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
      expect(console.error).toHaveBeenCalledWith(
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
      expect(console.error).toHaveBeenCalledWith(
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
      expect(console.error).toHaveBeenCalledWith(
        "Error logging in with email:",
        firebaseError
      );
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
      expect(console.log).toHaveBeenCalledWith(
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
      expect(console.error).toHaveBeenCalledWith(
        "Error sending password reset email:",
        firebaseError
      );
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
      expect(console.error).toHaveBeenCalledWith(
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
      expect(console.error).toHaveBeenCalledWith(
        "Error signing in with Google:",
        playServicesError
      );
    });

    it("should handle Google sign-in cancellation", async () => {
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
        data: { idToken: null }, // Missing ID token
        user: { email: "user@google.com" },
      });

      await expect(AuthService.signInWithGoogle()).rejects.toThrow(
        "No ID token received from Google Sign-In"
      );
      expect(console.error).toHaveBeenCalledWith(
        "Error signing in with Google:",
        expect.any(Error)
      );
    });

    it("should handle missing data object from Google", async () => {
      (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
        data: null, // Missing data object
        user: { email: "user@google.com" },
      });

      await expect(AuthService.signInWithGoogle()).rejects.toThrow(
        "No ID token received from Google Sign-In"
      );
    });

    it("should handle undefined idToken in data object", async () => {
      (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
        data: { idToken: undefined }, // Undefined ID token
        user: { email: "user@google.com" },
      });

      await expect(AuthService.signInWithGoogle()).rejects.toThrow(
        "No ID token received from Google Sign-In"
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
      expect(console.error).toHaveBeenCalledWith(
        "Error signing in with Google:",
        firebaseError
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

    it("should handle Facebook login cancellation", async () => {
      (LoginManager.logInWithPermissions as jest.Mock).mockRejectedValueOnce(
        new Error("User cancelled the login process")
      );

      await expect(AuthService.signInWithFacebook()).rejects.toThrow(
        "User cancelled the login process"
      );
      expect(console.error).toHaveBeenCalledWith(
        "❌ Facebook login error:",
        expect.any(Error)
      );
    });

    it("should handle Facebook access token retrieval failure", async () => {
      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValueOnce(
        null
      );

      await expect(AuthService.signInWithFacebook()).rejects.toThrow(
        "Facebook access token error. Please try again."
      );
      expect(console.error).toHaveBeenCalledWith(
        "❌ Facebook login error:",
        expect.any(Error)
      );
    });

    it("should handle Facebook login permission denial", async () => {
      (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({
        isCancelled: false,
        grantedPermissions: [], // No permissions granted
      });

      // Still should proceed if not cancelled
      const result = await AuthService.signInWithFacebook();
      expect(result).toEqual(mockUserCredential);
    });

    it("should handle auth/account-exists-with-different-credential error", async () => {
      const firebaseError = {
        code: "auth/account-exists-with-different-credential",
        message: "Account exists with different credential",
        email: "craigbeswetherick@gmail.com",
      };
      mockAuthInstance.signInWithCredential.mockRejectedValueOnce(
        firebaseError
      );

      // Mock fetchSignInMethodsForEmail to simulate the specific code path
      (mockAuthInstance as any).fetchSignInMethodsForEmail = jest
        .fn()
        .mockResolvedValue([]);

      await expect(AuthService.signInWithFacebook()).rejects.toThrow(
        "Google sign-in failed during account linking. " +
          "Please try signing in with Google first, then link Facebook in account settings."
      );
    });

    it("should handle auth/auth-popup-closed-by-user error", async () => {
      // Setup proper access token with email permissions
      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValueOnce({
        accessToken: "mockFbAccessToken",
        permissions: ["public_profile", "email"],
        userID: "123456",
      });

      const firebaseError = {
        code: "auth/auth-popup-closed-by-user",
        message: "User closed popup",
      };
      mockAuthInstance.signInWithCredential.mockRejectedValueOnce(
        firebaseError
      );

      await expect(AuthService.signInWithFacebook()).rejects.toThrow(
        "Facebook login cancelled."
      );
    });

    it("should handle auth/operation-not-supported-in-this-environment error", async () => {
      // Setup proper access token with email permissions
      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValueOnce({
        accessToken: "mockFbAccessToken",
        permissions: ["public_profile", "email"],
        userID: "123456",
      });

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

    it("should handle unknown Firebase errors by rethrowing", async () => {
      // Setup proper access token with email permissions
      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValueOnce({
        accessToken: "mockFbAccessToken",
        permissions: ["public_profile", "email"],
        userID: "123456",
      });

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

    it("should handle Facebook SDK errors", async () => {
      const facebookError = {
        message: "Facebook SDK error",
        type: "FacebookRequestError",
      };
      (LoginManager.logInWithPermissions as jest.Mock).mockRejectedValueOnce(
        facebookError
      );

      await expect(AuthService.signInWithFacebook()).rejects.toEqual(
        facebookError
      );
    });

    it("should handle undefined access token object", async () => {
      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValueOnce(
        undefined
      );

      await expect(AuthService.signInWithFacebook()).rejects.toThrow(
        "Facebook access token error. Please try again."
      );
    });

    it("should handle access token object without accessToken property", async () => {
      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValueOnce({
        // Missing accessToken property
        userID: "123456",
      });

      // This will throw an error when trying to access data.accessToken.substring
      await expect(AuthService.signInWithFacebook()).rejects.toThrow();
    });

    it("should handle account conflict with unknown error code", async () => {
      const firebaseError = {
        code: "auth/account-conflict",
        message: "Account conflict",
      };
      mockAuthInstance.signInWithCredential.mockRejectedValueOnce(
        firebaseError
      );

      await expect(AuthService.signInWithFacebook()).rejects.toEqual(
        firebaseError
      );
    });

    it("should handle user cancelling Facebook login", async () => {
      (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({
        isCancelled: true,
      });

      await expect(AuthService.signInWithFacebook()).rejects.toThrow(
        "User cancelled the login process"
      );

      expect(console.log).toHaveBeenCalledWith(
        "👤 User cancelled Facebook login"
      );
    });

    it("should handle other Facebook login errors", async () => {
      const genericError = new Error("Some other Facebook error");
      (LoginManager.logInWithPermissions as jest.Mock).mockRejectedValueOnce(
        genericError
      );

      await expect(AuthService.signInWithFacebook()).rejects.toThrow(
        genericError
      );
      expect(console.error).toHaveBeenCalledWith(
        "❌ Facebook login error:",
        genericError
      );
    });

    it("should handle Firebase sign-in errors after Facebook login", async () => {
      const firebaseError = {
        code: "auth/invalid-credential",
        message: "Invalid Facebook credential",
      };
      mockAuthInstance.signInWithCredential.mockRejectedValueOnce(
        firebaseError
      );

      await expect(AuthService.signInWithFacebook()).rejects.toThrow(
        "Invalid Facebook credentials. Please try again."
      );
    });

    it("should proceed with sign-in when LoginManager.logOut throws during session clear", async () => {
      (LoginManager.logOut as jest.Mock).mockImplementationOnce(() => {
        throw new Error("Logout failed");
      });
      (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({
        isCancelled: false,
        grantedPermissions: ["public_profile", "email"],
      });
      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValueOnce({
        accessToken: "mockFbAccessToken",
        permissions: ["public_profile", "email"],
        expirationTime: Date.now() + 3600000,
      });

      const result = await AuthService.signInWithFacebook();

      expect(result).toEqual(mockUserCredential);
      expect(mockAuthInstance.signInWithCredential).toHaveBeenCalled();
    });
  });

  describe("logout", () => {
    it("should successfully sign out", async () => {
      await AuthService.logout();

      expect(mockAuthInstance.signOut).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith("User signed out successfully.");
    });

    it("should handle Firebase signOut errors", async () => {
      const signOutError = {
        code: "auth/network-request-failed",
        message: "Network error during sign out",
      };
      mockAuthInstance.signOut.mockRejectedValueOnce(signOutError);

      await expect(AuthService.logout()).rejects.toEqual(signOutError);
      expect(console.error).toHaveBeenCalledWith(
        "Error signing out:",
        signOutError
      );
    });

    it("should handle unknown signOut errors", async () => {
      const unknownError = new Error("Unknown error during logout");
      mockAuthInstance.signOut.mockRejectedValueOnce(unknownError);

      await expect(AuthService.logout()).rejects.toThrow(
        "Unknown error during logout"
      );
      expect(console.error).toHaveBeenCalledWith(
        "Error signing out:",
        unknownError
      );
    });
  });

  describe("runOnMainThread utility", () => {
    it("should execute callback on main thread via InteractionManager", async () => {
      // Call Google sign-in to test runOnMainThread
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
      // Set up Facebook access token mock for this specific test
      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValue({
        accessToken: "mock_facebook_access_token_123456789",
        permissions: ["public_profile", "email"],
        userID: "123456789",
      });

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
  });
});
