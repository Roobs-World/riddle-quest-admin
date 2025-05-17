import { Text } from "react-native";
import { useState } from "react";
import UserPasswordInput from "../../components/inputFields/UserPasswordInput";
import WideButton from "../../components/buttons/WideButton";
import { AppStrings } from "../../constants/AppStrings";
import PadlockIcon from "@images/padlock.svg";
import CustomSafeAreaView from "../../components/CustomSafeAreaView";
import BackButton from "../../components/buttons/BackButton";
import AuthLayout from "../../components/layouts/AuthLayout";
import ScreenTitle from "../../components/text/ScreenTitle";
import Subtitle from "../../components/text/Subtitle";

export default function NewPasswordScreen({ navigation }: { navigation: any }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSetNewPassword = () => {
    navigation.navigate(AppStrings.Navigation.LANDING);
  };

  return (
    <CustomSafeAreaView>
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
