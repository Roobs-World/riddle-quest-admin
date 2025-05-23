import auth from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { AccessToken, LoginManager } from "react-native-fbsdk-next";
import { AuthService } from "../AuthService";

jest.mock("@react-native-firebase/app", () => ({
  __esModule: true,
  default: {
    app: jest.fn(() => ({
      name: "[DEFAULT]",
      options: {},
    })),
    apps: [
      {
        name: "[DEFAULT]",
        options: {},
      },
    ],
    SDK_VERSION: "mockSDKVersion",
    initializeApp: jest.fn().mockReturnValue({
      name: "[DEFAULT]",
      options: {},
    }),
    NativeModules: {
      RNFBAppModule: {
        NATIVE_FIREBASE_APPS: JSON.stringify([
          { name: "[DEFAULT]", options: {} },
        ]),
        FIREBASE_RAW_JSON: "{}",
        addListener: jest.fn(),
        removeListeners: jest.fn(),
      },
    },
  },
}));

// Mocks are in jest.setup.js. We just need to ensure they are reset or used correctly.

const mockFirebaseAuthUser = { uid: "test-uid", email: "test@example.com" };

// Mock Google Sign-In
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
  },
  statusCodes: { PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE" }, // Add other status codes if needed
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

// Firebase mocks are largely in jest.setup.js
// We need to ensure that auth.GoogleAuthProvider.credential and auth.FacebookAuthProvider.credential
// are mock functions we can control or inspect if needed.

describe("AuthService", () => {
  const mockEmail = "test@example.com";
  const mockPassword = "password123";
  const mockUserCredential = { user: { uid: "test-uid" } } as any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks for Firebase auth methods (from jest.setup.js)
    // These are on the auth() instance
    (auth().createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({
      user: mockFirebaseAuthUser,
    });
    (auth().signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
      user: mockFirebaseAuthUser,
    });
    (auth().sendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);
    (auth().signInWithCredential as jest.Mock).mockResolvedValue({
      user: mockFirebaseAuthUser,
    });
    (auth().signOut as jest.Mock).mockResolvedValue(undefined);

    // Setup mocks for Google/Facebook credential static methods (from jest.setup.js)
    // These are on auth.Provider objects
    // Default mock implementation for credential methods, can be overridden per test if needed
    if (auth.GoogleAuthProvider && auth.GoogleAuthProvider.credential) {
      (auth.GoogleAuthProvider.credential as jest.Mock).mockImplementation(
        (idToken) => ({
          type: "google.com-mocked",
          token: idToken,
          providerId: "google.com",
        })
      );
    } else {
      console.error(
        "AuthService.test.ts: auth.GoogleAuthProvider.credential is not set up by jest.setup.js"
      );
    }

    if (auth.FacebookAuthProvider && auth.FacebookAuthProvider.credential) {
      (auth.FacebookAuthProvider.credential as jest.Mock).mockImplementation(
        (token) => ({
          type: "facebook.com-mocked",
          token,
          providerId: "facebook.com",
        })
      );
    } else {
      console.error(
        "AuthService.test.ts: auth.FacebookAuthProvider.credential is not set up by jest.setup.js"
      );
    }

    // Mock GoogleSignin specifics
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
      idToken: "mockGoogleIdToken",
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
      (
        auth().createUserWithEmailAndPassword as jest.Mock
      ).mockResolvedValueOnce(mockUserCredential);
      const result = await AuthService.signUpWithEmail(mockEmail, mockPassword);
      expect(auth().createUserWithEmailAndPassword).toHaveBeenCalledWith(
        mockEmail,
        mockPassword
      );
      expect(result).toEqual(mockUserCredential);
    });

    it("should throw an error if createUserWithEmailAndPassword fails", async () => {
      const errorMessage = "Sign up failed";
      (
        auth().createUserWithEmailAndPassword as jest.Mock
      ).mockRejectedValueOnce(new Error(errorMessage));
      await expect(
        AuthService.signUpWithEmail(mockEmail, mockPassword)
      ).rejects.toThrow(errorMessage);
    });
  });

  describe("loginWithEmail", () => {
    it("should call signInWithEmailAndPassword and return user credential", async () => {
      (auth().signInWithEmailAndPassword as jest.Mock).mockResolvedValueOnce(
        mockUserCredential
      );
      const result = await AuthService.loginWithEmail(mockEmail, mockPassword);
      expect(auth().signInWithEmailAndPassword).toHaveBeenCalledWith(
        mockEmail,
        mockPassword
      );
      expect(result).toEqual(mockUserCredential);
    });

    it("should throw an error if signInWithEmailAndPassword fails", async () => {
      const errorMessage = "Login failed";
      (auth().signInWithEmailAndPassword as jest.Mock).mockRejectedValueOnce(
        new Error(errorMessage)
      );
      await expect(
        AuthService.loginWithEmail(mockEmail, mockPassword)
      ).rejects.toThrow(errorMessage);
    });
  });

  describe("sendPasswordResetEmail", () => {
    it("should call sendPasswordResetEmail", async () => {
      (auth().sendPasswordResetEmail as jest.Mock).mockResolvedValueOnce(
        undefined
      );
      await AuthService.sendPasswordResetEmail(mockEmail);
      expect(auth().sendPasswordResetEmail).toHaveBeenCalledWith(mockEmail);
    });

    it("should throw an error if sendPasswordResetEmail fails", async () => {
      const errorMessage = "Reset email failed";
      (auth().sendPasswordResetEmail as jest.Mock).mockRejectedValueOnce(
        new Error(errorMessage)
      );
      await expect(
        AuthService.sendPasswordResetEmail(mockEmail)
      ).rejects.toThrow(errorMessage);
    });
  });

  describe("signInWithGoogle", () => {
    it("should sign in with Google and return user credential", async () => {
      // GoogleSignin.signIn is mocked in beforeEach to resolve
      // auth.GoogleAuthProvider.credential is mocked in beforeEach
      // auth().signInWithCredential is mocked in beforeEach to resolve

      const result = await AuthService.signInWithGoogle();

      expect(GoogleSignin.signIn).toHaveBeenCalled();
      expect(auth.GoogleAuthProvider.credential).toHaveBeenCalledWith(
        "mockGoogleIdToken"
      );
      expect(auth().signInWithCredential).toHaveBeenCalledWith({
        type: "google.com-mocked",
        token: "mockGoogleIdToken",
        providerId: "google.com",
      });
      expect(result).toEqual({ user: mockFirebaseAuthUser });
    });

    it("should throw an error if Google Sign-In fails", async () => {
      (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce(
        new Error("Google Sign-In failed")
      );

      await expect(AuthService.signInWithGoogle()).rejects.toThrow(
        "Google Sign-In failed"
      );
      expect(auth.GoogleAuthProvider.credential).not.toHaveBeenCalled();
      expect(auth().signInWithCredential).not.toHaveBeenCalled();
    });
  });

  describe("signInWithFacebook", () => {
    const mockFbAccessToken = "mockFbAccessToken";

    it("should sign in with Facebook and return user credential", async () => {
      // LoginManager.logInWithPermissions is mocked in beforeEach
      // AccessToken.getCurrentAccessToken is mocked in beforeEach
      // auth.FacebookAuthProvider.credential is mocked in beforeEach
      // auth().signInWithCredential is mocked in beforeEach

      const result = await AuthService.signInWithFacebook();

      expect(LoginManager.logInWithPermissions).toHaveBeenCalledWith([
        "public_profile",
        "email",
      ]);
      expect(AccessToken.getCurrentAccessToken).toHaveBeenCalled();
      expect(auth.FacebookAuthProvider.credential).toHaveBeenCalledWith(
        mockFbAccessToken
      );
      expect(auth().signInWithCredential).toHaveBeenCalledWith({
        type: "facebook.com-mocked",
        token: mockFbAccessToken,
        providerId: "facebook.com",
      });
      expect(result).toEqual({ user: mockFirebaseAuthUser });
    });

    it("should throw an error if Facebook login is cancelled", async () => {
      (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({
        isCancelled: true,
      });

      await expect(AuthService.signInWithFacebook()).rejects.toThrow(
        "User cancelled the login process"
      );
      expect(AccessToken.getCurrentAccessToken).not.toHaveBeenCalled();
      expect(auth.FacebookAuthProvider.credential).not.toHaveBeenCalled();
      expect(auth().signInWithCredential).not.toHaveBeenCalled();
    });

    it("should throw an error if Facebook access token is not obtained", async () => {
      (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({
        isCancelled: false,
        grantedPermissions: ["email"],
        declinedPermissions: [],
      });
      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValueOnce(
        null
      ); // No access token

      await expect(AuthService.signInWithFacebook()).rejects.toThrow(
        "Something went wrong obtaining access token"
      );
      expect(auth.FacebookAuthProvider.credential).not.toHaveBeenCalled();
      expect(auth().signInWithCredential).not.toHaveBeenCalled();
    });

    it("should re-throw specific auth errors from Facebook login", async () => {
      const firebaseAuthError = new Error("Firebase auth error");
      (firebaseAuthError as any).code =
        "auth/account-exists-with-different-credential";

      // LoginManager and AccessToken resolve successfully
      (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({
        isCancelled: false,
        grantedPermissions: ["email"],
        declinedPermissions: [],
      });
      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValueOnce({
        accessToken: mockFbAccessToken,
      });

      // auth.FacebookAuthProvider.credential is mocked in beforeEach
      // signInWithCredential rejects
      (auth().signInWithCredential as jest.Mock).mockRejectedValueOnce(
        firebaseAuthError
      );

      await expect(AuthService.signInWithFacebook()).rejects.toThrow(
        "Account exists with different credential. Please use a different login method."
      );
      expect(auth.FacebookAuthProvider.credential).toHaveBeenCalledWith(
        mockFbAccessToken
      );
    });
  });

  describe("logout", () => {
    it("should call signOut", async () => {
      (auth().signOut as jest.Mock).mockResolvedValueOnce(undefined);
      await AuthService.logout();
      expect(auth().signOut).toHaveBeenCalled();
    });

    it("should throw an error if signOut fails", async () => {
      const errorMessage = "Logout failed";
      (auth().signOut as jest.Mock).mockRejectedValueOnce(
        new Error(errorMessage)
      );
      await expect(AuthService.logout()).rejects.toThrow(errorMessage);
    });
  });
});
