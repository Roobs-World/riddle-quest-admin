import React, { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import MuteButton from "../buttons/MuteButton";
import { verticalScale } from "@/utils/responsive";

const OVERLAY_TOP_OFFSET = verticalScale(64);
const OVERLAY_RIGHT_OFFSET = 16;

interface GlobalMuteOverlayProps {
  isSoundEnabled: boolean;
  onToggleSound: (isEnabled: boolean) => void;
}

const GlobalMuteOverlay: React.FC<GlobalMuteOverlayProps> = ({
  isSoundEnabled,
  onToggleSound,
}) => {
  const handleToggleMute = useCallback(() => {
    onToggleSound(!isSoundEnabled);
  }, [isSoundEnabled, onToggleSound]);

  return (
    <View style={[styles.buttonContainer, { top: OVERLAY_TOP_OFFSET, right: OVERLAY_RIGHT_OFFSET }]}>
      <MuteButton isMuted={!isSoundEnabled} onToggle={handleToggleMute} />
    </View>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    elevation: 1000,
    position: "absolute",
    zIndex: 1000,
  },
});

export default GlobalMuteOverlay;
