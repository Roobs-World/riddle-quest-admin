import * as Font from "expo-font";

export const loadFonts = async () => {
  console.log("Attempting to load fonts...");
  await Font.loadAsync({
    PoetsenOne: require("@fonts/PoetsenOne-Regular.ttf"),
    Poppins: require("@fonts/Poppins-Regular.ttf"),
    PoppinsBold: require("@fonts/Poppins-Bold.ttf"),
  });
  console.log("Fonts loaded successfully!");
};
