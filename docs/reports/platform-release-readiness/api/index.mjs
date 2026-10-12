import {readFileSync} from 'node:fs';
import {createTaskApi} from '../lib/task-api.mjs';
const register = JSON.parse(readFileSync(new URL('../src/content/task-register.json', import.meta.url), 'utf8'));
export default createTaskApi(register);
