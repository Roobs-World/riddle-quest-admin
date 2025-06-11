import React from "react";
import { View, Text, Modal, SafeAreaView, ScrollView } from "react-native";
import { AppStrings } from "../../../constants/AppStrings";
import CloseButton from "../../buttons/CloseButton";

/**
 * Props for the CreditsModal component.
 * @property {boolean} isVisible - Controls the visibility of the credits modal.
 * @property {() => void} onClose - Function to call when the modal is closed.
 */
interface CreditsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

/**
 * Modal component for displaying credits and team information.
 */
const CreditsModal: React.FC<CreditsModalProps> = ({ isVisible, onClose }) => {
  const teamMembers = [
    {
      name: "Craig Beswetherick",
      role: "Lead Developer & Game Design",
    },
    {
      name: "Reuben Beswetherick",
      role: "Inspiration",
    },
    {
      name: "Thomas Lemrond",
      role: "Game Designer, Publisher, Overall Hero",
    },
    {
      name: "Gavin Harrison",
      role: "Sound Design",
    },
    {
      name: "Nathalia",
      role: "Design",
    },
    {
      name: "Mr Ben",
      role: "Design",
    },
  ];

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-white p-6 rounded-lg m-4 w-11/12 max-w-md items-center relative max-h-4/5">
          {/* Close Button in top-right corner */}
          <View className="absolute top-2 right-2 z-10">
            <CloseButton onPress={onClose} size={20} />
          </View>

          <Text className="text-2xl font-bold text-gray-800 mb-2 text-center">
            {AppStrings.Credits.TITLE}
          </Text>

          <Text className="text-lg text-gray-600 text-center mb-6">
            {AppStrings.Credits.SUBTITLE}
          </Text>

          <ScrollView
            className="flex-1 w-full"
            showsVerticalScrollIndicator={false}
          >
            {teamMembers.map((member, index) => (
              <View
                key={index}
                className="bg-gray-50 rounded-lg p-4 mb-3 w-full"
              >
                <Text className="text-lg font-bold text-gray-800 text-center mb-1">
                  {member.name}
                </Text>
                <Text className="text-sm text-gray-600 text-center">
                  {member.role}
                </Text>
              </View>
            ))}

            <View className="mt-6 mb-2">
              <Text className="text-lg font-bold text-gray-800 text-center mb-3">
                {AppStrings.Credits.THANK_YOU_TITLE}
              </Text>
              <Text className="text-sm text-gray-600 text-center leading-5">
                {AppStrings.Credits.THANK_YOU_TEXT}
              </Text>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default CreditsModal;
