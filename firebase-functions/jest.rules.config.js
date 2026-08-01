const base = require("./jest.config.js");

module.exports = {
  ...base,
  testMatch: ["**/__tests__/raceRules.it.test.ts", "**/__tests__/raceService.it.test.ts"],
};
