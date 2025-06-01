import React, { useState } from "react";
import { StyleSheet } from "react-native";
import UserPasswordInput from "../../components/inputFields/UserPasswordInput";
import WideButton from "../../components/buttons/WideButton";
import { AppStrings } from "../../constants/AppStrings";
import PadlockIcon from "@images/padlock.svg";
import CustomSafeAreaView from "../../components/CustomSafeAreaView";
import AuthLayout from "../../components/layouts/AuthLayout";
import ScreenTitle from "../../components/text/ScreenTitle";
import Subtitle from "../../components/text/Subtitle";
import HomeBgSvg from "../../../assets/images/home-bg.svg";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  NewPassword: undefined;
  Landing: undefined;
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
    <CustomSafeAreaView className="flex-1 bg-cream-light p-6">
      <HomeBgSvg width="120%" height="100%" style={styles.backgroundImage} />
      <AuthLayout>
        <PadlockIcon className="w-24 h-24 mb-8 mx-auto" />
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

const styles = StyleSheet.create({
  backgroundImage: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: "-5%",
    zIndex: -1,
  },
});
