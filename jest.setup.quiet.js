// Global Jest setup for reducing console noise during test runs

// Suppress specific console outputs that are noisy during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

// Filter out known noisy patterns
const noisyPatterns = [
  /\{"severity":/,
  /beforeEach_/,
  /afterEach_/,
  /User testUserGameLogic/,
  /\[iapConfig/,
  /Firebase Functions tests completed successfully!/,
  /React Native tests completed successfully!/,
  /Stopping emulators/,
  /Emulators stopped/,
  /Test run completed!/,
];

function shouldSuppressMessage(message) {
  return noisyPatterns.some((pattern) => pattern.test(message));
}

// Override console methods to filter noise
console.log = (...args) => {
  const message = args.join(" ");
  if (!shouldSuppressMessage(message)) {
    originalConsoleLog(...args);
  }
};

console.error = (...args) => {
  const message = args.join(" ");
  if (!shouldSuppressMessage(message)) {
    originalConsoleError(...args);
  }
};

console.warn = (...args) => {
  const message = args.join(" ");
  if (!shouldSuppressMessage(message)) {
    originalConsoleWarn(...args);
  }
};

console.info = (...args) => {
  const message = args.join(" ");
  if (!shouldSuppressMessage(message)) {
    originalConsoleInfo(...args);
  }
};

// Store originals globally for test restoration if needed
global.originalConsoleMethods = {
  log: originalConsoleLog,
  error: originalConsoleError,
  warn: originalConsoleWarn,
  info: originalConsoleInfo,
};
