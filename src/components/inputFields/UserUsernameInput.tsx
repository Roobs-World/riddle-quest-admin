import { View, Text } from "react-native";
import { AppStrings } from "../../constants/AppStrings";
import ReusableTextInput from "../shared/ReusableTextInput";

export default function UserUsernameInput({
  username,
  setUsername,
}: {
  username: string;
  setUsername: (email: string) => void;
}) {
  return (
    <View className="w-full mb-2">
      <Text
        className="text-sm text-gray-600 mb-2 text-left"
        style={{ fontFamily: "PoppinsSemiBold" }}
      >
        {AppStrings.AuthStrings.SignUp.USERNAME_LABEL}
      </Text>
      <View className="flex-row items-center border border-gray-300 rounded-lg mb-2">
        <ReusableTextInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          placeholder={AppStrings.AuthStrings.SignUp.USERNAME_PLACEHOLDER}
        />
      </View>
    </View>
  );
}
