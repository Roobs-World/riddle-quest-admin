declare module "react-native-applovin-max" {
  // Add a basic type for AppLovinMAXType to suppress property errors
  export interface AppLovinMAXType {
    [key: string]: any; // Allows any properties, effectively making it like 'any'
  }

  // Declare the AppLovinMAX namespace/object to suppress namespace errors
  export const AppLovinMAX: AppLovinMAXType & {
    // Add specific known static methods or properties if needed for better (but still manual) typing
    // For now, keeping it simple to just suppress the "does not exist" and namespace errors.
    initialize: (sdkKey: string) => Promise<any>;
    // ... other static methods used in your hooks ...

    // Also declare sub-modules or objects if they are used like AppLovinMAX.InterstitialAd
    // This is a simplified approach. For full typing, one would need to replicate the actual SDK structure.
  };

  // Declare other specific types/interfaces that are imported and causing errors
  // e.g., AdInfo, RewardedAd, AdLoadFailedInfo, etc.
  // For simplicity now, we'll use 'any' for these to see if it resolves the TS errors.
  export interface AdInfo {
    adUnitId?: string;
    creativeId?: string;
    networkName?: string;
    placement?: string;
    revenue?: number;
    [key: string]: any; // For any other properties
  }

  export interface AdLoadFailedInfo {
    adUnitId?: string;
    code?: number;
    message?: string;
    [key: string]: any; // For any other properties
  }

  export interface AdDisplayFailedInfo {
    adUnitId?: string;
    code?: number;
    message?: string;
    [key: string]: any; // For any other properties
  }

  export interface AdRewardInfo {
    adUnitId?: string;
    amount?: number;
    label?: string;
    [key: string]: any; // For any other properties
  }

  export interface InterstitialAdListener {
    onAdLoaded?: (adInfo: AdInfo) => void;
    onAdLoadFailed?: (errorInfo: AdLoadFailedInfo) => void;
    onAdDisplayed?: (adInfo: AdInfo) => void;
    onAdDisplayFailed?: (
      adInfo: AdInfo,
      errorInfo: AdDisplayFailedInfo
    ) => void;
    onAdHidden?: (adInfo: AdInfo) => void;
    onAdClicked?: (adInfo: AdInfo) => void;
  }

  // If InterstitialAd is used as a static class/object (e.g., InterstitialAd.loadAd())
  export const InterstitialAd: {
    [key: string]: any;
  };
  // If BannerAd is used similarly
  export const BannerAd: {
    [key: string]: any;
  };

  // For imports like: import { AdInfo, RewardedAd, Configuration } from 'react-native-applovin-max';
  export type Configuration = any; // Added for App.tsx

  // For usage like RewardedAd.loadAd()
  export const RewardedAd: {
    [key: string]: any; // Allows any static methods like loadAd, addAdLoadedEventListener, etc.
  };

  // Default export for: import AppLovinMAX from 'react-native-applovin-max'
  // This might conflict if AppLovinMAX is also a named export. Let's assume one primary way.
  // The hooks seem to use: import AppLovinMAX, { RewardedAd } from 'react-native-applovin-max';
  // This means AppLovinMAX is the default export, and RewardedAd etc. are named exports.
  // So the `export const AppLovinMAX` above is for the named export if used like { AppLovinMAX }.
  // If used as `import applovin from ...` then the default export is used.

  // Default export should be the main SDK object, often also available as a named export.
  const mainSdkObject: AppLovinMAXType & {
    initialize: (sdkKey: string) => Promise<any>;
    // Potentially other top-level functions if the default import is used that way
  };
  export default mainSdkObject;
}
