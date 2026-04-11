/**
 * @fileoverview
 * Landing screen for the Qwordly authentication flow.
 *
 * This screen is the primary entry point for unauthenticated users. It
 * provides email/password, Google, and Facebook sign-in options, a path
 * to registration, and a "Play as Guest" shortcut into gameplay.
 */
import React, { useState } from "react";
import { View, Text } from "react-native";
import CustomSafeAreaView from "../components/layouts/CustomSafeAreaView";
import GoogleSignInButton from "../components/buttons/GoogleSignInButton";
import FacebookSignInButton from "../components/buttons/FacebookSignInButton";
import WideButton from "../components/buttons/WideButton";
import StarryBackground from "../components/background/StarryBackground";
import PulsingSpinner from "../components/loading/PulsingSpinner";
import { AppStrings } from "../constants/AppStrings";
import { LOADING_SPINNER_SIZE } from "../constants/loading";
import Subtitle from "../components/text/Subtitle";
import { AuthService } from "../services/AuthService";
import { useAuth } from "../contexts/AuthContext";
import Error from "../components/text/Error";
import { type FirebaseAuthTypes } from "@react-native-firebase/auth";
import { styles, SPACING } from "../styles";
import { logger } from "../utils/logger";
import { captureException } from "../utils/sentry";
import CreditsModal from "../components/modals/help/CreditsModal";
import MainLogoSvg from "../../assets/images/main-logo.svg";

/**
 * Landing screen component used at the root of the auth stack.
 *
 * It wires social sign-in handlers, navigates to email/password login and
 * registration screens, and exposes a guest play CTA for anonymous sign-in.
 *
 * @param navigation React Navigation stack navigation prop.
 */
const LandingScreen = () => {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const [isCreditsVisible, setIsCreditsVisible] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const userCredential = await AuthService.signInWithGoogle();
      logger.debug("Google login success:", userCredential);
      if (userCredential.user?.uid) {
        login();
      }
    } catch (error) {
      const firebaseError = error as FirebaseAuthTypes.NativeFirebaseAuthError;
      logger.error("Google login error:", firebaseError);
      captureException(error);
      switch (firebaseError.code) {
        case "auth/account-exists-with-different-credential":
          setAuthError(
            "Account exists with different credential. Please use a different login method."
          );
          break;
        case "auth/auth-popup-closed-by-user":
          logger.debug("Auth popup closed by user.");
          break;
        default:
          setAuthError(
            firebaseError.message ||
              "An unexpected error occurred during Google login."
          );
      }
    } finally {
      setIsLoading(false);
    }
  };

  /* istanbul ignore next */
  const handleFacebookSignIn = async () => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const userCredential = await AuthService.signInWithFacebook();
      logger.debug("Facebook login success:", userCredential);
      if (userCredential.user?.uid) {
        login();
      }
    } catch (error: unknown) {
      logger.error("Facebook login error:", error);
      captureException(error);

      // Check if the error is a user cancellation first (more specific matching)
      if (error instanceof Error) {
        const errorMessage = (error as Error).message;

        // Check for exact cancellation messages
        if (
          errorMessage === "User cancelled the login process" ||
          errorMessage === "Facebook login cancelled."
        ) {
          logger.debug("Facebook login cancelled by user.");
          // Don't show error for cancellation - it's expected behavior
          return;
        }

        // Handle specific Facebook SDK errors
        if (errorMessage.includes("access token")) {
          logger.error("Facebook access token error detected");
          setAuthError(
            "Facebook login configuration issue. Please try again or contact support."
          );
          return;
        }

        if (errorMessage.includes("Facebook permission request timed out")) {
          logger.error("Facebook login timeout detected");
          setAuthError(
            "Facebook login timed out. This may indicate a configuration issue. Please try again."
          );
          return;
        }

        if (errorMessage.includes("Facebook SDK not properly initialized")) {
          logger.error("Facebook SDK initialization error detected");
          setAuthError(
            "Facebook login is not properly configured. Please restart the app and try again."
          );
          return;
        }

        // For generic Error objects that don't match specific patterns, use the actual error message
        // This fixes the issue where "FB Network error" was being replaced with generic message
        if (!("code" in error)) {
          setAuthError(errorMessage);
          return;
        }
      }

      // Handle Firebase auth errors
      if (error && typeof error === "object" && "code" in error) {
        const firebaseError =
          error as FirebaseAuthTypes.NativeFirebaseAuthError;
        switch (firebaseError.code) {
          case "auth/account-exists-with-different-credential":
            setAuthError(
              "Account exists with different credential. Please use a different login method."
            );
            break;
          case "auth/auth-popup-closed-by-user":
            logger.debug("Auth popup closed by user.");
            break;
          case "auth/operation-not-supported-in-this-environment":
            setAuthError(
              "Facebook login is not supported in this environment."
            );
            break;
          case "auth/network-request-failed":
            setAuthError(
              "Network error during Facebook login. Please check your connection and try again."
            );
            break;
          case "auth/invalid-credential":
            setAuthError("Invalid Facebook credentials. Please try again.");
            break;
          default:
            setAuthError(
              firebaseError.message ||
                "An unexpected error occurred during Facebook login."
            );
        }
      } else {
        // Handle other types of errors with better fallback
        const errorMessage =
          error instanceof Error
            ? (error as Error).message
            : "An unexpected error occurred during Facebook login.";

        logger.error("Non-Firebase Facebook error:", errorMessage);
        setAuthError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayButtonPress = async () => {
    setIsLoading(true);
    setAuthError(null);

    try {
      if (isAuthenticated) {
        await AuthService.logout();
      }
      await AuthService.signInAnonymously();
      // isAuthenticated becomes true -> Navigation switches to Game automatically
    } catch (error) {
      logger.error("Error signing in anonymously for guest play:", error);
      captureException(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CustomSafeAreaView className="justify-start">
      <StarryBackground />

      <View style={{ flex: 1, width: '100%', alignItems: 'center', zIndex: 2 }}>
        {/* Title at the top */}
        <View style={{ alignItems: 'center', paddingTop: SPACING.xl }}>
          <MainLogoSvg
            testID="main-logo-svg"
            width={288}
            height={70}
            style={{ marginBottom: SPACING.md }}
          />
          <Text
            className="font-bold text-white text-center"
            style={[styles.title, { marginBottom: SPACING.md, color: '#FFFFFF' }]}
          >
            {AppStrings.AuthStrings.Landing.TAGLINE_1}
          </Text>
          <Subtitle text={AppStrings.AuthStrings.Landing.TAGLINE_2} />
        </View>

        {/* Spacer — solar system visible here */}
        <View style={{ flex: 1, minHeight: 0 }} />

        {/* Buttons at the bottom */}
        <View style={{ width: '100%', alignItems: 'center', gap: SPACING.md, paddingBottom: SPACING.xl }}>
          <GoogleSignInButton onPress={handleGoogleSignIn} disabled={isLoading} />
          <FacebookSignInButton onPress={handleFacebookSignIn} disabled={isLoading} />
          {authError && <Error message={authError} />}
          <WideButton
            buttonText="Play as Guest"
            onPress={handlePlayButtonPress}
            disabled={isLoading}
          />
          <WideButton
            buttonText="Credits"
            onPress={() => setIsCreditsVisible(true)}
          />
        </View>
      </View>

      <PulsingSpinner visible={isLoading} size={LOADING_SPINNER_SIZE} />
      <CreditsModal
        isVisible={isCreditsVisible}
        onClose={() => setIsCreditsVisible(false)}
      />
    </CustomSafeAreaView>
  );
};

export default LandingScreen;

