const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const repo = path.resolve(__dirname, '../../../../..');

/** Identity regressions. Browser layout/photo decoding are verified separately; these
 * checks exercise source transitions, semantics and the authored nesting geometry. */
exports.run = async function run({ UI, React, render, unmount, act, document, click, ssr }) {
  // Expected colours come from the generated tokens, so these checks follow tokens/easm.tokens.json.
  const rgb = hex => `rgb(${hex.slice(1).match(/../g).map(part => parseInt(part, 16)).join(', ')})`, C = UI.tokens.color;
  const h = React.createElement, window = document.defaultView, checks = [];
  const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks.push(message); };
  const check = (value, message) => { assert.ok(value, message); checks.push(message); };
  const css = fs.readFileSync(path.join(repo, 'packages/ui/src/utility.css'), 'utf8');
  const tokens = Object.fromEntries([...fs.readFileSync(path.join(repo, 'packages/ui/src/tokens.css'), 'utf8').matchAll(/(--easm-ui-[\w-]+):\s*([^;]+);/g)].map(match => [match[1], match[2]]));
  // JSDOM does not resolve CSS custom properties. Resolve root tokens only in the
  // test fixture; this is an authored CSS contract check, not a browser layout claim.
  let resolved = css + '\n' + fs.readFileSync(path.join(repo, 'packages/ui/src/actions.css'), 'utf8');
  for (let i = 0; i < 3; i++) resolved = resolved.replace(/var\((--[\w-]+)(?:,\s*([^()]+))?\)/g, (whole, name, fallback) => tokens[name] || fallback || whole);
  const style = document.createElement('style');
  style.textContent = `.easm-ui,.easm-ui *{box-sizing:border-box}.easm-ui [hidden]{display:none!important}` + resolved;
  document.head.append(style);
  const computed = node => window.getComputedStyle(node);
  const px = (node, property) => parseFloat(computed(node)[property]);
  const srcA = 'https://example.invalid/a.png', srcB = 'https://example.invalid/b.png';
  const previousClipboard = Object.getOwnPropertyDescriptor(window.navigator, 'clipboard');
  const emit = async (image, event) => act(async () => image.dispatchEvent(new window.Event(event)));
  try {
    for (const [size, diameter] of [['sm', 32], ['md', 40], ['lg', 48]]) for (const shape of ['circle', 'rounded']) {
      await render(h(UI.Avatar, { name: 'Aisha Khan', size, shape, src: srcA }));
      const avatar = document.querySelector('.easm-ui-avatar'), image = avatar.querySelector('img');
      equal(px(avatar, 'width'), diameter, `Avatar ${size}/${shape} width follows canonical diameter`);
      equal(px(avatar, 'height'), diameter, `Avatar ${size}/${shape} height follows canonical diameter`);
      equal(avatar.getAttribute('data-shape'), shape, `Avatar ${size}/${shape} exposes the requested shape`);
      equal(computed(avatar).borderRadius, shape === 'circle' ? '50%' : '8px', `Avatar ${size}/${shape} frame radius is explicit`);
      equal(computed(image).objectFit, 'cover', `Avatar ${size}/${shape} crops photos with cover`);
      equal(computed(image).objectPosition, 'center', `Avatar ${size}/${shape} crop is centered`);
      equal(computed(image).position, 'absolute', `Avatar ${size}/${shape} pending photo cannot displace initials`);
      equal(computed(image).opacity, '0', `Avatar ${size}/${shape} pending photo remains hidden`);
      equal(image.getAttribute('alt'), '', `Avatar ${size}/${shape} photo does not repeat the accessible identity`);
      check(!avatar.querySelector('.easm-ui-avatar-initials').hidden, `Avatar ${size}/${shape} retains visible initials while photo loads`);
      await emit(image, 'load');
      equal(avatar.getAttribute('data-image-state'), 'loaded', `Avatar ${size}/${shape} load event commits the photo`);
      equal(computed(image).opacity, '1', `Avatar ${size}/${shape} completed photo becomes visible`);
      check(avatar.querySelector('.easm-ui-avatar-initials').hidden, `Avatar ${size}/${shape} loaded photo hides initials`);
      if (shape === 'rounded') equal(parseFloat(computed(image).borderRadius.replace(/^calc\(/, '')), 7, `Avatar ${size}/${shape} photo mask subtracts the frame border`);
    }
    for (const [name, expected] of [['Aisha Khan','AK'], ['Aisha','A'], ['  Aisha   Noor Khan  ','AK'], ['Élodie Zafar','ÉZ'], ['E\u0301lodie Zafar','E\u0301Z'], ['👩‍💻 Researcher','👩‍💻R'], ['ß ß','SS']]) {
      await render(h(UI.Avatar, { name }));
      equal(document.querySelector('.easm-ui-avatar-initials').textContent, expected, `Avatar initials preserve first/last graphemes: ${name.trim()}`);
    }
    const markup = ssr(h(UI.Avatar, { name: 'Aisha Khan', status: 'online' }));
    const ssrHost = document.createElement('div'); ssrHost.innerHTML = markup;
    equal(ssrHost.firstChild.getAttribute('aria-label'), 'Aisha Khan, online', 'Standalone Avatar announces name and presence once');
    equal(ssrHost.querySelectorAll('[role="img"]').length, 1, 'Standalone Avatar exposes exactly one image role');
    check(ssrHost.querySelector('.easm-ui-avatar-status').getAttribute('aria-hidden') === 'true', 'Presence dot is decorative because its meaning is already named');

    let changeSource;
    function SourceHarness() {
      const [src, setSrc] = React.useState(srcA); changeSource = setSrc;
      return h(UI.Avatar, { name: 'Aisha Khan', src });
    }
    await render(h(SourceHarness));
    let avatar = document.querySelector('.easm-ui-avatar'), image = avatar.querySelector('img');
    await emit(image, 'error');
    equal(avatar.getAttribute('data-image-state'), 'fallback', 'Failed photo changes to a stable fallback state');
    check(!avatar.querySelector('img'), 'Failed photo removes the broken image element');
    equal(avatar.querySelector('.easm-ui-avatar-initials').textContent, 'AK', 'Failed photo retains identity initials');
    await act(async () => changeSource(srcB));
    image = avatar.querySelector('img'); equal(image.getAttribute('src'), srcB, 'New image source mounts a new photo attempt');
    equal(avatar.getAttribute('data-image-state'), 'loading', 'A replacement photo cannot inherit the previous failed state');
    await emit(image, 'load');
    await act(async () => changeSource(srcA));
    image = avatar.querySelector('img'); equal(image.getAttribute('src'), srcA, 'Returning to a previously failed source retries that source');
    equal(avatar.getAttribute('data-image-state'), 'loading', 'Source changes never show a stale loaded picture');
    await act(async () => changeSource(undefined));
    check(!avatar.querySelector('img') && avatar.getAttribute('data-image-state') === 'fallback', 'Clearing the source restores initials and removes the photo');

    const proto = window.HTMLImageElement.prototype;
    const complete = Object.getOwnPropertyDescriptor(proto, 'complete');
    const naturalWidth = Object.getOwnPropertyDescriptor(proto, 'naturalWidth');
    try {
      Object.defineProperty(proto, 'complete', { configurable: true, get: () => true });
      Object.defineProperty(proto, 'naturalWidth', { configurable: true, get: () => 100 });
      await render(h(UI.Avatar, { name: 'Cached photo', src: srcA }));
      equal(document.querySelector('.easm-ui-avatar').getAttribute('data-image-state'), 'loaded', 'Already-loaded cached photo is recognized after hydration');
      Object.defineProperty(proto, 'naturalWidth', { configurable: true, get: () => 0 });
      await render(h(UI.Avatar, { name: 'Cached failure', src: srcA }));
      equal(document.querySelector('.easm-ui-avatar').getAttribute('data-image-state'), 'fallback', 'Already-failed cached photo is recognized without waiting for another event');
      check(!document.querySelector('.easm-ui-avatar img'), 'Cached failed photo cannot leave a broken image behind');
    } finally {
      Object.defineProperty(proto, 'complete', complete); Object.defineProperty(proto, 'naturalWidth', naturalWidth);
    }

    for (const [size, height, diameter] of [['sm', 40, 32], ['md', 48, 40]]) for (const description of [undefined, 'Support agent']) {
      let removed = 0;
      await render(h('form', null, h(UI.UserChip, { name: 'Aisha Khan', size, description, status: 'online', onRemove: () => removed++ })));
      const chip = document.querySelector('.easm-ui-user-chip'), child = chip.querySelector('.easm-ui-avatar'), button = chip.querySelector('button');
      equal(px(chip, 'minHeight'), height, `UserChip ${size}/${description ? 'two-line' : 'one-line'} minimum height is intentional`);
      equal(px(child, 'height'), diameter, `UserChip ${size} avatar uses canonical diameter`);
      const inset = px(chip, 'borderLeftWidth') + px(chip, 'paddingLeft');
      equal(inset, 4, `UserChip ${size} outer border is included in the 4px avatar inset`);
      equal(px(chip, 'borderRadius') - px(child, 'borderRadius'), inset, `UserChip ${size} avatar/frame corner offset equals the inset`);
      equal(diameter + 2 * inset, height, `UserChip ${size} compact geometry closes exactly without an off-by-one pixel`);
      equal(computed(chip).backgroundColor, rgb(C.surfaceHover), `UserChip ${size} identity frame has an opaque quiet surface`);
      equal(computed(child).backgroundColor, rgb(C.avatar), `UserChip ${size} avatar has an opaque brand surface`);
      equal(px(chip, 'gap'), 8, `UserChip ${size} avatar/copy/control gap is 8px`);
      equal(child.getAttribute('aria-hidden'), 'true', `UserChip ${size} does not announce the avatar beside the visible name`);
      check(!chip.querySelector('[role="img"]'), `UserChip ${size} exposes identity as text rather than duplicate image roles`);
      equal(button.getAttribute('aria-label'), 'Remove Aisha Khan', `UserChip ${size} removal target has an explicit identity label`);
      equal(button.type, 'button', `UserChip ${size} removal cannot submit its enclosing form`);
      const nameHeight = px(chip.querySelector('.easm-ui-user-chip-name'), 'lineHeight');
      const captionHeight = description ? px(chip.querySelector('.easm-ui-user-chip-description'), 'lineHeight') : 0;
      check(nameHeight + captionHeight <= diameter, `UserChip ${size} one/two-line metrics fit within avatar height`);
      await click(button); equal(removed, 1, `UserChip ${size} removal runs exactly once`);
    }
    let removed = 0;
    await render(h(UI.UserChip, { name: 'Aisha Khan', disabled: true, onRemove: () => removed++ }));
    const disabled = document.querySelector('button'); await click(disabled);
    check(disabled.disabled && disabled.getAttribute('aria-disabled') === 'true' && removed === 0, 'Disabled UserChip removal cannot fire while identity text stays readable');
    const longName = 'AishaVeryLongUnbrokenFamilyNameThatMustRemainReadableAtNarrowWidths';
    await render(h(UI.UserChip, { name: longName, description: 'Department of Academic Quality and Institutional Research' }));
    const copy = document.querySelector('.easm-ui-user-chip-copy');
    equal(copy.querySelector('.easm-ui-user-chip-name').textContent, longName, 'Long identity is retained in full without inaccessible truncation');
    equal(px(copy, 'minWidth'), 0, 'UserChip copy can shrink instead of forcing the frame outside its container');
    // break-word, not anywhere: the copy may shrink (min-width 0 above), so a name wider than it still wraps, while a
    // short word is never split between letters to make room (EASM UI 3.7.13: `anywhere` let flex rows and table
    // columns squeeze text to one letter wide).
    equal(computed(copy.querySelector('.easm-ui-user-chip-name')).overflowWrap, 'break-word', 'Unbroken long names can wrap at narrow widths');
    equal(computed(document.querySelector('.easm-ui-user-chip')).maxWidth, '100%', 'UserChip frame is bounded by its available container width');
    check(!document.querySelector('button'), 'Display-only UserChip does not introduce a false interactive target');

    for (const [size, frame, glyph] of [['sm',32,20],['md',40,24],['lg',48,32]]) for (const [tone, background] of [['brand',rgb(C.primarySurface)],['neutral',rgb(C.track)],['signature',rgb(C.signatureSurface)]]) {
      await render(h(UI.ModuleIcon, { icon: 'inbox', label: 'Support', size, tone }));
      const module = document.querySelector('.easm-ui-module-icon'), svg = module.querySelector('svg');
      equal(px(module, 'width'), frame, `ModuleIcon ${size}/${tone} frame follows canonical size`);
      equal(svg.getAttribute('width'), String(glyph), `ModuleIcon ${size}/${tone} artwork follows canonical size`);
      equal(computed(module).backgroundColor, background, `ModuleIcon ${size}/${tone} surface is explicitly opaque`);
      equal(computed(module).justifyContent, 'center', `ModuleIcon ${size}/${tone} artwork centers horizontally`);
      equal(computed(module).alignItems, 'center', `ModuleIcon ${size}/${tone} artwork centers vertically`);
      equal(svg.getAttribute('aria-label'), 'Support', `ModuleIcon ${size}/${tone} named artwork retains its meaning`);
    }
    for (const [size, glyphSize] of [['sm',16],['md',20],['lg',24]]) for (const label of ['Copy', 'Copy reference identifier']) {
      let finish, copied;
      Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise(resolve => { finish = resolve; }) } });
      await render(h(UI.CopyControl, { text: 'EASM-1042', label, size, onCopy: value => copied = value }));
      const button = document.querySelector('button'), grid = button.querySelector('.easm-ui-copy-labels');
      equal(computed(grid).display, 'grid', `CopyControl ${size}/${label} reserves its two labels in one grid cell`);
      equal(grid.querySelectorAll('.easm-ui-copy-measure').length, 2, `CopyControl ${size}/${label} reserves both idle and acknowledged label widths`);
      const measures = [...grid.querySelectorAll('.easm-ui-copy-measure')];
      equal(measures.map(node => node.textContent).join('|'), `${label}|Copied`, `CopyControl ${size}/${label} preserves both actual strings for width measurement`);
      check(measures.every(node => computed(node).visibility === 'hidden' && node.getAttribute('aria-hidden') === 'true' && computed(node).gridArea === '1 / 1'), `CopyControl ${size}/${label} reserve text is invisible, decorative and shares the label cell`);
      equal(button.getAttribute('aria-label'), label, `CopyControl ${size}/${label} accessible name contains only its current action`);
      await click(button);
      check(button.getAttribute('aria-busy') === 'true', `CopyControl ${size}/${label} pending clipboard operation exposes busy state`);
      equal(button.querySelector('.easm-ui-button-spinner').getAttribute('width'), String(glyphSize), `CopyControl ${size}/${label} loading icon retains its ordinary icon width`);
      equal(button.querySelector('.easm-ui-button-spinner').getAttribute('height'), String(glyphSize), `CopyControl ${size}/${label} loading icon retains its ordinary icon height`);
      equal(grid.querySelector('.easm-ui-copy-label').textContent, label, `CopyControl ${size}/${label} pending operation retains original action text in flow`);
      equal(computed(button.querySelector('.easm-ui-button-busy-indicator')).position, 'absolute', `CopyControl ${size}/${label} loading indicator adds no layout slot`);
      equal(computed(button.querySelector('.easm-ui-button-label')).opacity, '0', `CopyControl ${size}/${label} loading retains label geometry beneath its indicator`);
      check(button.querySelector('[data-icon="copy"]'), `CopyControl ${size}/${label} loading retains the original artwork in flow`);
      await act(async () => finish());
      equal(copied, 'EASM-1042', `CopyControl ${size}/${label} reports the successfully copied text`);
      equal(grid.querySelector('.easm-ui-copy-label').textContent, 'Copied', `CopyControl ${size}/${label} success updates the visible label`);
      equal(button.getAttribute('aria-label'), 'Copied', `CopyControl ${size}/${label} success has its actual accessible name`);
      equal(measures.map(node => node.textContent).join('|'), `${label}|Copied`, `CopyControl ${size}/${label} success retains the same width-reservation strings`);
      equal(document.querySelector('[role="status"]').textContent, 'Copied to clipboard.', `CopyControl ${size}/${label} success is announced once by the live status`);
    }
    assert.throws(() => ssr(h(UI.CopyControl, { text: 'EASM-1042', label: ' ' }))); checks.push('CopyControl rejects a blank action label despite decorative measurement text');
    check(css.includes("@media (pointer: coarse)") && css.includes(".easm-ui-user-chip[data-removable='true'] { min-height: 56px; }") && css.includes("width: 48px; height: 48px; font-size: 16px; }"), 'Coarse removable UserChip reserves a 48px avatar in a 56px frame around the shared 44px action target');
    check(css.includes('background: Canvas; color: CanvasText; border-color: CanvasText;'), 'Identity surfaces retain an explicit high-contrast frame in forced-color mode');
    return checks;
  } finally { style.remove(); await unmount(); if (previousClipboard) Object.defineProperty(window.navigator, 'clipboard', previousClipboard); else delete window.navigator.clipboard; }
};

