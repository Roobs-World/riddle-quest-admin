import React, { useRef } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import BackspaceIcon from "../icons/BackspaceIcon";
import { scale, moderateScale } from "../../utils/responsive";
import { gameStyles } from "../../styles";

interface KeyboardProps {
  onKeyPress: (key: string) => void;
  isVisible: boolean;
}

const Keyboard: React.FC<KeyboardProps> = ({ onKeyPress, isVisible }) => {
  const topRow = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
  const midRow = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
  const bottomRow = ["z", "x", "c", "v", "b", "n", "m"];

  const keyboardRef = useRef<View>(null);
  const keyRefs = useRef<{ [key: string]: View | null }>({});

  // Responsive styles
  const keyHeight = scale(48);
  const keyWidth = scale(32); // Reduced from 38 to 32 to prevent overflow
  const keyMargin = scale(1.65);
  const fontSize = moderateScale(18);

  const handleKeyPress = (key: string) => {
    onKeyPress(key);
  };

  return (
    <View
      ref={keyboardRef}
      style={[
        gameStyles.keyboardContainer,
        {
          marginTop: -8,
          minHeight: scale(160), // Reduced from 200 to fit bottom bar
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible ? "auto" : "none",
        },
      ]}
    >
      {/* Keyboard keys layer */}
      <View
        style={[
          gameStyles.keyboardLayer,
          {
            paddingVertical: scale(8), // Reduced from 10
          },
        ]}
      >
        {/* Top row - QWERTYUIOP */}
        <View
          style={[
            gameStyles.keyboardRow,
            {
              marginBottom: scale(5), // Reduced from 6
            },
          ]}
        >
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
              onPress={() => handleKeyPress(key)}
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
              onPress={() => handleKeyPress(key)}
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
              style={[
                gameStyles.keyButton,
                {
                  borderRadius: scale(6),
                  height: keyHeight,
                  width: keyWidth, // Use wider key width
                  margin: keyMargin,
                },
              ]}
              onPress={() => handleKeyPress(key)}
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
            style={[
              gameStyles.backspaceKey,
              {
                borderRadius: scale(6),
                height: keyHeight,
                width: scale(48),
                margin: keyMargin,
              },
            ]}
            onPress={() => handleKeyPress("BACKSPACE")}
            activeOpacity={0.7}
          >
            <BackspaceIcon color="#fcfaf4" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default Keyboard;
