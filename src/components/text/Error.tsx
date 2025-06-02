import React from "react";
import { Text } from "react-native";
import { styles } from "../../styles";

// Define props for the PasswordError component
interface ErrorProps {
  message: string;
}

// Accept message prop
const Error = ({ message }: ErrorProps) => (
  <Text
    className="text-red-500 text-center mb-4"
    style={styles.errorText}
    role="alert"
  >
    {message}
  </Text>
);

export default Error;
