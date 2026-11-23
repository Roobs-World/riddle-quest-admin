const path = require('node:path');

/** Suite definitions share one root configuration and dependency installation. */
const suites = {
  "core": {
    "testEnvironment": "node",
    "testEnvironmentOptions": {
      "globalsCleanup": "on"
    },
    "roots": [
      "<rootDir>/src/core"
    ],
    "testMatch": [
      "**/__tests__/**/*.(test|spec).(ts|tsx)",
      "**/*.(test|spec).(ts|tsx)"
    ],
    "transform": {
      "^.+\\.tsx?$": [
        "ts-jest",
        {
          "tsconfig": "<rootDir>/tsconfig.json"
        }
      ]
    },
    "moduleFileExtensions": [
      "ts",
      "tsx",
      "js",
      "json"
    ],
    "collectCoverageFrom": [
      "src/core/**/*.{ts,tsx}",
      "!src/core/**/*.d.ts",
      "!src/core/**/__tests__/**",
      "!src/core/**/*.{test,spec}.{ts,tsx}"
    ],
    "coverageDirectory": "coverage/core",
    "coverageReporters": [
      "text",
      "text-summary",
      "json-summary"
    ],
    "coverageThreshold": {
      "global": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      }
    },
    "rootDir": ".",
    "displayName": "core"
  },
  "solo": {
    "testEnvironment": "node",
    "testEnvironmentOptions": {
      "globalsCleanup": "on"
    },
    "roots": [
      "<rootDir>/src/solo"
    ],
    "testMatch": [
      "**/__tests__/**/*.(test|spec).(ts|tsx)",
      "**/*.(test|spec).(ts|tsx)"
    ],
    "transform": {
      "^.+\\.tsx?$": [
        "ts-jest",
        {
          "tsconfig": "<rootDir>/tsconfig.json"
        }
      ]
    },
    "moduleNameMapper": {},
    "moduleFileExtensions": [
      "ts",
      "tsx",
      "js",
      "json"
    ],
    "collectCoverageFrom": [
      "src/solo/**/*.{ts,tsx}",
      "!src/solo/**/*.d.ts",
      "!src/solo/**/__tests__/**",
      "!src/solo/**/*.{test,spec}.{ts,tsx}"
    ],
    "coverageDirectory": "coverage/solo",
    "coverageReporters": [
      "text",
      "text-summary",
      "json-summary"
    ],
    "rootDir": ".",
    "displayName": "solo"
  },
  "hosted": {
    "testEnvironment": "node",
    "testEnvironmentOptions": {
      "globalsCleanup": "on"
    },
    "roots": [
      "<rootDir>/src/hosted"
    ],
    "testMatch": [
      "**/__tests__/**/*.(test|spec).(ts|tsx)",
      "**/*.(test|spec).(ts|tsx)"
    ],
    "transform": {
      "^.+\\.tsx?$": [
        "ts-jest",
        {
          "tsconfig": "<rootDir>/tsconfig.json"
        }
      ]
    },
    "moduleNameMapper": {},
    "moduleFileExtensions": [
      "ts",
      "tsx",
      "js",
      "json"
    ],
    "collectCoverageFrom": [
      "src/hosted/**/*.{ts,tsx}",
      "!src/hosted/**/*.d.ts",
      "!src/hosted/**/__tests__/**",
      "!src/hosted/**/*.{test,spec}.{ts,tsx}"
    ],
    "coverageDirectory": "coverage/hosted",
    "coverageReporters": [
      "text",
      "text-summary",
      "json-summary"
    ],
    "rootDir": ".",
    "displayName": "hosted"
  },
  "web": {
    "rootDir": ".",
    "testEnvironment": "node",
    "testEnvironmentOptions": {
      "globalsCleanup": "on"
    },
    "roots": [
      "<rootDir>/src/web",
      "<rootDir>/src/hosted/race",
      "<rootDir>/platforms/web/jest/src",
      "<rootDir>/platforms/web/facebook/src",
      "<rootDir>/platforms/web/reddit/src",
      "<rootDir>/platforms/web/youtube/src",
      "<rootDir>/platforms/web/netflix/src",
      "<rootDir>/platforms/web/yahoo/src",
      "<rootDir>/platforms/web/gamesnacks/src"
    ],
    "testPathIgnorePatterns": [
      "/node_modules/",
      "/platforms/web/reddit/src/server/"
    ],
    "testMatch": [
      "**/__tests__/**/*.(test|spec).(ts|tsx)"
    ],
    "transform": {
      "^.+\\.tsx?$": [
        "ts-jest",
        {
          "tsconfig": "<rootDir>/tsconfig.json"
        }
      ]
    },
    "moduleNameMapper": {
      "^(?:\\.\\./)+(?:src/web/)?platform/webTargetEnvironment$": "<rootDir>/src/web/test/webTargetEnvironmentMock.ts",
      "^#youtube-content$": "<rootDir>/firebase-functions/content/youtube-fixtures/youtube-content-fixture-v1.json",
      "^\\./localeModules$": "<rootDir>/src/web/test/localeModulesMock.ts",
      "^(?:\\.\\./)+(?:src/web/)?firebaseEnvironment$|^\\./firebaseEnvironment$": "<rootDir>/src/web/test/firebaseEnvironmentMock.ts",
      "\\.(css|less|scss)$": "<rootDir>/src/web/test/styleMock.cjs",
      "\\.(svg|png|jpg|jpeg|webp|webm|ogg|mp3|wav)$": "<rootDir>/src/web/test/fileMock.cjs"
    },
    "moduleFileExtensions": [
      "ts",
      "tsx",
      "js",
      "jsx",
      "json"
    ],
    "collectCoverageFrom": [
      "src/web/**/*.{ts,tsx}",
      "platforms/web/jest/src/**/*.{ts,tsx}",
      "platforms/web/facebook/src/**/*.{ts,tsx}",
      "platforms/web/reddit/src/**/*.{ts,tsx}",
      "platforms/web/youtube/src/**/*.{ts,tsx}",
      "platforms/web/netflix/src/**/*.{ts,tsx}",
      "platforms/web/yahoo/src/**/*.{ts,tsx}",
      "platforms/web/gamesnacks/src/**/*.{ts,tsx}",
      "!platforms/web/*/src/server/**",
      "!platforms/web/*/src/**/*.d.ts",
      "!platforms/web/*/src/**/__tests__/**",
      "!platforms/web/*/src/**/*.{test,spec}.{ts,tsx}",
      "src/hosted/race/**/*.ts",
      "src/hosted/profileMapper.ts",
      "src/hosted/play/requestIds.ts",
      "!src/web/**/*.d.ts",
      "!src/web/**/__tests__/**",
      "!src/web/**/*.{test,spec}.{ts,tsx}",
      "!src/web/**/*.jest-playwright.test.ts",
      "!src/web/test/**"
    ],
    "coverageDirectory": "coverage/web",
    "coverageReporters": [
      "text",
      "text-summary",
      "json-summary"
    ],
    "coverageThreshold": {
      "global": {
        "statements": 36,
        "branches": 36,
        "functions": 32,
        "lines": 37
      },
      "<rootDir>/src/web/developmentFirstRun.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/src/web/testHarness.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/src/web/analytics/events.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/src/web/play/localBridge.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/src/hosted/profileMapper.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/src/hosted/play/requestIds.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/src/web/play/guidance/guidanceConfig.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/src/web/FatalErrorBoundary.tsx": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/src/web/play/avatarImage.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/platforms/web/jest/src/JestSdkPlatform.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/platforms/web/jest/src/MockJestPlatform.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/platforms/web/jest/src/entryIntent.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/platforms/web/jest/src/milestone.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/platforms/web/jest/src/sharing/screenshots.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/platforms/web/jest/src/notifications/copy.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/platforms/web/jest/src/notifications/engagement.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/platforms/web/jest/src/notifications/useJestNotifications.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/platforms/web/jest/src/purchases.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/platforms/web/jest/src/useJestProductCatalog.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/platforms/web/jest/src/useJestPurchase.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/platforms/web/jest/src/startup.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/src/web/play/game/layoutReady.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/src/web/play/performance/mobileCapabilities.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/src/web/play/achievements.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/src/web/play/race/components/RaceQuitDialog.tsx": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/src/hosted/race/logic/raceAnalytics.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/src/web/play/race/logic/raceFeatureFlag.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/src/hosted/race/logic/racePresentation.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/src/hosted/race/RacePlay.ts": {
        "statements": 90,
        "branches": 80,
        "functions": 90,
        "lines": 90
      },
      "<rootDir>/src/web/play/race/hooks/useRaceDialogFocus.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      },
      "<rootDir>/src/web/play/race/hooks/useRaceGameplayFit.ts": {
        "statements": 100,
        "branches": 100,
        "functions": 100,
        "lines": 100
      }
    },
    "displayName": "web"
  }
};

