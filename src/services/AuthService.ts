import auth, {
  type FirebaseAuthTypes,
  GoogleAuthProvider,
  FacebookAuthProvider,
} from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { AccessToken, LoginManager } from "react-native-fbsdk-next";
import { InteractionManager } from "react-native";

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
      const result = await LoginManager.logInWithPermissions([
        "public_profile",
        "email",
      ]);

      if (result.isCancelled) {
        throw new Error("User cancelled the login process");
      }

      const data = await AccessToken.getCurrentAccessToken();

      if (!data) {
        throw new Error("Something went wrong obtaining access token");
      }

      const facebookCredential = FacebookAuthProvider.credential(
        data.accessToken
      );

      const userCredential = await auth().signInWithCredential(
        facebookCredential
      );
      return userCredential;
    } catch (error: unknown) {
      console.error("Error signing in with Facebook:", error);
      if (error && typeof error === "object" && "code" in error) {
        const firebaseError =
          error as FirebaseAuthTypes.NativeFirebaseAuthError;
        switch (firebaseError.code) {
          case "auth/account-exists-with-different-credential":
            throw new Error(
              "Account exists with different credential. Please use a different login method."
            );
          case "auth/auth-popup-closed-by-user":
            console.log("Facebook auth popup closed by user.");
            throw new Error("Facebook login cancelled.");
          case "auth/operation-not-supported-in-this-environment":
            throw new Error(
              "Facebook login is not supported in this environment."
            );
          default:
            throw error;
        }
      }
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
};
