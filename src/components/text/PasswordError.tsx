import { AppStrings } from "../../constants/AppStrings";
import { Text } from "react-native";

export default function PasswordError() {
  return (
    <Text className="text-xs text-red-600 ml-1 mb-4 text-right">
      {AppStrings.AuthStrings.SignUp.PASSWORD_VALIDATION_BAD}
    </Text>
  );
}
