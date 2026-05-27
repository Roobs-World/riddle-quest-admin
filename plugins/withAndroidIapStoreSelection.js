const {withAppBuildGradle} = require("expo/config-plugins");

const withAndroidIapStoreSelection = (config) => {
  return withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language === "groovy") {
      var fileContent = gradleConfig.modResults.contents;
      let strategy = "missingDimensionStrategy 'store', 'play'";

      if (fileContent.includes("defaultConfig {")) {
        if (!fileContent.includes(strategy)) {
          fileContent = fileContent.replace(/(defaultConfig\s*{\s*)/, `$1\n        ${strategy}\n`);
        }
      } else if (fileContent.includes("android {")) {
        fileContent = fileContent.replace(
          /android\\s*{/,
          "android {\\n    defaultConfig {\\n        " + strategy + "\\n    }",
        );
      } else {
        fileContent = "\\nandroid {\\n    defaultConfig {\\n        " + strategy + "\\n    }\\n}" + "\\n" + fileContent;
      }
      gradleConfig.modResults.contents = fileContent;
    } else {
      throw new Error("withAndroidIapStoreSelection: Cannot modify an app build.gradle that is not groovy.");
    }
    return gradleConfig;
  });
};

module.exports = withAndroidIapStoreSelection;
