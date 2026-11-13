// Scopes the animated SVG exports (svg/icon, svg/waveform) and the poster frames (svg/frames) so they can be inlined
// into a page safely: every class, keyframe and id gets the file's own prefix (easm-icon-done-light-kr0), and the
// reduced-motion rule stops only that file's animations instead of every animation on the page (`*`).
//   node scripts/scope-svg.mjs           rewrite the files in place (idempotent: scoped files are left alone)
//   node scripts/scope-svg.mjs --check   fail if a file is not scoped (run after regenerating the motion SVGs)
// The dots exports are not touched: their CSS is the same DOTS_CSS the components inject, so it never conflicts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const DIRS = ['svg/icon', 'svg/waveform', 'svg/frames'];

const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function scopeSvg(svg, prefix) {
  const rootTag = /^<svg\b[^>]*>/.exec(svg);
  if (!rootTag) throw new Error('not an svg');
  if (new RegExp(`\\bclass="${escRe(prefix)}"`).test(rootTag[0])) return svg; // already scoped
  const p = name => `${prefix}-${name}`;
  const ids = new Set();
  for (const m of svg.matchAll(/\sid="([^"]*)"/g)) ids.add(m[1]);

  // the style sheet: keyframes, the animations that use them, class selectors and the reduced-motion rule
  let out = svg.replace(/<style>([\s\S]*?)<\/style>/g, (_, css) => {
    const frames = new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1]));
    // split into @keyframes blocks (left as they are, apart from the name) and everything else
    let text = '', i = 0;
    for (const m of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
      text += scopeRules(css.slice(i, m.index));
      let depth = 0, j = m.index + m[0].length - 1;
      for (; j < css.length; j++) { if (css[j] === '{') depth++; else if (css[j] === '}' && --depth === 0) break; }
      text += `@keyframes ${p(m[1])}` + css.slice(m.index + m[0].length - 1, j + 1);
      i = j + 1;
    }
    text += scopeRules(css.slice(i));
    return `<style>${text}</style>`;

    function scopeRules(rules) {
      return rules
        .replace(/(animation(?:-name)?\s*:\s*)([^;}]*)/g, (_, decl, value) =>
          decl + value.replace(/(^|[\s,])([\w-]+)(?=[\s,]|$)/g, (s, lead, name) => (frames.has(name) ? lead + p(name) : s)))
        .replace(/\.([A-Za-z_][\w-]*)/g, (_, name) => `.${p(name)}`)
        .replace(/(^|[{}])\s*\*\s*\{/g, (_, lead) => `${lead}.${prefix} *{`);
    }
  });
  // the markup: class tokens, ids and references to them
  out = out.replace(/(\sclass=")([^"]*)(")/g, (_, a, list, b) => a + list.split(/\s+/).filter(Boolean).map(p).join(' ') + b);
  for (const id of ids) {
    out = out.replace(new RegExp(`(\\sid=")${escRe(id)}(")`, 'g'), `$1${p(id)}$2`)
      .replace(new RegExp(`url\\(#${escRe(id)}\\)`, 'g'), `url(#${p(id)})`)
      .replace(new RegExp(`(href=")#${escRe(id)}(")`, 'g'), `$1#${p(id)}$2`);
  }
  // references to ids defined elsewhere would break: keep the file self-contained
  for (const m of out.matchAll(/url\(#([\w-]+)\)/g)) if (!m[1].startsWith(prefix)) throw new Error(`${prefix}: url(#${m[1]}) has no matching id`);
  return out.replace(/^<svg\b/, `<svg class="${prefix}"`);
}

const files = DIRS.flatMap(dir => fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.svg')).map(f => `${dir}/${f}`));
const unscoped = [];
let changed = 0;
for (const rel of files) {
  const f = path.join(root, rel), svg = fs.readFileSync(f, 'utf8'), scoped = scopeSvg(svg, path.basename(rel, '.svg'));
  if (scoped === svg) continue;
  if (check) { unscoped.push(rel); continue; }
  fs.writeFileSync(f, scoped);
  changed++;
}
if (check && unscoped.length) { console.error(`scope-svg: ${unscoped.length} file(s) are not scoped; run node scripts/scope-svg.mjs\n  ${unscoped.join('\n  ')}`); process.exit(1); }
console.log(check ? `scope-svg: ${files.length} motion SVGs are scoped` : `scope-svg: scoped ${changed} of ${files.length} motion SVGs`);
