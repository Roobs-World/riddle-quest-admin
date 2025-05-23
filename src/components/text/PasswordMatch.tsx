import { AppStrings } from "../../constants/AppStrings";
import { Text } from "react-native";

interface PasswordMatchProps {
  passwordsMatch: boolean;
  isPasswordLongEnough: boolean;
}

export default function PasswordMatch({
  passwordsMatch,
  isPasswordLongEnough,
}: PasswordMatchProps) {
  if (!isPasswordLongEnough) {
    return (
      <Text className="text-xs text-red-600 ml-1 mb-4 text-right">
        {AppStrings.AuthStrings.SignUp.PASSWORD_DOES_NOT_LONG_ENOUGH}
      </Text>
    );
  }

  if (!passwordsMatch) {
    return (
      <Text className="text-xs text-red-600 ml-1 mb-4 text-right">
        {AppStrings.AuthStrings.SignUp.PASSWORD_DOES_NOT_MATCH}
      </Text>
    );
  }

  return (
    <Text className="text-xs text-green-600 ml-1 mb-4 text-right">
      {AppStrings.AuthStrings.SignUp.PASSWORD_VALIDATION_GOOD}
    </Text>
  );
}
