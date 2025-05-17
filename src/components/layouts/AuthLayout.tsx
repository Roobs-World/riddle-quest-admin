import React from "react";
import { View } from "react-native";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return <View className="flex-1 items-center w-full">{children}</View>;
};

export default AuthLayout;
