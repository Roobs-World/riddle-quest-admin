import React from "react";
import { TextInput, TextInputProps } from "react-native";

interface ReusableTextInputProps extends TextInputProps {
  // Add any custom props here if needed
}

const ReusableTextInput: React.FC<ReusableTextInputProps> = ({ ...props }) => {
  return (
    <TextInput
      className="flex-1 bg-input-background text-gray-700 p-3 text-base h-12"
      style={{ fontFamily: "Poppins" }}
      {...props}
    />
  );
};

export default ReusableTextInput;
