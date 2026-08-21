import {cp, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";

const packageRoot = path.resolve(import.meta.dirname, "..");
const portalArtifact = path.resolve(packageRoot, "../portal/dist-reddit");
const clientOutput = path.join(packageRoot, "dist/client");
const redditLicenseNotice = path.join(packageRoot, "third-party-licenses.reddit.txt");

await rm(clientOutput, {recursive: true, force: true});
await cp(portalArtifact, clientOutput, {recursive: true, force: false, errorOnExist: true});
await cp(redditLicenseNotice, path.join(clientOutput, "third-party-licenses.txt"), {force: true});
const gameHtml = await readFile(path.join(clientOutput, "index.html"), "utf8");
const splashHtml = await readFile(path.join(clientOutput, "reddit-inline.html"), "utf8");
await writeFile(path.join(clientOutput, "splash.html"), splashHtml);
await writeFile(path.join(clientOutput, "game.html"), gameHtml);
await rm(path.join(clientOutput, "index.html"));
await rm(path.join(clientOutput, "reddit-inline.html"));
console.log("Staged isolated Reddit client as splash.html and game.html");
