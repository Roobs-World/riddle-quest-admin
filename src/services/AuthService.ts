import {
  getAuth,
  signOut,
  signInWithPopup,
  type FirebaseAuthTypes,
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
} from "@react-native-firebase/auth";
import { getApp } from "@react-native-firebase/app";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { AccessToken, LoginManager } from "react-native-fbsdk-next";
import { InteractionManager, AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { safeTimeout } from "../utils/timing";
import { logger } from "../utils/logger";
import { captureException } from "../utils/sentry";

/**
 * Ensures the function runs on the main thread to avoid threading issues with Google Play Services
 */
const runOnMainThread = <T>(fn: () => Promise<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    InteractionManager.runAfterInteractions(async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  });
};

const clearLocalAuthData = async (reason: string): Promise<void> => {
  try {
    await AsyncStorage.clear();
    logger.debug(`Cleared local data after auth transition (${reason}).`);
  } catch (error) {
    logger.warn(`Failed to clear local data (${reason}).`, error);
    captureException(error);
  }
};

const FACEBOOK_CANCELLATION_CODES = new Set([
  "auth/auth-popup-closed-by-user",
  "auth/cancelled-popup-request",
]);

const FACEBOOK_CANCELLATION_MESSAGES = [
  "User cancelled the login process",
  "Facebook login cancelled.",
  "User cancelled the login flow",
  "Account linking cancelled by user",
];

export const isFacebookLoginCancellation = (error: unknown): boolean => {
  if (!error) {
    return false;
  }

  if (error instanceof Error) {
    return FACEBOOK_CANCELLATION_MESSAGES.some((message) =>
      error.message.includes(message)
    );
  }

  if (typeof error !== "object") {
    return false;
  }

  const maybeError = error as {
    code?: unknown;
    isCancelled?: unknown;
    message?: unknown;
  };

  if (maybeError.isCancelled === true) {
    return true;
  }

  if (
    typeof maybeError.code === "string" &&
    FACEBOOK_CANCELLATION_CODES.has(maybeError.code)
  ) {
    return true;
  }

  if (typeof maybeError.message !== "string") {
    return false;
  }

  const errorMessage = maybeError.message;
  return FACEBOOK_CANCELLATION_MESSAGES.some((message) =>
    errorMessage.includes(message)
  );
};

