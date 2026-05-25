const ANDROID_TEST_APP_ID = "ca-app-pub-3940256099942544~3347511713";
const IOS_TEST_APP_ID = "ca-app-pub-3940256099942544~1458002511";
const ENV_KEYS = [
  "GOOGLE_MOBILE_ADS_ANDROID_APP_ID",
  "GOOGLE_MOBILE_ADS_IOS_APP_ID",
  "ADMOB_ANDROID_APP_ID",
  "ADMOB_IOS_APP_ID",
];

const originalEnv = {...process.env};

const readGoogleMobileAdsPluginConfig = () => {
  jest.resetModules();
  const appConfig = require("../../../app.config.js");
  const plugin = appConfig.plugins.find(
    (entry) =>
      Array.isArray(entry) && entry[0] === "react-native-google-mobile-ads"
  );

  return plugin[1];
};

describe("app.config Google Mobile Ads IDs", () => {
  beforeEach(() => {
    process.env = {...originalEnv};
    ENV_KEYS.forEach((key) => {
      delete process.env[key];
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses documented Google Mobile Ads environment variables", () => {
    process.env.GOOGLE_MOBILE_ADS_ANDROID_APP_ID = "google-android-id";
    process.env.GOOGLE_MOBILE_ADS_IOS_APP_ID = "google-ios-id";
    process.env.ADMOB_ANDROID_APP_ID = "legacy-android-id";
    process.env.ADMOB_IOS_APP_ID = "legacy-ios-id";

    const pluginConfig = readGoogleMobileAdsPluginConfig();

    expect(pluginConfig.androidAppId).toBe("google-android-id");
    expect(pluginConfig.iosAppId).toBe("google-ios-id");
  });

  it("keeps legacy AdMob variables as a fallback", () => {
    process.env.ADMOB_ANDROID_APP_ID = "legacy-android-id";
    process.env.ADMOB_IOS_APP_ID = "legacy-ios-id";

    const pluginConfig = readGoogleMobileAdsPluginConfig();

    expect(pluginConfig.androidAppId).toBe("legacy-android-id");
    expect(pluginConfig.iosAppId).toBe("legacy-ios-id");
  });

  it("defaults to safe Google test app IDs when production IDs are unset", () => {
    const pluginConfig = readGoogleMobileAdsPluginConfig();

    expect(pluginConfig.androidAppId).toBe(ANDROID_TEST_APP_ID);
    expect(pluginConfig.iosAppId).toBe(IOS_TEST_APP_ID);
  });
});
