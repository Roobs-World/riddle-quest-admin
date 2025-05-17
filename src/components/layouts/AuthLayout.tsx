import React from "react";
import { View } from "react-native";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <View className="flex-1 justify-center items-stretch w-full py-8">
      {children}
    </View>
  );
};

export default AuthLayout;
