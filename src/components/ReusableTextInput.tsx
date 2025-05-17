import React from "react";
import { TextInput, TextInputProps } from "react-native";

interface ReusableTextInputProps extends TextInputProps {
  // Add any custom props here if needed
}

const ReusableTextInput: React.FC<ReusableTextInputProps> = ({ ...props }) => {
  return (
    <TextInput
      className="flex-1 bg-[#F8F5EE] text-gray-700 p-3 text-base font-poppins-regular h-12"
      {...props}
    />
  );
};

export default ReusableTextInput;
