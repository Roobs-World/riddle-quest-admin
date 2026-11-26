import {lstat, readFile, readdir} from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const config = JSON.parse(await readFile(path.join(root, "devvit.json"), "utf8"));
const errors = [];
const packageFiles = [];
async function walkPackage(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) {
      errors.push(`${path.relative(root, absolute)} is not a regular package entry`);
    } else if (entry.isDirectory()) await walkPackage(absolute);
    else packageFiles.push(absolute);
  }
}
if (config.$schema !== "https://developers.reddit.com/schema/config-file.v1.json") errors.push("schema URL is not pinned");
if (!/^[a-z][a-z0-9-]{2,19}$/.test(config.name ?? "")) errors.push("app name is invalid");
if (config.post?.entrypoints?.default?.inline !== true) errors.push("default entrypoint must be inline");
if (config.post?.entrypoints?.default?.entry !== "splash.html") errors.push("inline entrypoint must be splash.html");
if (config.post?.entrypoints?.game?.entry !== "game.html") errors.push("expanded entrypoint must be game.html");
if (config.server?.entry !== "index.cjs") errors.push("server entrypoint must be index.cjs");
if (config.post?.dir !== "build/devvit/client" || config.server?.dir !== "build/devvit/server") {
  errors.push("client and server output must remain in this project's build/devvit folder");
}
const required = [
  path.join(config.post?.dir ?? "", "splash.html"),
  path.join(config.post?.dir ?? "", "game.html"),
  path.join(config.server?.dir ?? "", config.server?.entry ?? ""),
  path.join(config.post?.dir ?? "", "third-party-licenses.txt"),
];
for (const relative of required) {
  try {
    const entry = await lstat(path.join(root, relative));
    if (!entry.isFile() || entry.isSymbolicLink()) errors.push(`${relative} is not a regular file`);
  } catch {
    errors.push(`${relative} is missing`);
  }
}
const licenseNotice = await readFile(path.join(root, config.post?.dir ?? "", "third-party-licenses.txt"), "utf8");
for (const dependency of ["@devvit/client@", "@devvit/web@", "devvit@", "hono@"]) {
  if (!licenseNotice.includes(dependency)) errors.push(`third-party notices omit ${dependency}`);
}
const domains = config.permissions?.http?.domains;
if (!Array.isArray(domains) || domains.length !== 1 || domains[0] !== "www.roobsworld.com") {
  errors.push("HTTP permission must contain only the reviewed Roobs World gateway host");
}
if (config.permissions?.redis !== true) errors.push("Redis permission is missing");
if (config.permissions?.payments !== true) errors.push("Payments permission is missing");
if (config.payments?.productsFile !== "products.json" ||
  config.payments?.endpoints?.fulfillOrder !== "/internal/payments/fulfill" ||
  config.payments?.endpoints?.refundOrder !== "/internal/payments/refund") {
  errors.push("payment products/handlers are not exact");
}
const postMenu = config.menu?.items;
if (!Array.isArray(postMenu) || postMenu.length !== 1 ||
  postMenu[0]?.location !== "subreddit" || postMenu[0]?.forUserType !== "moderator" ||
  postMenu[0]?.endpoint !== "/internal/menu/post-create") {
  errors.push("moderator post-creation menu action is not exact");
}
if (config.triggers?.onAppInstall !== "/internal/triggers/app-install" ||
  config.triggers?.onAppUpgrade !== "/internal/triggers/app-upgrade") {
  errors.push("idempotent post-creation lifecycle triggers are not exact");
}
const products = JSON.parse(await readFile(path.join(root, "products.json"), "utf8"));
const expectedProducts = [["riddle_quest_coins_250",50],["riddle_quest_coins_550",100],
  ["riddle_quest_coins_900",150],["riddle_quest_coins_1600",250],
  ["riddle_quest_coins_3400",500],["riddle_quest_coins_7000",1000]];
if (!Array.isArray(products.products) || products.products.length !== expectedProducts.length ||
  expectedProducts.some(([sku, price], index) => products.products[index]?.sku !== sku ||
    products.products[index]?.price !== price || products.products[index]?.accountingType !== "CONSUMABLE")) {
  errors.push("Reddit Gold product catalog is invalid");
}
const serverBundle = await readFile(path.join(root, config.server?.dir ?? "", config.server?.entry ?? ""), "utf8");
for (const functionName of ["exchangeRedditIdentity", "deleteRedditAccount", "redditStorage", "redditGameplay"]) {
  if (!serverBundle.includes(functionName)) errors.push(`server bundle omits fixed Firebase route ${functionName}`);
}
if (!serverBundle.includes("https://www.roobsworld.com/api/reddit-gateway/")) {
  errors.push("server bundle omits the fixed Roobs World gateway URL");
}
if (serverBundle.includes("us-central1-riddle-quest-ec2b2.cloudfunctions.net")) {
  errors.push("server bundle bypasses the Roobs World gateway");
}
for (const route of ["/internal/menu/post-create", "/internal/triggers/app-install",
  "/internal/triggers/app-upgrade", "/internal/payments/fulfill", "/internal/payments/refund"]) {
  if (!serverBundle.includes(route)) errors.push(`server bundle omits ${route}`);
}
if (/require\(["']@(?:devvit|hono)/u.test(serverBundle)) {
  errors.push("server bundle externalizes a dependency unavailable in the Devvit runtime");
}
const gatewaySetting = config.settings?.global?.redditGatewaySecret;
if (gatewaySetting?.type !== "string" || gatewaySetting?.isSecret !== true || "defaultValue" in gatewaySetting) {
  errors.push("global Reddit gateway secret setting is invalid");
}
const environmentSetting = config.settings?.global?.redditEnvironment;
if (environmentSetting?.type !== "string" || environmentSetting?.isSecret === true ||
  "defaultValue" in environmentSetting) {
  errors.push("global Reddit deployment environment setting is invalid");
}
await walkPackage(path.join(root, config.post?.dir ?? ""));
await walkPackage(path.join(root, config.server?.dir ?? ""));
const packageSizes = await Promise.all(packageFiles.map(async (file) => ({file, bytes: (await lstat(file)).size})));
for (const {file, bytes} of packageSizes) {
  if (bytes > 100 * 1024 * 1024) errors.push(`${path.relative(root, file)} exceeds Reddit's documented 100 MiB per-file limit`);
}
if (errors.length) throw new Error(errors.join("\n"));
const packageBytes = packageSizes.reduce((sum, {bytes}) => sum + bytes, 0);
console.log(`Devvit package contract passed: ${packageFiles.length} regular files/${(packageBytes / 1024 / 1024).toFixed(2)} MiB, isolated inline/game client, CJS server, Redis, and one gateway host`);
