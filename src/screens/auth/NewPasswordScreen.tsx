import React, {useState} from "react";
import {Text, View} from "react-native";
import AuthLayout from "../../components/layouts/AuthLayout";
import CustomSafeAreaView from "../../components/layouts/CustomSafeAreaView";
import StarryBackground from "../../components/background/StarryBackground";
import UserPasswordInput from "../../components/inputFields/UserPasswordInput";
import PasswordMatch from "../../components/text/PasswordMatch";
import WideButton from "../../components/buttons/WideButton";
import Error from "../../components/text/Error";
import {AppStrings} from "../../constants/AppStrings";
import {styles, SPACING} from "../../styles";

const NewPasswordScreen = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isPasswordLongEnough = password.length >= 6;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const shouldShowPasswordMatch = password.length > 0 || confirmPassword.length > 0;

  const handleSetPassword = () => {
    setSuccessMessage(null);

    if (!password || !confirmPassword) {
      setFormError(AppStrings.Profile.ALERT_PASSWORD_FIELDS_EMPTY);
      return;
    }

    if (!isPasswordLongEnough) {
      setFormError(AppStrings.Profile.ALERT_PASSWORD_TOO_SHORT);
      return;
    }

    if (!passwordsMatch) {
      setFormError(AppStrings.Profile.ALERT_PASSWORDS_DO_NOT_MATCH);
      return;
    }

    setFormError(null);
    setSuccessMessage(AppStrings.Profile.ALERT_PASSWORD_UPDATE_SUCCESS);
  };

  return (
    <CustomSafeAreaView>
      <StarryBackground />
      <AuthLayout style={{justifyContent: "center"}}>
        <Text style={[styles.title, {marginBottom: SPACING.md}]}>{AppStrings.AuthStrings.NewPassword.TITLE}</Text>
        <Text className="text-white text-center" style={[styles.subtitle, {marginBottom: SPACING.xl}]}>
          {AppStrings.AuthStrings.NewPassword.NEW_PASSWORD_DESCRIPTION}
        </Text>

        <View style={{width: "100%", gap: SPACING.md}}>
          <UserPasswordInput
            label={AppStrings.AuthStrings.NewPassword.NEW_PASSWORD_LABEL}
            password={password}
            placeholder={AppStrings.AuthStrings.NewPassword.NEW_PASSWORD_PLACEHOLDER}
            setPassword={setPassword}
          />
          <UserPasswordInput
            label={AppStrings.AuthStrings.NewPassword.CONFIRM_PASSWORD_LABEL}
            password={confirmPassword}
            placeholder={AppStrings.AuthStrings.NewPassword.CONFIRM_PASSWORD_PLACEHOLDER}
            setPassword={setConfirmPassword}
          />

          {shouldShowPasswordMatch && (
            <PasswordMatch isPasswordLongEnough={isPasswordLongEnough} passwordsMatch={passwordsMatch} />
          )}

          {formError && <Error message={formError} />}
          {successMessage && (
            <Text className="text-white text-center" style={styles.subtitle}>
              {successMessage}
            </Text>
          )}

          <WideButton buttonText={AppStrings.AuthStrings.NewPassword.SET_PASSWORD_BUTTON} onPress={handleSetPassword} />
        </View>
      </AuthLayout>
    </CustomSafeAreaView>
  );
};

export default NewPasswordScreen;
