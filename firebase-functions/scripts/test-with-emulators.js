#!/usr/bin/env node

const {spawn, exec} = require("child_process");
const net = require("net");

// Configuration
const FIRESTORE_PORT = 8099;
const AUTH_PORT = 9099;
const MAX_WAIT_TIME = 60000; // 60 seconds
const CHECK_INTERVAL = 2000; // 2 seconds

let emulatorProcess = null;

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(1000);

    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.on("error", () => {
      resolve(false);
    });

    socket.connect(port, "127.0.0.1");
  });
}

async function waitForEmulators() {
  log("🔍 Waiting for emulators to be ready...", colors.yellow);

  const startTime = Date.now();

  while (Date.now() - startTime < MAX_WAIT_TIME) {
    const firestoreReady = await checkPort(FIRESTORE_PORT);
    const authReady = await checkPort(AUTH_PORT);

    if (firestoreReady && authReady) {
      log("✅ Emulators are ready!", colors.green);
      return true;
    }

    log(
      `⏳ Checking emulators... Firestore: ${firestoreReady ? "✅" : "❌"}, Auth: ${authReady ? "✅" : "❌"}`,
      colors.cyan,
    );
    await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL));
  }

  log("❌ Timeout waiting for emulators to start", colors.red);
  return false;
}

function startEmulators() {
  return new Promise((resolve, reject) => {
    log("🚀 Starting Firebase emulators...", colors.blue);

    // Kill any existing emulator processes
    exec('pkill -f "firebase.*emulators"', () => {
      // Start emulators
      emulatorProcess = spawn(
        "firebase",
        [
          "emulators:start",
          "--only",
          "firestore,auth",
          "--import=./.emulator-data",
          "--export-on-exit=./.emulator-data",
        ],
        {
          stdio: ["pipe", "pipe", "pipe"],
          cwd: process.cwd(),
        },
      );

      emulatorProcess.stdout.on("data", (data) => {
        const output = data.toString();
        if (output.includes("All emulators ready")) {
          resolve();
        }
        // Only show important output
        if (output.includes("emulators started") || output.includes("ready") || output.includes("running")) {
          log(`📡 ${output.trim()}`, colors.cyan);
        }
      });

      emulatorProcess.stderr.on("data", (data) => {
        const error = data.toString();
        // Only show actual errors, not warnings
        if (error.includes("Error") || error.includes("Failed")) {
          log(`⚠️ ${error.trim()}`, colors.yellow);
        }
      });

      emulatorProcess.on("close", (code) => {
        if (code !== 0 && code !== null) {
          reject(new Error(`Emulators exited with code ${code}`));
        }
      });

      // Give emulators time to start
      setTimeout(resolve, 5000);
    });
  });
}

function runTests() {
  return new Promise((resolve, reject) => {
    log("🧪 Running integration tests...", colors.magenta);

    const testProcess = spawn("pnpm", ["run", "test:integration"], {
      stdio: "inherit",
      env: {
        ...process.env,
        FIRESTORE_EMULATOR_HOST: "127.0.0.1:8099",
      },
      cwd: process.cwd(),
    });

    testProcess.on("close", (code) => {
      if (code === 0) {
        log("✅ Integration tests completed successfully!", colors.green);
        resolve();
      } else {
        log(`❌ Integration tests failed with code ${code}`, colors.red);
        reject(new Error(`Tests failed with code ${code}`));
      }
    });
  });
}

function runUnitTests() {
  return new Promise((resolve, reject) => {
    log("🧪 Running unit tests...", colors.magenta);

    const testProcess = spawn("pnpm", ["run", "test:unit"], {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    testProcess.on("close", (code) => {
      if (code === 0) {
        log("✅ Unit tests completed successfully!", colors.green);
        resolve();
      } else {
        log(`❌ Unit tests failed with code ${code}`, colors.red);
        reject(new Error(`Unit tests failed with code ${code}`));
      }
    });
  });
}

function stopEmulators() {
  if (emulatorProcess) {
    log("🛑 Stopping emulators...", colors.yellow);
    emulatorProcess.kill("SIGTERM");

    // Force kill if it doesn't stop gracefully
    setTimeout(() => {
      if (emulatorProcess && !emulatorProcess.killed) {
        emulatorProcess.kill("SIGKILL");
      }
    }, 5000);
  }

  // Also kill any leftover processes
  exec('pkill -f "firebase.*emulators"', () => {
    log("🏁 Emulators stopped", colors.green);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const runIntegrationTests = !args.includes("--unit-only");
  const runOnlyIntegration = args.includes("--integration-only");

  try {
    log("🎯 Starting automated test suite...", colors.bright);

    if (!runOnlyIntegration) {
      // Run unit tests first (no emulators needed)
      await runUnitTests();
    }

    if (runIntegrationTests) {
      // Start emulators for integration tests
      await startEmulators();
      await waitForEmulators();

      const emulatorsReady = await waitForEmulators();
      if (!emulatorsReady) {
        throw new Error("Emulators failed to start within timeout");
      }

      // Run integration tests
      await runTests();
    }

    log("🎉 All tests completed successfully!", colors.green);
    process.exit(0);
  } catch (error) {
    log(`💥 Test suite failed: ${error.message}`, colors.red);
    process.exit(1);
  } finally {
    stopEmulators();
  }
}

// Handle process termination
process.on("SIGINT", () => {
  log("\n🛑 Received SIGINT, stopping emulators...", colors.yellow);
  stopEmulators();
  process.exit(0);
});

process.on("SIGTERM", () => {
  log("\n🛑 Received SIGTERM, stopping emulators...", colors.yellow);
  stopEmulators();
  process.exit(0);
});

// Start the test suite
main();
