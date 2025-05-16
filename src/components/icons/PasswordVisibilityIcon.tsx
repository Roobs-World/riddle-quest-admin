import React from "react";
import { Text } from "react-native";

const PasswordVisibilityIcon = ({ visible }: { visible: boolean }) => (
  <Text className="text-gray-500 text-lg">{visible ? "Show" : "Hide"}</Text>
);

export default PasswordVisibilityIcon;
