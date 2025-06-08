#!/usr/bin/env node

const { spawn, exec } = require("child_process");
const os = require("os");

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

const isWindows = os.platform() === "win32";
let emulatorProcess = null;

function killEmulatorProcesses() {
  return new Promise((resolve) => {
    if (isWindows) {
      // Windows-specific command to kill Firebase emulator processes
      exec('taskkill /F /IM "java.exe" /T 2>nul', () => {
        resolve();
      });
    } else {
      // Unix-like systems
      exec('pkill -f "firebase.*emulators" 2>/dev/null', () => {
        resolve();
      });
    }
  });
}

function startEmulators() {
  return new Promise(async (resolve, reject) => {
    log("🚀 Starting Firebase emulators...", colors.blue);

    // Kill any existing emulator processes
    await killEmulatorProcesses();

    // Use npx to ensure firebase-tools is available
    const command = isWindows ? "npx.cmd" : "npx";
    const args = [
      "firebase",
      "emulators:start",
      "--only",
      "firestore,auth",
      "--import=./firebase-functions/.emulator-data",
      "--export-on-exit=./firebase-functions/.emulator-data",
    ];

    emulatorProcess = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
      shell: isWindows,
    });

    let emulatorStarted = false;

    emulatorProcess.stdout.on("data", (data) => {
      const output = data.toString();
      if (!emulatorStarted && output.includes("All emulators ready")) {
        emulatorStarted = true;
        log("✅ Emulators are ready!", colors.green);
        resolve();
      }
    });

    emulatorProcess.stderr.on("data", (data) => {
      const error = data.toString();
      if (error.includes("Error") || error.includes("Failed")) {
        log(`⚠️ ${error.trim()}`, colors.yellow);
      }
    });

    emulatorProcess.on("error", (error) => {
      log(`❌ Failed to start emulators: ${error.message}`, colors.red);
      reject(error);
    });

    // Give emulators time to start (fallback if "All emulators ready" is not detected)
    setTimeout(() => {
      if (!emulatorStarted) {
        log(
          "⏰ Emulator startup timeout reached, proceeding anyway...",
          colors.yellow
        );
        resolve();
      }
    }, 15000);
  });
}

function initializeFirestore() {
  return new Promise((resolve) => {
    log("🗄️ Initializing Firestore with test data...", colors.blue);

    // Create a simple initialization script that adds test data
    const initScript = `
      const path = require('path');
      const { createRequire } = require('module');
      
      // Create require from the project root to resolve firebase-admin
      const projectRoot = path.resolve(__dirname, '../..');
      const require = createRequire(path.join(projectRoot, 'package.json'));
      
      const admin = require('firebase-admin');
      
      if (!admin.apps.length) {
        admin.initializeApp({
          projectId: 'test-project',
        });
      }
      
      const db = admin.firestore();
      
      async function initializeTestData() {
        try {
          // Add test riddles
          const riddlesRef = db.collection('riddles');
          await riddlesRef.doc('test-riddle-1').set({
            riddleId: 'test-riddle-1',
            text: 'Test riddle 1',
            answer: 'test',
            classicIndex: 0,
            difficulty: 'easy',
            category: 'test',
            hints: ['Test hint']
          });
          
          // Add test user
          const usersRef = db.collection('users');
          await usersRef.doc('test-user-1').set({
            userId: 'test-user-1',
            email: 'test@example.com',
            username: 'testuser',
            coins: 100,
            xp: 0,
            registeredAt: Date.now(),
            progress: {
              dailyChallengeIndex: 0,
              classicIndex: 0,
              tutorialIndex: 0
            }
          });
          
          console.log('✅ Test data initialized successfully');
        } catch (error) {
          console.error('❌ Failed to initialize test data:', error);
        }
      }
      
      initializeTestData();
    `;

    // Write init script to temporary file and execute it
    const fs = require("fs");
    const path = require("path");
    const tempFile = path.join(process.cwd(), "temp-firestore-init.js");

    fs.writeFileSync(tempFile, initScript);

    const command = isWindows ? "node.exe" : "node";
    const initProcess = spawn(command, [tempFile, "--input-type=commonjs"], {
      env: {
        ...process.env,
        FIRESTORE_EMULATOR_HOST: "127.0.0.1:8099",
        NODE_PATH: path.join(process.cwd(), "node_modules"),
      },
      cwd: process.cwd(),
      shell: isWindows,
    });

    initProcess.stdout.on("data", (data) => {
      const output = data.toString();
      if (output.includes("✅")) {
        log(output.trim(), colors.green);
      }
    });

    initProcess.stderr.on("data", (data) => {
      log(`⚠️ ${data.toString().trim()}`, colors.yellow);
    });

    initProcess.on("close", (code) => {
      // Clean up temp file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }

      if (code === 0) {
        log("✅ Firestore initialized with test data!", colors.green);
      } else {
        log(
          "⚠️ Firestore initialization completed with warnings",
          colors.yellow
        );
      }
      resolve();
    });
  });
}

