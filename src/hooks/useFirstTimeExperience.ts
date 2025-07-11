import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useModal } from "./useModal";

export const useFirstTimeExperience = () => {
  const modal = useModal();

  useEffect(() => {
    const checkIfFirstTimeUser = async () => {
      try {
        const hasSeenWelcome = await AsyncStorage.getItem("hasSeenWelcome");
        if (hasSeenWelcome === null) {
          modal.showWelcomeModal();
          await AsyncStorage.setItem("hasSeenWelcome", "true");
        } else {
          const hasSeenInstructions = await AsyncStorage.getItem(
            "hasSeenInstructions"
          );
          if (hasSeenInstructions === null) {
            modal.showInstructionsModal();
            await AsyncStorage.setItem("hasSeenInstructions", "true");
          }
        }
      } catch (error) {
        console.error(
          "Error checking AsyncStorage for first time user:",
          error
        );
      }
    };

    checkIfFirstTimeUser();
  }, [modal]);
};
