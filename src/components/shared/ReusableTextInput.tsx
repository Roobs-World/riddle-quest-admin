import React from "react";
import { TextInput, TextInputProps } from "react-native";

const ReusableTextInput: React.FC<TextInputProps> = ({ ...props }) => {
  return (
    <TextInput
      className="flex-1 bg-input-background text-gray-700 p-3 text-base h-12"
      style={{ fontFamily: "Poppins" }}
      {...props}
    />
  );
};

export default ReusableTextInput;
