import React, { useState } from "react";
import UserPasswordInput from "../../components/inputFields/UserPasswordInput";
import WideButton from "../../components/buttons/WideButton";
import { AppStrings } from "../../constants/AppStrings";
import PadlockIcon from "@images/padlock.svg";
import CustomSafeAreaView from "../../components/layouts/CustomSafeAreaView";
import AuthLayout from "../../components/layouts/AuthLayout";
import ScreenTitle from "../../components/text/ScreenTitle";
import Subtitle from "../../components/text/Subtitle";
import StarryBackground from "../../components/background/StarryBackground";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SPACING } from "../../styles";
import { AUTH_ICON_SIZE } from "../../constants/layout";

type AuthStackParamList = {
  Login: object | undefined;
  SignUp: object | undefined;
  ForgotPassword: object | undefined;
  NewPassword: object | undefined;
  Landing: object | undefined;
};

type NewPasswordScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  "NewPassword"
>;

/**
 * Screen for setting a new password.
 * Allows users to enter and confirm a new password after a password reset.
 *
 * @param {object} navigation - The navigation prop from React Navigation.
 */
export default function NewPasswordScreen({
  navigation,
}: {
  navigation: NewPasswordScreenNavigationProp;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  /**
   * Handles the action of setting the new password.
   * Navigates the user back to the Landing screen upon successful password reset.
   */
  const handleSetNewPassword = () => {
    navigation.navigate(AppStrings.Navigation.LANDING);
  };

  return (
    <CustomSafeAreaView className="flex-1 bg-cream-light" style={{ padding: SPACING.lg }}>
      <StarryBackground />
      <AuthLayout>
        <PadlockIcon width={AUTH_ICON_SIZE} height={AUTH_ICON_SIZE} style={{ marginBottom: SPACING.xl, alignSelf: "center" }} />
        <ScreenTitle title={AppStrings.AuthStrings.NewPassword.TITLE} />

        <Subtitle
          text={AppStrings.AuthStrings.NewPassword.NEW_PASSWORD_DESCRIPTION}
        />

        <UserPasswordInput
          password={newPassword}
          setPassword={setNewPassword}
          label={AppStrings.AuthStrings.NewPassword.NEW_PASSWORD_LABEL}
          placeholder={
            AppStrings.AuthStrings.NewPassword.NEW_PASSWORD_PLACEHOLDER
          }
        />

        <UserPasswordInput
          password={confirmPassword}
          setPassword={setConfirmPassword}
          label={AppStrings.AuthStrings.NewPassword.CONFIRM_PASSWORD_LABEL}
          placeholder={
            AppStrings.AuthStrings.NewPassword.CONFIRM_PASSWORD_PLACEHOLDER
          }
        />
      </AuthLayout>

      <WideButton
        buttonText={AppStrings.AuthStrings.NewPassword.SET_PASSWORD_BUTTON}
        onPress={handleSetNewPassword}
      />
    </CustomSafeAreaView>
  );
}
