const ANDROID_TEST_APP_ID = "ca-app-pub-3940256099942544~3347511713";
const IOS_TEST_APP_ID = "ca-app-pub-3940256099942544~1458002511";

const loadAppConfig = (envOverrides = {}) => {
  const previousEnv = process.env;
  const baseEnv = {
    NODE_ENV: "test",
    ...envOverrides,
  };

  let appConfig;

  try {
    jest.isolateModules(() => {
      jest.doMock("dotenv", () => ({
        config: jest.fn(),
      }));

      jest.doMock("fs", () => {
        const actualFs = jest.requireActual("fs");

        return {
          ...actualFs,
          readFileSync: jest.fn(() => JSON.stringify({client: []})),
        };
      });

      process.env = baseEnv;
      appConfig = require("../../../app.config.js");
    });
  } finally {
    jest.dontMock("dotenv");
    jest.dontMock("fs");
    process.env = previousEnv;
  }

  return appConfig;
};

const readGoogleMobileAdsPluginConfig = (envOverrides = {}) => {
  const appConfig = loadAppConfig(envOverrides);
  const plugin = appConfig.plugins.find(
    (entry) => Array.isArray(entry) && entry[0] === "react-native-google-mobile-ads",
  );

  return plugin[1];
};

describe("app.config Google Mobile Ads IDs", () => {
  it("uses documented Google Mobile Ads environment variables", () => {
    const pluginConfig = readGoogleMobileAdsPluginConfig({
      GOOGLE_MOBILE_ADS_ANDROID_APP_ID: "google-android-id",
      GOOGLE_MOBILE_ADS_IOS_APP_ID: "google-ios-id",
      ADMOB_ANDROID_APP_ID: "legacy-android-id",
      ADMOB_IOS_APP_ID: "legacy-ios-id",
    });

    expect(pluginConfig.androidAppId).toBe("google-android-id");
    expect(pluginConfig.iosAppId).toBe("google-ios-id");
  });

  it("keeps legacy AdMob variables as a fallback", () => {
    const pluginConfig = readGoogleMobileAdsPluginConfig({
      ADMOB_ANDROID_APP_ID: "legacy-android-id",
      ADMOB_IOS_APP_ID: "legacy-ios-id",
    });

    expect(pluginConfig.androidAppId).toBe("legacy-android-id");
    expect(pluginConfig.iosAppId).toBe("legacy-ios-id");
  });

  it("defaults to safe Google test app IDs when production IDs are unset", () => {
    const pluginConfig = readGoogleMobileAdsPluginConfig();

    expect(pluginConfig.androidAppId).toBe(ANDROID_TEST_APP_ID);
    expect(pluginConfig.iosAppId).toBe(IOS_TEST_APP_ID);
  });
});
