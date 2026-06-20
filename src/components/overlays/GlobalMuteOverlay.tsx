import React, {useCallback} from "react";
import {StyleSheet, View} from "react-native";
import MuteButton from "../buttons/MuteButton";
import {verticalScale} from "@/utils/responsive";

export const GLOBAL_MUTE_OVERLAY_TOP_OFFSET = verticalScale(112);
const OVERLAY_RIGHT_OFFSET = 16;

interface GlobalMuteOverlayProps {
  isSoundEnabled: boolean;
  onToggleSound: (isEnabled: boolean) => void;
  accessibilityLabel?: string;
}

const GlobalMuteOverlay: React.FC<GlobalMuteOverlayProps> = ({
  isSoundEnabled,
  onToggleSound,
  accessibilityLabel,
}) => {
  const handleToggleMute = useCallback(() => {
    onToggleSound(!isSoundEnabled);
  }, [isSoundEnabled, onToggleSound]);

  return (
    <View pointerEvents="box-none" style={styles.overlayRoot}>
      <View
        pointerEvents="box-none"
        style={[styles.buttonContainer, {top: GLOBAL_MUTE_OVERLAY_TOP_OFFSET, right: OVERLAY_RIGHT_OFFSET}]}
        testID="global-mute-button-container"
      >
        <MuteButton
          isMuted={!isSoundEnabled}
          onToggle={handleToggleMute}
          {...(accessibilityLabel ? {accessibilityLabel} : {})}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    elevation: 1000,
    position: "absolute",
    zIndex: 1000,
  },
  overlayRoot: {
    ...StyleSheet.absoluteFill,
  },
});

export default GlobalMuteOverlay;
