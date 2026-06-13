import {getIosDevices, toCapabilities} from "./ios-devices.mjs";

const devices = getIosDevices();
const capabilities = toCapabilities(devices);

if (capabilities.some((capability) => capability.platformName !== "ios")) {
  throw new Error("Every BrowserStack capability must target iOS.");
}

console.log(`BrowserStack iOS config is valid for ${devices.length} devices:`);
devices.forEach(({deviceName, osVersion}) => console.log(`- ${deviceName} (iOS ${osVersion})`));
