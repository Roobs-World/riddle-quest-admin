const fs = require("node:fs");
const path = require("node:path");

const functionsRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(functionsRoot, "..");
const stagedRoot = path.join(functionsRoot, ".build-source");
const serverRoots = [
  "platforms/native/android/server",
  "platforms/web/jest/server",
  "platforms/web/facebook/server",
  "platforms/web/reddit/server",
  "platforms/web/yahoo/server",
];
const sharedSourceRoots = [
  "src",
  "platforms/web/facebook/src/commerce/facebookCatalog.ts",
  "platforms/web/reddit/src/shared/redditCatalog.ts",
  "platforms/web/jest/src/referrals/referralCampaigns.ts",
];

/** Recreates the repository-relative source graph inside the Functions archive boundary. */
function stagePlatformSource() {
  fs.rmSync(stagedRoot, {recursive: true, force: true});
  fs.mkdirSync(stagedRoot, {recursive: true});
  fs.writeFileSync(path.join(stagedRoot, "package.json"), '{"private":true,"type":"commonjs"}\n');
  for (const sourceRoot of ["firebase-functions/src", ...serverRoots, ...sharedSourceRoots]) {
    const target = path.join(stagedRoot, sourceRoot);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.cpSync(path.join(repositoryRoot, sourceRoot), target, {
      recursive: true,
      filter: (source) => {
        const name = path.basename(source);
        return name !== "node_modules" && name !== "__tests__" && name !== "__mocks__" && name !== "scripts" &&
          !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(name);
      },
    });
  }
  return stagedRoot;
}

module.exports = {stagePlatformSource, serverRoots, sharedSourceRoots};
if (require.main === module) console.log(`Prepared platform source at ${stagePlatformSource()}`);
