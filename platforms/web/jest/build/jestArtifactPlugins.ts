import type {Plugin} from "vite";

/** Compacts nonsemantic shader spacing in Jest bundles while retaining lines and continuations. */
export function jestShaderIndentationPlugin(): Plugin {
  return {
    name: "riddle-quest-jest-shader-indentation",
    apply: "build",
    enforce: "pre",
    /** Shader templates retain their tokens, comments and diagnostic line numbers. */
    transform(source, id) {
      if (!/[\\/]three[\\/]src[\\/]renderers[\\/]shaders[\\/].*\.glsl\.js$/.test(id)) return null;
      return {
        code: source.replace(/(\/\* glsl \*\/`)((?:\\[\s\S]|[^\\`])*)(`)/g,
          (original: string, opening: string, shader: string, closing: string) => {
            if (shader.includes("${")) return original;
            /** Block-comment state protects shader commentary across source lines. */
            let blockComment = false;
            /** Continuation lines retain the whitespace separating their preprocessed tokens. */
            const lines = shader.split("\n");
            /** Only horizontal spacing inside parentheses changes on ordinary code lines. */
            const compacted = lines.map((line, index) => {
              /** Preprocessor directives and continued lines retain their complete interior spacing. */
              const protectedLine = /^[\t ]*#/.test(line) || index > 0 && /\\[\t ]*\r?$/.test(lines[index - 1]);
              /** Line comments stop spacing changes until the next source line. */
              let lineComment = false;
              /** Leading indentation may be removed unless a prior line continues into this one. */
              const indented = index > 0 && /\\[\t ]*\r?$/.test(lines[index - 1]) ? line : line.replace(/^[\t ]+/, "");
              return indented.replace(/\/\*|\*\/|\/\/|\([\t ]+|[\t ]+\)/g, (token: string) => {
                if (blockComment) {
                  if (token === "*/") blockComment = false;
                  return token;
                }
                if (lineComment) return token;
                if (token === "/*") {blockComment = true; return token;}
                if (token === "//") {lineComment = true; return token;}
                return protectedLine ? token : token.trim();
              });
            }).join("\n");
            return opening + compacted + closing;
          }),
        map: null,
      };
    },
  };
}

/** Omits known unused product metadata from Jest's Firebase app SDK. */
export function jestFirebaseScriptPolicyPlugin(): Plugin {
  /** Firebase's shared policy also serves products that this target never loads. */
  const analyticsScript = "https://www.googletagmanager.com/gtag/js";
  return {
    name: "riddle-quest-jest-firebase-script-policy",
    apply: "build",
    enforce: "pre",
    /** Narrow only the reviewed policy declaration; changed vendor shapes fail the build. */
    transform(source, id) {
      /** Package-qualified paths keep application code and other Firebase products untouched. */
      const filename = id.split("?", 1)[0];
      if (!/[\\/]node_modules[\\/]@firebase[\\/]app[\\/]dist[\\/].+\.[cm]?js$/u.test(filename) ||
        !source.includes(analyticsScript) && !source.includes("@firebase/crashlytics")) return null;
      /** Keep every app, Auth and App Check operation while excluding unsupported products. */
      let code = source;
      if (code.includes(analyticsScript)) {
        /** The current SDK declares Analytics first, followed by Auth and App Check URLs. */
        const declaration = /const ALLOWED_SCRIPT_URLS = \[\s*(['"])https:\/\/www\.googletagmanager\.com\/gtag\/js\1\s*,\s*/u;
        if (!declaration.test(code)) throw new Error("Jest Firebase script policy source changed.");
        code = code.replace(declaration, "const ALLOWED_SCRIPT_URLS = [");
        if (code.includes(analyticsScript)) throw new Error("Jest Firebase script policy contains an unexpected Analytics URL.");
      }
      if (code.includes("@firebase/crashlytics")) {
        /** The version-log entry is metadata, not a supported Crashlytics service. */
        const declaration = /const ([\w$]+) = (['"])@firebase\/crashlytics\2;/u.exec(code);
        /** Only the known platform-version map may reference this product identifier. */
        const registration = /const PLATFORM_LOG_STRING = \{[\s\S]*?\n\};/u.exec(code)?.[0];
        if (!declaration || !registration) throw new Error("Jest Firebase product metadata source changed.");
        /** Generated identifiers may contain dollars but no other regular-expression syntax. */
        const identifier = declaration[1].replaceAll("$", "\\$");
        /** Remove only the exact Crashlytics platform-log mapping. */
        const entry = new RegExp(`\\[${identifier}\\]\\s*:\\s*(['"])fire-cls\\1\\s*,\\s*`, "u");
        if (!entry.test(registration)) throw new Error("Jest Firebase product metadata registration changed.");
        code = code.replace(registration, registration.replace(entry, "")).replace(declaration[0], "");
        if (code.includes("@firebase/crashlytics") || new RegExp(`\\b${identifier}(?![\\w$])`, "u").test(code))
          throw new Error("Jest Firebase product metadata contains an unexpected Crashlytics reference.");
      }
      return {code, map: null};
    },
  };
}
