import React from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import SlideInModalContent from "../../shared/SlideInModalContent";
import { AUTH_CONTENT_MAX_WIDTH } from "../../../constants/layout";
import { SPACING, TYPOGRAPHY } from "../../../styles";

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
    padding: SPACING.lg,
  },
  content: {
    width: "100%",
    maxWidth: AUTH_CONTENT_MAX_WIDTH,
  },
  card: {
    width: "100%",
    backgroundColor: "#161616",
    borderRadius: 16,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderWidth: 1,
    borderColor: "#5C5C5C",
  },
  title: {
    color: "#FFFFFF",
    fontSize: TYPOGRAPHY.fontSize["2xl"],
    fontWeight: "700",
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  message: {
    color: "#D9D9D9",
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: "center",
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.normal,
  },
});

export default React.memo(OfflineBlockingModal);
