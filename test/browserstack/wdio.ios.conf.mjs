import {config as loadEnv} from "dotenv";
import {getIosDevices, toCapabilities} from "./ios-devices.mjs";

loadEnv({path: ".env.browserstack.local", quiet: true});

const app = process.env.BROWSERSTACK_APP;
const username = process.env.BROWSERSTACK_USERNAME;
const accessKey = process.env.BROWSERSTACK_ACCESS_KEY;

if (!app) {
  throw new Error("Set BROWSERSTACK_APP to a local .ipa path, public .ipa URL, custom ID, or bs:// app URL.");
}

if (!username || !accessKey) {
  throw new Error("Set BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY before running the iOS matrix.");
}

export const config = {
  user: username,
  key: accessKey,
  hostname: "hub.browserstack.com",
  runner: "local",
  specs: ["./ios/**/*.spec.mjs"],
  maxInstances: Number(process.env.BROWSERSTACK_MAX_INSTANCES || 2),
  capabilities: toCapabilities(getIosDevices()),
  logLevel: "info",
  framework: "mocha",
  reporters: ["spec"],
  services: [
    [
      "browserstack",
      {
        app,
      },
    ],
  ],
  connectionRetryTimeout: 180000,
  connectionRetryCount: 2,
  waitforTimeout: 30000,
  mochaOpts: {
    timeout: 120000,
  },
};
