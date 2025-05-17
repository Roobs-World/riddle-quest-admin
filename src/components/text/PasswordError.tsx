import { Text } from "react-native";

// Define props for the PasswordError component
interface PasswordErrorProps {
  message: string;
}

// Accept message prop
export default function PasswordError({ message }: PasswordErrorProps) {
  return (
    <Text className="text-xs text-red-600 ml-1 mb-4 text-right">{message}</Text>
  );
}
