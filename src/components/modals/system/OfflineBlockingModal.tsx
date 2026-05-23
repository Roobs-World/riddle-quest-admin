import React from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import SlideInModalContent from "../../shared/SlideInModalContent";
import { AUTH_CONTENT_MAX_WIDTH } from "../../../constants/layout";
import { scale, verticalScale } from "../../../utils/responsive";

interface OfflineBlockingModalProps {
  isVisible: boolean;
}

const OfflineBlockingModal: React.FC<OfflineBlockingModalProps> = ({
  isVisible,
}) => {
  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {}}
      testID="offline-blocking-modal"
    >
      <View style={styles.backdrop}>
        <SlideInModalContent isVisible={isVisible} style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.title}>No Internet Connection</Text>
            <Text style={styles.message}>
              Please reconnect to continue playing.
            </Text>
          </View>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: scale(24),
  },
  content: {
    width: "100%",
    maxWidth: AUTH_CONTENT_MAX_WIDTH,
  },
  card: {
    width: "100%",
    backgroundColor: "#161616",
    borderRadius: 16,
    paddingHorizontal: scale(24),
    paddingVertical: verticalScale(24),
    borderWidth: 1,
    borderColor: "#5C5C5C",
  },
  title: {
    color: "#FFFFFF",
    fontSize: scale(24),
    fontWeight: "700",
    textAlign: "center",
    marginBottom: verticalScale(8),
  },
  message: {
    color: "#D9D9D9",
    fontSize: scale(16),
    textAlign: "center",
    lineHeight: scale(16) * 1.5,
  },
});

export default React.memo(OfflineBlockingModal);
