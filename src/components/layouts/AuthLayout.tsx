import React from "react";
import { View } from "react-native";
import { styles } from "../../styles";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <View className="flex-1 items-center w-full" style={styles.authContentContainer}>
      {children}
    </View>
  );
};

export default AuthLayout;

