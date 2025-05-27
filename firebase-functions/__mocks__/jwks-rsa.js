// Mock for jwks-rsa library to avoid ES module issues in Jest
module.exports = function () {
  return {
    getSigningKey: function () {
      return {};
    },
    getSigningKeys: function () {
      return [];
    },
  };
};
