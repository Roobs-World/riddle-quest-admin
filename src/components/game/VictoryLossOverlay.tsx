import React from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";
import type { SubmittedGuess, Feedback, GameOutcome } from "../../hooks/types";
import { generateFeedbackEmojiGrid } from "../../utils/gameUtils";
import WideButton from "../buttons/WideButton";

interface VictoryLossOverlayProps {
  isVisible: boolean;
  outcome: GameOutcome;
  attempts: number;
  correctAnswer: string | null;
  coinsEarned: number | null;
  guesses: SubmittedGuess[];
  onNext: () => void;
  onRetry: () => void;
  onHome: () => void;
}

const VictoryLossOverlay: React.FC<VictoryLossOverlayProps> = ({
  isVisible,
  outcome,
  attempts,
  correctAnswer,
  coinsEarned,
  guesses,
  onNext,
  onRetry,
  onHome,
}) => {
  if (!isVisible || !outcome) {
    return null;
  }

  const isWin = outcome === "win";
  const title = isWin ? "Victory!" : "Defeat!";
  const titleColor = isWin ? "text-green-500" : "text-red-500";

  const emojiSummary = generateFeedbackEmojiGrid(guesses);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={() => {}}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-cream-light p-6 rounded-lg w-11/12 max-w-sm items-center">
          <Text className={`text-3xl font-bold mb-4 ${titleColor}`}>
            {title}
          </Text>
          {isWin ? (
            <>
              <Text className="text-lg mb-2 text-gray-800">
                Solved in {attempts} attempts!
              </Text>
              {coinsEarned !== null && coinsEarned > 0 && (
                <Text className="text-lg mb-4 text-gray-800">
                  Coins Earned: {coinsEarned}
                </Text>
              )}
            </>
          ) : (
            <Text className="text-lg mb-4 text-gray-800">
              Correct Answer: {correctAnswer}
            </Text>
          )}

          {/* Emoji Grid Summary */}
          {guesses.length > 0 && (
            <Text className="text-xl font-mono mb-4 text-gray-800">
              {emojiSummary}
            </Text>
          )}

          <WideButton
            buttonText={isWin ? "Next Level" : "Retry"}
            onPress={isWin ? onNext : onRetry}
            className="mb-3"
          />
          <WideButton buttonText="Home" onPress={onHome} />
        </View>
      </View>
    </Modal>
  );
};

export default VictoryLossOverlay;
