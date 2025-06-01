// Manual mock for @react-native-firebase/auth

const mockAuthInstance = {
  currentUser: null,
  onAuthStateChanged: jest.fn((callback) => {
    // Simulate no user initially
    setTimeout(() => callback(null), 0);
    return jest.fn(); // Return unsubscribe function
  }),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  signInWithCredential: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  __setMockUser: jest.fn((user) => {
    mockAuthInstance.currentUser = user;
  }),
  __clearMockUser: jest.fn(() => {
    mockAuthInstance.currentUser = null;
  }),
};

// The auth function always returns the same instance
const auth = jest.fn(() => mockAuthInstance);

// Export as default
export default auth;

// Export additional auth providers
export const GoogleAuthProvider = {
  credential: jest.fn((idToken) => ({
    type: "google.com",
    token: idToken,
    providerId: "google.com",
  })),
};

export const FacebookAuthProvider = {
  credential: jest.fn((accessToken) => ({
    type: "facebook.com",
    token: accessToken,
    providerId: "facebook.com",
  })),
};
