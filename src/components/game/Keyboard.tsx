import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import BackspaceIcon from "../icons/BackspaceIcon";
import { scale, moderateScale, isTablet } from "../../utils/responsive";

const COLORS = {
  primaryOrange: "#FF8C00",
};

interface KeyboardProps {
  onKeyPress: (key: string) => void;
}

interface PulseAnimation {
  key: string;
  x: number;
  y: number;
  id: string;
}

const Keyboard: React.FC<KeyboardProps> = ({ onKeyPress }) => {
  const topRow = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
  const midRow = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
  const bottomRow = ["z", "x", "c", "v", "b", "n", "m"];

  const [pulses, setPulses] = useState<PulseAnimation[]>([]);
  const keyboardRef = useRef<View>(null);
  const keyRefs = useRef<{ [key: string]: View | null }>({});
  const pulseIdCounter = useRef(0); // Add counter for truly unique IDs

  // Responsive styles
  const keyHeight = scale(48);
  const keyMargin = scale(1);
  const fontSize = moderateScale(18);
  const containerPadding = isTablet ? scale(16) : scale(8);

  const createPulse = (key: string) => {
    const keyRef = keyRefs.current[key];
    if (!keyRef || !keyboardRef.current) return;

    // Measure the key position relative to the keyboard container
    keyRef.measureLayout(
      keyboardRef.current,
      (x: number, y: number, width: number, height: number) => {
        // Create truly unique ID with counter and timestamp
        const pulseId = `pulse_${Date.now()}_${++pulseIdCounter.current}`;

        // Calculate center of the key
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        const newPulse: PulseAnimation = {
          key,
          x: centerX,
          y: centerY,
          id: pulseId,
        };

        setPulses((prev) => [...prev, newPulse]);
      },
      () => {
        console.error("Failed to measure key position");
      }
    );
  };

  const handleKeyPress = (key: string) => {
    createPulse(key);
    onKeyPress(key);
  };

  const PulseCircle: React.FC<{ pulse: PulseAnimation }> = ({ pulse }) => {
    const scaleValue = useSharedValue(0);
    const opacity = useSharedValue(0.8);
    const animationCompleted = useRef(false);

    const removePulse = React.useCallback(() => {
      if (!animationCompleted.current) {
        animationCompleted.current = true;
        setPulses((prev) => prev.filter((p) => p.id !== pulse.id));
      }
    }, [pulse.id]);

    React.useEffect(() => {
      // Start both animations immediately when component mounts
      // Only the scale animation needs the completion callback since they run simultaneously
      scaleValue.value = withTiming(1.5, { duration: 600 }, (finished) => {
        if (finished) {
          runOnJS(removePulse)();
        }
      });

      // Opacity animation runs in parallel
      opacity.value = withTiming(0, { duration: 600 });

      // Cleanup function to prevent memory leaks
      return () => {
        animationCompleted.current = true;
      };
    }, [scaleValue, opacity, removePulse]); // Include all dependencies used in the effect

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scaleValue.value }],
      opacity: opacity.value,
    }));

    return (
      <Animated.View
        style={[
          styles.pulseCircle,
          {
            left: pulse.x - 20, // Center the pulse on the key
            top: pulse.y - 20, // Center the pulse on the key
          },
          animatedStyle,
        ]}
      />
    );
  };

  return (
    <View
      ref={keyboardRef}
      className="items-center relative"
      style={{ padding: containerPadding }}
    >
      {/* Top row */}
      <View className="flex-row mb-1">
        {topRow.map((key) => (
          <TouchableOpacity
            key={key}
            ref={(ref) => {
              keyRefs.current[key] = ref;
            }}
            className="flex-1 items-center justify-center rounded bg-gray-300"
            style={{
              height: keyHeight,
              margin: keyMargin,
            }}
            onPress={() => handleKeyPress(key)}
          >
            <Text
              className="font-bold uppercase text-black"
              style={{ fontSize }}
            >
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
            ref={(ref) => {
              keyRefs.current[key] = ref;
            }}
            className="flex-1 items-center justify-center rounded bg-gray-300"
            style={{
              height: keyHeight,
              margin: keyMargin,
            }}
            onPress={() => handleKeyPress(key)}
          >
            <Text
              className="font-bold uppercase text-black"
              style={{ fontSize }}
            >
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
            ref={(ref) => {
              keyRefs.current[key] = ref;
            }}
            className="flex-1 items-center justify-center rounded bg-gray-300"
            style={{
              height: keyHeight,
              margin: keyMargin,
            }}
            onPress={() => handleKeyPress(key)}
          >
            <Text
              className="font-bold uppercase text-black"
              style={{ fontSize }}
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
          className="flex-1 items-center justify-center rounded bg-black"
          style={{
            height: keyHeight,
            margin: keyMargin,
          }}
          onPress={() => handleKeyPress("DELETE")}
        >
          <BackspaceIcon width={scale(20)} height={scale(20)} color="#fcfaf4" />
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

const styles = StyleSheet.create({
  pulseCircle: {
    backgroundColor: COLORS.primaryOrange,
    borderRadius: 20,
    height: 40,
    pointerEvents: "none",
    position: "absolute",
    width: 40,
  },
});

export default Keyboard;
