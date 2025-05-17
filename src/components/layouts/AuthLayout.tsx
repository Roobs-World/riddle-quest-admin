import React from "react";
import { View } from "react-native";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return <View className="flex-1 items-stretch w-full mt-8">{children}</View>;
};

export default AuthLayout;
