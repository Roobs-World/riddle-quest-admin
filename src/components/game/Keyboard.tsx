import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

interface KeyboardProps {
  onKeyPress: (key: string) => void;
}

const Keyboard: React.FC<KeyboardProps> = ({ onKeyPress }) => {
  const topRow = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
  const midRow = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
  const bottomRow = ["z", "x", "c", "v", "b", "n", "m"];

  return (
    <View className="items-center p-2">
      {/* Top row */}
      <View className="flex-row mb-1">
        {topRow.map((key) => (
          <TouchableOpacity
            key={key}
            className="flex-1 m-[1px] items-center justify-center rounded bg-gray-300 h-12"
            onPress={() => onKeyPress(key)}
          >
            <Text className="text-lg font-bold uppercase">{key}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Middle row */}
      <View className="flex-row mb-1">
        {midRow.map((key) => (
          <TouchableOpacity
            key={key}
            className="flex-1 m-[1px] items-center justify-center rounded bg-gray-300 h-12"
            onPress={() => onKeyPress(key)}
          >
            <Text className="text-lg font-bold uppercase">{key}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bottom row */}
      <View className="flex-row">
        {bottomRow.map((key) => (
          <TouchableOpacity
            key={key}
            className="flex-1 m-[1px] items-center justify-center rounded bg-gray-300 h-12"
            onPress={() => onKeyPress(key)}
          >
            <Text className="text-lg font-bold uppercase">{key}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          key="delete"
          className="flex-1 m-[1px] items-center justify-center rounded bg-black h-12"
          onPress={() => onKeyPress("DELETE")}
        >
          <Text className="text-white text-xs font-bold uppercase">X</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Keyboard;
