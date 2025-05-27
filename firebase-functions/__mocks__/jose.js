// Mock for jose library to avoid ES module issues in Jest
module.exports = {
  compactDecrypt: function () {
    return Promise.resolve({});
  },
  compactVerify: function () {
    return Promise.resolve({});
  },
  jwtVerify: function () {
    return Promise.resolve({});
  },
  createRemoteJWKSet: function () {
    return function () {
      return Promise.resolve({});
    };
  },
};
