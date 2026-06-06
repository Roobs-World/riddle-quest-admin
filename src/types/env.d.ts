import originalConstants from "expo-constants";

declare module "expo-constants" {
  // Define the interface for the 'extra' object
  interface AppConfigExtra {
    OPENAI_API_KEY?: string;
    FIREBASE_API_KEY?: string;
    FIREBASE_APP_ID?: string;
    FIREBASE_AUTH_DOMAIN?: string;
    FIREBASE_PROJECT_ID?: string;
    FIREBASE_STORAGE_BUCKET?: string;
    FACEBOOK_APP_ID?: string;
    FACEBOOK_APP_SECRET?: string;
    FACEBOOK_CLIENT_TOKEN?: string;
    GOOGLE_SERVICE_ACCOUNT?: string;
    // Add other environment variables here as needed
  }

  // Define the interface for the 'expoConfig' object
  export interface ExpoConfig {
    extra?: AppConfigExtra;
    // Add other properties of expoConfig here if they exist and you need to type them
  }

  // Augment the type of the default export from 'expo-constants'
  // This tells TypeScript that the 'Constants' object has an 'expoConfig' property.
  export default interface OverriddenConstants extends originalConstants {
    expoConfig?: ExpoConfig | null; // expoConfig can be null or undefined
  }
}

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";
    OPENAI_API_KEY?: string;
    FIREBASE_PROJECT_ID?: string;
    FIREBASE_API_KEY?: string;
    FIREBASE_AUTH_DOMAIN?: string;
    FIREBASE_STORAGE_BUCKET?: string;
    FIREBASE_APP_ID?: string;
    APPLE_SHARED_SECRET?: string;
    GOOGLE_SERVICE_ACCOUNT?: string;
    FACEBOOK_APP_ID?: string;
    FACEBOOK_APP_SECRET?: string;
    FACEBOOK_CLIENT_TOKEN?: string;
  }
}
