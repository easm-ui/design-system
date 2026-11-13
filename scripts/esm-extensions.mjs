// After tsc: give every relative import in the emitted JavaScript and declarations a full path
// ("./actions" -> "./actions.js", "./icons" -> "./icons/index.js"), so the published packages load in
// plain Node ESM (SSR, test runners) as well as in bundlers.
//   node scripts/esm-extensions.mjs packages/ui/dist
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'dist');
const files = fs.readdirSync(root, { recursive: true }).map(f => path.join(root, String(f))).filter(f => /\.(js|d\.ts)$/.test(f));
const spec = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]+)\2/g;
let changed = 0;
for (const file of files) {
  const dir = path.dirname(file);
  const before = fs.readFileSync(file, 'utf8');
  const after = before.replace(spec, (m, lead, q, rel) => {
    if (/\.(js|mjs|cjs|json|css)$/.test(rel)) return m;
    const target = path.resolve(dir, rel);
    if (fs.existsSync(target + '.js')) return `${lead}${q}${rel}.js${q}`;
    if (fs.existsSync(path.join(target, 'index.js'))) return `${lead}${q}${rel}/index.js${q}`;
    throw new Error(`${path.relative(root, file)}: cannot resolve ${rel}`);
  });
  if (after !== before) { fs.writeFileSync(file, after); changed++; }
}
console.log(`esm-extensions: ${changed} of ${files.length} files in ${path.relative(process.cwd(), root)}`);
