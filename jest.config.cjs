const path = require("node:path");
const fs = require("node:fs");
const layout = require("./config/source-layout.json");

/** Match source ownership and test discovery from the same feature patterns. */
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const absolute = value => path.resolve(__dirname, value);
const discoveryPattern = source => {
  if (source.endsWith("/**")) return escape(absolute(source.slice(0, -3))) + "[/\\\\].*\\.(?:test|spec)\\.tsx?$";
  return /\.(?:test|spec)\.tsx?$/.test(source) ? escape(absolute(source)) + "$" : null;
};
const coveragePattern = source => source.endsWith("/**")
  ? source.slice(0, -3) + "/**/*.{ts,tsx}"
  : /\.tsx?$/.test(source) ? source : null;
const platformRoots = fs.readdirSync(path.join(__dirname, "platforms/web"))
  .map(target => "platforms/web/" + target + "/src")
  .filter(directory => fs.existsSync(absolute(directory)));
const selectionIndex = process.argv.indexOf("--selectProjects");
const selectionArgument = process.argv.find(argument => argument.startsWith("--selectProjects="));
const selectedGroup = process.env.RIDDLE_QUEST_JEST_GROUP ||
  (selectionIndex >= 0 ? process.argv[selectionIndex + 1] : selectionArgument?.slice("--selectProjects=".length)) || "interface";
if (!Object.hasOwn(layout.groups, selectedGroup)) throw new Error("Unknown test responsibility: " + selectedGroup);
const group = layout.groups[selectedGroup];
const sourcePatterns = group.sources.concat(group.includePlatforms ? platformRoots.map(root => root + "/**") : []);
const excludedTests = Object.entries(layout.groups)
  .filter(([name]) => name !== selectedGroup)
  .flatMap(([, definition]) => definition.sources.map(discoveryPattern).filter(Boolean));
const config = {
  rootDir: ".",
  displayName: selectedGroup,
  testEnvironment: "node",
  testEnvironmentOptions: {globalsCleanup: "on"},
  roots: ["<rootDir>/src", ...platformRoots.map(root => "<rootDir>/" + root)],
  testRegex: sourcePatterns.map(discoveryPattern).filter(Boolean),
  testPathIgnorePatterns: ["/node_modules/", "/platforms/web/reddit/src/server/", ...excludedTests],
  transform: {"^.+\\.tsx?$": ["ts-jest", {tsconfig: "<rootDir>/tsconfig.json"}]},
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  collectCoverageFrom: sourcePatterns.concat(group.coverageExtras || []).map(coveragePattern).filter(Boolean)
    .concat(["!src/**/*.d.ts", "!src/**/__tests__/**", "!src/**/*.{test,spec}.{ts,tsx}",
      "!platforms/web/*/src/server/**", "!platforms/web/*/src/**/*.d.ts", "!platforms/web/*/src/**/__tests__/**", "!platforms/web/*/src/**/*.{test,spec}.{ts,tsx}"])
    .concat((group.coverageExcludes || []).map(coveragePattern).filter(Boolean).map(source => "!" + source)),
  coverageDirectory: "coverage/" + selectedGroup,
  coverageReporters: ["text", "text-summary", "json-summary"],
};
if (layout.coverage[selectedGroup]) {
  config.coverageThreshold = Object.fromEntries(Object.entries(layout.coverage[selectedGroup])
    .map(([file, threshold]) => [file === "global" ? file : absolute(file), threshold]));
}
if (group.mocks) config.moduleNameMapper = group.mocks;
if (process.env.RIDDLE_QUEST_JEST_RACE_COVERAGE === "1") {
  const race = layout.raceCoverage[selectedGroup];
  if (!race) throw new Error("Race coverage requires rules or interface");
  config.collectCoverage = true;
  config.coverageDirectory += "/race";
  config.coverageReporters = ["text-summary", "json-summary", "lcov"];
  config.collectCoverageFrom = race.sources.map(coveragePattern).filter(Boolean)
    .concat(["!src/**/__tests__/**", "!src/**/*.{test,spec}.{ts,tsx}"])
    .concat((race.exclude || []).map(coveragePattern).filter(Boolean).map(source => "!" + source));
  config.coverageThreshold = {global: race.threshold};
}
module.exports = config;
