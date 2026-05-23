/**
 * @fileoverview About / Legal modal for externally hosted compliance links.
 */

import React from "react";
import {Alert, Modal, ScrollView, Text, TouchableOpacity, View} from "react-native";
import CloseButton from "../../buttons/CloseButton";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {AppStrings, getAppLanguage} from "../../../constants/AppStrings";
import {getLegalUrl, LegalUrlKey} from "../../../constants/legal";
import {SPACING, TYPOGRAPHY} from "../../../styles";
import {verticalScale} from "@/utils/responsive";

const Linking = require("react-native/Libraries/Linking/Linking") as {
  openURL: (url: string) => Promise<void>;
};

interface AboutLegalModalProps {
  isVisible: boolean;
  onClose: () => void;
}

interface LegalLinkRow {
  key: LegalUrlKey;
  label: string;
}

const getLegalLinkRows = (): LegalLinkRow[] => [
  {key: "website", label: AppStrings.AboutLegal.RIDDLE_QUEST_WEBSITE},
  {key: "privacyPolicy", label: AppStrings.AboutLegal.PRIVACY_POLICY},
  {key: "termsOfUse", label: AppStrings.AboutLegal.TERMS_OF_USE},
  {key: "accountDeletion", label: AppStrings.AboutLegal.ACCOUNT_DELETION},
  {key: "dataExport", label: AppStrings.AboutLegal.DATA_EXPORT},
  {key: "thirdPartyLicenses", label: AppStrings.AboutLegal.THIRD_PARTY_LICENSES},
  {key: "support", label: AppStrings.AboutLegal.SUPPORT},
];

const openExternalUrl = async (label: string, url: string) => {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(
      AppStrings.CommonAlerts.UNABLE_TO_OPEN_TITLE,
      `${AppStrings.CommonAlerts.COULD_NOT_OPEN_PREFIX}${label}${AppStrings.CommonAlerts.COULD_NOT_OPEN_TRY_AGAIN}`
    );
  }
};

const AboutLegalModal: React.FC<AboutLegalModalProps> = ({isVisible, onClose}) => {
  return (
    <Modal visible={isVisible} transparent={true} animationType="none" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <TouchableOpacity style={{flex: 1}} onPress={onClose} activeOpacity={1} />

        <SlideInModalContent isVisible={isVisible}>
          <View
            style={{
              backgroundColor: "#FCFAF4",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: SPACING["2xl"] ?? 32,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: SPACING.lg,
                paddingVertical: SPACING.md,
                position: "relative",
              }}
            >
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  fontSize: TYPOGRAPHY.fontSize["4xl"],
                  color: "#1A1A1A",
                  letterSpacing: 1,
                  textAlign: "center",
                }}
              >
                {AppStrings.AboutLegal.TITLE}
              </Text>
              <CloseButton
                onPress={onClose}
                style={{
                  position: "absolute",
                  right: SPACING.lg,
                  top: verticalScale(22),
                }}
              />
            </View>

            <ScrollView style={{paddingHorizontal: SPACING.lg}}>
              {getLegalLinkRows().map((row, index) => (
                <React.Fragment key={row.key}>
                  {index > 0 ? <View style={{height: 1, backgroundColor: "#E8E0E8"}} /> : null}
                  <TouchableOpacity
                    accessibilityRole="link"
                    onPress={() => {
                      void openExternalUrl(row.label, getLegalUrl(row.key, getAppLanguage()));
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 16,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: TYPOGRAPHY.fontSecondary,
                        fontSize: TYPOGRAPHY.fontSize.base,
                        color: "#1A1A1A",
                        flex: 1,
                        paddingRight: SPACING.sm,
                      }}
                    >
                      {row.label}
                    </Text>
                    <Text style={{fontSize: 20, color: "#9CA3AF"}}>{">"}</Text>
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </ScrollView>
          </View>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default AboutLegalModal;
