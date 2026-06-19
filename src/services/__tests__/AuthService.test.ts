jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn(() => ({})),
}));

jest.mock("../../utils/timing", () => ({
  safeTimeout: jest.fn(() => jest.fn()),
  safeDelay: jest.fn(() => Promise.resolve()),
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../../utils/sentry", () => ({
  captureException: jest.fn(),
}));

jest.mock("react-native", () => ({
  InteractionManager: {
    runAfterInteractions: jest.fn((callback) => Promise.resolve().then(callback)),
  },
  AppState: {
    addEventListener: jest.fn(() => ({remove: jest.fn()})),
    removeEventListener: jest.fn(),
    currentState: "active",
  },
}));

jest.mock("react-native-fbsdk-next", () => ({
  LoginManager: {
    logInWithPermissions: jest.fn(),
    logOut: jest.fn(),
  },
  AccessToken: {
    getCurrentAccessToken: jest.fn(),
  },
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  clear: jest.fn().mockResolvedValue(undefined),
}));

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

global.fetch = jest.fn();

const mockAuthInstance = {
  currentUser: null as any,
  onAuthStateChanged: jest.fn((callback) => {
    callback(null);
    return jest.fn();
  }),
  signOut: jest.fn(),
  signInWithCredential: jest.fn(),
  signInAnonymously: jest.fn(),
  fetchSignInMethodsForEmail: jest.fn(),
};

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
  OAuthProvider: jest.fn().mockImplementation((providerId) => ({providerId})),
  signInWithPopup: jest.fn(),
}));

import {GoogleSignin} from "@react-native-google-signin/google-signin";
import {AccessToken, LoginManager} from "react-native-fbsdk-next";
import {GoogleAuthProvider, FacebookAuthProvider, signInWithPopup} from "@react-native-firebase/auth";
import {InteractionManager, AppState} from "react-native";
import {AuthService, isGoogleSignInCancellation} from "../AuthService";
import {captureException} from "../../utils/sentry";
import {logger} from "../../utils/logger";