for (const catalog of [
  '<rootDir>/platforms/web/facebook/src/commerce/facebookCatalog.ts',
  '<rootDir>/platforms/web/reddit/src/shared/redditCatalog.ts',
]) {
  suites.web.coverageThreshold[catalog] = {statements:100,branches:100,functions:100,lines:100};
}

const selectionIndex = process.argv.indexOf('--selectProjects');
const selectionArgument = process.argv.find(argument => argument.startsWith('--selectProjects='));
const selectedGroup = process.env.RIDDLE_QUEST_JEST_GROUP ||
  (selectionIndex >= 0 ? process.argv[selectionIndex + 1] : selectionArgument?.slice('--selectProjects='.length)) || 'web';
if (!Object.hasOwn(suites, selectedGroup)) throw new Error('Unknown shared test group: ' + selectedGroup);
const config = {...suites[selectedGroup]};
if (config.coverageThreshold) {
  config.coverageThreshold = Object.fromEntries(Object.entries(config.coverageThreshold).map(([file, threshold]) => [
    file.startsWith('<rootDir>/') ? path.resolve(__dirname, file.slice('<rootDir>/'.length)) : file, threshold,
  ]));
}
if (process.env.RIDDLE_QUEST_JEST_RACE_COVERAGE === '1') {
  if (!['core','web'].includes(selectedGroup)) throw new Error('Race coverage requires core or web');
  config.collectCoverage = true;
  config.coverageDirectory = 'coverage/' + selectedGroup + '/race';
  config.coverageReporters = ['text-summary','json-summary','lcov'];
  config.collectCoverageFrom = selectedGroup === 'core'
    ? ['src/core/race/**/*.ts','!src/core/race/**/__tests__/**']
    : ['src/web/play/race/**/*.{ts,tsx}','src/hosted/race/**/*.ts','!src/web/play/race/**/__tests__/**','!src/web/play/race/RaceTo10Game.tsx','!src/web/play/race/hooks/**','!src/web/play/race/components/NativeAnswerInput.tsx','!src/web/play/race/components/PlatformPlayerOverlay.tsx'];
  config.coverageThreshold = {global: selectedGroup === 'core'
    ? {statements:95,branches:95,functions:70,lines:95}
    : {statements:85,branches:70,functions:85,lines:90}};
}
module.exports = config;
