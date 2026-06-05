import React from "react";
import {t} from "../../i18n";
import {Text} from "react-native";
import {TYPOGRAPHY, SPACING} from "../../styles";

interface PasswordMatchProps {
  passwordsMatch: boolean;
  isPasswordLongEnough: boolean;
}

export default function PasswordMatch({passwordsMatch, isPasswordLongEnough}: PasswordMatchProps) {
  if (!isPasswordLongEnough) {
    return (
      <Text
        className="text-red-600 text-right"
        style={{fontSize: TYPOGRAPHY.fontSize.xs, marginLeft: SPACING.xs, marginBottom: SPACING.md}}
      >
        {t("AuthStrings.SignUp.PASSWORD_DOES_NOT_LONG_ENOUGH")}
      </Text>
    );
  }

  if (!passwordsMatch) {
    return (
      <Text
        className="text-red-600 text-right"
        style={{fontSize: TYPOGRAPHY.fontSize.xs, marginLeft: SPACING.xs, marginBottom: SPACING.md}}
      >
        {t("AuthStrings.SignUp.PASSWORD_DOES_NOT_MATCH")}
      </Text>
    );
  }

  return (
    <Text
      className="text-green-600 text-right"
      style={{fontSize: TYPOGRAPHY.fontSize.xs, marginLeft: SPACING.xs, marginBottom: SPACING.md}}
    >
      {t("AuthStrings.SignUp.PASSWORD_VALIDATION_GOOD")}
    </Text>
  );
}
