import React from "react";
import GoogleIcon from "../icons/GoogleIcon";
import {SIZING} from "../../styles";
import SocialSignInButtonShell from "./SocialSignInButtonShell";

interface GoogleSignInButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({onPress, disabled = false}) => {
  return (
    <SocialSignInButtonShell
      icon={<GoogleIcon width={SIZING.icon.md} height={SIZING.icon.md} />}
      labelKey="AuthStrings.Login.CONTINUE_WITH_GOOGLE"
      onPress={onPress}
      disabled={disabled}
    />
  );
};

export default GoogleSignInButton;
