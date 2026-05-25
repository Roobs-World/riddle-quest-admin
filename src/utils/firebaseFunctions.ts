import {getFunctions, httpsCallable} from "@react-native-firebase/functions";
import {getApp} from "@react-native-firebase/app";

/**
 * Get Firebase Functions instance configured for the correct region.
 * All our functions are deployed to us-central1.
 */
export const getFirebaseFunctions = () => {
  return getFunctions(getApp(), "us-central1");
};

/**
 * Create an https callable function with the correct region configuration.
 * @param functionName - The name of the Firebase Function to call
 * @returns A callable function instance
 */
export const getCallableFunction = (functionName: string) => {
  const functions = getFirebaseFunctions();
  const callable = httpsCallable(functions, functionName);

  // Note: Timeout handling for riddle generation functions is configured
  // server-side in Firebase Functions (540 seconds = 9 minutes)
  // Client-side timeout will be handled by the calling code with appropriate retry logic

  return callable;
};