if (require.main === module) (async () => {
  const req = createRequire(path.join(repo, 'packages/ui/package.json'));
  const cache = path.join(__dirname, '.cache'); fs.mkdirSync(cache, { recursive: true });
  const outfile = path.join(cache, 'identity-runtime.cjs');
  await req('esbuild').build({ entryPoints: [path.join(repo, 'packages/ui/src/utility.tsx')], outfile, bundle: true, format: 'cjs', platform: 'node', jsx: 'automatic', external: ['react','react-dom','react-dom/*','react/jsx-runtime'], logLevel: 'silent' });
  const { JSDOM } = req('jsdom'); const dom = new JSDOM('<!doctype html><html lang="en"><head></head><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
  for (const name of ['window','document','HTMLElement','HTMLInputElement','Element','Node','Event','MouseEvent','MutationObserver','DocumentFragment','NodeFilter','HTMLButtonElement']) global[name] = name === 'window' ? dom.window : dom.window[name];
  Object.defineProperty(global, 'navigator', { configurable: true, value: dom.window.navigator });
  global.getComputedStyle = dom.window.getComputedStyle; global.IS_REACT_ACT_ENVIRONMENT = true;
  const React = req('react'), { act } = React, { createRoot } = req('react-dom/client'), { renderToStaticMarkup } = req('react-dom/server');
  let root, host;
  const unmount = async () => { if (root) { await act(async () => root.unmount()); host.remove(); root = undefined; } };
  const render = async element => { await unmount(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); await act(async () => root.render(element)); return host; };
  const click = async element => act(async () => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })));
  const checks = await exports.run({ UI: require(outfile), React, render, unmount, act, document: dom.window.document, click, ssr: renderToStaticMarkup });
  fs.writeFileSync(path.join(__dirname, 'identity.json'), JSON.stringify({ scope: 'Identity semantics, image state transitions and authored geometry contracts; real browser layout is separate.', checks: checks.length, passed: checks, issues: [] }, null, 2) + '\n');
  dom.window.close(); console.log(`PASS: ${checks.length} identity checks.`);
})().catch(error => { console.error(error); process.exit(1); });
