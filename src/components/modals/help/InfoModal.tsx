import React from "react";
import {View, Text, Modal} from "react-native";
import {TYPOGRAPHY, SPACING} from "../../../styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import WideButton from "../../buttons/WideButton";
import {MODAL_WIDTH, MODAL_HEIGHT} from "../../../constants/layout";
import {AppStrings} from "../../../constants/AppStrings";
import SlideInModalContent from "../../shared/SlideInModalContent";

interface InfoModalProps {
  isVisible: boolean;
  title: string;
  message: string;
  actionButtonText?: string;
  onAction?: () => void;
  onConfirm?: () => void;
  onClose: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({
  isVisible,
  title,
  message,
  actionButtonText,
  onAction,
  onConfirm,
  onClose,
}) => {
  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  const handleAction = () => {
    onAction?.();
    onClose();
  };

  return (
    <Modal visible={isVisible} transparent={true} animationType="fade" onRequestClose={handleConfirm}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <SlideInModalContent isVisible={isVisible}>
          <View
            style={{
              width: MODAL_WIDTH,
              height: MODAL_HEIGHT,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ModalBg width={MODAL_WIDTH} height={MODAL_HEIGHT} style={{position: "absolute"}} />
            {/* Decorative wave — clipped to card bounds */}
            <HomeBg
              width={MODAL_WIDTH * 1.1}
              height={MODAL_HEIGHT * 1.1}
              style={{position: "absolute", top: -MODAL_HEIGHT * 0.05, left: -MODAL_WIDTH * 0.05}}
            />

            <View
              style={{
                width: "80%",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  fontSize: TYPOGRAPHY.fontSize.title,
                  color: "black",
                  marginBottom: SPACING.lg,
                  textAlign: "center",
                }}
              >
                {title}
              </Text>
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  fontSize: TYPOGRAPHY.fontSize.lg,
                  color: "black",
                  marginBottom: SPACING.lg,
                  textAlign: "center",
                }}
              >
                {message}
              </Text>
              <View style={{width: "100%", marginTop: SPACING.lg}}>
                {actionButtonText && onAction ? (
                  <View style={{marginBottom: SPACING.md}}>
                    <WideButton buttonText={actionButtonText} onPress={handleAction} disabled={false} />
                  </View>
                ) : null}
                <WideButton
                  buttonText={AppStrings.CommonAlerts.OK_BUTTON}
                  onPress={handleConfirm}
                  disabled={false}
                />
              </View>
            </View>
          </View>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default InfoModal;
