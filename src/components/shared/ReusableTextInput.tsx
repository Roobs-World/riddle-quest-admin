import React from "react";
import { TextInput, TextInputProps } from "react-native";
import { styles } from "../../styles";

interface ReusableTextInputProps extends TextInputProps {
  className?: string;
}

const ReusableTextInput: React.FC<ReusableTextInputProps> = ({
  className,
  ...props
}) => {
  return <TextInput style={styles.input} className={className} {...props} />;
};

export default ReusableTextInput;
