const NORMALIZED_LINE_WIDTH = 80;
const TS_LIKE_EXTENSIONS = new Set([".js", ".mjs", ".ts", ".tsx"]);

/** Removes standalone TSDoc blocks without discarding code beside a closing delimiter. */
const removeStandaloneTsdoc = (contents) => {
  const implementation = [];
  let insideTsdoc = false;

  for (const line of contents.split("\n")) {
    const trimmed = line.trimStart();
    if (!insideTsdoc && !trimmed.startsWith("/**")) {
      implementation.push(line);
      continue;
    }

    const delimiterOffset = insideTsdoc ? 0 : line.indexOf("/**") + 3;
    const end = line.indexOf("*/", delimiterOffset);
    if (end === -1) {
      insideTsdoc = true;
      continue;
    }

    insideTsdoc = false;
    const remainder = line.slice(end + 2);
    if (remainder.trim() !== "") implementation.push(remainder);
  }

  return implementation.join("\n");
};

/** Measures source volume independently of formatting and standalone TSDoc. */
export const measureSourceSize = (contents, extension) => {
  if (contents === "") return 0;
  if (!TS_LIKE_EXTENSIONS.has(extension)) return contents.split("\n").length;

  const implementation = removeStandaloneTsdoc(contents);
  const normalizedCharacters = implementation.replace(/\s+/g, "").length;
  return normalizedCharacters === 0 ? 0 : Math.ceil(normalizedCharacters / NORMALIZED_LINE_WIDTH);
};
