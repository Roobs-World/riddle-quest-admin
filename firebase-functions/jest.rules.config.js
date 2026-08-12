const base = require("./jest.config.js");

module.exports = {
  ...base,
  testMatch: [
    "**/__tests__/race/raceRules.it.test.ts",
    "**/__tests__/race/raceService.it.test.ts",
    "**/__tests__/storageRules.it.test.ts",
    "**/__tests__/usernameRules.it.test.ts",
  ],
};
