Use the Expo MCP server for Expo, React Native, EAS, simulator, and React Native DevTools tasks.

Prefer Expo MCP tools over guessing package versions or Expo APIs from memory.

When adding Expo packages, use the Expo-recommended install flow.

When a UI change is requested, verify it in the simulator when local Expo MCP capabilities are available.

When removing something that shows text, verify that the text is not used elsewhere in the codebase. If it isnt, delete it from all the translations that contain that key/value pair. When added text, verify that it exists in the translations else add it for each language.
