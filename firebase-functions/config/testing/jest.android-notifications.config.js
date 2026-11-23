/* eslint-env node */
const base = require("./jest.config.js");
/** Dedicated demo project prevents the notification fixtures from touching another emulator suite's data. */
module.exports = {...base, testMatch: ["**/__tests__/androidNotifications.it.test.ts"]};
