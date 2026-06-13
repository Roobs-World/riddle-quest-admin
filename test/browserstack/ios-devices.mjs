const defaultDevices = [
  {
    deviceName: "iPhone 15",
    osVersion: "17",
  },
  {
    deviceName: "iPad Pro 12.9 2022",
    osVersion: "16",
  },
];

export const getIosDevices = () => {
  const configuredDevices = process.env.BROWSERSTACK_IOS_DEVICES;
  if (!configuredDevices) {
    return defaultDevices;
  }

  const devices = JSON.parse(configuredDevices);
  if (!Array.isArray(devices) || devices.length === 0) {
    throw new Error("BROWSERSTACK_IOS_DEVICES must be a non-empty JSON array.");
  }

  return devices.map((device, index) => {
    if (!device?.deviceName || !device?.osVersion) {
      throw new Error(`BROWSERSTACK_IOS_DEVICES[${index}] requires deviceName and osVersion.`);
    }

    return {
      deviceName: String(device.deviceName),
      osVersion: String(device.osVersion),
    };
  });
};

export const toCapabilities = (devices) =>
  devices.map(({deviceName, osVersion}) => ({
    platformName: "ios",
    "appium:deviceName": deviceName,
    "appium:platformVersion": osVersion,
    "appium:automationName": "XCUITest",
    "appium:autoAcceptAlerts": true,
    "bstack:options": {
      deviceName,
      osVersion,
      projectName: "Qwordly",
      buildName: process.env.BROWSERSTACK_BUILD_NAME || `ios-smoke-${new Date().toISOString().slice(0, 10)}`,
      sessionName: "iOS landing smoke",
      debug: true,
      networkLogs: true,
    },
  }));
