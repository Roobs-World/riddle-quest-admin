import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from "react-native";
import ProgressBar from "../../components/shared/ProgressBar";
import BackIcon from "../../components/icons/BackIcon";
import PasswordVisibilityIcon from "../../components/icons/PasswordVisibilityIcon";
import CheckboxIcon from "../../components/icons/CheckboxIcon";

const SignUpScreen = ({ navigation }: { navigation: any }) => {
  const [username, setUsername] = useState("Jane Doe");
  const [email, setEmail] = useState("janDoe@gmail.com");
  const [password, setPassword] = useState("************");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  return (
    <SafeAreaView className="flex-1 bg-cream-light">
      <StatusBar barStyle="dark-content" backgroundColor="#FAF3E0" />
      <ScrollView contentContainerClassName="p-6 grow">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mb-6 self-start"
        >
          <BackIcon />
        </TouchableOpacity>

        <ProgressBar activeStep={1} totalSteps={3} />

        <Text className="text-3xl font-bold text-gray-800 mb-8">
          Create your account
        </Text>

        <Text className="text-sm text-gray-600 mb-1">Username</Text>
        <TextInput
          className="bg-white border border-gray-300 text-gray-700 p-3 rounded-lg mb-4 text-base"
          value={username}
          onChangeText={setUsername}
          placeholder="Enter your username"
        />

        <Text className="text-sm text-gray-600 mb-1">Email</Text>
        <TextInput
          className="bg-white border border-gray-300 text-gray-700 p-3 rounded-lg mb-4 text-base"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="Enter your email"
        />

        <Text className="text-sm text-gray-600 mb-1">Password</Text>
        <View className="flex-row items-center bg-white border border-gray-300 rounded-lg mb-1 overflow-hidden">
          <TextInput
            className="flex-1 text-gray-700 p-3 text-base"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!isPasswordVisible}
            placeholder="Enter your password"
          />
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            className="p-3"
          >
            <PasswordVisibilityIcon visible={isPasswordVisible} />
          </TouchableOpacity>
        </View>
        {/* "Looks Good" validation message - logic to be added */}
        <Text className="text-xs text-green-600 ml-1 mb-4">Looks Good ✓</Text>

        <TouchableOpacity
          className="flex-row items-center mb-6"
          onPress={() => setAgreedToTerms(!agreedToTerms)}
        >
          <CheckboxIcon checked={agreedToTerms} />
          <Text className="text-sm text-gray-600 flex-1">
            I agree to the{" "}
            <Text className="text-primary-orange font-semibold">
              user agreement
            </Text>{" "}
            and{" "}
            <Text className="text-primary-orange font-semibold">
              privacy policy
            </Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-primary-orange w-full py-4 rounded-lg shadow-md mb-8"
          onPress={() => console.log("Next pressed")} // Replace with actual sign-up logic
          disabled={!agreedToTerms}
        >
          <Text
            className={`text-lg font-semibold text-center ${
              agreedToTerms ? "text-white" : "text-gray-300"
            }`}
          >
            Next
          </Text>
        </TouchableOpacity>

        <View className="flex-row items-center justify-center">
          <Text className="text-sm text-gray-600">
            Do you have an account?{" "}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Login")}>
            <Text className="text-sm text-red-500 font-semibold">
              Log in now
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Ensure primary-orange and cream-light are defined in your tailwind.config.js
// e.g., primary-orange: '#FDBA74', cream-light: '#FAF3E0'

export default SignUpScreen;
