/**
 * @fileoverview
 * Landing screen for the Riddle Quest authentication flow.
 *
 * This screen is the primary entry point for unauthenticated users. It
 * provides email/password, Google, and Facebook sign-in options, a path
 * to registration, and a "Play as Guest" shortcut into gameplay.
 */
import React, {useState} from "react";
import {View, Text, Linking, Image} from "react-native";
import CustomSafeAreaView from "../components/layouts/CustomSafeAreaView";
import GoogleSignInButton from "../components/buttons/GoogleSignInButton";
import FacebookSignInButton from "../components/buttons/FacebookSignInButton";
import WideButton from "../components/buttons/WideButton";
import StarryBackground from "../components/background/StarryBackground";
import PulsingSpinner from "../components/loading/PulsingSpinner";
import {AppStrings} from "../constants/AppStrings";
import {LOADING_SPINNER_SIZE} from "../constants/loading";
import Subtitle from "../components/text/Subtitle";
import {AuthService} from "../services/AuthService";
import {useAuth} from "../contexts/AuthContext";
import Error from "../components/text/Error";
import {type FirebaseAuthTypes} from "@react-native-firebase/auth";
import {styles, SPACING} from "../styles";
import {logger} from "../utils/logger";
import {captureException} from "../utils/sentry";
import CreditsModal from "../components/modals/help/CreditsModal";
import MainLogoPng from "../../assets/images/logo.png";
import {verticalScale} from "@/utils/responsive";

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
  const {login, isAuthenticated} = useAuth();
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
          setAuthError(AppStrings.AuthStrings.Login.ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL);
          break;
        case "auth/auth-popup-closed-by-user":
          logger.debug("Auth popup closed by user.");
          break;
        default:
          setAuthError(firebaseError.message || AppStrings.AuthStrings.Login.GOOGLE_UNEXPECTED_ERROR);
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
        if (errorMessage === "User cancelled the login process" || errorMessage === "Facebook login cancelled.") {
          logger.debug("Facebook login cancelled by user.");
          // Don't show error for cancellation - it's expected behavior
          return;
        }

        // Handle specific Facebook SDK errors
        if (errorMessage.includes("access token")) {
          logger.error("Facebook access token error detected");
          setAuthError(AppStrings.AuthStrings.Login.FACEBOOK_CONFIG_ERROR);
          return;
        }

        if (errorMessage.includes("Facebook permission request timed out")) {
          logger.error("Facebook login timeout detected");
          setAuthError(AppStrings.AuthStrings.Login.FACEBOOK_TIMEOUT_ERROR);
          return;
        }

        if (errorMessage.includes("Facebook SDK not properly initialized")) {
          logger.error("Facebook SDK initialization error detected");
          setAuthError(AppStrings.AuthStrings.Login.FACEBOOK_SDK_ERROR);
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
        const firebaseError = error as FirebaseAuthTypes.NativeFirebaseAuthError;
        switch (firebaseError.code) {
          case "auth/account-exists-with-different-credential":
            setAuthError(AppStrings.AuthStrings.Login.ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL);
            break;
          case "auth/auth-popup-closed-by-user":
            logger.debug("Auth popup closed by user.");
            break;
          case "auth/operation-not-supported-in-this-environment":
            setAuthError(AppStrings.AuthStrings.Login.OPERATION_NOT_SUPPORTED_ERROR);
            break;
          case "auth/network-request-failed":
            setAuthError(AppStrings.AuthStrings.Login.FACEBOOK_NETWORK_ERROR);
            break;
          case "auth/invalid-credential":
            setAuthError(AppStrings.AuthStrings.Login.FACEBOOK_INVALID_CREDENTIAL_ERROR);
            break;
          default:
            setAuthError(firebaseError.message || AppStrings.AuthStrings.Login.FACEBOOK_UNEXPECTED_ERROR);
        }
      } else {
        // Handle other types of errors with better fallback
        const errorMessage =
          error instanceof Error ? (error as Error).message : AppStrings.AuthStrings.Login.FACEBOOK_UNEXPECTED_ERROR;

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

  const handleRoobsWorldPress = () => {
    void Linking.openURL("https://www.roobsworld.com");
  };

  return (
    <CustomSafeAreaView className="justify-start">
      <StarryBackground />

      <View style={{flex: 1, width: "100%", alignItems: "center", zIndex: 2}}>
        {/* Title at the top */}
        <View style={{alignItems: "center", paddingTop: SPACING.xl}}>
          <Image testID="main-logo-svg" source={MainLogoPng} style={{width: 320, height: 150}} resizeMode="contain" />
          <Text
            className="font-bold text-white text-center"
            style={[styles.title, {marginBottom: SPACING.md, color: "#FFFFFF"}]}
          >
            {AppStrings.AuthStrings.Landing.TAGLINE_1}
          </Text>
          <Subtitle text={AppStrings.AuthStrings.Landing.TAGLINE_2} />
        </View>

        {/* Spacer — solar system visible here */}
        <View style={{flex: 1, minHeight: 0}} />

        {/* Buttons at the bottom */}
        <View style={{width: "100%", alignItems: "center", gap: SPACING.md, paddingBottom: SPACING.xl}}>
          <GoogleSignInButton onPress={handleGoogleSignIn} disabled={isLoading} />
          <FacebookSignInButton onPress={handleFacebookSignIn} disabled={isLoading} />
          {authError && <Error message={authError} />}
          <WideButton
            buttonText={AppStrings.AuthStrings.Landing.PLAY_AS_GUEST}
            onPress={handlePlayButtonPress}
            disabled={isLoading}
          />
          <WideButton
            buttonText={AppStrings.AuthStrings.Landing.CREDITS_BUTTON}
            onPress={() => setIsCreditsVisible(true)}
          />
          <WideButton buttonText="Made by Roobs World" onPress={handleRoobsWorldPress} />
        </View>
      </View>

      <PulsingSpinner visible={isLoading} size={LOADING_SPINNER_SIZE} />
      <CreditsModal isVisible={isCreditsVisible} onClose={() => setIsCreditsVisible(false)} />
    </CustomSafeAreaView>
  );
};

export default LandingScreen;
