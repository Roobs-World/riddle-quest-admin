/* eslint-env node */
const base = require("./jest.config.js");
/** Permanent referral replay fixtures use a dedicated demo project. */
module.exports = {...base, testMatch: ["**/__tests__/androidReferrals.it.test.ts"]};
