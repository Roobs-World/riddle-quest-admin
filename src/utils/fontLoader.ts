import * as Font from "expo-font";

import PoetsenOne from "../../assets/fonts/PoetsenOne-Regular.ttf";
import Poppins from "../../assets/fonts/Poppins-Regular.ttf";
import PoppinsBold from "../../assets/fonts/Poppins-Bold.ttf";
import PoppinsSemiBold from "../../assets/fonts/Poppins-SemiBold.ttf";
import PoppinsLight from "../../assets/fonts/Poppins-Light.ttf";

export const loadFonts = async () => {
  console.log("Attempting to load fonts...");
  await Font.loadAsync({
    PoetsenOne: PoetsenOne,
    Poppins: Poppins,
    PoppinsBold: PoppinsBold,
    PoppinsSemiBold: PoppinsSemiBold,
    PoppinsLight: PoppinsLight,
  });
  console.log("Fonts loaded successfully!");
};
