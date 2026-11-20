/* eslint-env node */
const base = require("./jest.config.js");
/** Subscription concurrency uses a dedicated local demo project. */
module.exports = {...base, testMatch: ["**/__tests__/androidSubscriptionRegistry.it.test.ts"]};
