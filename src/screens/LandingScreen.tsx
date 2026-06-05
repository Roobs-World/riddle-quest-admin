/**
 * @fileoverview
 * Landing screen for the Riddle Quest authentication flow.
 *
 * This screen is the primary entry point for unauthenticated users. It
 * provides Google and Facebook sign-in options plus a "Play as Guest" shortcut
 * into gameplay.
 */
import React, {useState} from "react";
import {View, Text, Linking, Image, TouchableOpacity} from "react-native";
import CustomSafeAreaView from "../components/layouts/CustomSafeAreaView";
import GoogleSignInButton from "../components/buttons/GoogleSignInButton";
import FacebookSignInButton from "../components/buttons/FacebookSignInButton";
import WideButton from "../components/buttons/WideButton";
import StarryBackground from "../components/background/StarryBackground";
import PulsingSpinner from "../components/loading/PulsingSpinner";
import {t} from "../i18n";
import {LOADING_SPINNER_SIZE} from "../constants/loading";
import {AuthService} from "../services/AuthService";
import {useAuth} from "../contexts/AuthContext";
import Error from "../components/text/Error";
import {styles, SPACING} from "../styles";
import {logger} from "../utils/logger";
import {captureException} from "../utils/sentry";
import MainLogoPng from "../../assets/images/logo.png";
import {LANDING_LOGO_HEIGHT, LANDING_LOGO_WIDTH} from "../constants/layout";
import {
  getFacebookSignInErrorMessage,
  getGoogleSignInErrorMessage,
  isFacebookLoginCancellation,
  isGoogleSignInCancellation,
} from "../application/auth/authErrorMessages";

/**
 * Landing screen component used at the root of the auth stack.
 *
 * It wires social sign-in handlers and exposes a guest play CTA for anonymous
 * sign-in.
 */
const LandingScreen = () => {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const {login, isAuthenticated} = useAuth();

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
      if (isGoogleSignInCancellation(error)) {
        logger.debug("Auth popup closed by user.");
        return;
      }

      logger.error("Google login error:", error);
      captureException(error);
      setAuthError(getGoogleSignInErrorMessage(error));
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
      if (userCredential?.user?.uid) {
        login();
      }
    } catch (error: unknown) {
      if (isFacebookLoginCancellation(error)) {
        return;
      }

      logger.error("Facebook login error:", error);
      captureException(error);
      setAuthError(getFacebookSignInErrorMessage(error));
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
          <Image
            testID="main-logo-svg"
            source={MainLogoPng}
            style={{width: LANDING_LOGO_WIDTH, height: LANDING_LOGO_HEIGHT}}
            resizeMode="contain"
          />
          <Text
            className="font-bold text-white text-center"
            style={[styles.title, {marginBottom: SPACING.md, color: "#FFFFFF"}]}
          >
            {t("AuthStrings.Landing.TAGLINE_1")}
          </Text>
        </View>

        {/* Spacer — solar system visible here */}
        <View style={{flex: 1, minHeight: 0}} />

        {/* Buttons at the bottom */}
        <View style={[styles.authContentContainer, {alignItems: "center", gap: SPACING.md, paddingBottom: SPACING.xl}]}>
          <GoogleSignInButton onPress={handleGoogleSignIn} disabled={isLoading} />
          <FacebookSignInButton onPress={handleFacebookSignIn} disabled={isLoading} />
          {authError && <Error message={authError} />}
          <WideButton
            buttonText={t("AuthStrings.Landing.PLAY_AS_GUEST")}
            onPress={handlePlayButtonPress}
            disabled={isLoading}
          />
          <TouchableOpacity
            accessibilityLabel={t("Accessibility.LANDING_ATTRIBUTION_LINK")}
            accessibilityRole="link"
            onPress={handleRoobsWorldPress}
            testID="roobs-world-link"
          >
            <Text className="text-white text-center" style={[styles.creditsLink, {opacity: 0.85}]}>
              {t("AuthStrings.Landing.MADE_BY_ROOBS_WORLD")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <PulsingSpinner visible={isLoading} size={LOADING_SPINNER_SIZE} />
    </CustomSafeAreaView>
  );
};

export default LandingScreen;
