import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync, mkdirSync, readFileSync, readdirSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const sourcePath = fileURLToPath(new URL("./HierarchyReader.java", import.meta.url));
const repositoryRoot = resolve(dirname(sourcePath), "../../../../..");
let readerPath;

/** Compiles a device-only UiAutomator reader from the installed SDK, never into the game APK. */
export function prepareHierarchyReader() {
  if (readerPath) return readerPath;
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (!sdk) throw new Error("Set ANDROID_HOME to an installed Android SDK before device verification.");
  const newest = (folder, predicate) => readdirSync(folder).filter(predicate).sort((a, b) => b.localeCompare(a, undefined, {numeric: true}))[0];
  const platforms = join(sdk, "platforms"), buildTools = join(sdk, "build-tools");
  const platform = newest(platforms, name => existsSync(join(platforms, name, "uiautomator.jar")) && existsSync(join(platforms, name, "optional/android.test.base.jar")));
  const tools = newest(buildTools, name => existsSync(join(buildTools, name, "d8")));
  if (!platform || !tools) throw new Error("Install an Android SDK platform with UiAutomator and SDK build-tools before device verification.");
  const hash = createHash("sha256").update(readFileSync(sourcePath)).update(platform).update(tools).digest("hex").slice(0, 16);
  const output = join(repositoryRoot, "artifacts/android-device-tools", hash);
  const jar = join(output, "hierarchy-reader.jar");
  if (!existsSync(jar)) {
    mkdirSync(output, {recursive: true});
    const platformDirectory = join(platforms, platform);
    const libraries = ["android.jar", "uiautomator.jar", "optional/android.test.base.jar"].map(name => join(platformDirectory, name));
    const javac = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, "bin/javac") : "javac";
    execFileSync(javac, ["--release", "8", "-classpath", libraries.join(":"), "-d", output, sourcePath], {stdio: "pipe"});
    execFileSync(join(buildTools, tools, "d8"), ["--lib", libraries[0], "--classpath", libraries[1], "--classpath", libraries[2],
      "--min-api", "24", "--output", jar, join(output, "com/riddlequest/verification/HierarchyReader.class")], {stdio: "pipe"});
  }
  readerPath = jar;
  return jar;
}