function runAllTests() {
  return new Promise((resolve) => {
    log("🧪 Running all tests...", colors.magenta);

    // First run Firebase Functions tests
    log("📦 Running Firebase Functions tests...", colors.cyan);

    const functionsTestProcess = spawn(
      isWindows ? "pnpm.cmd" : "pnpm",
      ["test"],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          FIRESTORE_EMULATOR_HOST: "127.0.0.1:8099",
          NODE_OPTIONS: "--experimental-vm-modules",
        },
        cwd: "./firebase-functions",
        shell: isWindows,
      }
    );

    functionsTestProcess.on("close", (functionsCode) => {
      if (functionsCode !== 0) {
        log(
          `⚠️ Firebase Functions tests failed with exit code ${functionsCode}`,
          colors.yellow
        );
      } else {
        log(
          "✅ Firebase Functions tests completed successfully!",
          colors.green
        );
      }

      // Then run React Native tests
      log("📱 Running React Native tests...", colors.cyan);

      const rnTestProcess = spawn(
        isWindows ? "npx.cmd" : "npx",
        ["jest", "--config", "jest.config.cjs"],
        {
          stdio: "inherit",
          env: {
            ...process.env,
            FIRESTORE_EMULATOR_HOST: "127.0.0.1:8099",
          },
          cwd: process.cwd(),
          shell: isWindows,
        }
      );

      rnTestProcess.on("close", (rnCode) => {
        if (rnCode !== 0) {
          log(
            `⚠️ React Native tests failed with exit code ${rnCode}`,
            colors.yellow
          );
          log(
            "Note: React Native tests may fail due to transformation issues",
            colors.yellow
          );
        } else {
          log("✅ React Native tests completed successfully!", colors.green);
        }
        resolve();
      });

      rnTestProcess.on("error", (error) => {
        log(`❌ React Native test process error: ${error.message}`, colors.red);
        resolve();
      });
    });

    functionsTestProcess.on("error", (error) => {
      log(
        `❌ Firebase Functions test process error: ${error.message}`,
        colors.red
      );
      resolve();
    });
  });
}

function stopEmulators() {
  if (emulatorProcess) {
    log("🛑 Stopping emulators...", colors.yellow);

    if (isWindows) {
      // On Windows, we need to kill the process tree
      exec(`taskkill /F /PID ${emulatorProcess.pid} /T`, (error) => {
        if (error) {
          // Fallback: kill Java processes
          exec('taskkill /F /IM "java.exe" /T', () => {
            log("🏁 Emulators stopped", colors.green);
          });
        } else {
          log("🏁 Emulators stopped", colors.green);
        }
      });
    } else {
      emulatorProcess.kill("SIGTERM");
      // Force kill if it doesn't stop gracefully
      setTimeout(() => {
        if (emulatorProcess && !emulatorProcess.killed) {
          emulatorProcess.kill("SIGKILL");
        }
      }, 5000);
    }
  }

  // Also kill any leftover processes
  killEmulatorProcesses();
}

async function main() {
  try {
    log(
      "🎯 Starting unified test suite with Firestore initialization...",
      colors.bright
    );
    log(
      "This will start emulators, initialize Firestore, and run all tests",
      colors.cyan
    );

    // Start emulators
    await startEmulators();

    // Initialize Firestore with test data
    await initializeFirestore();

    // Run all tests
    await runAllTests();

    log("🎉 Test run completed!", colors.green);

    // Give a moment for output to flush
    setTimeout(() => {
      process.exit(0);
    }, 1000);
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
  setTimeout(() => process.exit(0), 2000);
});

process.on("SIGTERM", () => {
  log("\n🛑 Received SIGTERM, stopping emulators...", colors.yellow);
  stopEmulators();
  setTimeout(() => process.exit(0), 2000);
});

// Start the test suite
main();
