/* Stylesheet sanity: every CSS file parses into the rules its author wrote.
 * An unclosed comment (one "* /" missing) turns the rules after it into comment text without any parse error,
 * and those components silently fall back to browser defaults (2026-10-28: secondary buttons lost their fill).
 * So no comment may contain what looks like a rule: a selector line followed by a declaration block. */
const fs = require('node:fs');
const path = require('node:path');
const dir = path.resolve(__dirname, '../src');
const problems = [];
for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.css'))) {
  const text = fs.readFileSync(path.join(dir, file), 'utf8');
  for (const match of text.matchAll(/\/\*[\s\S]*?\*\//g)) {
    const body = match[0];
    const rule = body.match(/^\s*(?:[.:#@\[]|:where|:is)[^\n{]*\{[^}]*:[^}]*\}/m);
    if (rule) {
      const line = text.slice(0, match.index).split('\n').length;
      problems.push(`${file}:${line} a comment contains a rule (is a "*/" missing?): ${rule[0].trim().slice(0, 100)}`);
    }
  }
  const opened = (text.match(/\/\*/g) || []).length, closed = (text.match(/\*\//g) || []).length;
  if (opened !== closed) problems.push(`${file}: ${opened} comments opened, ${closed} closed`);
}
/* A pressed button scales with `transform` (motion.css). A class that sits on Button or IconButton must not position
 * or mirror it with `transform` too, or the press replaces it: 2026-10-29 the row arrows, centred with
 * translateY(-50%), dropped half their height under the finger and a press on their top half missed. Use the
 * translate and scale properties instead. */
const source = fs.readdirSync(dir).filter(name => name.endsWith('.tsx')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
const buttonClasses = new Set();
for (const m of source.matchAll(/<(?:IconButton|Button)\b[^>]*?className=(?:"([^"]+)"|\{cx\(([^)]*)\))/g))
  for (const word of (m[1] ?? m[2]).split(/[\s'",]+/)) if (word.startsWith('easm-ui-')) buttonClasses.add(word);
const sheets = fs.readdirSync(dir).filter(name => name.endsWith('.css')).map(name => [name, fs.readFileSync(path.join(dir, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')]);
for (const [file, css] of sheets) for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  if (selector.includes(':active') || !/(^|[;\s])transform\s*:/.test(body)) continue;
  for (const name of buttonClasses) if (new RegExp(`\\.${name}(?![\\w-])`).test(selector)) problems.push(`${file}: .${name} sets transform, which a press replaces; use translate or scale`);
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`stylesheets: every comment closed, no rule inside a comment, no button positioned by transform (${buttonClasses.size} classes)`);
