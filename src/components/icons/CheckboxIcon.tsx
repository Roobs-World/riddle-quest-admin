import React from "react";
import { View, Text } from "react-native";

const CheckboxIcon = ({ checked }: { checked: boolean }) => (
  <View
    className={`w-5 h-5 border-2 ${
      checked ? "bg-blue-500 border-blue-500" : "border-gray-400"
    } rounded mr-4 justify-center items-center`}
  >
    {checked && <Text className="text-red-500 text-xs">✓</Text>}
  </View>
);

export default CheckboxIcon;
