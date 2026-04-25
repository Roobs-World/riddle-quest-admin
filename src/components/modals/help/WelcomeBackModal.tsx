import React from "react";
import {Image, Modal, Pressable, Text, View} from "react-native";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import {AppStrings} from "../../../constants/AppStrings";
import {TYPOGRAPHY, SPACING} from "../../../styles";
import {AVATAR_SIZE_LARGE, MODAL_CONTENT_PADDING, MODAL_HEIGHT, MODAL_WIDTH} from "../../../constants/layout";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {moderateScale, verticalScale} from "../../../utils/responsive";
import RotatingWheelBackground from "@/components/shared/RotatingWheelBackground";
import {useAuth} from "@/contexts/AuthContext";

interface WelcomeBackModalProps {
  isVisible: boolean;
  onClose: () => void;
  username: string;
  onDismiss?: () => void;
}

const WelcomeBackModal: React.FC<WelcomeBackModalProps> = ({isVisible, onClose, username, onDismiss}) => {
  const {playerData} = useAuth();
  const avatarUrl = playerData?.avatarUrl ?? null;
  const avatarRadius = AVATAR_SIZE_LARGE / 2;
  const initial = (username || AppStrings.Profile.GUEST_USERNAME).charAt(0).toUpperCase();

  const handleDismiss = () => {
    onClose();
    onDismiss?.();
  };

  return (
    <Modal animationType="fade" transparent={true} visible={isVisible} onRequestClose={handleDismiss}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <RotatingWheelBackground isVisible={isVisible} />
        <SlideInModalContent isVisible={isVisible}>
          <Pressable onPress={handleDismiss} accessibilityRole="button" testID="welcome-back-modal-touch-target">
            <View
              style={{
                width: MODAL_WIDTH,
                height: MODAL_HEIGHT,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <ModalBg width={MODAL_WIDTH} height={MODAL_HEIGHT} style={{position: "absolute"}} />
              <HomeBg
                width={MODAL_WIDTH * 1.1}
                height={MODAL_HEIGHT * 1.1}
                style={{
                  position: "absolute",
                  top: -MODAL_HEIGHT * 0.05,
                  left: -MODAL_WIDTH * 0.05,
                }}
              />

              <View
                style={{
                  flex: 1,
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: MODAL_CONTENT_PADDING,
                }}
              >
                {avatarUrl ? (
                  <Image
                    key={avatarUrl}
                    testID="welcome-back-avatar-image"
                    source={{uri: avatarUrl}}
                    style={{
                      width: AVATAR_SIZE_LARGE * 2,
                      height: AVATAR_SIZE_LARGE * 2,
                      borderRadius: avatarRadius,
                      borderWidth: moderateScale(3),
                      borderColor: "#FFFFFF",
                      marginBottom: verticalScale(12),
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: AVATAR_SIZE_LARGE,
                      height: AVATAR_SIZE_LARGE,
                      borderRadius: avatarRadius,
                      backgroundColor: "rgba(255,255,255,0.15)",
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: moderateScale(3),
                      borderColor: "#FFFFFF",
                      marginBottom: verticalScale(12),
                    }}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: TYPOGRAPHY.fontSize.display,
                        fontFamily: TYPOGRAPHY.fontSecondaryBold,
                      }}
                    >
                      {initial}
                    </Text>
                  </View>
                )}

                <Text
                  style={{
                    fontFamily: TYPOGRAPHY.fontPrimary,
                    fontSize: TYPOGRAPHY.fontSize["3xl"],
                    color: "black",
                    textAlign: "center",
                  }}
                >
                  {AppStrings.WelcomeBackModal.TITLE}
                </Text>
                <Text
                  style={{
                    marginTop: SPACING.md,
                    fontFamily: TYPOGRAPHY.fontSecondaryBold,
                    fontSize: TYPOGRAPHY.fontSize["2xl"],
                    color: "black",
                    textAlign: "center",
                  }}
                >
                  {username || AppStrings.Profile.GUEST_USERNAME}
                </Text>
                <Text
                  style={{
                    marginTop: verticalScale(12),
                    fontFamily: TYPOGRAPHY.fontSecondary,
                    fontSize: TYPOGRAPHY.fontSize.base,
                    color: "black",
                    textAlign: "center",
                  }}
                >
                  {AppStrings.WelcomeBackModal.TAP_TO_CONTINUE}
                </Text>
              </View>
            </View>
          </Pressable>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default WelcomeBackModal;
