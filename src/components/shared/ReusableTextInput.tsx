import React from "react";
import { TextInput, TextInputProps, StyleSheet } from "react-native";

const ReusableTextInput: React.FC<TextInputProps> = ({ ...props }) => {
  return (
    <TextInput
      className="flex-1 bg-input-background text-gray-700 p-3 text-base h-12"
      style={styles.input}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    fontFamily: "Poppins",
  },
});

export default ReusableTextInput;
