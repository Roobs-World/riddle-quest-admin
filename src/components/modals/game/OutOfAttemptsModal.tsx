import React from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";
import CloseButton from "../../buttons/CloseButton";

interface OutOfAttemptsModalProps {
  isVisible: boolean;
  userCoins: number;
  continueCost: number;
  onWatchAd: () => void;
  onSpendCoins: () => void;
  onClose: () => void;
}

const OutOfAttemptsModal: React.FC<OutOfAttemptsModalProps> = ({
  isVisible,
  userCoins,
  continueCost,
  onWatchAd,
  onSpendCoins,
  onClose,
}) => {
  const canAffordContinue = userCoins >= continueCost;

  if (!isVisible) {
    return null;
  }

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => onClose && onClose()}
      testID="out-of-attempts-modal"
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-white p-6 rounded-lg m-4 w-11/12 max-w-sm relative">
          {/* Close Button in top-right corner */}
          <View className="absolute top-2 right-2 z-10">
            <CloseButton
              onPress={() => onClose && onClose()}
              size={20}
              testID="close-button"
            />
          </View>

          <Text className="text-2xl font-bold text-gray-800 mb-4 text-center">
            Out of Attempts!
          </Text>

          <Text className="text-md text-gray-700 mb-6 text-center">
            You&apos;ve used all 3 attempts. Continue playing by watching an ad
            or spending coins.
          </Text>

          {/* Watch Ad Button */}
          <TouchableOpacity
            onPress={() => onWatchAd && onWatchAd()}
            className="bg-blue-500 px-6 py-3 rounded-lg mb-3 w-full items-center"
            testID="watch-ad-button"
          >
            <Text className="text-white font-bold text-lg">
              Watch Ad to Continue
            </Text>
            <Text className="text-white text-sm opacity-80">
              Free - Get 3 more attempts
            </Text>
          </TouchableOpacity>

          {/* Spend Coins Button */}
          <TouchableOpacity
            onPress={() => {
              if (canAffordContinue && onSpendCoins) {
                onSpendCoins();
              }
            }}
            className={`px-6 py-3 rounded-lg mb-4 w-full items-center ${
              canAffordContinue ? "bg-yellow-500" : "bg-gray-400"
            }`}
            disabled={!canAffordContinue}
            testID="spend-coins-button"
          >
            <Text className="text-white font-bold text-lg">
              Spend {continueCost} Coins
            </Text>
            <Text className="text-white text-sm opacity-80">
              {canAffordContinue
                ? `You have ${userCoins} coins`
                : `Need ${continueCost - userCoins} more coins`}
            </Text>
          </TouchableOpacity>

          {/* Give Up Button */}
          <TouchableOpacity
            onPress={() => onClose && onClose()}
            className="bg-gray-500 px-6 py-2 rounded-lg w-full items-center"
            testID="give-up-button"
          >
            <Text className="text-white font-semibold">Give Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default OutOfAttemptsModal;
