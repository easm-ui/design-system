// Renders the README's pictures from scenes.tsx with the real packages.
//   node .github/readme/build.mjs            (needs: pnpm install; playwright-core install chromium-headless-shell)
// Writes hero.png, dashboard.png, controls.png, icons.png and brand.png next to this file.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '../..');
const req = createRequire(join(repo, 'packages/ui/package.json'));
const esbuild = req('esbuild');
const { chromium } = createRequire(join(repo, 'package.json'))('playwright-core');

const out = join(here, '.cache');
mkdirSync(out, { recursive: true });
await esbuild.build({
  entryPoints: [join(here, 'scenes.tsx')], outfile: join(out, 'scenes.js'), bundle: true, format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' }, nodePaths: [join(repo, 'packages/ui/node_modules')], logLevel: 'warning', minify: true,
});
await esbuild.build({ entryPoints: [join(repo, 'packages/ui/src/styles.css')], outfile: join(out, 'ui.css'), bundle: true, logLevel: 'warning' });
writeFileSync(join(out, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="ui.css"><link rel="stylesheet" href="scenes.css"></head>
<body class="easm-ui easm-ui-page" data-easm-motion="off"><div id="root"></div><script src="scenes.js"></script></body></html>`);
writeFileSync(join(out, 'scenes.css'), readFileSync(join(here, 'scenes.css')));

const types = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8' };
const server = http.createServer((q, s) => {
  const file = q.url.split('?')[0].split('#')[0].replace(/^\/$/, '/index.html');
  try { s.writeHead(200, { 'content-type': types[file.split('.').pop()] ?? 'application/octet-stream' }); s.end(readFileSync(join(out, file))); }
  catch { s.writeHead(404); s.end(); }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const sizes = { hero: [1280, 640], dashboard: [1280, 960], controls: [1280, 440], icons: [1280, 440], brand: [1280, 340] };
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox', '--disable-gpu'] });
for (const [name, [width, height]] of Object.entries(sizes)) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}#${name}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(here, `${name}.png`) });
  console.log(name, errors.length ? `errors: ${errors.join(' | ').slice(0, 600)}` : 'ok');
  await page.close();
}
await browser.close();
server.close();
