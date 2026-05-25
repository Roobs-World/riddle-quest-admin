// Mock for react-native-fbsdk-next
export const ShareDialog = {
  canShow: jest.fn(() => Promise.resolve(true)),
  show: jest.fn(() => Promise.resolve({isCancelled: false})),
};

export const AccessToken = {
  getCurrentAccessToken: jest.fn(() => Promise.resolve(null)),
};

export const LoginManager = {
  logInWithPermissions: jest.fn(() => Promise.resolve({isCancelled: false, grantedPermissions: []})),
  logOut: jest.fn(),
};

export const GraphRequest = jest.fn(() => ({
  start: jest.fn(),
}));

export const GraphRequestManager = jest.fn(() => ({
  addRequest: jest.fn(),
  start: jest.fn(),
}));

export default {
  ShareDialog,
  AccessToken,
  LoginManager,
  GraphRequest,
  GraphRequestManager,
};
