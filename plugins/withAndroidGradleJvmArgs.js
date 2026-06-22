const {withGradleProperties} = require("expo/config-plugins");

const GRADLE_JVMARGS_KEY = "org.gradle.jvmargs";
const GRADLE_JVMARGS_VALUE = "-Xmx4096m -XX:MaxMetaspaceSize=512m";

const withAndroidGradleJvmArgs = (config) => {
  return withGradleProperties(config, (gradleConfig) => {
    const existingProperty = gradleConfig.modResults.find(
      (item) => item.type === "property" && item.key === GRADLE_JVMARGS_KEY,
    );

    if (existingProperty) {
      existingProperty.value = GRADLE_JVMARGS_VALUE;
    } else {
      gradleConfig.modResults.push({
        type: "property",
        key: GRADLE_JVMARGS_KEY,
        value: GRADLE_JVMARGS_VALUE,
      });
    }

    return gradleConfig;
  });
};

module.exports = withAndroidGradleJvmArgs;
