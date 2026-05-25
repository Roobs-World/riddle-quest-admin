const Asset = {
  fromModule: jest.fn(() => ({
    uri: "mock-uri",
    localUri: "mock-local-uri",
    name: "mock-asset",
    type: "png",
    downloadAsync: jest.fn().mockResolvedValue(undefined),
  })),
  loadAsync: jest.fn().mockResolvedValue(undefined),
};

module.exports = {Asset};
