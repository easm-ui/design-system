// Dashboard atmosphere SSR contract, against the built package (pnpm build first).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.env.EASM_BRAND_DIST ? resolve(process.env.EASM_BRAND_DIST) : resolve(root, 'dist');
const B = await import(pathToFileURL(resolve(dist, 'index.js')).href);
const { getParticleFieldPoints } = await import(pathToFileURL(resolve(dist, 'background/particle-field.js')).href);
const html = props => renderToStaticMarkup(h(B.EasmParticleField, props));

test('particle atmosphere renders a decorative, non-interactive server fallback', () => {
  const markup = html();
  assert.match(markup, /^<div[^>]*aria-hidden="true"/);
  assert.match(markup, /pointer-events:none/);
  assert.match(markup, /<canvas/);
  assert.match(markup, /<svg/);
  assert.ok((markup.match(/M-?[\d.]+ -?[\d.]+m-/g) || []).length > 100, 'the fallback contains the actual particle mesh');
  assert.doesNotMatch(markup, /role="(?:img|status|alert)"|tabindex="0"|aria-live=/);
  assert.doesNotMatch(markup, /(?:href|src)="https?:\/\//, 'the fallback does not load external artwork');
});

test('server rendering is stable and every supported palette has a distinct fallback', () => {
  const variants = ['charcoal', 'light', 'steel'];
  const output = variants.map(variant => {
    const props = { variant, phase: 0.25, paused: true };
    const first = html(props);
    assert.equal(first, html(props), variant + ' deterministic SSR');
    assert.match(first, new RegExp(`data-easm-particle-field="${variant}"`));
    return first;
  });
  assert.equal(new Set(output).size, variants.length);
});

test('consumer layout attributes survive without making the artwork interactive', () => {
  const markup = html({ className: 'dashboard-art', style: { opacity: 0.4 }, 'data-test-id': 'atmosphere' });
  assert.match(markup, /class="[^"]*dashboard-art/);
  assert.match(markup, /data-test-id="atmosphere"/);
  assert.match(markup, /opacity:0.4/);
  assert.match(markup, /pointer-events:none/);
});

test('several atmospheres in one server tree have independent gradient identities', () => {
  const markup = renderToStaticMarkup(h('main', null, h(B.EasmParticleField), h(B.EasmParticleField, { variant: 'light' }), h(B.EasmParticleField)));
  const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const references = [...markup.matchAll(/url\(#([^)]+)\)/g)].map(match => match[1]);
  assert(ids.length >= 6);
  assert.equal(new Set(ids).size, ids.length);
  assert(references.every(reference => ids.includes(reference)));
});

test('invalid dimensions are safe and the analytic mesh wraps its phase without a seam', () => {
  for (const dimensions of [[0, 400], [-1, 400], [960, 0], [Infinity, 400], [960, NaN]]) {
    assert.deepEqual(getParticleFieldPoints(...dimensions, 0), []);
  }
  for (const variant of ['charcoal', 'light', 'steel']) {
    const options = { variant, intensity: 1 };
    const points = getParticleFieldPoints(1440, 700, 0, options);
    assert.deepEqual(points, getParticleFieldPoints(1440, 700, 1, options), variant + ' loop closure');
    assert.deepEqual(getParticleFieldPoints(1440, 700, -.25, options), getParticleFieldPoints(1440, 700, .75, options), variant + ' backwards phase');
    assert(points.length > 500);
    assert(points.every(({ x, y, radius, alpha }) => Number.isFinite(x) && Number.isFinite(y) && radius > 0 && alpha >= 0 && alpha <= 1));
  }
});


test('the abstract system streams stay represented through the coordinated surface', () => {
  for (const phase of [0, .25, .5, .75]) {
    const points = getParticleFieldPoints(1440, 900, phase, { intensity: 1 });
    assert.equal(new Set(points.map(point => point.stream)).size, 6);
    assert(points.some(point => point.warmth > .25), 'the shared intelligence region is absent');
  }
});

test('pointer response is deterministic, bounded and returns exactly to neutral', () => {
  const base = getParticleFieldPoints(1440, 900, .125);
  const zero = getParticleFieldPoints(1440, 900, .125, { pointer: { x: .7, y: .7, strength: 0 } });
  assert.deepEqual(base, zero);
  const active = getParticleFieldPoints(1440, 900, .125, { pointer: { x: .7, y: .7, strength: 1 } });
  assert.notDeepEqual(base, active);
  assert(active.every(point => Object.values(point).every(Number.isFinite)));
  assert(active.every(point => point.x > -5 && point.x < 1445 && point.y > -5 && point.y < 905 && point.radius < 3));
  assert.deepEqual(getParticleFieldPoints(1440, 900, 0, {pointer:{x:.7,y:.7,strength:1}}),
    getParticleFieldPoints(1440, 900, 1, {pointer:{x:.7,y:.7,strength:1}}));
  assert.deepEqual(base, getParticleFieldPoints(1440, 900, .125, {pointer:{x:NaN,y:0,strength:1}}));
});
