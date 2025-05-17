import { Text } from "react-native";

export default function Subtitle({ text }: { text: string }) {
  return (
    <Text
      className="text-2xl font-bold text-black-400 text-center mb-8 mx-12"
      style={{
        fontFamily: "Poppins",
        fontWeight: "400",
        fontSize: 14,
        lineHeight: 24,
        letterSpacing: -0.104,
      }}
    >
      {text}
    </Text>
  );
}