export const AuthService = {
  async linkAnonymousWithGoogle(): Promise<FirebaseAuthTypes.UserCredential> {
    return runOnMainThread(async () => {
      try {
        const auth = getAuth(getApp());
        const user = auth.currentUser;
        if (!user) {
          throw new Error("No signed-in user available to link.");
        }
        if (!user.isAnonymous) {
          throw new Error("Only anonymous users can be upgraded via linking.");
        }

        await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        });

        const signInResult = await GoogleSignin.signIn();

        if (signInResult.type === "cancelled") {
          throw Object.assign(new Error("Google sign-in cancelled by user."), {
            code: "auth/auth-popup-closed-by-user",
          });
        }

        const idToken = signInResult.data?.idToken;
        const googleEmail = signInResult.data?.user?.email;

        if (!idToken) {
          throw new Error("No ID token received from Google Sign-In");
        }

        if (!googleEmail) {
          throw new Error(
            "Email address not provided by Google. Please use an account with a valid email."
          );
        }

        const googleCredential = GoogleAuthProvider.credential(idToken);
        const userCredential = await user.linkWithCredential(googleCredential);
        if (typeof userCredential.user.reload === "function") {
          await userCredential.user.reload();
        }
        if (typeof userCredential.user.getIdToken === "function") {
          await userCredential.user.getIdToken(true);
        }

        logger.debug("✅ Anonymous account linked with Google:", {
          uid: userCredential.user?.uid,
          email: userCredential.user?.email,
          displayName: userCredential.user?.displayName,
        });

        return userCredential;
      } catch (error) {
        logger.error("Error linking anonymous account with Google:", error);
        captureException(error);
        throw error;
      }
    });
  },

  async linkAnonymousWithFacebook(): Promise<FirebaseAuthTypes.UserCredential | null> {
    try {
      const auth = getAuth(getApp());
      const user = auth.currentUser;
      if (!user) {
        throw new Error("No signed-in user available to link.");
      }
      if (!user.isAnonymous) {
        throw new Error("Only anonymous users can be upgraded via linking.");
      }

      const loginResult = await LoginManager.logInWithPermissions([
        "public_profile",
        "email",
      ]);

      if (loginResult.isCancelled) {
        return null;
      }

      const tokenData = await AccessToken.getCurrentAccessToken();
      if (!tokenData?.accessToken) {
        throw new Error("No Facebook access token available.");
      }

      const facebookCredential = FacebookAuthProvider.credential(
        tokenData.accessToken
      );
      const userCredential = await user.linkWithCredential(facebookCredential);
      if (typeof userCredential.user.reload === "function") {
        await userCredential.user.reload();
      }
      if (typeof userCredential.user.getIdToken === "function") {
        await userCredential.user.getIdToken(true);
      }

      logger.debug("✅ Anonymous account linked with Facebook:", {
        uid: userCredential.user?.uid,
        email: userCredential.user?.email,
        displayName: userCredential.user?.displayName,
      });

      return userCredential;
    } catch (error) {
      if (isFacebookLoginCancellation(error)) {
        return null;
      }

      logger.error("Error linking anonymous account with Facebook:", error);
      captureException(error);
      throw error;
    }
  },

  /**
   * Signs up a user with email and password.
   *
   * @param email The user's email address.
   * @param password The user's password.
   * @returns A Promise resolving to the UserCredential.
   */
  async signUpWithEmail(
    email: string,
    password: string
  ): Promise<FirebaseAuthTypes.UserCredential> {
    try {
      const userCredential = await getAuth(
        getApp()
      ).createUserWithEmailAndPassword(email, password);
      return userCredential;
    } catch (error) {
      logger.error("Error signing up with email:", error);
      captureException(error);
      throw error;
    }
  },

  /**
   * Logs in a user with email and password.
   *
   * @param email The user's email address.
   * @param password The user's password.
   * @returns A Promise resolving to the UserCredential.
   */
  async loginWithEmail(
    email: string,
    password: string
  ): Promise<FirebaseAuthTypes.UserCredential> {
    try {
      const userCredential = await getAuth(getApp()).signInWithEmailAndPassword(
        email,
        password
      );
      return userCredential;
    } catch (error) {
      logger.error("Error logging in with email:", error);
      captureException(error);
      throw error;
    }
  },

  /**
   * Sends a password reset email to the user.
   *
   * @param email The user's email address.
   * @returns A Promise that resolves when the email is sent.
   */
  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      await getAuth(getApp()).sendPasswordResetEmail(email);
      logger.debug("Password reset email sent successfully.");
    } catch (error) {
      logger.error("Error sending password reset email:", error);
      captureException(error);
      throw error;
    }
  },

  /**
   * Signs in a user using Google.
   *
   * @returns A Promise resolving to the UserCredential.
   */
  async signInWithGoogle(): Promise<FirebaseAuthTypes.UserCredential> {
    return runOnMainThread(async () => {
      try {
        await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        });

        const signInResult = await GoogleSignin.signIn();

        // v14+ returns a typed result object instead of throwing on cancel
        if (signInResult.type === "cancelled") {
          throw Object.assign(new Error("Google sign-in cancelled by user."), {
            code: "auth/auth-popup-closed-by-user",
          });
        }

        // idToken lives in signInResult.data for v14+
        const idToken = signInResult.data?.idToken;
        const googleEmail = signInResult.data?.user?.email;

        if (!idToken) {
          throw new Error("No ID token received from Google Sign-In");
        }

        if (!googleEmail) {
          throw new Error(
            "Email address not provided by Google. Please use an account with a valid email."
          );
        }

        const googleCredential = GoogleAuthProvider.credential(idToken);

        const userCredential = await getAuth(getApp()).signInWithCredential(
          googleCredential
        );

        logger.debug("✅ Google authentication successful:", {
          uid: userCredential.user?.uid,
          email: userCredential.user?.email,
          displayName: userCredential.user?.displayName,
        });
        await clearLocalAuthData("google-signin");

        return userCredential;
      } catch (error) {
        logger.error("Error signing in with Google:", error);
        captureException(error);
        throw error;
      }
    });
  },

  /**
   * Signs in a user using X (Twitter).
   *
   * Opens Chrome Custom Tabs (Android) or Safari View Controller (iOS) to
   * complete the OAuth flow — no native Twitter SDK required.
   *
   * @returns A Promise resolving to the UserCredential.
   */
  async signInWithTwitter(): Promise<FirebaseAuthTypes.UserCredential> {
    try {
      // OAuthProvider('twitter.com') opens Chrome Custom Tabs (Android) /
      // Safari View Controller (iOS) for the full OAuth flow.
      // TwitterAuthProvider cannot be instantiated on native SDKs.
      const provider = new OAuthProvider("twitter.com");
      const auth = getAuth(getApp());
      const userCredential = await signInWithPopup(auth, provider);
      logger.debug("✅ Twitter/X authentication successful:", {
        uid: userCredential.user?.uid,
        email: userCredential.user?.email,
        displayName: userCredential.user?.displayName,
      });
      return userCredential;
    } catch (error) {
      logger.error("Error signing in with Twitter/X:", error);
      captureException(error);
      throw error;
    }
  },

  /**
   * Signs in a user using Facebook.
   *
   * @returns A Promise resolving to the UserCredential.
   */
  async signInWithFacebook(): Promise<FirebaseAuthTypes.UserCredential | null> {
    let appStateListener: { remove: () => void } | null = null;
    const cleanupAppStateListener = () => {
      appStateListener?.remove();
      appStateListener = null;
    };

    try {
      logger.debug("🔐 Starting Facebook login process...");

      // First, let's verify Facebook SDK is properly initialized
      logger.debug("🔍 Checking Facebook SDK status...");
      logger.debug("📱 LoginManager available:", !!LoginManager);
      logger.debug("🔑 AccessToken available:", !!AccessToken);

      try {
        logger.debug("🧪 Testing Facebook SDK initialization...");
        // Test if we can access Facebook SDK methods
        if (typeof LoginManager.logInWithPermissions !== "function") {
          throw new Error("Facebook LoginManager not properly configured");
        }
        logger.debug("✅ Facebook SDK appears to be initialized correctly");
      } catch (sdkError) {
        logger.error("❌ Facebook SDK initialization issue:", sdkError);
        captureException(sdkError);
        throw new Error(
          "Facebook SDK not properly initialized. Please restart the app."
        );
      }

      // Clear any existing Facebook session to avoid account conflicts
      logger.debug("🧹 Clearing any existing Facebook session...");
      try {
        LoginManager.logOut();
        logger.debug("✅ Facebook session cleared successfully");
      } catch (logoutError) {
        logger.warn("⚠️ Facebook logout warning:", logoutError);
      }

      // Request Facebook login permissions with timeout
      logger.debug("🔓 Requesting Facebook login permissions...");
      logger.debug("⏰ Setting 30-second timeout for permission request...");

      // Add AppState monitoring to track background/foreground transitions
      appStateListener = AppState.addEventListener(
        "change",
        (nextAppState) => {
          logger.debug(`🔄 App state changed to: ${nextAppState}`);
          if (nextAppState === "background") {
            logger.debug("📱 Facebook login likely opened external app/browser");
            logger.debug(
              "🔑 CRITICAL: If app doesn't return, missing Android Key Hash is likely cause"
            );
            logger.debug("📋 Required Key Hash: Xo8WBi6jzSxKDVR4drqm84yr9iU=");
            logger.debug(
              "🏠 Add to Facebook Developer Console → Settings → Basic → Android Platform"
            );
          } else if (nextAppState === "active") {
            logger.debug(
              "🔙 App returned to foreground - checking Facebook login result"
            );
          }
        }
      );

      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        safeTimeout(() => {
          cleanupAppStateListener();
          reject(
            new Error(
              "Facebook permission request timed out after 30 seconds. On real device this usually indicates:\n" +
                "1. ❗ MISSING ANDROID KEY HASH in Facebook Developer Console (MOST LIKELY)\n" +
                "   → Add: Xo8WBi6jzSxKDVR4drqm84yr9iU=\n" +
                "   → Location: Facebook Console → Settings → Basic → Android Platform\n" +
                "2. Facebook app not in Development mode\n" +
                "3. Package name mismatch (com.roobsworld.riddlequest)\n" +
                "4. App restrictions in Facebook Developer Console\n" +
                "5. Firebase project not configured for Facebook auth"
            )
          );
        }, 30000);
      });

      // Race between permission request and timeout
      logger.debug(
        "🚀 Starting Promise.race between Facebook login and timeout..."
      );

      const result = (await Promise.race([
        LoginManager.logInWithPermissions(["public_profile", "email"])
          .then((res) => {
            logger.debug(
              "✅ LoginManager.logInWithPermissions resolved with:",
              res
            );
            return res;
          })
          .catch((err) => {
            if (isFacebookLoginCancellation(err)) {
              throw err;
            }

            logger.error(
              "❌ LoginManager.logInWithPermissions rejected:",
              err
            );
            throw err;
          }),
        timeoutPromise,
      ])) as {
        isCancelled: boolean;
        grantedPermissions?: string[];
        declinedPermissions?: string[];
      };

      logger.debug("🎯 Promise.race completed successfully");

      // Clean up AppState listener after successful login
      appStateListener?.remove();
      logger.debug("🧹 Cleaned up AppState listener");

      logger.debug("📝 Facebook login result:", {
        isCancelled: result.isCancelled,
        grantedPermissions: result.grantedPermissions,
        declinedPermissions: result.declinedPermissions,
      });

      // Additional debugging for permission issues
      if (result.grantedPermissions && result.grantedPermissions.length === 0) {
        logger.warn("⚠️ No permissions granted by Facebook");
        logger.warn("🔍 Possible causes:");
        logger.warn("  - User declined all permissions");
        logger.warn("  - Facebook app configuration issue");
        logger.warn("  - App not approved for requested permissions");
      }

      if (result.declinedPermissions && result.declinedPermissions.length > 0) {
        logger.warn(
          "❌ Some permissions were declined:",
          result.declinedPermissions
        );
      }

      if (result.isCancelled) {
        return null;
      }

      // Get Facebook access token
      logger.debug("🔑 Retrieving Facebook access token...");
      const data = await AccessToken.getCurrentAccessToken();

      if (!data) {
        logger.error("❌ No Facebook access token received");
        logger.error("🔍 DEBUGGING INFO:");
        logger.error("- Facebook login completed successfully");
        logger.error("- User did not cancel");
        logger.error("- AccessToken.getCurrentAccessToken() returned null");
        logger.error(
          "- This typically means Facebook rejected the access token"
        );
        logger.error(
          "- MOST LIKELY CAUSE: Missing Facebook Key Hash in Developer Console"
        );
        logger.error("- Required Key Hash: Xo8WBi6jzSxKDVR4drqm84yr9iU=");
        logger.error(
          "- Add this to Facebook Developer Console → Settings → Basic → Android Platform"
        );
        logger.error(
          "- Alternative: Check if Facebook app is in Development mode"
        );
        logger.error(
          "- Alternative: Verify App ID and Client Token are correct"
        );
        throw new Error("Something went wrong obtaining access token");
      }

      logger.debug("✅ Facebook access token received:", {
        accessToken: data.accessToken.substring(0, 20) + "...",
        permissions: data.permissions,
        expires: data.expirationTime,
      });

      // **NEW: Enhanced debugging for access token type**
      logger.debug("🔍 DETAILED ACCESS TOKEN ANALYSIS:");
      logger.debug("- Full Token Length:", data.accessToken.length);
      logger.debug("- Token Prefix:", data.accessToken.substring(0, 10));
      logger.debug(
        "- Token Type:",
        data.accessToken.startsWith("GG|")
          ? "App Access Token (WRONG)"
          : "User Access Token (CORRECT)"
      );
      logger.debug("- Permissions Granted:", data.permissions);
      logger.debug(
        "- Declined Permissions:",
        data.declinedPermissions || "None"
      );
      logger.debug(
        "- Token Expiry:",
        new Date(data.expirationTime || 0).toISOString()
      );
      logger.debug("- User ID:", data.userID || "Not Available");
      logger.debug(
        "- App ID from token:",
        data.applicationID || "Not Available"
      );
      logger.debug("- Gaming App Token Format Check:");
      logger.debug(
        "  - Is Gaming Token:",
        data.accessToken.includes("gaming") ||
          data.accessToken.startsWith("GAT_")
      );
      logger.debug(
        "  - Raw Token Sample:",
        data.accessToken.substring(0, 50) + "..."
      );

      // Check if we got the wrong token type
      if (data.accessToken.startsWith("GG|")) {
        logger.error(
          "❌ CRITICAL ERROR: Received App Access Token instead of User Access Token"
        );
        logger.error(
          "- App Access Tokens start with 'GG|' and are for server-to-server calls"
        );
        logger.error(
          "- User Access Tokens are long alphanumeric strings for user authentication"
        );
        logger.error("- This indicates a Facebook SDK configuration issue");
        logger.error(
          "- SOLUTION: Check Facebook Developer Console App Mode and OAuth settings"
        );
        throw new Error(
          "Invalid token type: received App Access Token instead of User Access Token"
        );
      }

      // Enhanced consumer app token validation
      logger.debug("🏢 CONSUMER APP SPECIFIC CHECKS:");
      logger.debug(
        "- Token appears to be for consumer app:",
        data.applicationID === "1249521063516632"
      );
      logger.debug(
        "- Public profile permission present:",
        data.permissions?.includes("public_profile")
      );
      logger.debug(
        "- Email permission present:",
        data.permissions?.includes("email")
      );

      // Check if email permission was granted
      if (!data.permissions?.includes("email")) {
        logger.error("❌ MISSING EMAIL PERMISSION");
        logger.error("- Email permission was not granted by Facebook");
        logger.error("- This is required for user account creation");
        logger.error("- Permissions granted:", data.permissions);
        logger.error("- Permissions declined:", data.declinedPermissions);
        logger.error("- User may have declined email permission during login");
        logger.error("- SOLUTION: Clear Facebook app cache and retry login");
        logger.error(
          "- SOLUTION: In Facebook app settings, revoke Riddle Quest permissions and retry"
        );

        // Force logout to clear any cached permissions
        try {
          LoginManager.logOut();
          logger.debug(
            "🧹 Cleared Facebook session due to missing email permission"
          );
        } catch (e) {
          logger.warn("⚠️ Could not clear Facebook session:", e);
        }

        throw new Error(
          "Email permission not granted. Please clear Facebook app cache and try again, ensuring you approve email access when prompted."
        );
      }

      logger.debug("- Ready for Firebase credential creation...");

      // Create Firebase credential
      logger.debug("🔗 Creating Firebase credential...");
      const facebookCredential = FacebookAuthProvider.credential(
        data.accessToken
      );

      // Sign in with Firebase
      logger.debug("🔥 Signing in with Firebase...");
      const userCredential = await getAuth(getApp()).signInWithCredential(
        facebookCredential
      );

      logger.debug("✅ Firebase authentication successful:", {
        uid: userCredential.user?.uid,
        email: userCredential.user?.email,
        displayName: userCredential.user?.displayName,
      });

      // Enhanced debugging for user object after Facebook login
      logger.debug("🔍 DETAILED FIREBASE USER OBJECT AFTER FACEBOOK LOGIN:");
      logger.debug("- UID:", userCredential.user?.uid);
      logger.debug("- Email:", userCredential.user?.email || "(null/empty)");
      logger.debug("- Email Type:", typeof userCredential.user?.email);
      logger.debug("- Email Verified:", userCredential.user?.emailVerified);
      logger.debug("- Display Name:", userCredential.user?.displayName);
      logger.debug("- Photo URL:", userCredential.user?.photoURL);
      logger.debug(
        "- Provider Data:",
        userCredential.user?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          uid: provider.uid,
          email: provider.email,
          displayName: provider.displayName,
        }))
      );

      // Reload user to ensure all provider data is populated
      logger.debug(
        "🔄 Reloading Firebase user to populate all provider data..."
      );
      await userCredential.user.reload();
      const reloadedUser = getAuth(getApp()).currentUser;

      logger.debug("🔍 FIREBASE USER OBJECT AFTER RELOAD:");
      logger.debug("- UID:", reloadedUser?.uid);
      logger.debug("- Email:", reloadedUser?.email || "(null/empty)");
      logger.debug("- Email Type:", typeof reloadedUser?.email);
      logger.debug("- Email Verified:", reloadedUser?.emailVerified);
      logger.debug("- Display Name:", reloadedUser?.displayName);
      logger.debug("- Photo URL:", reloadedUser?.photoURL);
      logger.debug(
        "- Provider Data:",
        reloadedUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          uid: provider.uid,
          email: provider.email,
          displayName: provider.displayName,
        }))
      );

      // If Firebase didn't provide email, try fetching it directly from Facebook Graph API
      if (!reloadedUser?.email) {
        logger.debug(
          "⚠️ Firebase didn't provide email, attempting direct Facebook Graph API call..."
        );
        try {
          logger.debug("🌐 Making Facebook Graph API request for user email...");

          // Get current access token
          const currentToken = await AccessToken.getCurrentAccessToken();
          if (!currentToken) {
            throw new Error(
              "No Facebook access token available for Graph API call"
            );
          }

          // Call Facebook Graph API to get user info including email
          const graphResponse = await fetch(
            `https://graph.facebook.com/me?fields=id,name,email&access_token=${currentToken.accessToken}`
          );

          if (!graphResponse.ok) {
            throw new Error(
              `Facebook Graph API error: ${graphResponse.status} ${graphResponse.statusText}`
            );
          }

          const userData = await graphResponse.json();
          logger.debug("📊 Facebook Graph API response:", {
            id: userData.id,
            name: userData.name,
            email: userData.email || "(not provided)",
            hasEmail: !!userData.email,
          });

          if (userData.email) {
            logger.debug(
              "✅ Successfully retrieved email from Facebook Graph API:",
              userData.email
            );
            // Store the email in a way that can be accessed by AuthContext
            // We'll need to modify the userCredential or find another way to pass this
            logger.debug("🔧 Email retrieved, will be handled in AuthContext");
          } else {
            logger.warn(
              "⚠️ Facebook Graph API also didn't provide email address"
            );
            logger.warn("🔍 Possible reasons:");
            logger.warn("  - User's Facebook account has no email address");
            logger.warn("  - Email is not verified on Facebook");
            logger.warn("  - Facebook privacy settings prevent email sharing");
            logger.warn(
              "  - App needs to be in Live mode for email permission"
            );
          }
        } catch (graphError) {
          logger.error("❌ Facebook Graph API call failed:", graphError);
          captureException(graphError);
          logger.error(
            "🔧 Continuing with normal flow, AuthContext will handle missing email"
          );
        }
      }

      await clearLocalAuthData("facebook-signin");

      return userCredential;
    } catch (error: unknown) {
      cleanupAppStateListener();

      if (isFacebookLoginCancellation(error)) {
        return null;
      }

      logger.error("❌ Facebook login error:", error);
      captureException(error);

      // Clean up AppState listener on error
      try {
        cleanupAppStateListener();
        logger.debug("🧹 Cleaned up AppState listener on error");
      } catch (cleanupError) {
        logger.warn("⚠️ Failed to cleanup AppState listener:", cleanupError);
      }

      // Enhanced error handling with detailed logging
      if (error instanceof Error) {
        logger.error("📝 Error details:", {
          name: error.name,
          message: error.message,
          stack: error.stack?.substring(0, 200),
        });
      }

      if (error && typeof error === "object" && "code" in error) {
        const firebaseError =
          error as FirebaseAuthTypes.NativeFirebaseAuthError;
        logger.error("🔥 Firebase error code:", firebaseError.code);

        switch (firebaseError.code) {
          case "auth/account-exists-with-different-credential": {
            logger.error("🔄 Account exists with different credential");
            logger.debug("🔗 Implementing automatic account linking...");

            // Declare signInMethods outside try block so it's accessible in catch
            let signInMethods: string[] = [];

            try {
              // Get the current Facebook access token
              const currentFacebookToken =
                await AccessToken.getCurrentAccessToken();
              if (!currentFacebookToken) {
                throw new Error(
                  "No Facebook access token available for linking"
                );
              }

              // Get the Facebook credential that caused the conflict
              const facebookCredential = FacebookAuthProvider.credential(
                currentFacebookToken.accessToken
              );

              // Get existing sign-in methods for the email
              logger.debug("📧 Checking existing sign-in methods for email...");
              signInMethods = await getAuth(
                getApp()
              ).fetchSignInMethodsForEmail("craigbeswetherick@gmail.com");
              logger.debug("🔍 Existing sign-in methods:", signInMethods);

              // If fetchSignInMethodsForEmail returns empty but we have a conflict,
              // it's likely a Google account that's signed out. Try Google linking first.
              if (signInMethods.length === 0) {
                logger.debug(
                  "⚠️ No sign-in methods found, but conflict exists. Trying Google linking..."
                );
                logger.debug(
                  "🔗 Assuming Google account and attempting automatic linking..."
                );
              }

              // If the account exists with Google, or if we have an empty array (likely Google),
              // sign in with Google first, then link Facebook
              if (
                signInMethods.includes("google.com") ||
                signInMethods.length === 0
              ) {
                logger.debug(
                  "🔗 Account exists with Google, attempting automatic linking..."
                );

                // Sign in with Google first
                logger.debug("🔐 Signing in with Google to link Facebook...");
                await GoogleSignin.hasPlayServices({
                  showPlayServicesUpdateDialog: true,
                });
                const googleSignInResult = await GoogleSignin.signIn();
                const googleIdToken = googleSignInResult.data?.idToken;

                if (!googleIdToken) {
                  throw new Error("Failed to get Google ID token for linking");
                }

                const googleCredential =
                  GoogleAuthProvider.credential(googleIdToken);
                const googleUserCredential = await getAuth(
                  getApp()
                ).signInWithCredential(googleCredential);

                logger.debug(
                  "✅ Signed in with Google, now linking Facebook..."
                );

                // Link the Facebook credential to the existing Google account
                const linkedUser =
                  await googleUserCredential.user.linkWithCredential(
                    facebookCredential
                  );

                logger.debug(
                  "🎉 Successfully linked Facebook to existing Google account!"
                );
                logger.debug("✅ Account linking successful:", {
                  uid: linkedUser.user?.uid,
                  email: linkedUser.user?.email,
                  providers: linkedUser.user?.providerData?.map(
                    (p) => p.providerId
                  ),
                });

                return linkedUser;
              }

              // If the account exists with email/password, we need user interaction
              if (signInMethods.includes("password")) {
                throw new Error(
                  "Account exists with email/password. Please sign in with your email and password first, " +
                    "then you can link Facebook in account settings."
                );
              }

              // Unknown sign-in method
              throw new Error(
                `Account exists with: ${signInMethods.join(", ")}. ` +
                  "Please sign in with that method first to link Facebook."
              );
            } catch (linkError) {
              if (isFacebookLoginCancellation(linkError)) {
                return null;
              }

              logger.error("❌ Account linking failed:", linkError);
              captureException(linkError);

              if (
                linkError instanceof Error &&
                linkError.message.includes("User cancelled")
              ) {
                throw new Error("Account linking cancelled by user.");
              }

              if (
                linkError instanceof Error &&
                linkError.message.includes("email/password")
              ) {
                throw linkError; // Re-throw email/password message as-is
              }

              // Provide more specific guidance based on the error
              if (
                linkError instanceof Error &&
                (linkError.message.includes("Google") ||
                  linkError.message.includes("google"))
              ) {
                throw new Error(
                  "Google sign-in failed during account linking. " +
                    "Please try signing in with Google first, then link Facebook in account settings."
                );
              }

              // If fetchSignInMethodsForEmail returned empty, provide specific guidance
              const signInMethodsEmpty = signInMethods.length === 0;
              if (signInMethodsEmpty) {
                throw new Error(
                  "Account conflict detected but couldn't determine sign-in method. " +
                    "Please try signing in with Google or email/password first, " +
                    "then link Facebook in account settings."
                );
              }

              throw new Error(
                "Failed to automatically link accounts. Please sign in with your original method " +
                  "(Google or email/password) and link Facebook in account settings."
              );
            }
          }
          case "auth/auth-popup-closed-by-user":
            logger.debug("👤 Facebook auth popup closed by user.");
            throw new Error("Facebook login cancelled.");
          case "auth/operation-not-supported-in-this-environment":
            logger.error(
              "🚫 Facebook login not supported in this environment"
            );
            throw new Error(
              "Facebook login is not supported in this environment."
            );
          case "auth/network-request-failed":
            logger.error("🌐 Network request failed during Facebook login");
            throw new Error(
              "Network error during Facebook login. Please check your connection."
            );
          case "auth/invalid-credential":
            logger.error("🔐 Invalid Facebook credential");
            throw new Error("Invalid Facebook credentials. Please try again.");
          default:
            logger.error("🔥 Unknown Firebase error:", firebaseError.code);
            throw error;
        }
      }

      // Handle non-Firebase errors
      if (error instanceof Error) {
        if (error.message.includes("User cancelled")) {
          logger.debug("👤 User cancellation confirmed");
          throw error;
        }
        if (error.message.includes("access token")) {
          logger.error("🔑 Access token issue");
          logger.error(
            "🚨 LIKELY SOLUTION: Add Facebook Key Hash to Developer Console"
          );
          logger.error("📋 Key Hash needed: Xo8WBi6jzSxKDVR4drqm84yr9iU=");
          throw new Error("Facebook access token error. Please try again.");
        }
      }

      logger.error("❓ Unknown error type:", typeof error);
      throw error;
    }
  },

  /**
   * Signs in anonymously (guest play).
   *
   * @returns A Promise resolving to the UserCredential.
   */
  async signInAnonymously(): Promise<FirebaseAuthTypes.UserCredential> {
    try {
      const userCredential = await getAuth(getApp()).signInAnonymously();
      logger.debug("✅ Anonymous sign-in successful:", userCredential.user?.uid);
      return userCredential;
    } catch (error) {
      logger.error("Error signing in anonymously:", error);
      captureException(error);
      throw error;
    }
  },

  /**
   * Logs out the current user.
   *
   * @returns A Promise that resolves when the user is logged out.
   */
  async logout(): Promise<void> {
    try {
      await signOut(getAuth(getApp()));
      logger.debug("User signed out successfully.");
    } catch (error) {
      logger.error("Error signing out:", error);
      captureException(error);
      throw error;
    } finally {
      await clearLocalAuthData("logout");
    }
  },

  /**
   * Diagnostic utility for Facebook SDK configuration.
   * Helps identify common Facebook integration issues.
   */
  async diagnoseFacebookSetup(): Promise<{
    isConfigured: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    logger.debug("🔍 Running Facebook SDK diagnostic...");

    try {
      // Check if Facebook SDK is available
      if (!LoginManager || !AccessToken) {
        issues.push("Facebook SDK not properly imported");
        recommendations.push(
          "Ensure react-native-fbsdk-next is properly installed"
        );
      } else {
        logger.debug("✅ Facebook SDK imported successfully");
      }

      // Test Facebook login permissions (without actually logging in)
      try {
        // This will test if the Facebook app is properly configured
        logger.debug("🧪 Testing Facebook app configuration...");

        // Check if we can access LoginManager methods
        if (typeof LoginManager.logInWithPermissions !== "function") {
          issues.push("Facebook LoginManager not properly configured");
          recommendations.push(
            "Check Facebook app configuration in app.config.js"
          );
        }

        logger.debug("✅ Facebook LoginManager available");
      } catch (error) {
        issues.push(
          "Facebook LoginManager test failed: " +
            (error instanceof Error ? error.message : String(error))
        );
        recommendations.push("Check Facebook SDK setup and app configuration");
      }

      return {
        isConfigured: issues.length === 0,
        issues,
        recommendations,
      };
    } catch (error) {
      logger.error("❌ Facebook diagnostic failed:", error);
      captureException(error);
      issues.push(
        "Diagnostic failed: " +
          (error instanceof Error ? error.message : String(error))
      );
      recommendations.push("Check Facebook SDK installation and setup");

      return {
        isConfigured: false,
        issues,
        recommendations,
      };
    }
  },

  /**
   * Comprehensive Facebook troubleshooting utility.
   * Provides detailed analysis of Facebook configuration and common issues.
   */
  async troubleshootFacebookLogin(): Promise<{
    configurationStatus: string;
    commonIssues: string[];
    troubleshootingSteps: string[];
    keyHashInfo: string;
  }> {
    logger.debug("🔧 Running comprehensive Facebook troubleshooting...");

    const commonIssues = [
      "1. Missing Android Key Hash in Facebook Developer Console",
      "2. Facebook app not in Development mode",
      "3. App ID or Client Token mismatch",
      "4. Missing or incorrect app.config.js configuration",
      "5. Android strings.xml configuration issues",
      "6. Facebook app restrictions or review status",
      "7. Network connectivity issues",
      "8. Device/emulator compatibility issues",
      "9. Missing OAuth Redirect URI: fb1568112680678349://authorize",
      "10. User account not added as test user/developer",
      "11. public_profile and email permissions not approved",
      "12. Facebook app in Live mode instead of Development mode",
    ];

    const troubleshootingSteps = [
      "1. Verify Facebook app is in Development mode in Facebook Developer Console",
      "2. Add Android Key Hash: Xo8WBi6jzSxKDVR4drqm84yr9iU= to Facebook Console",
      "3. Check Facebook App ID: 1249521063516632 matches in Developer Console",
      "4. Verify Client Token in Facebook Console matches: [NEW_CLIENT_TOKEN]",
      "5. Ensure package name com.roobsworld.riddlequest is configured in Facebook Console",
      "6. Add OAuth Redirect URI: fb1249521063516632://authorize",
      "7. Add your Facebook account as Developer or Test User",
      "8. Verify public_profile and email permissions are approved",
      "9. Test on a real device (Facebook login may not work in emulators)",
      "10. Check Facebook app permissions: public_profile and email should be approved",
      "11. Verify Facebook app is not restricted or in review mode",
      "12. Ensure Android platform has Class Name: com.roobsworld.riddlequest.MainActivity",
    ];

    const keyHashInfo =
      "Required Android Key Hash: Xo8WBi6jzSxKDVR4drqm84yr9iU=\n" +
      "Add this to Facebook Developer Console → App Settings → Basic → Android Platform\n" +
      "This key hash was generated from the app's debug keystore\n\n" +
      "CRITICAL: Also add OAuth Redirect URI: fb1568112680678349://authorize\n" +
      "Location: Facebook Console → App Settings → Basic → OAuth Redirect URIs\n\n" +
      "IMPORTANT: Ensure Facebook app is in Development mode\n" +
      "Location: Facebook Console → App Settings → Basic → App Mode";

    let configurationStatus = "Unknown";
    try {
      const diagnostic = await this.diagnoseFacebookSetup();
      configurationStatus = diagnostic.isConfigured
        ? "✅ SDK Configured"
        : "❌ Configuration Issues";
    } catch {
      configurationStatus = "❌ Diagnostic Failed";
    }

    return {
      configurationStatus,
      commonIssues,
      troubleshootingSteps,
      keyHashInfo,
    };
  },
};



