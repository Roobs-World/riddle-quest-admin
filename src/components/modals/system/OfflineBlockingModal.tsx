import React from "react";
import { Modal, StyleSheet, Text, View } from "react-native";

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
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
      testID="offline-blocking-modal"
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>No Internet Connection</Text>
          <Text style={styles.message}>
            Please reconnect to continue playing.
          </Text>
        </View>
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
  card: {
    width: "100%",
    maxWidth: 420,
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
