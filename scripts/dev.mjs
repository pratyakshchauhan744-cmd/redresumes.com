import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadEnv } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendEnv = loadEnv('development', root, '');
const backendEnv = loadEnv('development', path.join(root, 'backend'), '');
const backendPort = backendEnv.PORT || '4000';
const apiUrl = frontendEnv.VITE_API_BASE_URL || `http://localhost:${backendPort}`;
const localApi = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(apiUrl).hostname);
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { /* Already exited. */ }
    }
  }
  process.exitCode = code;
}
function start(command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: 'inherit', detached: true });
  children.push(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code || 1); });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

if (localApi) {
  let running = false;
  try {
    const response = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(1500) });
    running = response.ok && (await response.json()).service === 'redresumes-backend';
  } catch { /* Start the local API below. */ }
  if (running) console.log(`Using running RedResumes API at ${apiUrl}`);
  else start('npm', ['run', 'dev'], path.join(root, 'backend'));
}
start(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--port=3000', '--host=0.0.0.0', ...process.argv.slice(2)], root);
