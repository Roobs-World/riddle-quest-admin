import React from "react";
import { View } from "react-native";

const ProgressBar = ({
  activeStep,
  totalSteps,
}: {
  activeStep: number;
  totalSteps: number;
}) => (
  <View className="flex-row w-full justify-around my-4 mb-8 px-10">
    {Array.from({ length: totalSteps }).map((_, index) => (
      <View
        key={index}
        className={`h-1.5 flex-1 ${
          index < activeStep ? "bg-primary-orange" : "bg-gray-300"
        } rounded-full ${index < totalSteps - 1 ? "mr-2" : ""}`}
      />
    ))}
  </View>
);

export default ProgressBar;
