import React, {useState} from "react";
import {Text, TouchableOpacity, View} from "react-native";
import AuthLayout from "../../components/layouts/AuthLayout";
import CustomSafeAreaView from "../../components/layouts/CustomSafeAreaView";
import StarryBackground from "../../components/background/StarryBackground";
import ReusableTextInput from "../../components/shared/ReusableTextInput";
import UserPasswordInput from "../../components/inputFields/UserPasswordInput";
import WideButton from "../../components/buttons/WideButton";
import PulsingSpinner from "../../components/loading/PulsingSpinner";
import Error from "../../components/text/Error";
import {t} from "../../i18n";
import {LOADING_SPINNER_SIZE} from "../../constants/loading";
import {AUTH_CONTENT_MAX_WIDTH} from "../../constants/layout";
import {styles, SPACING} from "../../styles";
import {isDesktop, isLargeTablet} from "../../utils/responsive";
import {validateEmail} from "../../utils/emailValidation";
import {AuthService} from "../../services/AuthService";
import {useAuth} from "../../contexts/AuthContext";
import {getLoginErrorMessage} from "../../application/auth/authErrorMessages";
import {logger} from "../../utils/logger";
import {captureException} from "../../utils/sentry";

type AuthNavigation = {
  navigate: (screenName: string) => void;
};

type LoginScreenProps = {
  navigation?: AuthNavigation;
};

const LoginScreen = ({navigation}: LoginScreenProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const {login} = useAuth();
  const isWideAuthLayout = isLargeTablet || isDesktop;

  const handleLogin = async () => {
    const nextEmailError = validateEmail(email.trim());
    setEmailError(nextEmailError || null);

    if (nextEmailError) {
      return;
    }

    if (!password) {
      setAuthError(t("AuthStrings.Login.PASSWORD_CANNOT_BE_EMPTY"));
      return;
    }

    setIsLoading(true);
    setAuthError(null);

    try {
      const userCredential = await AuthService.loginWithEmail(email.trim(), password);
      if (userCredential.user?.uid) {
        login();
      }
    } catch (error) {
      logger.error("Email login failed:", error);
      captureException(error);
      setAuthError(getLoginErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CustomSafeAreaView>
      <StarryBackground />
      <AuthLayout
        style={
          isWideAuthLayout ? {maxWidth: AUTH_CONTENT_MAX_WIDTH, justifyContent: "center"} : {justifyContent: "center"}
        }
      >
        <Text style={[styles.title, {marginBottom: SPACING.xl}]}>{t("AuthStrings.Login.TITLE")}</Text>
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
            {emailError && <Error message={emailError} />}
          </View>

          <UserPasswordInput password={password} setPassword={setPassword} />

          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => navigation?.navigate(t("Navigation.FORGOT_PASSWORD"))}
          >
            <Text className="text-white text-right" style={styles.forgotPasswordText}>
              {t("AuthStrings.Login.FORGOT_PASSWORD")}
            </Text>
          </TouchableOpacity>

          {authError && <Error message={authError} />}

          <WideButton
            buttonText={t("AuthStrings.Login.LOGIN_BUTTON")}
            disabled={isLoading}
            onPress={handleLogin}
          />

          <View className="flex-row justify-center">
            <Text className="text-white" style={styles.subtitle}>
              {t("AuthStrings.Login.NO_ACCOUNT_PROMPT")}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => navigation?.navigate(t("Navigation.SIGN_UP"))}
            >
              <Text className="text-white" style={styles.subtitle}>
                {t("AuthStrings.Login.REGISTER_NOW")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </AuthLayout>
      <PulsingSpinner visible={isLoading} size={LOADING_SPINNER_SIZE} />
    </CustomSafeAreaView>
  );
};

export default LoginScreen;
