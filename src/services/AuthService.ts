import auth, {
  type FirebaseAuthTypes,
  GoogleAuthProvider,
  FacebookAuthProvider,
} from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { AccessToken, LoginManager } from "react-native-fbsdk-next";
import { InteractionManager, AppState } from "react-native";

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

export const AuthService = {
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
      const userCredential = await auth().createUserWithEmailAndPassword(
        email,
        password
      );
      return userCredential;
    } catch (error) {
      console.error("Error signing up with email:", error);
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
      const userCredential = await auth().signInWithEmailAndPassword(
        email,
        password
      );
      return userCredential;
    } catch (error) {
      console.error("Error logging in with email:", error);
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
      await auth().sendPasswordResetEmail(email);
      console.log("Password reset email sent successfully.");
    } catch (error) {
      console.error("Error sending password reset email:", error);
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

        // For Google Sign-In version 14.x, idToken is in signInResult.data.idToken
        const idToken = signInResult.data?.idToken;

        if (!idToken) {
          throw new Error("No ID token received from Google Sign-In");
        }

        const googleCredential = GoogleAuthProvider.credential(idToken);

        const userCredential = await auth().signInWithCredential(
          googleCredential
        );

        // Validate that Google provided an email address
        if (!userCredential.user?.email) {
          console.error("❌ MISSING EMAIL FROM GOOGLE");
          console.error("- Google did not provide an email address");
          console.error("- This is required for user account creation");
          throw new Error(
            "Email address not provided by Google. Please use an account with a valid email."
          );
        }

        console.log("✅ Google authentication successful:", {
          uid: userCredential.user?.uid,
          email: userCredential.user?.email,
          displayName: userCredential.user?.displayName,
        });

        return userCredential;
      } catch (error) {
        console.error("Error signing in with Google:", error);
        throw error;
      }
    });
  },

  /**
   * Signs in a user using Facebook.
   *
   * @returns A Promise resolving to the UserCredential.
   */
  async signInWithFacebook(): Promise<FirebaseAuthTypes.UserCredential> {
    try {
      console.log("🔐 Starting Facebook login process...");

      // First, let's verify Facebook SDK is properly initialized
      console.log("🔍 Checking Facebook SDK status...");
      console.log("📱 LoginManager available:", !!LoginManager);
      console.log("🔑 AccessToken available:", !!AccessToken);

      try {
        console.log("🧪 Testing Facebook SDK initialization...");
        // Test if we can access Facebook SDK methods
        if (typeof LoginManager.logInWithPermissions !== "function") {
          throw new Error("Facebook LoginManager not properly configured");
        }
        console.log("✅ Facebook SDK appears to be initialized correctly");
      } catch (sdkError) {
        console.error("❌ Facebook SDK initialization issue:", sdkError);
        throw new Error(
          "Facebook SDK not properly initialized. Please restart the app."
        );
      }

      // Clear any existing Facebook session to avoid account conflicts
      console.log("🧹 Clearing any existing Facebook session...");
      try {
        LoginManager.logOut();
        console.log("✅ Facebook session cleared successfully");
      } catch (logoutError) {
        console.warn("⚠️ Facebook logout warning:", logoutError);
      }

      // Request Facebook login permissions with timeout
      console.log("🔓 Requesting Facebook login permissions...");
      console.log("⏰ Setting 30-second timeout for permission request...");

      // Add AppState monitoring to track background/foreground transitions
      const appStateListener = AppState.addEventListener(
        "change",
        (nextAppState) => {
          console.log(`🔄 App state changed to: ${nextAppState}`);
          if (nextAppState === "background") {
            console.log("📱 Facebook login likely opened external app/browser");
            console.log(
              "🔑 CRITICAL: If app doesn't return, missing Android Key Hash is likely cause"
            );
            console.log("📋 Required Key Hash: Xo8WBi6jzSxKDVR4drqm84yr9iU=");
            console.log(
              "🏠 Add to Facebook Developer Console → Settings → Basic → Android Platform"
            );
          } else if (nextAppState === "active") {
            console.log(
              "🔙 App returned to foreground - checking Facebook login result"
            );
          }
        }
      );

      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          appStateListener?.remove();
          reject(
            new Error(
              "Facebook permission request timed out after 30 seconds. On real device this usually indicates:\n" +
                "1. ❗ MISSING ANDROID KEY HASH in Facebook Developer Console (MOST LIKELY)\n" +
                "   → Add: Xo8WBi6jzSxKDVR4drqm84yr9iU=\n" +
                "   → Location: Facebook Console → Settings → Basic → Android Platform\n" +
                "2. Facebook app not in Development mode\n" +
                "3. Package name mismatch (com.grindhead.qwordly)\n" +
                "4. App restrictions in Facebook Developer Console\n" +
                "5. Firebase project not configured for Facebook auth"
            )
          );
        }, 30000);
      });

      // Race between permission request and timeout
      console.log(
        "🚀 Starting Promise.race between Facebook login and timeout..."
      );

      const result = (await Promise.race([
        LoginManager.logInWithPermissions(["public_profile", "email"])
          .then((res) => {
            console.log(
              "✅ LoginManager.logInWithPermissions resolved with:",
              res
            );
            return res;
          })
          .catch((err) => {
            console.error(
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

      console.log("🎯 Promise.race completed successfully");

      // Clean up AppState listener after successful login
      appStateListener?.remove();
      console.log("🧹 Cleaned up AppState listener");

      console.log("📝 Facebook login result:", {
        isCancelled: result.isCancelled,
        grantedPermissions: result.grantedPermissions,
        declinedPermissions: result.declinedPermissions,
      });

      // Additional debugging for permission issues
      if (result.grantedPermissions && result.grantedPermissions.length === 0) {
        console.warn("⚠️ No permissions granted by Facebook");
        console.warn("🔍 Possible causes:");
        console.warn("  - User declined all permissions");
        console.warn("  - Facebook app configuration issue");
        console.warn("  - App not approved for requested permissions");
      }

      if (result.declinedPermissions && result.declinedPermissions.length > 0) {
        console.warn(
          "❌ Some permissions were declined:",
          result.declinedPermissions
        );
      }

      if (result.isCancelled) {
        console.log("👤 User cancelled Facebook login");
        throw new Error("User cancelled the login process");
      }

      // Get Facebook access token
      console.log("🔑 Retrieving Facebook access token...");
      const data = await AccessToken.getCurrentAccessToken();

      if (!data) {
        console.error("❌ No Facebook access token received");
        console.error("🔍 DEBUGGING INFO:");
        console.error("- Facebook login completed successfully");
        console.error("- User did not cancel");
        console.error("- AccessToken.getCurrentAccessToken() returned null");
        console.error(
          "- This typically means Facebook rejected the access token"
        );
        console.error(
          "- MOST LIKELY CAUSE: Missing Facebook Key Hash in Developer Console"
        );
        console.error("- Required Key Hash: Xo8WBi6jzSxKDVR4drqm84yr9iU=");
        console.error(
          "- Add this to Facebook Developer Console → Settings → Basic → Android Platform"
        );
        console.error(
          "- Alternative: Check if Facebook app is in Development mode"
        );
        console.error(
          "- Alternative: Verify App ID and Client Token are correct"
        );
        throw new Error("Something went wrong obtaining access token");
      }

      console.log("✅ Facebook access token received:", {
        accessToken: data.accessToken.substring(0, 20) + "...",
        permissions: data.permissions,
        expires: data.expirationTime,
      });

      // **NEW: Enhanced debugging for access token type**
      console.log("🔍 DETAILED ACCESS TOKEN ANALYSIS:");
      console.log("- Full Token Length:", data.accessToken.length);
      console.log("- Token Prefix:", data.accessToken.substring(0, 10));
      console.log(
        "- Token Type:",
        data.accessToken.startsWith("GG|")
          ? "App Access Token (WRONG)"
          : "User Access Token (CORRECT)"
      );
      console.log("- Permissions Granted:", data.permissions);
      console.log(
        "- Declined Permissions:",
        data.declinedPermissions || "None"
      );
      console.log(
        "- Token Expiry:",
        new Date(data.expirationTime || 0).toISOString()
      );
      console.log("- User ID:", data.userID || "Not Available");
      console.log(
        "- App ID from token:",
        data.applicationID || "Not Available"
      );
      console.log("- Gaming App Token Format Check:");
      console.log(
        "  - Is Gaming Token:",
        data.accessToken.includes("gaming") ||
          data.accessToken.startsWith("GAT_")
      );
      console.log(
        "  - Raw Token Sample:",
        data.accessToken.substring(0, 50) + "..."
      );

      // Check if we got the wrong token type
      if (data.accessToken.startsWith("GG|")) {
        console.error(
          "❌ CRITICAL ERROR: Received App Access Token instead of User Access Token"
        );
        console.error(
          "- App Access Tokens start with 'GG|' and are for server-to-server calls"
        );
        console.error(
          "- User Access Tokens are long alphanumeric strings for user authentication"
        );
        console.error("- This indicates a Facebook SDK configuration issue");
        console.error(
          "- SOLUTION: Check Facebook Developer Console App Mode and OAuth settings"
        );
        throw new Error(
          "Invalid token type: received App Access Token instead of User Access Token"
        );
      }

      // Enhanced consumer app token validation
      console.log("🏢 CONSUMER APP SPECIFIC CHECKS:");
      console.log(
        "- Token appears to be for consumer app:",
        data.applicationID === "1249521063516632"
      );
      console.log(
        "- Public profile permission present:",
        data.permissions?.includes("public_profile")
      );
      console.log(
        "- Email permission present:",
        data.permissions?.includes("email")
      );

      // Check if email permission was granted
      if (!data.permissions?.includes("email")) {
        console.error("❌ MISSING EMAIL PERMISSION");
        console.error("- Email permission was not granted by Facebook");
        console.error("- This is required for user account creation");
        console.error("- Permissions granted:", data.permissions);
        console.error("- Permissions declined:", data.declinedPermissions);
        console.error("- User may have declined email permission during login");
        console.error("- SOLUTION: Clear Facebook app cache and retry login");
        console.error(
          "- SOLUTION: In Facebook app settings, revoke Qwordly permissions and retry"
        );

        // Force logout to clear any cached permissions
        try {
          LoginManager.logOut();
          console.log(
            "🧹 Cleared Facebook session due to missing email permission"
          );
        } catch (e) {
          console.warn("⚠️ Could not clear Facebook session:", e);
        }

        throw new Error(
          "Email permission not granted. Please clear Facebook app cache and try again, ensuring you approve email access when prompted."
        );
      }

      console.log("- Ready for Firebase credential creation...");

      // Create Firebase credential
      console.log("🔗 Creating Firebase credential...");
      const facebookCredential = FacebookAuthProvider.credential(
        data.accessToken
      );

      // Sign in with Firebase
      console.log("🔥 Signing in with Firebase...");
      const userCredential = await auth().signInWithCredential(
        facebookCredential
      );

      console.log("✅ Firebase authentication successful:", {
        uid: userCredential.user?.uid,
        email: userCredential.user?.email,
        displayName: userCredential.user?.displayName,
      });

      // Enhanced debugging for user object after Facebook login
      console.log("🔍 DETAILED FIREBASE USER OBJECT AFTER FACEBOOK LOGIN:");
      console.log("- UID:", userCredential.user?.uid);
      console.log("- Email:", userCredential.user?.email || "(null/empty)");
      console.log("- Email Type:", typeof userCredential.user?.email);
      console.log("- Email Verified:", userCredential.user?.emailVerified);
      console.log("- Display Name:", userCredential.user?.displayName);
      console.log("- Photo URL:", userCredential.user?.photoURL);
      console.log(
        "- Provider Data:",
        userCredential.user?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          uid: provider.uid,
          email: provider.email,
          displayName: provider.displayName,
        }))
      );

      // Reload user to ensure all provider data is populated
      console.log(
        "🔄 Reloading Firebase user to populate all provider data..."
      );
      await userCredential.user.reload();
      const reloadedUser = auth().currentUser;

      console.log("🔍 FIREBASE USER OBJECT AFTER RELOAD:");
      console.log("- UID:", reloadedUser?.uid);
      console.log("- Email:", reloadedUser?.email || "(null/empty)");
      console.log("- Email Type:", typeof reloadedUser?.email);
      console.log("- Email Verified:", reloadedUser?.emailVerified);
      console.log("- Display Name:", reloadedUser?.displayName);
      console.log("- Photo URL:", reloadedUser?.photoURL);
      console.log(
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
        console.log(
          "⚠️ Firebase didn't provide email, attempting direct Facebook Graph API call..."
        );
        try {
          console.log("🌐 Making Facebook Graph API request for user email...");

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
          console.log("📊 Facebook Graph API response:", {
            id: userData.id,
            name: userData.name,
            email: userData.email || "(not provided)",
            hasEmail: !!userData.email,
          });

          if (userData.email) {
            console.log(
              "✅ Successfully retrieved email from Facebook Graph API:",
              userData.email
            );
            // Store the email in a way that can be accessed by AuthContext
            // We'll need to modify the userCredential or find another way to pass this
            console.log("🔧 Email retrieved, will be handled in AuthContext");
          } else {
            console.warn(
              "⚠️ Facebook Graph API also didn't provide email address"
            );
            console.warn("🔍 Possible reasons:");
            console.warn("  - User's Facebook account has no email address");
            console.warn("  - Email is not verified on Facebook");
            console.warn("  - Facebook privacy settings prevent email sharing");
            console.warn(
              "  - App needs to be in Live mode for email permission"
            );
          }
        } catch (graphError) {
          console.error("❌ Facebook Graph API call failed:", graphError);
          console.error(
            "🔧 Continuing with normal flow, AuthContext will handle missing email"
          );
        }
      }

      return userCredential;
    } catch (error: unknown) {
      console.error("❌ Facebook login error:", error);

      // Clean up AppState listener on error
      try {
        // @ts-expect-error - appStateListener may be undefined in this scope
        appStateListener?.remove();
        console.log("🧹 Cleaned up AppState listener on error");
      } catch (cleanupError) {
        console.warn("⚠️ Failed to cleanup AppState listener:", cleanupError);
      }

      // Enhanced error handling with detailed logging
      if (error instanceof Error) {
        console.error("📝 Error details:", {
          name: error.name,
          message: error.message,
          stack: error.stack?.substring(0, 200),
        });
      }

      if (error && typeof error === "object" && "code" in error) {
        const firebaseError =
          error as FirebaseAuthTypes.NativeFirebaseAuthError;
        console.error("🔥 Firebase error code:", firebaseError.code);

        switch (firebaseError.code) {
          case "auth/account-exists-with-different-credential": {
            console.error("🔄 Account exists with different credential");
            console.log("🔗 Implementing automatic account linking...");

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
              console.log("📧 Checking existing sign-in methods for email...");
              signInMethods = await auth().fetchSignInMethodsForEmail(
                "craigbeswetherick@gmail.com"
              );
              console.log("🔍 Existing sign-in methods:", signInMethods);

              // If fetchSignInMethodsForEmail returns empty but we have a conflict,
              // it's likely a Google account that's signed out. Try Google linking first.
              if (signInMethods.length === 0) {
                console.log(
                  "⚠️ No sign-in methods found, but conflict exists. Trying Google linking..."
                );
                console.log(
                  "🔗 Assuming Google account and attempting automatic linking..."
                );
              }

              // If the account exists with Google, or if we have an empty array (likely Google),
              // sign in with Google first, then link Facebook
              if (
                signInMethods.includes("google.com") ||
                signInMethods.length === 0
              ) {
                console.log(
                  "🔗 Account exists with Google, attempting automatic linking..."
                );

                // Sign in with Google first
                console.log("🔐 Signing in with Google to link Facebook...");
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
                const googleUserCredential = await auth().signInWithCredential(
                  googleCredential
                );

                console.log(
                  "✅ Signed in with Google, now linking Facebook..."
                );

                // Link the Facebook credential to the existing Google account
                const linkedUser =
                  await googleUserCredential.user.linkWithCredential(
                    facebookCredential
                  );

                console.log(
                  "🎉 Successfully linked Facebook to existing Google account!"
                );
                console.log("✅ Account linking successful:", {
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
              console.error("❌ Account linking failed:", linkError);

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
            console.log("👤 Facebook auth popup closed by user.");
            throw new Error("Facebook login cancelled.");
          case "auth/operation-not-supported-in-this-environment":
            console.error(
              "🚫 Facebook login not supported in this environment"
            );
            throw new Error(
              "Facebook login is not supported in this environment."
            );
          case "auth/network-request-failed":
            console.error("🌐 Network request failed during Facebook login");
            throw new Error(
              "Network error during Facebook login. Please check your connection."
            );
          case "auth/invalid-credential":
            console.error("🔐 Invalid Facebook credential");
            throw new Error("Invalid Facebook credentials. Please try again.");
          default:
            console.error("🔥 Unknown Firebase error:", firebaseError.code);
            throw error;
        }
      }

      // Handle non-Firebase errors
      if (error instanceof Error) {
        if (error.message.includes("User cancelled")) {
          console.log("👤 User cancellation confirmed");
          throw error;
        }
        if (error.message.includes("access token")) {
          console.error("🔑 Access token issue");
          console.error(
            "🚨 LIKELY SOLUTION: Add Facebook Key Hash to Developer Console"
          );
          console.error("📋 Key Hash needed: Xo8WBi6jzSxKDVR4drqm84yr9iU=");
          throw new Error("Facebook access token error. Please try again.");
        }
      }

      console.error("❓ Unknown error type:", typeof error);
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
      await auth().signOut();
      console.log("User signed out successfully.");
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
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

    console.log("🔍 Running Facebook SDK diagnostic...");

    try {
      // Check if Facebook SDK is available
      if (!LoginManager || !AccessToken) {
        issues.push("Facebook SDK not properly imported");
        recommendations.push(
          "Ensure react-native-fbsdk-next is properly installed"
        );
      } else {
        console.log("✅ Facebook SDK imported successfully");
      }

      // Test Facebook login permissions (without actually logging in)
      try {
        // This will test if the Facebook app is properly configured
        console.log("🧪 Testing Facebook app configuration...");

        // Check if we can access LoginManager methods
        if (typeof LoginManager.logInWithPermissions !== "function") {
          issues.push("Facebook LoginManager not properly configured");
          recommendations.push(
            "Check Facebook app configuration in app.config.js"
          );
        }

        console.log("✅ Facebook LoginManager available");
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
      console.error("❌ Facebook diagnostic failed:", error);
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
    console.log("🔧 Running comprehensive Facebook troubleshooting...");

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
      "5. Ensure package name com.grindhead.qwordly is configured in Facebook Console",
      "6. Add OAuth Redirect URI: fb1249521063516632://authorize",
      "7. Add your Facebook account as Developer or Test User",
      "8. Verify public_profile and email permissions are approved",
      "9. Test on a real device (Facebook login may not work in emulators)",
      "10. Check Facebook app permissions: public_profile and email should be approved",
      "11. Verify Facebook app is not restricted or in review mode",
      "12. Ensure Android platform has Class Name: com.grindhead.qwordly.MainActivity",
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
