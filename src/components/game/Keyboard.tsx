import React, { useRef } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import BackspaceIcon from "../icons/BackspaceIcon";
import { scale, moderateScale } from "../../utils/responsive";
import { COLORS, gameStyles } from "../../styles";

interface KeyboardProps {
  onKeyPress: (key: string) => void;
  isVisible: boolean;
}

const Keyboard: React.FC<KeyboardProps> = ({ onKeyPress }) => {
  const topRow = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
  const midRow = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
  const bottomRow = ["z", "x", "c", "v", "b", "n", "m"];

  const keyboardRef = useRef<View>(null);
  const keyRefs = useRef<{ [key: string]: View | null }>({});

  // Responsive styles
  const keyHeight = scale(36);
  const keyWidth = scale(35); // Reduced from 38 to 32 to prevent overflow
  const keyMargin = scale(1.65);
  const fontSize = moderateScale(18);

  const handleKeyPress = (key: string) => {
    onKeyPress(key);
  };

  return (
    <View ref={keyboardRef} style={gameStyles.keyboardContainer}>
      {/* Keyboard keys layer */}
      <View style={gameStyles.keyboardLayer}>
        {/* Top row - QWERTYUIOP */}
        <View style={gameStyles.keyboardRow}>
          {topRow.map((key) => (
            <TouchableOpacity
              key={key}
              ref={(ref) => {
                keyRefs.current[key] = ref;
              }}
              style={[
                gameStyles.keyButton,
                {
                  borderRadius: scale(6),
                  height: keyHeight,
                  width: keyWidth, // Use wider key width
                  margin: keyMargin,
                },
              ]}
              onPressIn={() => handleKeyPress(key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  gameStyles.keyText,
                  {
                    fontSize,
                  },
                ]}
              >
                {key}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Middle row - ASDFGHJKL with half-key offset */}
        <View
          style={[
            gameStyles.keyboardRow,
            {
              marginBottom: scale(5), // Reduced from 6
            },
          ]}
        >
          <View style={{ width: scale(16) }} />
          {midRow.map((key) => (
            <TouchableOpacity
              key={key}
              ref={(ref) => {
                keyRefs.current[key] = ref;
              }}
              style={[
                gameStyles.keyButton,
                {
                  borderRadius: scale(6),
                  height: keyHeight,
                  width: keyWidth, // Use wider key width
                  margin: keyMargin,
                },
              ]}
              onPressIn={() => handleKeyPress(key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  gameStyles.keyText,
                  {
                    fontSize,
                  },
                ]}
              >
                {key}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={{ width: scale(16) }} />
        </View>

        {/* Bottom row - ZXCVBNM + DELETE */}
        <View style={gameStyles.keyboardRow}>
          <View style={{ width: scale(48) }} />
          {bottomRow.map((key) => (
            <TouchableOpacity
              key={key}
              ref={(ref) => {
                keyRefs.current[key] = ref;
              }}
              className="rounded-full"
              style={[
                gameStyles.keyButton,
                {
                  borderRadius: scale(6),
                  height: keyHeight,
                  width: keyWidth, // Use wider key width
                  margin: keyMargin,
                },
              ]}
              onPressIn={() => handleKeyPress(key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  gameStyles.keyText,
                  {
                    fontSize,
                  },
                ]}
              >
                {key}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            key="delete"
            ref={(ref) => {
              keyRefs.current["DELETE"] = ref;
            }}
            style={{
              height: keyHeight,
              width: scale(48),
              margin: keyMargin,
            }}
            onPressIn={() => handleKeyPress("BACKSPACE")}
            activeOpacity={0.7}
          >
            <BackspaceIcon />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default Keyboard;
