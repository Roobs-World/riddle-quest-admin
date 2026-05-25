import React from "react";
import {StyleProp, View, ViewStyle} from "react-native";
import {styles} from "../../styles";

interface AuthLayoutProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({children, style}) => {
  return (
    <View className="flex-1 items-center w-full" style={[styles.authContentContainer, style]}>
      {children}
    </View>
  );
};

export default AuthLayout;
