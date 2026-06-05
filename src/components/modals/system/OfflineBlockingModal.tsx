import React from "react";
import {Modal, StyleSheet, Text, View} from "react-native";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {AUTH_CONTENT_MAX_WIDTH} from "../../../constants/layout";
import {t} from "../../../i18n";
import {scale, verticalScale} from "../../../utils/responsive";

interface OfflineBlockingModalProps {
  isVisible: boolean;
}

const OfflineBlockingModal: React.FC<OfflineBlockingModalProps> = ({isVisible}) => {
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
            <Text style={styles.title}>{t("CommonAlerts.OFFLINE_TITLE")}</Text>
            <Text style={styles.message}>{t("CommonAlerts.OFFLINE_MESSAGE")}</Text>
          </View>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    flex: 1,
    justifyContent: "center",
    padding: scale(24),
  },
  card: {
    backgroundColor: "#161616",
    borderColor: "#5C5C5C",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: scale(24),
    paddingVertical: verticalScale(24),
    width: "100%",
  },
  content: {
    maxWidth: AUTH_CONTENT_MAX_WIDTH,
    width: "100%",
  },
  message: {
    color: "#D9D9D9",
    fontSize: scale(16),
    lineHeight: scale(16) * 1.5,
    textAlign: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: scale(24),
    fontWeight: "700",
    marginBottom: verticalScale(8),
    textAlign: "center",
  },
});

export default React.memo(OfflineBlockingModal);
