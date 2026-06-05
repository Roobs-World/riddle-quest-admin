import React from "react";
import {View, Text} from "react-native";
import {t} from "../../i18n";
import ReusableTextInput from "../shared/ReusableTextInput";
import Error from "../text/Error";
import {styles, SPACING} from "../../styles";

interface UserEmailInputProps {
  email: string;
  setEmail: (email: string) => void;
  errorMessage?: string | null;
}

const UserEmailInput: React.FC<UserEmailInputProps> = ({email, setEmail, errorMessage}) => {
  return (
    <View className="w-full">
      <Text className="text-gray-600 text-left" style={[styles.labelText, {marginBottom: SPACING.sm}]}>
        {t("AuthStrings.Login.EMAIL_LABEL")}
      </Text>
      <View className="flex-row items-center bg-input-background rounded-lg border border-gray-300">
        <ReusableTextInput
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder={t("AuthStrings.Login.EMAIL_PLACEHOLDER")}
        />
      </View>
      {errorMessage && <Error message={errorMessage} />}
    </View>
  );
};

export default UserEmailInput;
