import assert from "node:assert/strict";
import {readFile, readdir} from "node:fs/promises";
import {createRequire} from "node:module";
import path from "node:path";
import test from "node:test";
import {createWebTargetViteConfig} from "../../../../scripts/web/build/webTargetViteConfig.ts";

/** Real target configuration supplies the transform exercised by these checks. */
const config = createWebTargetViteConfig({command: "build", mode: "jest", environment: process.env});
/** The production plugin is deliberately absent from all other targets. */
const plugin = config.plugins.find(candidate => candidate?.name === "riddle-quest-jest-shader-indentation");
assert.equal(typeof plugin?.transform, "function");

/** Imports each template as JavaScript so assertions observe the actual GLSL string. */
async function shaderModule(source) {
  return import(`data:text/javascript,${encodeURIComponent(source)}`);
}

/** Comments and spacing cannot conceal a changed GLSL identifier, number or operator. */
function tokens(shader) {
  return shader.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, "")
    .match(/[A-Za-z_]\w*|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[^\s]/g) ?? [];
}

/** Finds the installed Three shader modules without relying on a particular package-manager layout. */
async function shaderFiles(directory) {
  /** All canonical templates must preserve the same observable program. */
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    /** Installed module path also exercises the plugin's production scope. */
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await shaderFiles(file));
    else if (file.endsWith(".glsl.js")) files.push(file);
  }
  return files;
}

for (const lineEnding of ["\n", "\r\n"]) {
test(`Jest compaction preserves comments, lines and ${lineEnding === "\n" ? "LF" : "CRLF"} macro continuation separation`, async () => {
  /** The continued macro requires its following line to retain separating whitespace. */
  const source = "export default /* glsl */`\n    // shader comment\n    precision highp float;\n    #define COLOR vec3(0.5) \\\\\n        + vec3(0.1)\n    void main() {\n        gl_FragColor = vec4(COLOR, 1.0);\n    }\n`;".replaceAll("\n", lineEnding);
  /** The genuine transform runs before the ordinary Vite minifier. */
  const result = plugin.transform(source, "/node_modules/three/src/renderers/shaders/ShaderChunk/fixture.glsl.js");
  /** Executed GLSL exposes whitespace semantics independently of the transform implementation. */
  const before = (await shaderModule(source)).default;
  /** Expected body keeps the continued macro and source line positions intact. */
  const after = (await shaderModule(result.code)).default;
  assert.equal(after, "\n// shader comment\nprecision highp float;\n#define COLOR vec3(0.5) \\\n        + vec3(0.1)\nvoid main() {\ngl_FragColor = vec4(COLOR, 1.0);\n}\n");
  assert.deepEqual(tokens(after), tokens(before));
  assert.equal(after.split("\n").length, before.split("\n").length);
  assert.match(result.code, /\/\* glsl \*\//);
});
}

test("every installed Three shader keeps its token stream and diagnostic line count", async () => {
  /** Resolving from this script uses the portal's installed Three version. */
  const require = createRequire(import.meta.url);
  /** Three's CommonJS entry lives beside its canonical shader source directory. */
  const files = await shaderFiles(path.resolve(path.dirname(require.resolve("three")), "../src/renderers/shaders"));
  assert.ok(files.length > 0);
  for (const file of files) {
    /** The original source is never modified by this check. */
    const source = await readFile(file, "utf8");
    /** The configured build transform selects only the vendor shader template. */
    const result = plugin.transform(source, file);
    /** Imported values model the strings WebGL receives. */
    const before = await shaderModule(source);
    /** Compaction may change indentation but no shader program token or diagnostic line. */
    const after = await shaderModule(result.code);
    assert.deepEqual(Object.keys(after), Object.keys(before), file);
    for (const [name, shader] of Object.entries(before)) {
      assert.equal(typeof shader, "string", `${file}:${name}`);
      assert.deepEqual(tokens(after[name]), tokens(shader), `${file}:${name}`);
      assert.equal(after[name].split("\n").length, shader.split("\n").length, `${file}:${name}`);
    }
  }
});

test("only shader template code changes while comments and object/function macro forms remain intact", async () => {
  /** Ordinary module text and preprocessor spacing must survive shader-only compaction. */
  const source = 'export const note = " ( ordinary JS string ) ";\n// ( JS comment )\nexport default /* glsl */`\n    #define OBJECT ( 0.5 )\n    #define FUNC(v) ( v )\n    /* shader comment ( unchanged ) */\n    void main() {\n        gl_FragColor = vec4( FUNC( OBJECT ) );\n    }\n`;';
  /** The module uses the exact vendor-template marker consumed in production. */
  const result = plugin.transform(source, "/node_modules/three/src/renderers/shaders/ShaderChunk/fixture.glsl.js");
  /** Executed module exports distinguish ordinary JavaScript strings from shader content. */
  const after = await shaderModule(result.code);
  assert.equal(after.note, " ( ordinary JS string ) ");
  assert.match(result.code, /\/\/ \( JS comment \)/);
  assert.match(after.default, /#define OBJECT \( 0\.5 \)/);
  assert.match(after.default, /#define FUNC\(v\) \( v \)/);
  assert.match(after.default, /\/\* shader comment \( unchanged \) \*\//);
  assert.match(after.default, /gl_FragColor = vec4\(FUNC\(OBJECT\)\);/);
  assert.deepEqual(tokens(after.default), tokens((await shaderModule(source)).default));
});

test("other JavaScript and other targets retain their existing build behavior", () => {
  assert.equal(plugin.transform("export const value = 1;", "/src/play/gameSession.ts"), null);
  assert.equal(plugin.transform("export default `  body`;", "/node_modules/another-library/shader.glsl.js"), null);
  for (const mode of ["facebook", "reddit", "youtube", "netflix", "yahoo", "gamesnacks"]) {
    /** Selecting another target must not introduce a new vendor transform. */
    const target = createWebTargetViteConfig({command: "build", mode, environment: process.env});
    assert.equal(target.plugins.some(candidate => candidate?.name === "riddle-quest-jest-shader-indentation"), false, mode);
  }
  assert.equal(plugin.apply, "build");
});
