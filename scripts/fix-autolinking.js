const fs = require("fs");
const path = require("path");

const autolinkingFile = path.join(
  __dirname,
  "..",
  "android",
  "app",
  "build",
  "generated",
  "autolinking",
  "src",
  "main",
  "java",
  "com",
  "facebook",
  "react",
  "PackageList.java"
);

if (fs.existsSync(autolinkingFile)) {
  let content = fs.readFileSync(autolinkingFile, "utf8");

  // Replace the incorrect import
  content = content.replace(
    "import expo.core.ExpoModulesPackage;",
    "import expo.modules.core.ExpoModulesPackage;"
  );

  fs.writeFileSync(autolinkingFile, content);
  console.log("Fixed autolinking import for ExpoModulesPackage");
} else {
  console.log("Autolinking file not found, skipping fix");
}
