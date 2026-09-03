// Builds labs/web3-hero (a separate React/Vite mini-project — see labs/README.md)
// and copies its output into dist/labs/web3-hero/, alongside the static
// public/labs/falcon-ai and public/labs/kresna-footer pages that Vite's main
// build already copied verbatim via publicDir. Run automatically by
// `npm run build` (see package.json) so Netlify's single build command
// picks up all three.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const web3Dir = path.join(rootDir, 'labs/web3-hero');
const web3Dist = path.join(web3Dir, 'dist');
const targetDir = path.join(rootDir, 'dist/labs/web3-hero');

console.log('[build-labs] Installing + building labs/web3-hero…');
execSync('npm install', { cwd: web3Dir, stdio: 'inherit' });
execSync('npm run build', { cwd: web3Dir, stdio: 'inherit' });

if (!existsSync(web3Dist)) {
  throw new Error('[build-labs] labs/web3-hero build did not produce a dist/ directory.');
}

mkdirSync(targetDir, { recursive: true });
cpSync(web3Dist, targetDir, { recursive: true });
console.log('[build-labs] Copied labs/web3-hero/dist -> dist/labs/web3-hero');
