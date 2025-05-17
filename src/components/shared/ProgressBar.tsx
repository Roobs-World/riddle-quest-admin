import React from "react";
import { View } from "react-native";

const ProgressBar = ({
  activeStep,
  totalSteps,
}: {
  activeStep: number;
  totalSteps: number;
}) => (
  <View className="flex-row items-center mx-auto mt-4">
    {Array.from({ length: totalSteps }).map((_, index) => (
      <View
        key={index}
        className={`h-2 w-16 rounded-full mx-2 ${
          index <= activeStep - 1 ? "bg-primary-orange" : "bg-gray-300"
        }`}
      />
    ))}
  </View>
);

export default ProgressBar;
