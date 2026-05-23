import React from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import SlideInModalContent from "../../shared/SlideInModalContent";

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
    padding: 24,
  },
  content: {
    width: "100%",
    maxWidth: 420,
  },
  card: {
    width: "100%",
    backgroundColor: "#161616",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: "#5C5C5C",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  message: {
    color: "#D9D9D9",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
});

export default React.memo(OfflineBlockingModal);
