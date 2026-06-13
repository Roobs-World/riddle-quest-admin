import React, {useCallback} from "react";
import {Modal, StyleSheet, View} from "react-native";
import MuteButton from "../buttons/MuteButton";
import {verticalScale} from "@/utils/responsive";

const OVERLAY_TOP_OFFSET = verticalScale(64);
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
    <Modal animationType="none" transparent={true} visible={true} presentationStyle="overFullScreen">
      <View pointerEvents="box-none" style={styles.modalRoot}>
        <View style={[styles.buttonContainer, {top: OVERLAY_TOP_OFFSET, right: OVERLAY_RIGHT_OFFSET}]}>
          <MuteButton
            isMuted={!isSoundEnabled}
            onToggle={handleToggleMute}
            {...(accessibilityLabel ? {accessibilityLabel} : {})}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    elevation: 1000,
    position: "absolute",
    zIndex: 1000,
  },
  modalRoot: {
    flex: 1,
  },
});

export default GlobalMuteOverlay;
