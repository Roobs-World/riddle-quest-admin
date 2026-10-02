import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build, loadConfigFromFile} from 'vite';

// Rebuild the same validated release content as a monolithic module for a
// differential startup measurement. Normal target builds restore split packs.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.NODE_ENV = 'production';
for (const target of ['youtube', 'netflix', 'yahoo']) {
  const loaded = await loadConfigFromFile({command:'build', mode:target}, path.join(root,'vite.config.ts'), root);
  if (!loaded) throw new Error('Missing Vite configuration');
  const config = loaded.config;
  config.plugins = config.plugins.filter(plugin => plugin?.name !== 'riddle-quest-playable-content');
  config.resolve.alias['#youtube-content'] = path.join(root,'src/playable/generated/youtube-content-v1.json');
  await build({...config, root, mode:target, configFile:false});
}
