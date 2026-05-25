import React, {useMemo, useState} from "react";
import {Linking, Text, TouchableOpacity, View} from "react-native";
import type {FirebaseAuthTypes} from "@react-native-firebase/auth";
import AuthLayout from "../../components/layouts/AuthLayout";
import CustomSafeAreaView from "../../components/layouts/CustomSafeAreaView";
import StarryBackground from "../../components/background/StarryBackground";
import ReusableTextInput from "../../components/shared/ReusableTextInput";
import UserPasswordInput from "../../components/inputFields/UserPasswordInput";
import PasswordMatch from "../../components/text/PasswordMatch";
import WideButton from "../../components/buttons/WideButton";
import PulsingSpinner from "../../components/loading/PulsingSpinner";
import Error from "../../components/text/Error";
import {AppStrings} from "../../constants/AppStrings";
import {LOADING_SPINNER_SIZE} from "../../constants/loading";
import {styles, SPACING} from "../../styles";
import {AuthService} from "../../services/AuthService";
import {useAuth} from "../../contexts/AuthContext";
import {signUpSchema} from "../../validation/authSchemas";
import {logger} from "../../utils/logger";
import {captureException} from "../../utils/sentry";

type AuthNavigation = {
  navigate: (screenName: string) => void;
};

type SignUpScreenProps = {
  navigation?: AuthNavigation;
};

const getSignUpErrorMessage = (error: unknown): string => {
  const firebaseError = error as FirebaseAuthTypes.NativeFirebaseAuthError;

  switch (firebaseError.code) {
    case "auth/email-already-in-use":
      return AppStrings.AuthStrings.SignUp.EMAIL_ALREADY_IN_USE_ERROR;
    case "auth/invalid-email":
      return AppStrings.AuthStrings.SignUp.INVALID_EMAIL_ERROR;
    case "auth/operation-not-allowed":
      return AppStrings.AuthStrings.SignUp.OPERATION_NOT_ALLOWED_ERROR;
    case "auth/weak-password":
      return AppStrings.AuthStrings.SignUp.WEAK_PASSWORD_ERROR;
    default:
      return firebaseError.message || AppStrings.AuthStrings.SignUp.SIGNUP_UNEXPECTED_ERROR;
  }
};

const SignUpScreen = ({navigation}: SignUpScreenProps) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const {login} = useAuth();

  const isPasswordLongEnough = password.length >= 6;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const shouldShowPasswordMatch = password.length > 0 || confirmPassword.length > 0;

  const signUpData = useMemo(
    () => ({username, email, password, confirmPassword}),
    [confirmPassword, email, password, username],
  );

  const openLegalPage = (pageName: string) => {
    const slug = pageName.toLowerCase().replace(/\s+/g, "-");
    void Linking.openURL(`https://www.roobsworld.com/${slug}`);
  };

  const handleSignUp = async () => {
    setFormError(null);

    if (!hasAcceptedTerms) {
      setFormError(AppStrings.AuthStrings.SignUp.MUST_AGREE_TO_TERMS);
      return;
    }

    const result = signUpSchema.safeParse(signUpData);
    if (!result.success) {
      setFormError(result.error.issues[0]?.message ?? AppStrings.AuthStrings.SignUp.SIGNUP_UNEXPECTED_ERROR);
      return;
    }

    setIsLoading(true);

    try {
      const userCredential = await AuthService.signUpWithEmail(email.trim(), password);
      if (userCredential.user?.uid) {
        login();
      }
    } catch (error) {
      logger.error("Email sign up failed:", error);
      captureException(error);
      setFormError(getSignUpErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CustomSafeAreaView>
      <StarryBackground />
      <AuthLayout style={{justifyContent: "center"}}>
        <Text style={[styles.title, {marginBottom: SPACING.xl}]}>{AppStrings.AuthStrings.SignUp.TITLE}</Text>

        <View style={{width: "100%", gap: SPACING.md}}>
          <View>
            <Text className="text-gray-600 text-left" style={[styles.labelText, {marginBottom: SPACING.sm}]}>
              {AppStrings.AuthStrings.SignUp.USERNAME_LABEL}
            </Text>
            <ReusableTextInput
              autoCapitalize="none"
              onChangeText={setUsername}
              placeholder={AppStrings.AuthStrings.SignUp.USERNAME_PLACEHOLDER}
              value={username}
            />
          </View>

          <View>
            <Text className="text-gray-600 text-left" style={[styles.labelText, {marginBottom: SPACING.sm}]}>
              {AppStrings.AuthStrings.SignUp.EMAIL_LABEL}
            </Text>
            <ReusableTextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder={AppStrings.AuthStrings.SignUp.EMAIL_PLACEHOLDER}
              value={email}
            />
          </View>

          <UserPasswordInput
            label={AppStrings.AuthStrings.SignUp.PASSWORD_LABEL}
            password={password}
            placeholder={AppStrings.AuthStrings.SignUp.PASSWORD_PLACEHOLDER}
            setPassword={setPassword}
          />

          <UserPasswordInput
            label={AppStrings.AuthStrings.SignUp.CONFIRM_PASSWORD_LABEL}
            password={confirmPassword}
            placeholder={AppStrings.AuthStrings.SignUp.CONFIRM_PASSWORD_PLACEHOLDER}
            setPassword={setConfirmPassword}
          />

          {shouldShowPasswordMatch && (
            <PasswordMatch isPasswordLongEnough={isPasswordLongEnough} passwordsMatch={passwordsMatch} />
          )}

          <TouchableOpacity accessibilityRole="checkbox" onPress={() => setHasAcceptedTerms((current) => !current)}>
            <Text className="text-white" style={styles.subtitle}>
              {hasAcceptedTerms ? "[x] " : "[ ] "}
              {AppStrings.AuthStrings.SignUp.TERMS_AGREEMENT_PART1}
              <Text onPress={() => openLegalPage(AppStrings.AuthStrings.SignUp.TERMS_PAGE_NAME)}>
                {AppStrings.AuthStrings.SignUp.TERMS_USER_AGREEMENT}
              </Text>
              {AppStrings.AuthStrings.SignUp.TERMS_AGREEMENT_PART2}
              <Text onPress={() => openLegalPage(AppStrings.AuthStrings.SignUp.PRIVACY_POLICY_PAGE_NAME)}>
                {AppStrings.AuthStrings.SignUp.TERMS_PRIVACY_POLICY}
              </Text>
            </Text>
          </TouchableOpacity>

          {formError && <Error message={formError} />}

          <WideButton
            buttonText={AppStrings.AuthStrings.SignUp.NEXT_BUTTON}
            disabled={isLoading}
            onPress={handleSignUp}
          />

          <View className="flex-row justify-center">
            <Text className="text-white" style={styles.subtitle}>
              {AppStrings.AuthStrings.SignUp.HAS_ACCOUNT_PROMPT}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => navigation?.navigate(AppStrings.Navigation.LOGIN)}
            >
              <Text className="text-white" style={styles.subtitle}>
                {AppStrings.AuthStrings.SignUp.LOGIN_NOW}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </AuthLayout>
      <PulsingSpinner visible={isLoading} size={LOADING_SPINNER_SIZE} />
    </CustomSafeAreaView>
  );
};

export default SignUpScreen;
