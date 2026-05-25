import React from "react";
import {View, Text} from "react-native";
import {SIZING, SPACING} from "../../styles";

const CheckboxIcon = ({checked}: {checked: boolean}) => (
  <View
    className={`border-2 ${
      checked ? "bg-blue-500 border-blue-500" : "border-gray-400"
    } rounded justify-center items-center`}
    style={{width: SIZING.icon.lg, height: SIZING.icon.lg, marginRight: SPACING.md}}
  >
    {checked && <Text className="text-white text-md">✓</Text>}
  </View>
);

export default CheckboxIcon;
