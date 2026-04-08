const AuthorizationStatus = {
  NOT_DETERMINED: -1,
  DENIED: 0,
  AUTHORIZED: 1,
  PROVISIONAL: 2,
};

const messagingInstance = {
  requestPermission: jest.fn(() => Promise.resolve(AuthorizationStatus.AUTHORIZED)),
  hasPermission: jest.fn(() => Promise.resolve(AuthorizationStatus.AUTHORIZED)),
  getToken: jest.fn(() => Promise.resolve("mock-fcm-token")),
  deleteToken: jest.fn(() => Promise.resolve()),
  onMessage: jest.fn(() => jest.fn()),
  onTokenRefresh: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn(() => Promise.resolve(null)),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
};

const messaging = jest.fn(() => messagingInstance);
messaging.AuthorizationStatus = AuthorizationStatus;

// Named modular API exports (v9 style)
const getMessaging = jest.fn(() => messagingInstance);
const requestPermission = jest.fn(() => Promise.resolve(AuthorizationStatus.AUTHORIZED));
const hasPermission = jest.fn(() => Promise.resolve(AuthorizationStatus.AUTHORIZED));
const getToken = jest.fn(() => Promise.resolve("mock-fcm-token"));
const deleteToken = jest.fn(() => Promise.resolve());
const onMessage = jest.fn(() => jest.fn());
const onTokenRefresh = jest.fn(() => jest.fn());
const getInitialNotification = jest.fn(() => Promise.resolve(null));
const onNotificationOpenedApp = jest.fn(() => jest.fn());

module.exports = messaging;
module.exports.default = messaging;
module.exports.getMessaging = getMessaging;
module.exports.requestPermission = requestPermission;
module.exports.hasPermission = hasPermission;
module.exports.getToken = getToken;
module.exports.deleteToken = deleteToken;
module.exports.onMessage = onMessage;
module.exports.onTokenRefresh = onTokenRefresh;
module.exports.getInitialNotification = getInitialNotification;
module.exports.onNotificationOpenedApp = onNotificationOpenedApp;
module.exports.AuthorizationStatus = AuthorizationStatus;
