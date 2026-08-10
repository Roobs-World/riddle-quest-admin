import {readFile} from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [viteConfig, portalPackage, portalJest, coreJest, functionsJest, functionsPackage, openAIService, raceSchemas] =
  await Promise.all([
    read("packages/portal/vite.config.ts"),
    read("packages/portal/package.json"),
    read("packages/portal/jest.config.cjs"),
    read("packages/core/jest.config.js"),
    read("firebase-functions/jest.config.js"),
    read("firebase-functions/package.json"),
    read("firebase-functions/src/riddles/openaiService.ts"),
    read("packages/core/src/race/raceSchemas.ts"),
  ]);

const failures = [];
const requireText = (source, expected, message) => {
  if (!source.includes(expected)) failures.push(message);
};

requireText(viteConfig, "reactCompilerPreset", "React Compiler must remain enabled through Vite's official preset.");
requireText(viteConfig, "tsconfigPaths: true", "Vite 8 native tsconfig path resolution must remain enabled.");
requireText(viteConfig, "forwardConsole", "Vite 8 browser console forwarding must remain enabled for development.");
requireText(
  viteConfig,
  'devtools: command === "serve"',
  "Vite 8 integrated development tools must remain enabled for development without affecting production builds.",
);
requireText(portalPackage, '"babel-plugin-react-compiler"', "The stable React Compiler must remain pinned.");

for (const [name, config] of [
  ["portal", portalJest],
  ["core", coreJest],
  ["functions", functionsJest],
]) {
  requireText(config, 'globalsCleanup: "on"', `Jest 30 globals cleanup must remain enabled for ${name}.`);
}

requireText(openAIService, "openai.responses.parse", "OpenAI generation must use the current Responses API.");
requireText(openAIService, "store: false", "OpenAI Responses must explicitly disable response storage.");
requireText(openAIService, "prompt_cache_key", "OpenAI requests must retain stable prompt cache keys.");
if (openAIService.includes("chat.completions")) failures.push("Legacy Chat Completions usage must not return.");
if (raceSchemas.includes(".superRefine(")) failures.push("Deprecated Zod superRefine usage must not return.");

const functionsManifest = JSON.parse(functionsPackage);
if (functionsManifest.engines?.node !== "22") {
  failures.push("Firebase Functions must use the newest runtime currently supported by Firebase (Node 22).");
}

if (failures.length > 0) {
  console.error("Modern package feature audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Modern package feature audit passed.");
}
