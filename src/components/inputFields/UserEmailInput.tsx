import { View, Text } from "react-native";
import { AppStrings } from "../../constants/AppStrings";
import ReusableTextInput from "../shared/ReusableTextInput";
import Error from "../text/Error";

export default function UserEmailInput({
  email,
  setEmail,
  errorMessage,
}: {
  email: string;
  setEmail: (email: string) => void;
  errorMessage?: string | null;
}) {
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
          onChangeText={(text) => setEmail(text.trimEnd())}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder={AppStrings.AuthStrings.Login.EMAIL_PLACEHOLDER}
        />
      </View>
      {errorMessage && <Error message={errorMessage} />}
    </View>
  );
}
