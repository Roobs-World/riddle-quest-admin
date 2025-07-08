import React from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";
import CloseButton from "../../buttons/CloseButton";

/**
 * Props for the DailyChallengeCompletionModal component.
 * @property {boolean} isVisible - Controls the visibility of the modal.
 * @property {number} totalCoinsEarned - Total coins earned from completing all 5 questions.
 * @property {number} questionsCompleted - Number of questions completed (should be 5).
 * @property {() => void} onContinue - Function to call when the Continue button is pressed.
 * @property {() => void} onHome - Function to call when the Home button is pressed.
 */
interface DailyChallengeCompletionModalProps {
  isVisible: boolean;
  totalCoinsEarned: number;
  questionsCompleted: number;
  onContinue: () => void;
  onHome: () => void;
}

/**
 * Modal component displayed when the player completes all 5 daily challenge questions.
 * It shows congratulations, total coins earned, and provides options to continue or return home.
 * @param {DailyChallengeCompletionModalProps} props - The props for the component.
 * @returns {React.FC<DailyChallengeCompletionModalProps>} The rendered DailyChallengeCompletionModal component.
 */
const DailyChallengeCompletionModal: React.FC<
  DailyChallengeCompletionModalProps
> = ({
  isVisible,
  totalCoinsEarned,
  questionsCompleted,
  onContinue,
  onHome,
}) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={() => {}}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-cream-light p-6 rounded-lg w-11/12 max-w-sm items-center relative">
          {/* Close Button in top-right corner */}
          <View className="absolute top-2 right-2 z-10">
            <CloseButton onPress={onHome} size={20} />
          </View>

          {/* Congratulations Header */}
          <Text className="text-4xl font-bold mb-2 text-yellow-500">
            🎉 Congratulations! 🎉
          </Text>

          <Text className="text-2xl font-bold mb-4 text-green-600">
            Daily Challenge Complete!
          </Text>

          {/* Achievement Details */}
          <View className="bg-yellow-50 p-4 rounded-lg mb-4 w-full">
            <Text className="text-lg font-semibold mb-2 text-gray-800 text-center">
              Amazing Achievement!
            </Text>
            <Text className="text-lg mb-2 text-gray-800 text-center">
              You solved all {questionsCompleted} daily questions!
            </Text>
            {totalCoinsEarned > 0 && (
              <Text className="text-lg font-bold text-green-600 text-center">
                🪙 Total Coins Earned: {totalCoinsEarned}
              </Text>
            )}
          </View>

          {/* Motivational Message */}
          <View className="mb-4">
            <Text className="text-base text-gray-700 text-center leading-relaxed">
              Outstanding work! You&apos;ve mastered today&apos;s daily
              challenge. Come back tomorrow for a new set of brain-teasing
              riddles!
            </Text>
          </View>

          {/* Action Buttons */}
          <View className="w-full space-y-3">
            <TouchableOpacity
              className="bg-blue-500 py-3 px-6 rounded-md w-full"
              onPress={onContinue}
            >
              <Text className="text-white text-lg font-semibold text-center">
                Play Classic Mode
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-gray-300 py-3 px-6 rounded-md w-full"
              onPress={onHome}
            >
              <Text className="text-gray-800 text-lg font-semibold text-center">
                Return Home
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default DailyChallengeCompletionModal;
