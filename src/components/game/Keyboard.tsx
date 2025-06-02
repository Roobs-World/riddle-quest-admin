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

interface PulseCircleProps {
  pulse: PulseAnimation;
  pulseSize: number;
  onRemove: (id: string) => void;
}

const PulseCircle: React.FC<PulseCircleProps> = ({
  pulse,
  pulseSize,
  onRemove,
}) => {
  const scaleValue = useSharedValue(0.3);
  const opacity = useSharedValue(0.6);
  const animationCompleted = useRef(false);

  const removePulse = React.useCallback(() => {
    if (!animationCompleted.current) {
      animationCompleted.current = true;
      onRemove(pulse.id);
    }
  }, [pulse.id, onRemove]);

  React.useEffect(() => {
    // Start animations with improved timing
    scaleValue.value = withTiming(2, { duration: 400 }, (finished) => {
      if (finished) {
        runOnJS(removePulse)();
      }
    });

    opacity.value = withTiming(0, { duration: 400 });

    return () => {
      animationCompleted.current = true;
    };
  }, [scaleValue, opacity, removePulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.pulseCircle,
        {
          left: pulse.x - pulseSize / 2,
          top: pulse.y - pulseSize / 2,
          width: pulseSize,
          height: pulseSize,
          borderRadius: pulseSize / 2,
        },
        animatedStyle,
      ]}
    />
  );
};

const Keyboard: React.FC<KeyboardProps> = ({ onKeyPress }) => {
  const topRow = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
  const midRow = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
  const bottomRow = ["z", "x", "c", "v", "b", "n", "m"];

  const [pulses, setPulses] = useState<PulseAnimation[]>([]);
  const keyboardRef = useRef<View>(null);
  const keyRefs = useRef<{ [key: string]: View | null }>({});
  const pulseIdCounter = useRef(0);

  // Responsive styles
  const keyHeight = scale(48);
  const keyMargin = scale(1);
  const fontSize = moderateScale(18);
  const containerPadding = isTablet ? scale(16) : scale(8);
  const pulseSize = scale(60); // Larger pulse for better visibility

  const createPulse = (key: string) => {
    const keyRef = keyRefs.current[key];
    if (!keyRef || !keyboardRef.current) return;

    // Measure the key position relative to the keyboard container
    keyRef.measureLayout(
      keyboardRef.current,
      (x: number, y: number, width: number, height: number) => {
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
        console.error("Failed to measure key position for:", key);
      }
    );
  };

  const handleKeyPress = (key: string) => {
    createPulse(key);
    onKeyPress(key);
  };

  const handleRemovePulse = React.useCallback((id: string) => {
    setPulses((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return (
    <View
      ref={keyboardRef}
      style={[styles.keyboardContainer, { padding: containerPadding }]}
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
            activeOpacity={0.7}
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
            activeOpacity={0.7}
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
            activeOpacity={0.7}
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
          activeOpacity={0.7}
        >
          <BackspaceIcon width={scale(20)} height={scale(20)} color="#fcfaf4" />
        </TouchableOpacity>
      </View>

      {/* Pulse animations overlay */}
      <View style={styles.pulseContainer} pointerEvents="none">
        {pulses.map((pulse) => (
          <PulseCircle
            key={pulse.id}
            pulse={pulse}
            pulseSize={pulseSize}
            onRemove={handleRemovePulse}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    alignItems: "center",
    position: "relative",
  },
  pulseCircle: {
    backgroundColor: COLORS.primaryOrange,
    elevation: 5,
    position: "absolute",
    shadowColor: COLORS.primaryOrange,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  pulseContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
});

export default Keyboard;
