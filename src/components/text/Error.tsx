import { Text } from "react-native";

// Define props for the PasswordError component
interface ErrorProps {
  message: string;
}

// Accept message prop
export default function Error({ message }: ErrorProps) {
  return (
    <Text
      className="text-xs text-red-600 ml-1 mb-4 text-right"
      style={{ fontFamily: "Poppins" }}
    >
      {message}
    </Text>
  );
}
