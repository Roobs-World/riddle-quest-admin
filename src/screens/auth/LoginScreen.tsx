import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";
import BackIcon from "../../components/icons/BackIcon";
import PasswordVisibilityIcon from "../../components/icons/PasswordVisibilityIcon";

const LoginScreen = ({ navigation }: { navigation: any }) => {
  const [email, setEmail] = useState("JaneDoe@gmail.com");
  const [password, setPassword] = useState("************");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-cream-light p-6">
      <StatusBar barStyle="dark-content" backgroundColor="#FAF3E0" />

      <TouchableOpacity
        onPress={() => navigation.goBack()}
        className="mb-8 self-start"
      >
        <BackIcon />
      </TouchableOpacity>

      <Text className="text-3xl font-bold text-gray-800 mb-8">Log in</Text>

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
      <View className="flex-row items-center bg-white border border-gray-300 rounded-lg mb-2 overflow-hidden">
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
      <TouchableOpacity className="self-end mb-8">
        <Text className="text-sm text-primary-orange font-medium">
          Forgot password?
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="bg-primary-orange w-full py-4 rounded-lg shadow-md mb-8"
        onPress={() => console.log("Log in pressed")} // Replace with actual login logic
      >
        <Text className="text-white text-lg font-semibold text-center">
          Log In
        </Text>
      </TouchableOpacity>

      <View className="flex-row items-center justify-center">
        <Text className="text-sm text-gray-600">Don't have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
          <Text className="text-sm text-red-500 font-semibold">
            Register Now
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default LoginScreen;
