const path = require("node:path");
const rootDir = path.resolve(__dirname, "../../../firebase-functions");
module.exports = {
  ...require(path.join(rootDir, "jest.config.js")),
  rootDir,
  testMatch: ["**/__tests__/race/**/*.test.ts"],
  collectCoverage: false,
};
