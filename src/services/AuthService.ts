import auth, {
  type FirebaseAuthTypes,
  GoogleAuthProvider,
  FacebookAuthProvider,
} from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { AccessToken, LoginManager } from "react-native-fbsdk-next";

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
    try {
      // Ensure the device supports Google Play services
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      // Obtain the user's ID token
      const { idToken } = await GoogleSignin.signIn();

      // Create a Google credential with the token
      const googleCredential = GoogleAuthProvider.credential(idToken);

      // Sign-in the user with the credential
      const userCredential = await auth().signInWithCredential(
        googleCredential
      );
      return userCredential;
    } catch (error) {
      console.error("Error signing in with Google:", error);
      throw error;
    }
  },

  /**
   * Signs in a user using Facebook.
   *
   * @returns A Promise resolving to the UserCredential.
   */
  async signInWithFacebook(): Promise<FirebaseAuthTypes.UserCredential> {
    try {
      // Attempt a login using the Facebook SDK. Show the results of the login
      const result = await LoginManager.logInWithPermissions([
        "public_profile",
        "email",
      ]);

      if (result.isCancelled) {
        throw new Error("User cancelled the login process");
      }

      // Once signed in, get the access token
      const data = await AccessToken.getCurrentAccessToken();

      if (!data) {
        throw new Error("Something went wrong obtaining access token");
      }

      // Create a Firebase credential with the AccessToken
      const facebookCredential = FacebookAuthProvider.credential(
        data.accessToken
      );

      // Sign-in the user with the credential
      const userCredential = await auth().signInWithCredential(
        facebookCredential
      );
      return userCredential;
    } catch (error) {
      console.error("Error signing in with Facebook:", error);
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
