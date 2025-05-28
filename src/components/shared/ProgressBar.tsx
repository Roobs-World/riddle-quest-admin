import React from "react";
import { View } from "react-native";

const ProgressBar = ({
  activeStep,
  totalSteps,
  stepColors,
}: {
  activeStep: number;
  totalSteps: number;
  stepColors?: string[];
}) => (
  <View className="flex-row items-center mx-auto">
    {Array.from({ length: totalSteps }).map((_, index) => (
      <View
        key={index}
        className={`h-2 w-16 rounded-full mx-2 ${
          stepColors && stepColors[index]
            ? stepColors[index]
            : index <= activeStep - 1
            ? "bg-primary-orange"
            : "bg-gray-300"
        }`}
      />
    ))}
  </View>
);

export default ProgressBar;