describe("AuthService", () => {
  const mockUserCredential = {
    user: {
      uid: "test-uid",
      email: "test@example.com",
      displayName: "Test User",
      emailVerified: true,
      photoURL: "https://example.com/photo.jpg",
      providerData: [{providerId: "google.com", email: "test@example.com"}],
      reload: jest.fn().mockResolvedValue(undefined),
      getIdToken: jest.fn().mockResolvedValue("token"),
    },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthInstance.currentUser = mockUserCredential.user;
    mockAuthInstance.signOut.mockResolvedValue(undefined);
    mockAuthInstance.signInWithCredential.mockResolvedValue(mockUserCredential);
    mockAuthInstance.signInAnonymously.mockResolvedValue(mockUserCredential);
    mockAuthInstance.fetchSignInMethodsForEmail.mockResolvedValue([]);

    (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
      type: "success",
      data: {
        idToken: "mockGoogleIdToken",
        user: {email: "user@google.com", name: "Test Google User"},
      },
    });

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

    (InteractionManager.runAfterInteractions as jest.Mock).mockImplementation((callback) => Promise.resolve().then(callback));
    (AppState.addEventListener as jest.Mock).mockReturnValue({remove: jest.fn()});
    (GoogleAuthProvider.credential as jest.Mock).mockReturnValue({
      providerId: "google.com",
      token: "mockGoogleIdToken",
    });
    (FacebookAuthProvider.credential as jest.Mock).mockReturnValue({
      providerId: "facebook.com",
      token: "mockFbAccessToken",
    });
    (signInWithPopup as jest.Mock).mockResolvedValue(mockUserCredential);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: "123456",
        name: "Test User",
        email: "test@facebook.com",
      }),
    });
  });

  it("recognizes Google cancellation signals", () => {
    expect(isGoogleSignInCancellation({type: "cancelled"})).toBe(true);
    expect(isGoogleSignInCancellation({code: "auth/auth-popup-closed-by-user"})).toBe(true);
  });

  it("signs in with Google", async () => {
    const result = await AuthService.signInWithGoogle();

    expect(InteractionManager.runAfterInteractions).toHaveBeenCalled();
    expect(GoogleSignin.hasPlayServices).toHaveBeenCalledWith({showPlayServicesUpdateDialog: true});
    expect(GoogleSignin.signIn).toHaveBeenCalled();
    expect(GoogleAuthProvider.credential).toHaveBeenCalledWith("mockGoogleIdToken");
    expect(mockAuthInstance.signInWithCredential).toHaveBeenCalled();
    expect(result).toEqual(mockUserCredential);
  });

  it("surfaces Google cancellation without reporting an error", async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({type: "cancelled"});

    await expect(AuthService.signInWithGoogle()).rejects.toThrow("Google sign-in cancelled by user.");
    expect(logger.error).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("signs in with Facebook", async () => {
    const result = await AuthService.signInWithFacebook();

    expect(LoginManager.logInWithPermissions).toHaveBeenCalledWith(["public_profile", "email"]);
    expect(AccessToken.getCurrentAccessToken).toHaveBeenCalled();
    expect(FacebookAuthProvider.credential).toHaveBeenCalledWith("mockFbAccessToken");
    expect(mockAuthInstance.signInWithCredential).toHaveBeenCalled();
    expect(result).toEqual(mockUserCredential);
  });

  it("returns null when Facebook login is cancelled", async () => {
    (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({isCancelled: true});

    await expect(AuthService.signInWithFacebook()).resolves.toBeNull();
    expect(AccessToken.getCurrentAccessToken).not.toHaveBeenCalled();
  });

  it("signs in anonymously for guest play", async () => {
    const result = await AuthService.signInAnonymously();

    expect(mockAuthInstance.signInAnonymously).toHaveBeenCalled();
    expect(result).toEqual(mockUserCredential);
  });

  it("logs out the current user", async () => {
    await AuthService.logout();

    expect(mockAuthInstance.signOut).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith("User signed out successfully.");
  });

  it("signs in with Twitter via popup", async () => {
    const result = await AuthService.signInWithTwitter();

    expect(signInWithPopup).toHaveBeenCalled();
    expect(result).toEqual(mockUserCredential);
  });

  it("links an anonymous account with Google", async () => {
    const linkedCredential = {user: {uid: "linked-uid"}} as any;
    const linkWithCredential = jest.fn().mockResolvedValue(linkedCredential);

    mockAuthInstance.currentUser = {
      isAnonymous: true,
      linkWithCredential,
      reload: jest.fn().mockResolvedValue(undefined),
      getIdToken: jest.fn().mockResolvedValue("token"),
    };

    const result = await AuthService.linkAnonymousWithGoogle();

    expect(GoogleAuthProvider.credential).toHaveBeenCalledWith("mockGoogleIdToken");
    expect(linkWithCredential).toHaveBeenCalled();
    expect(result).toEqual(linkedCredential);
  });

  it("returns null when anonymous Facebook linking is cancelled", async () => {
    const linkWithCredential = jest.fn();
    mockAuthInstance.currentUser = {
      isAnonymous: true,
      linkWithCredential,
      reload: jest.fn().mockResolvedValue(undefined),
      getIdToken: jest.fn().mockResolvedValue("token"),
    };

    (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({isCancelled: true});

    await expect(AuthService.linkAnonymousWithFacebook()).resolves.toBeNull();
    expect(linkWithCredential).not.toHaveBeenCalled();
  });

  it("describes Facebook setup health", async () => {
    const result = await AuthService.diagnoseFacebookSetup();

    expect(result.isConfigured).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.recommendations).toHaveLength(0);
  });

  it("returns troubleshooting guidance", async () => {
    const result = await AuthService.troubleshootFacebookLogin();

    expect(result.configurationStatus).toBe("✅ SDK Configured");
    expect(result.keyHashInfo).toContain("Xo8WBi6jzSxKDVR4drqm84yr9iU=");
    expect(result.commonIssues.length).toBeGreaterThan(0);
  });
});
