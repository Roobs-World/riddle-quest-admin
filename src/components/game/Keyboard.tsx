import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  GestureResponderEvent,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import BackspaceIcon from "../icons/BackspaceIcon";

interface KeyboardProps {
  onKeyPress: (key: string) => void;
}

interface PulseAnimation {
  key: string;
  x: number;
  y: number;
  id: number;
}

const Keyboard: React.FC<KeyboardProps> = ({ onKeyPress }) => {
  const topRow = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
  const midRow = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
  const bottomRow = ["z", "x", "c", "v", "b", "n", "m"];

  const [pulses, setPulses] = useState<PulseAnimation[]>([]);

  const createPulse = (key: string, event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    const pulseId = Date.now();

    const newPulse: PulseAnimation = {
      key,
      x: locationX,
      y: locationY,
      id: pulseId,
    };

    setPulses((prev) => [...prev, newPulse]);

    // Remove pulse after animation completes
    setTimeout(() => {
      setPulses((prev) => prev.filter((p) => p.id !== pulseId));
    }, 600);
  };

  const handleKeyPress = (key: string, event: GestureResponderEvent) => {
    createPulse(key, event);
    onKeyPress(key);
  };

  const PulseCircle: React.FC<{ pulse: PulseAnimation }> = ({ pulse }) => {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0.8);

    React.useEffect(() => {
      scale.value = withTiming(1.5, { duration: 600 });
      opacity.value = withTiming(0, { duration: 600 });
    }, [scale, opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    }));

    return (
      <Animated.View
        style={[
          {
            position: "absolute",
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "#FF8C00", // Primary orange color to match game theme
            left: pulse.x - 20,
            top: pulse.y - 20,
            pointerEvents: "none",
          },
          animatedStyle,
        ]}
      />
    );
  };

  return (
    <View className="items-center p-2 relative">
      {/* Top row */}
      <View className="flex-row mb-1">
        {topRow.map((key) => (
          <TouchableOpacity
            key={key}
            className="flex-1 m-[1px] items-center justify-center rounded bg-gray-300 h-12"
            onPress={(event) => handleKeyPress(key, event)}
          >
            <Text className="text-lg font-bold uppercase text-black">
              {key}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Middle row */}
      <View className="flex-row mb-1">
        {midRow.map((key) => (
          <TouchableOpacity
            key={key}
            className="flex-1 m-[1px] items-center justify-center rounded bg-gray-300 h-12"
            onPress={(event) => handleKeyPress(key, event)}
          >
            <Text className="text-lg font-bold uppercase text-black">
              {key}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bottom row */}
      <View className="flex-row">
        {bottomRow.map((key) => (
          <TouchableOpacity
            key={key}
            className="flex-1 m-[1px] items-center justify-center rounded bg-gray-300 h-12"
            onPress={(event) => handleKeyPress(key, event)}
          >
            <Text className="text-lg font-bold uppercase text-black">
              {key}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          key="delete"
          className="flex-1 m-[1px] items-center justify-center rounded bg-black h-12"
          onPress={(event) => handleKeyPress("DELETE", event)}
        >
          <BackspaceIcon width={20} height={20} color="#fcfaf4" />
        </TouchableOpacity>
      </View>

      {/* Pulse animations */}
      {pulses.map((pulse) => (
        // eslint-disable-next-line react/prop-types
        <PulseCircle key={pulse.id} pulse={pulse} />
      ))}
    </View>
  );
};

export default Keyboard;
