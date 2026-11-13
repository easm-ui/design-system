// The mascot: renders on the server (no window at import), is the brand's (no product or institution names),
// and never makes a sound of her own. Against the built package (pnpm build first).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.env.EASM_BRAND_DIST ? resolve(process.env.EASM_BRAND_DIST) : resolve(root, 'dist');
const B = await import(pathToFileURL(resolve(dist, 'index.js')).href);
const sources = readdirSync(resolve(root, 'src/mascot')).filter(f => /\.tsx?$/.test(f)).map(f => [f, readFileSync(resolve(root, 'src/mascot', f), 'utf8')]);

test('the mascot renders a host on the server and exports its engine and expressions', () => {
  assert.match(renderToString(h(B.EasmMascot)), /data-easm-mascot="stage"/);
  assert.equal(typeof B.EasmMascotEngine, 'function');
  assert.ok(B.MASCOT_EXPRESSIONS.length >= 64);
  assert.ok(B.MASCOT_EXPRESSIONS.includes('happy'));
  assert.ok(B.MASCOT_ACTS.includes('wink'));
});

test('no product, institution or person names in the mascot', () => {
  for (const [file, text] of sources) {
    assert.doesNotMatch(text, /admissions|support widget/i, file);
  }
});

test('she never makes a sound of her own', () => {
  for (const [file, text] of sources) {
    assert.doesNotMatch(text, /speechSynthesis|SpeechSynthesisUtterance|new Audio\(|\.destination\b/, file);
  }
});
