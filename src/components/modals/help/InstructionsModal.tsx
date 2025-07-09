import React from "react";
import { View, Text, Modal, ScrollView } from "react-native";
import CloseButton from "../../buttons/CloseButton";
import HomeBgSvg from "../../../../assets/images/home-bg.svg";
import { styles } from "../../../styles";
import WideButton from "../../buttons/WideButton";

interface InstructionsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const InstructionsModal: React.FC<InstructionsModalProps> = ({
  isVisible,
  onClose,
}) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View
          style={{
            backgroundColor: "#FCFAF4",
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
            height: "100%",
            paddingTop: 40,
            flex: 1,
          }}
        >
          <HomeBgSvg
            width="120%"
            height="100%"
            style={styles.backgroundImage}
          />

          {/* Drag Handle */}
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              backgroundColor: "#D1D5DB",
              borderRadius: 2,
              marginBottom: 20,
            }}
          />

          <View
            style={{ position: "absolute", top: 50, right: 20, zIndex: 10 }}
          >
            <CloseButton onPress={onClose} size={20} />
          </View>

          <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
            <Text
              className="text-2xl font-bold text-gray-800 text-center mb-4"
              style={styles.creditsTitle}
            >
              How to Play
            </Text>

            <Text
              className="text-lg text-gray-600 text-center mb-8"
              style={styles.creditsSubtitle}
            >
              Learn the rules and start your word guessing adventure
            </Text>
          </View>

          <View style={{ flex: 1, paddingBottom: 80 }}>
            <ScrollView
              className="flex-1 w-full"
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              <View className="mx-4">
                <View
                  className="bg-white/90 rounded-lg p-6 mb-4 shadow-sm"
                  style={styles.teamMemberCard}
                >
                  <Text
                    className="text-xl font-bold text-gray-800 text-center mb-2"
                    style={styles.memberName}
                  >
                    The Goal
                  </Text>
                  <Text
                    className="text-base text-gray-600 text-center"
                    style={styles.memberRole}
                  >
                    Guess the hidden riddle in 3 tries using the color clues to
                    guide you.
                  </Text>
                </View>

                <View
                  className="bg-white/90 rounded-lg p-6 mb-4 shadow-sm"
                  style={styles.teamMemberCard}
                >
                  <Text
                    className="text-xl font-bold text-gray-800 text-center mb-4"
                    style={styles.memberName}
                  >
                    Color Clues
                  </Text>
                  <View style={{ gap: 16 }}>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          backgroundColor: "#22c55e", // green-500
                          borderRadius: 4,
                          marginRight: 12,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 16,
                            color: "#6B7280",
                            fontWeight: "400",
                          }}
                        >
                          Letter is correct and in the right position
                        </Text>
                      </View>
                    </View>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          backgroundColor: "#eab308", // yellow-500
                          borderRadius: 4,
                          marginRight: 12,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 16,
                            color: "#6B7280",
                            fontWeight: "400",
                          }}
                        >
                          Letter is in the word but wrong position
                        </Text>
                      </View>
                    </View>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          backgroundColor: "#ef4444", // red-500
                          borderRadius: 4,
                          marginRight: 12,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 16,
                            color: "#6B7280",
                            fontWeight: "400",
                          }}
                        >
                          Letter is not in the word at all
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View
                  className="bg-white/90 rounded-lg p-6 mb-4 shadow-sm"
                  style={styles.teamMemberCard}
                >
                  <Text
                    className="text-xl font-bold text-gray-800 text-center mb-2"
                    style={styles.memberName}
                  >
                    Tips for Success
                  </Text>
                  <Text
                    className="text-base text-gray-600 text-center"
                    style={styles.memberRole}
                  >
                    Start with common letters and use the color feedback to
                    narrow down your guesses. Remember, you only have 3
                    attempts!
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>

          <View
            style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}
          >
            <WideButton buttonText="Got It!" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default InstructionsModal;
