/**
 * @fileoverview
 * Landing screen for the Riddle Quest authentication flow.
 *
 * This screen is the primary entry point for unauthenticated users. It
 * provides Google and Facebook sign-in options plus a "Play as Guest" shortcut
 * into gameplay.
 */
import React, {useState} from "react";
import {View, Text, Linking, TouchableOpacity} from "react-native";
import AuthScreenShell from "../components/layouts/AuthScreenShell";
import GoogleSignInButton from "../components/buttons/GoogleSignInButton";
import FacebookSignInButton from "../components/buttons/FacebookSignInButton";
import WideButton from "../components/buttons/WideButton";
import PulsingSpinner from "../components/loading/PulsingSpinner";
import {t} from "../i18n";
import {LOADING_SPINNER_SIZE} from "../constants/loading";
import {AuthService} from "../services/AuthService";
import {useAuthSession} from "../contexts/AuthContext";
import Error from "../components/text/Error";
import {styles, SPACING} from "../styles";
import {logger} from "../utils/logger";
import {captureException} from "../utils/sentry";
import {getAuthErrorMessage} from "../application/auth/authErrorMessages";
import {RiddleQuestLogo} from "../components/branding/RiddleQuestLogo";

interface LandingScreenProps {
  isTransitioningToGame?: boolean;
}

/**
 * Landing screen component used at the root of the auth stack.
 *
 * It wires social sign-in handlers and exposes a guest play CTA for anonymous
 * sign-in.
 */
const LandingScreen = ({isTransitioningToGame = false}: LandingScreenProps) => {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const {login, isAuthenticated} = useAuthSession();
  const isBusy = isLoading || isTransitioningToGame;

  const handleSocialSignIn = async (
    signInFn: () => Promise<{user?: {uid?: string}} | null>,
    provider: "google" | "facebook",
  ) => {
    setIsLoading(true);
    setAuthError(null);
    let shouldKeepLoadingUntilGameReady = false;

    try {
      const userCredential = await signInFn();
      logger.debug(`${provider} login success:`, userCredential);
      if (userCredential?.user?.uid) {
        shouldKeepLoadingUntilGameReady = true;
        login();
      }
    } catch (error: unknown) {
      const message = getAuthErrorMessage(error, provider);
      if (!message) {
        return;
      }

      logger.error(`${provider} login error:`, error);
      setAuthError(message);
    } finally {
      if (!shouldKeepLoadingUntilGameReady) {
        setIsLoading(false);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    await handleSocialSignIn(AuthService.signInWithGoogle, "google");
  };

  const handleFacebookSignIn = async () => {
    await handleSocialSignIn(AuthService.signInWithFacebook, "facebook");
  };

  const handlePlayButtonPress = async () => {
    setIsLoading(true);
    setAuthError(null);
    let shouldKeepLoadingUntilGameReady = false;

    try {
      if (isAuthenticated) {
        await AuthService.logout();
      }
      await AuthService.signInAnonymously();
      shouldKeepLoadingUntilGameReady = true;
      // Navigation keeps this screen visible until the first game riddle is ready.
    } catch (error) {
      logger.error("Error signing in anonymously for guest play:", error);
      captureException(error);
    } finally {
      if (!shouldKeepLoadingUntilGameReady) {
        setIsLoading(false);
      }
    }
  };

  const handleRoobsWorldPress = () => {
    void Linking.openURL("https://www.roobsworld.com");
  };

  return (
    <AuthScreenShell>
      <View style={{alignItems: "center", paddingTop: SPACING.xl}}>
        <RiddleQuestLogo />
        <Text
          className="font-bold text-white text-center"
          style={[styles.title, {marginBottom: SPACING.md, color: "#FFFFFF"}]}
        >
          {t("AuthStrings.Landing.TAGLINE_1")}
        </Text>
      </View>

      <View style={{flex: 1, minHeight: 0}} />

      <View
        style={{
          alignItems: "center",
          gap: SPACING.md,
          paddingBottom: SPACING.xl,
          width: "100%",
        }}
      >
        <GoogleSignInButton onPress={handleGoogleSignIn} disabled={isBusy} />
        <FacebookSignInButton onPress={handleFacebookSignIn} disabled={isBusy} />
        {authError && <Error message={authError} />}
        <WideButton
          buttonText={t("AuthStrings.Landing.PLAY_AS_GUEST")}
          onPress={handlePlayButtonPress}
          disabled={isBusy}
          testID="play-as-guest-button"
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

      <PulsingSpinner visible={isBusy} size={LOADING_SPINNER_SIZE} />
    </AuthScreenShell>
  );
};

export default LandingScreen;
