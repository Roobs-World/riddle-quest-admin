import React, {useState} from "react";
import {Text, TouchableOpacity, View} from "react-native";
import AuthLayout from "../../components/layouts/AuthLayout";
import CustomSafeAreaView from "../../components/layouts/CustomSafeAreaView";
import StarryBackground from "../../components/background/StarryBackground";
import ReusableTextInput from "../../components/shared/ReusableTextInput";
import WideButton from "../../components/buttons/WideButton";
import PulsingSpinner from "../../components/loading/PulsingSpinner";
import Error from "../../components/text/Error";
import {t} from "../../i18n";
import {LOADING_SPINNER_SIZE} from "../../constants/loading";
import {styles, SPACING} from "../../styles";
import {validateEmail} from "../../utils/emailValidation";
import {AuthService} from "../../services/AuthService";
import {getForgotPasswordErrorMessage} from "../../application/auth/authErrorMessages";
import {logger} from "../../utils/logger";
import {captureException} from "../../utils/sentry";

type AuthNavigation = {
  navigate: (screenName: string) => void;
};

type ForgotPasswordScreenProps = {
  navigation?: AuthNavigation;
};

const ForgotPasswordScreen = ({navigation}: ForgotPasswordScreenProps) => {
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleResetPassword = async () => {
    const emailValidationError = validateEmail(email.trim());
    if (emailValidationError) {
      setFeedback(null);
      setErrorMessage(emailValidationError);
      return;
    }

    setIsLoading(true);
    setFeedback(null);
    setErrorMessage(null);

    try {
      await AuthService.sendPasswordResetEmail(email.trim());
      setFeedback(t("AuthStrings.ForgotPassword.SUCCESS_MESSAGE"));
    } catch (error) {
      logger.error("Password reset failed:", error);
      captureException(error);
      setErrorMessage(getForgotPasswordErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CustomSafeAreaView>
      <StarryBackground />
      <AuthLayout style={{justifyContent: "center"}}>
        <Text style={[styles.title, {marginBottom: SPACING.xl}]}>{t("AuthStrings.ForgotPassword.TITLE")}</Text>

        <View style={{width: "100%", gap: SPACING.md}}>
          <View>
            <Text className="text-gray-600 text-left" style={[styles.labelText, {marginBottom: SPACING.sm}]}>
              {t("AuthStrings.Login.EMAIL_LABEL")}
            </Text>
            <ReusableTextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder={t("AuthStrings.Login.EMAIL_PLACEHOLDER")}
              value={email}
            />
          </View>

          {feedback && (
            <Text className="text-white text-center" style={styles.subtitle}>
              {feedback}
            </Text>
          )}
          {errorMessage && <Error message={errorMessage} />}

          <WideButton
            buttonText={t("AuthStrings.ForgotPassword.BUTTON_TEXT")}
            disabled={isLoading}
            onPress={handleResetPassword}
          />

          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => navigation?.navigate(t("Navigation.LOGIN"))}
          >
            <Text className="text-white text-center" style={styles.subtitle}>
              {t("AuthStrings.ForgotPassword.BACK_TO_LOGIN")}
            </Text>
          </TouchableOpacity>
        </View>
      </AuthLayout>
      <PulsingSpinner visible={isLoading} size={LOADING_SPINNER_SIZE} />
    </CustomSafeAreaView>
  );
};

export default ForgotPasswordScreen;
