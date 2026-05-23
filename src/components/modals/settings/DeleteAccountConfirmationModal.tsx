import React from "react";
import {
  ActivityIndicator,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AppStrings } from "../../../constants/AppStrings";
import { AUTH_CONTENT_MAX_WIDTH } from "../../../constants/layout";
import { COLORS, SPACING, TYPOGRAPHY } from "../../../styles";
import SlideInModalContent from "../../shared/SlideInModalContent";

interface DeleteAccountConfirmationModalProps {
  isVisible: boolean;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const DeleteAccountConfirmationModal: React.FC<
  DeleteAccountConfirmationModalProps
> = ({ isVisible, isDeleting, onCancel, onConfirm }) => {
  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="none"
      onRequestClose={isDeleting ? undefined : onCancel}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: SPACING.lg,
          backgroundColor: "rgba(0,0,0,0.55)",
        }}
      >
        <SlideInModalContent
          isVisible={isVisible}
          style={{ width: "100%", maxWidth: AUTH_CONTENT_MAX_WIDTH }}
        >
          <View
            style={{
              width: "100%",
              borderRadius: 18,
              backgroundColor: "#FCFAF4",
              padding: SPACING.lg,
              borderWidth: 1,
              borderColor: "#E4D8B8",
            }}
          >
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize["2xl"],
                color: "#1A1A1A",
                marginBottom: SPACING.md,
                textAlign: "center",
              }}
            >
              {AppStrings.Profile.DELETE_ACCOUNT_CONFIRM_TITLE}
            </Text>
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontSecondary,
                fontSize: TYPOGRAPHY.fontSize.base,
                color: "#1A1A1A",
                lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.normal,
                marginBottom: SPACING.lg,
                textAlign: "center",
              }}
            >
              {AppStrings.Profile.DELETE_ACCOUNT_CONFIRM_MESSAGE}
            </Text>

            <View style={{ gap: SPACING.sm }}>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={isDeleting}
                onPress={onConfirm}
                testID="delete-account-confirm-button"
                style={{
                  minHeight: 48,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#C93535",
                  opacity: isDeleting ? 0.7 : 1,
                }}
              >
                {isDeleting ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: SPACING.sm,
                    }}
                  >
                    <ActivityIndicator color={COLORS.white} />
                    <Text
                      style={{
                        fontFamily: TYPOGRAPHY.fontSecondaryBold,
                        fontSize: TYPOGRAPHY.fontSize.lg,
                        color: COLORS.white,
                      }}
                    >
                      {AppStrings.Profile.DELETE_ACCOUNT_LOADING}
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={{
                      fontFamily: TYPOGRAPHY.fontSecondaryBold,
                      fontSize: TYPOGRAPHY.fontSize.lg,
                      color: COLORS.white,
                    }}
                  >
                    {AppStrings.Profile.DELETE_ACCOUNT_CONFIRM_BUTTON}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityRole="button"
                disabled={isDeleting}
                onPress={onCancel}
                testID="delete-account-cancel-button"
                style={{
                  minHeight: 48,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: "#E4D8B8",
                  opacity: isDeleting ? 0.7 : 1,
                }}
              >
                <Text
                  style={{
                    fontFamily: TYPOGRAPHY.fontSecondaryBold,
                    fontSize: TYPOGRAPHY.fontSize.lg,
                    color: "#401F40",
                  }}
                >
                  {AppStrings.Profile.DELETE_ACCOUNT_CANCEL_BUTTON}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default DeleteAccountConfirmationModal;
