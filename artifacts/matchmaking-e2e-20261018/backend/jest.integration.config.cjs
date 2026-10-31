const path = require("node:path");
const root = path.resolve(__dirname, "../../../firebase-functions");
const base = require(path.join(root, "jest.config.js"));
module.exports = {...base, rootDir: root, testMatch: ["**/__tests__/race/**/*.test.ts"], collectCoverage: false, coverageThreshold: {}};
