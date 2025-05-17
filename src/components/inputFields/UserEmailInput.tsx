import { View, Text } from "react-native";
import { AppStrings } from "../../constants/AppStrings";
import ReusableTextInput from "../shared/ReusableTextInput";
import { useState } from "react";
import Error from "../text/Error";
import { validateEmail } from "../../utils/emailValidation";

export default function UserEmailInput({
  email,
  setEmail,
}: {
  email: string;
  setEmail: (email: string) => void;
}) {
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleEmailChange = (text: string) => {
    const trimmedText = text.trimEnd();
    setEmail(trimmedText);
    if (!validateEmail(trimmedText)) {
      setEmailError(AppStrings.AuthStrings.Login.INVALID_EMAIL_FORMAT_ERROR);
    } else {
      setEmailError(null);
    }
  };

  return (
    <View className="w-full">
      <Text
        className="text-sm text-gray-600 mb-2 text-left"
        style={{ fontFamily: "PoppinsSemiBold" }}
      >
        {AppStrings.AuthStrings.Login.EMAIL_LABEL}
      </Text>
      <View className="flex-row items-center border border-gray-300 rounded-lg mb-2">
        <ReusableTextInput
          value={email}
          onChangeText={handleEmailChange}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder={AppStrings.AuthStrings.Login.EMAIL_PLACEHOLDER}
        />
      </View>
      {emailError && <Error message={emailError} />}
    </View>
  );
}
