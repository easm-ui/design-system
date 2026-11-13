// @easm-ui/brand: server rendering, names, escaping and logo rules, against the built package (pnpm build first).
// EASM_BRAND_DIST=<dir> tests another compiled copy of src.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.env.EASM_BRAND_DIST ? resolve(process.env.EASM_BRAND_DIST) : resolve(root, 'dist');
const B = await import(pathToFileURL(resolve(dist, 'index.js')).href);
const html = el => renderToString(el);

test('every component renders on the server', () => {
  for (const el of [h(B.EasmLogo), h(B.EasmMark), h(B.EasmIcon, { state: 'thinking' }), h(B.EasmWaveform), h(B.EasmDots), h(B.EasmTypingDots)]) {
    assert.match(html(el), /^<(svg|span)/);
  }
});

test('names: defaults, aria-label wins, "" is decorative', () => {
  assert.match(html(h(B.EasmLogo, { product: 'Forms' })), /role="img"[^>]*aria-label="EASM Forms"/);
  assert.match(html(h(B.EasmLogo, { 'aria-label': 'Home', title: 'EASM' })), /aria-label="Home"/);
  for (const el of [h(B.EasmLogo, { title: '' }), h(B.EasmMark, { title: '' }), h(B.EasmIcon, { title: '' }), h(B.EasmWaveform, { label: '' })]) {
    const out = html(el);
    assert.match(out, /aria-hidden="true"/);
    assert.doesNotMatch(out, /role="img"|aria-label=/);
  }
  assert.match(html(h(B.EasmLogo, { role: 'presentation' })), /role="presentation"/, 'consumer props are spread last');
  assert.equal(B.markArt({ product: 'One' }).label, 'EASM One');
});

test('dots: a status region with its label as text, or a named image', () => {
  // the region is named at once; its spoken text is filled on the client a moment after it appears (empty here)
  const live = html(h(B.EasmDots, { variant: 'searching' }));
  assert.match(live, /role="status"[^>]*aria-label="EASM is searching"/);
  assert.match(live, /<span style="[^"]*position:absolute[^"]*"><\/span><\/span>$/);
  const own = html(h(B.EasmDots, { 'aria-label': 'Assistant is typing' }));
  assert.match(own, /aria-label="Assistant is typing"/);
  assert.doesNotMatch(own, /EASM is writing/);
  const img = html(h(B.EasmDots, { announce: false, label: 'Writing' }));
  assert.match(img, /role="img"[^>]*aria-label="Writing"/);
  assert.doesNotMatch(img, />Writing</);
});

test('markup builders escape colours and names', () => {
  assert.doesNotMatch(B.dotsMarkup('red"/><foo bar="'), /<foo/);
  assert.doesNotMatch(B.waveMarkup(3, 'red"/><foo bar="'), /<foo/);
  assert.doesNotMatch(B.iconMarkup('light', 'u', 'red"/><foo bar="'), /<foo/);
  const file = B.svgFile(B.logoArt({ product: 'R&D "x"' }));
  assert.match(file, /aria-label="EASM R&amp;D &quot;x&quot;"/);
  assert.match(file, />R&amp;D &quot;x&quot;<\/text>/);
});

test('only the horizontal lockup carries a product', () => {
  for (const variant of ['stacked', 'descriptor', 'descriptor-under', 'wordmark']) {
    assert.equal(B.logoArt({ variant, product: 'Forms' }).inner, B.logoArt({ variant }).inner, `${variant} ignores the product`);
  }
  assert.notEqual(B.logoArt({ product: 'Forms' }).inner, B.logoArt({}).inner);
});

test('one source for names and timings', () => {
  assert.equal(B.FULL_NAME, B.BRAND.fullName);
  for (const p of B.PRODUCTS) assert.ok(B.PRODUCT_NAMES[p.product], `${p.product} has outlined artwork`);
  assert.equal(B.ICON_TIMING.blendOneShot, 0.28);
  assert.equal(B.DOTS_VIEWBOX, `0 0 26 ${B.DOTS_HEIGHT}`);
});

test('EasmDotField: a fixed, decorative canvas behind the page that paints nothing on the server', () => {
  assert.equal(typeof B.EasmDotField, 'function');
  const html = renderToString(h(B.EasmDotField));
  assert.match(html, /^<canvas[^>]*aria-hidden="true"/);
  assert.match(html, /pointer-events-none fixed left-0 top-0 -z-10/);
});
