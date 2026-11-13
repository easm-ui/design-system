/* Focused integration checks for the authored semantic icon motions.
 * Run from any directory: node packages/icons/test/part-motion.cjs
 * No generated release assets or tracked QA reports are changed by this check. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');

const pkg = path.resolve(__dirname, '..');
const repo = path.resolve(pkg, '../..');
const req = createRequire(path.join(pkg, 'package.json'));
const React = req('react');
const { renderToStaticMarkup, renderToString } = req('react-dom/server');
const ts = req('typescript');
const sharp = req('sharp');
const { chromium } = require(path.join(repo, 'node_modules/playwright-core'));
const cache = {};

function loadSource(file) {
  if (cache[file]) return cache[file].exports;
  const mod = { exports: {} };
  cache[file] = mod;
  const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  function localRequire(name) {
    if (!name.startsWith('.')) return req(name);
    const target = path.resolve(path.dirname(file), name);
    return loadSource(['', '.tsx', '.ts'].map(ext => target + ext).find(candidate => fs.existsSync(candidate)));
  }
  new Function('require', 'module', 'exports', result.outputText)(localRequire, mod, mod.exports);
  return mod.exports;
}

function inlineCss(file, stack = new Set()) {
  if (stack.has(file)) throw new Error(`Circular CSS import: ${file}`);
  const next = new Set([...stack, file]);
  return fs.readFileSync(file, 'utf8').replace(/@import\s+['"]([^'"]+)['"]\s*;/g,
    (_, relative) => inlineCss(path.resolve(path.dirname(file), relative), next));
}

const { Icon } = loadSource(path.join(pkg, 'src/Icon.tsx'));
const { MotionIcon } = loadSource(path.join(pkg, 'src/MotionIcon.tsx'));
const { AnimatedIcon } = loadSource(path.join(pkg, 'src/AnimatedIcon.tsx'));
const { motionPresets } = loadSource(path.join(pkg, 'src/motion.ts'));
const { iconMotionRecipes, motionIconNames, getIconMotion, isMotionIconName } = loadSource(path.join(pkg, 'src/motion-recipes.ts'));
const { geometry, iconNames } = loadSource(path.join(pkg, 'src/registry.ts'));
let ssrRoot = 0;
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props), { identifierPrefix: `qa-root-${++ssrRoot}-` });
// Component hooks such as useId must run under the genuine server dispatcher even when this
// test needs to inspect the host element's props before the HTML renderer removes callbacks.
function captureMotionHost(props) {
  let host;
  function Capture() { host = MotionIcon.render(props, null); return host; }
  render(Capture, {});
  return host;
}
const css = inlineCss(path.join(pkg, 'src/styles.css')) + '\n' + inlineCss(path.join(pkg, 'src/animation.css'));
const issues = [];
const report = {
  recipes: iconMotionRecipes.length,
  aliases: 0,
  ssrCases: 0,
  pixelComparisons: 0,
  animationSamples: 0,
  suppressionCases: 0,
  interactionCases: 0,
  lifecycleCases: 0,
  callbackCases: 0,
  compatibilityCases: 0,
  reactLifecycleCases: 0,
  loopContinuityCases: 0,
  loopModeCases: 0,
  loopBoundsSamples: 0,
  loopLifecycleCases: 0,
  loopSeamStatistics: [],
  connectionCases: 0,
  maskSerializationCases: 0,
  maskMirrorCases: 0,
  hydrationCases: 0,
  compositedVariantCases: 0,
  transparentClearanceCases: 0,
  semanticMilestones: 0,
  recurringMilestones: 0,
  temporaryGeometryCases: 0,
  clippingCases: 0,
};
function check(value, message, details) {
  if (!value) issues.push({ message, ...details });
}

const verbKeyframes = new Set([...fs.readFileSync(path.join(pkg, 'src/motion-verbs.css'), 'utf8').matchAll(/@keyframes\s+([\w-]+)/g)].map(match => match[1]));
function ssrChecks() {
  assert.ok(iconMotionRecipes.length > 0, 'The motion collection must not be empty');
  // The verb CSS is generated; a hand edit or a stale file fails here.
  require('node:child_process').execFileSync(process.execPath, [path.join(pkg, 'scripts/motion-verbs.mjs'), '--check'], { stdio: 'inherit' });
  assert.equal(new Set(motionIconNames).size, motionIconNames.length, 'Every authored icon has one recipe');
  assert.equal(new Set(iconMotionRecipes.map(recipe => geometry[recipe.name])).size, iconMotionRecipes.length,
    'Each authored recipe must use a distinct drawing; aliases reuse the canonical recipe');
  for (const recipe of iconMotionRecipes) {
    assert.ok(geometry[recipe.name], `Unknown recipe drawing: ${recipe.name}`);
    assert.ok(recipe.parts.length > 0, `No semantic parts: ${recipe.name}`);
    assert.ok(recipe.parts.some(part => part.animation), `No moving component: ${recipe.name}`);
    assert.equal(new Set(recipe.parts.map(part => part.id)).size, recipe.parts.length, `Part IDs must be unique: ${recipe.name}`);
    assert.ok(recipe.story?.trim(), `Recipe needs a story: ${recipe.name}`);
    for (const piece of recipe.parts) {
      assert.ok(!piece.temporary, `A motion adds no geometry the drawing does not have: ${recipe.name}/${piece.id}`);
      if (piece.animation) assert.ok(verbKeyframes.has(piece.animation), `Unknown verb ${piece.animation}: ${recipe.name}/${piece.id}`);
      if (piece.clipInset) report.clippingCases++;
    }
    for (const piece of recipe.loopParts ?? []) if (piece.animation) assert.ok(verbKeyframes.has(piece.animation), `Unknown verb ${piece.animation}: ${recipe.name}`);
    assert.equal(!!recipe.loopAllowed, ACTIVITY.includes(recipe.name), `Only real activity may repeat: ${recipe.name}`);
    if (!recipe.loopAllowed) assert.ok(recipe.durationMs <= 1100, `An action gesture lasts at most 1.1 s: ${recipe.name} (${recipe.durationMs} ms)`);
    // Stroke weight is part of the drawing: a pop on an outline stays within 15%, a squeeze within half width.
    for (const piece of recipe.parts) {
      const dot = piece.nodes.every(node => /h\.01$/.test(String(node.attrs?.d ?? '')));
      if (piece.animation === 'easm-verb-pop' && !dot) assert.ok(Math.abs(Number(piece.vars?.['--ms'] ?? 0)) <= .15,
        `A pop thickens an outline by more than 15%: ${recipe.name}/${piece.id}`);
      if (piece.animation === 'easm-verb-squeeze') assert.ok(Math.abs(Number(piece.vars?.['--msx'] ?? 0)) <= .5,
        `A squeeze thins strokes past half width: ${recipe.name}/${piece.id}`);
    }
    assert.ok(isMotionIconName(recipe.name));
    const resting = render(MotionIcon, { name: recipe.name });
    assert.doesNotMatch(resting, /data-active="true"/);
    assert.match(resting, /aria-hidden="true"/);
    assert.match(resting, /focusable="false"/);
    const named = render(MotionIcon, { name: recipe.name, label: recipe.title, active: true });
    assert.match(named, /role="img"/);
    assert.match(named, /aria-label=/);
    assert.match(named, /data-active="true"/);
    const disabled = render(MotionIcon, { name: recipe.name, active: true, state: 'disabled' });
    assert.doesNotMatch(disabled, /data-active="true"/);
    const loopParts = recipe.loopParts ?? recipe.parts;
    assert.ok(loopParts.length && loopParts.some(piece => piece.animation), `No recurring semantic actors: ${recipe.name}`);
    assert.equal(new Set(loopParts.map(piece => piece.id)).size, loopParts.length, `Recurring part IDs must be unique: ${recipe.name}`);
    assert.ok(Number.isFinite(recipe.loopDurationMs ?? recipe.durationMs) && (recipe.loopDurationMs ?? recipe.durationMs) > 0,
      `Invalid cycle period: ${recipe.name}`);
    assert.ok(recipe.loopStory?.trim(), `The recurring story needs an explicit rearm/turnover explanation: ${recipe.name}`);
    for (const emphasis of ['action','hint']) {
      assert.match(render(MotionIcon, { name: recipe.name, active: true, repeat: true, emphasis }), /data-repeat="true"/);
      assert.doesNotMatch(render(MotionIcon, { name: recipe.name, repeat: true, emphasis }), /data-active="true"/);
    }
    report.ssrCases += 4;
  }
  for (const name of iconNames) {
    const recipe = getIconMotion(name);
    if (recipe && name !== recipe.name) {
      assert.equal(geometry[name], geometry[recipe.name]);
      assert.match(render(MotionIcon, { name, active: true }), new RegExp(`data-recipe="${recipe.name}"`));
      assert.match(render(MotionIcon, { name, active: true }), new RegExp(`data-icon="${name}"`));
      report.aliases++;
    }
  }
  const unsupported = iconNames.find(name => !getIconMotion(name));
  assert.ok(unsupported, 'Expected a static fallback drawing');
  assert.doesNotMatch(render(MotionIcon, { name: unsupported, active: true }), /data-motion=/, 'Unsupported drawings keep their static renderer');
  for (const name of ['nonexistent-motion-icon', 'toString', 'constructor']) {
    assert.equal(getIconMotion(name), undefined);
    assert.equal(isMotionIconName(name), false);
    assert.throws(() => render(MotionIcon, { name }), /Unknown EASM icon/);
  }
  const name = motionIconNames[0];
  assert.match(render(MotionIcon, { name, 'aria-labelledby': 'icon-label' }), /aria-labelledby="icon-label"/);
  assert.doesNotMatch(render(MotionIcon, { name, 'aria-labelledby': 'icon-label' }), /aria-hidden/);
  assert.match(render(MotionIcon, { name, label: 'Visible name', 'aria-hidden': true }), /aria-hidden="true"/);
  report.ssrCases += 6;
}

function callbackAndCompatibilityChecks() {
  // Inspect the host element before React's HTML renderer omits event props. A callback-free icon
  // must not introduce a function prop that a React Server Components renderer cannot serialize.
  for (const name of motionIconNames) {
    const host = captureMotionHost({ name });
    assert.equal(host.type, 'svg');
    assert.equal(host.props.onAnimationEnd, undefined, `Unconditional native event handler: ${name}`);
    report.callbackCases++;
  }
  for (const props of [
    { name: 'send', active: true },
    { name: 'audio-waveform', active: false, repeat: true, trigger: 'interaction' },
    { name: 'audio-waveform', active: true, repeat: true, emphasis: 'hint' },
    { name: 'audio-waveform', active: true, repeat: true },
  ]) {
    let completed = 0;
    const forwarded = [];
    const rendered = captureMotionHost({ ...props,
      onMotionComplete: () => completed++,
      onAnimationEnd: event => forwarded.push(event.animationName),
    });
    const host = rendered.type === 'svg' ? rendered : rendered.props.element;
    for (const animationName of ['easm-part-send-plane', 'easm-part-rest-layer']) {
      host.props.onAnimationEnd({ animationName });
    }
    assert.equal(completed, 0, 'A component track or resting layer must not report scene completion');
    host.props.onAnimationEnd({ animationName: 'easm-part-sequence-layer' });
    const loops = props.active && props.repeat;
    assert.equal(completed, loops ? 0 : 1, 'Completion must match bounded playback, including hints');
    assert.deepEqual(forwarded, ['easm-part-send-plane', 'easm-part-rest-layer', 'easm-part-sequence-layer']);
    report.callbackCases++;
  }
  let forwarded = 0;
  const ordinary = captureMotionHost({ name: 'send', onAnimationEnd: () => forwarded++ });
  ordinary.props.onAnimationEnd({ animationName: 'easm-part-sequence-layer' });
  assert.equal(forwarded, 1, 'Standard SVG animation listeners remain supported');
  report.callbackCases++;
  for (const [preset, spec] of Object.entries(motionPresets)) {
    const recipe = getIconMotion(spec.icon);
    const resting = render(AnimatedIcon, { preset, label: spec.label });
    assert.match(resting, /role="img"/);
    assert.doesNotMatch(resting, /data-active="true"/);
    const active = render(AnimatedIcon, { preset, active: true });
    assert.match(active, /data-active="true"/);
    if (recipe) {
      assert.match(active, /data-motion="parts"/);
      assert.equal(spec.durationMs, recipe.durationMs, `Preset duration differs from its directed sequence: ${preset}`);
    } else {
      assert.match(active, /data-motion="spin"/);
    }
    if (spec.loopAllowed) assert.match(render(AnimatedIcon, { preset, active: true, repeat: true }), /data-repeat="true"/);
    else assert.throws(() => render(AnimatedIcon, { preset, repeat: true }), /does not permit looping/);
    report.compatibilityCases++;
  }
  assert.throws(() => render(AnimatedIcon, { preset: 'toString' }), /Unknown EASM motion preset/);
  assert.throws(() => render(AnimatedIcon, { preset: 'nonexistent' }), /Unknown EASM motion preset/);
  report.compatibilityCases += 2;
}

async function raster(svg) {
  return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function differences(a, b) {
  assert.equal(a.info.width, b.info.width);
  assert.equal(a.info.height, b.info.height);
  let pixels = 0, maximum = 0, total = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    let changed = false;
    for (let c = 0; c < 4; c++) {
      const delta = Math.abs(a.data[i + c] - b.data[i + c]);
      maximum = Math.max(maximum, delta);
      total += delta;
      if (delta) changed = true;
    }
    if (changed) pixels++;
  }
  return { pixels, maximum, total };
}

async function content(page, body) {
  await page.setContent(`<!doctype html><html><head><style>${css}\nbody{margin:24px;background:#fff} .row{display:flex;gap:24px;align-items:center;min-height:48px} button{padding:8px} </style></head><body>${body}</body></html>`);
}

/* Serialize actual browser-computed paints and local transforms, including SVG transform origins.
 * This gives sharp the frame the browser drew, with no unresolved CSS variables or CSS animation. */
async function serialize(page, selector = 'svg', phase) {
  return page.evaluate(({ selector, phase }) => {
    const svgs = [...document.querySelectorAll(selector)];
    if (phase !== undefined) {
      for (const svg of svgs) {
        const animations = svg.getAnimations({ subtree: true });
        const end = Math.max(1, ...animations.map(animation => animation.effect.getComputedTiming().endTime));
        for (const animation of animations) {
          animation.pause();
          animation.currentTime = end * phase;
        }
      }
    }
    const paintProps = ['color', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width',
      'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-dasharray',
      'stroke-dashoffset', 'opacity', 'visibility', 'mask-type'];
    return svgs.map(svg => {
      const clone = svg.cloneNode(true);
      const originals = [svg, ...svg.querySelectorAll('*')];
      const copies = [clone, ...clone.querySelectorAll('*')];
      const localReference = value => value.replace(/url\(["']?(?:[^#)"']*)#([^"')]+)["']?\)/g, 'url(#$1)');
      let clipNumber = 0;
      const definitions = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      originals.forEach((element, index) => {
        const copy = copies[index];
        const style = getComputedStyle(element);
        copy.removeAttribute('class');
        if (element.classList?.contains('easm-motion-rest')) copy.setAttribute('data-sampled-role', 'rest');
        if (element.classList?.contains('easm-motion-sequence')) copy.setAttribute('data-sampled-role', 'sequence');
        copy.removeAttribute('style');
        for (const property of paintProps) copy.style.setProperty(property, style.getPropertyValue(property));
        if (style.maskImage !== 'none' && style.maskImage.includes('url(')) copy.setAttribute('mask', localReference(style.maskImage));
        if (style.clipPath !== 'none' && style.clipPath.startsWith('url(')) {
          copy.setAttribute('clip-path', localReference(style.clipPath));
        } else if (style.clipPath !== 'none') {
          const inset = style.clipPath.match(/^inset\(([^)]+)\)(?:\s+(view-box|fill-box|stroke-box|border-box))?$/);
          if (!inset) throw new Error(`Unsupported sampled clip shape: ${style.clipPath}`);
          const values = inset[1].trim().split(/\s+/);
          const expanded = values.length === 1 ? [values[0],values[0],values[0],values[0]]
            : values.length === 2 ? [values[0],values[1],values[0],values[1]]
            : values.length === 3 ? [values[0],values[1],values[2],values[1]] : values;
          if (expanded.length !== 4 || !expanded.every(value => /^-?[\d.]+(?:px|%)?$/.test(value))) {
            throw new Error(`Inset clip is not a supported static rectangle: ${style.clipPath}`);
          }
          const view = svg.viewBox.baseVal;
          const local = inset[2] === 'fill-box' || inset[2] === 'stroke-box' ? element.getBBox() : view;
          const length = (value, axis) => value.endsWith('%') ? parseFloat(value) * axis / 100 : parseFloat(value);
          const top = length(expanded[0], local.height), right = length(expanded[1], local.width);
          const bottom = length(expanded[2], local.height), left = length(expanded[3], local.width);
          const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
          const id = `sampled-clip-${++clipNumber}`;
          clip.setAttribute('id', id); clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', String(local.x + left)); rect.setAttribute('y', String(local.y + top));
          rect.setAttribute('width', String(Math.max(0, local.width - left - right)));
          rect.setAttribute('height', String(Math.max(0, local.height - top - bottom)));
          rect.setAttribute('fill', '#000'); rect.setAttribute('stroke', 'none');
          clip.appendChild(rect); definitions.appendChild(clip);
          copy.setAttribute('clip-path', `url(#${id})`);
        }
        // librsvg does not normalize dash lengths with SVG pathLength the way Chromium does.
        // Bake that normalization into physical user units before rasterizing the sampled frame.
        if (element.getTotalLength && element.hasAttribute('pathLength')) {
          const nominal = Number(element.getAttribute('pathLength'));
          const scale = nominal > 0 ? element.getTotalLength() / nominal : 1;
          for (const property of ['stroke-dasharray', 'stroke-dashoffset']) {
            const value = style.getPropertyValue(property);
            if (value !== 'none') copy.style.setProperty(property,
              value.replace(/calc\(([-+]?\d*\.?\d+(?:e[-+]?\d+)?)(?:px)?\)/gi, '$1')
                .replace(/(-?\d*\.?\d+(?:e[-+]?\d+)?)(px)?/gi, (_, number) => String(Number(number) * scale)));
          }
        }
        if (element !== svg && element.closest('defs')) {
          // A mask mirror has no normal SVGGraphicsElement parent, so getCTM cannot reliably
          // provide its local matrix. Bake its computed CSS transform around the same view-box
          // origin used by the visible actor. Static geometry attributes remain untouched.
          if (style.transform !== 'none') {
            const [x,y] = style.transformOrigin.split(/\s+/).map(parseFloat);
            const matrix = new DOMMatrix().translate(x || 0,y || 0).multiply(new DOMMatrix(style.transform)).translate(-(x || 0),-(y || 0));
            copy.setAttribute('transform', `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`);
          }
        } else if (element !== svg && element.getCTM && element.parentElement?.getCTM) {
          const parent = element.parentElement.getCTM(), current = element.getCTM();
          // A legitimate fully closed reveal may collapse its parent to zero area. Its children
          // cannot contribute visible ink, and an inverse does not exist at that exact instant.
          if (parent && current) {
            const matrix = parent.a * parent.d - parent.b * parent.c === 0 ? new DOMMatrix() : parent.inverse().multiply(current);
            copy.setAttribute('transform', `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`);
          }
        }
      });
      if (definitions.childNodes.length) clone.insertBefore(definitions, clone.firstChild);
      return new XMLSerializer().serializeToString(clone);
    });
  }, { selector, phase });
}

async function maskSerializationChecks(page) {
  // A compositor oracle: moving black geometry must erase ink, and a referenced URL clip
  // must retain its receiver. These fixtures catch masks silently lost by the sampler itself.
  for (const inline of [false,true]) {
    await content(page, `<svg width="24" height="24" viewBox="0 0 24 24"><defs>
      <mask id="sampler-mask" maskUnits="userSpaceOnUse" style="mask-type:luminance;forced-color-adjust:none">
        <rect width="24" height="24" fill="white"/><g style="transform:translate(6px,0);transform-origin:12px 12px;transform-box:view-box"><rect x="4" y="4" width="4" height="4" fill="black"/></g>
      </mask><clipPath id="sampler-clip"><rect x="2" y="2" width="20" height="20"/></clipPath></defs>
      <g ${inline ? 'style="mask:url(#sampler-mask);clip-path:url(#sampler-clip)"' : 'mask="url(#sampler-mask)" clip-path="url(#sampler-clip)"'}><rect width="24" height="24" fill="red"/></g></svg>`);
    const [svg] = await serialize(page), image = await raster(svg);
    const alpha = (x,y) => image.data[(y*24+x)*4+3];
    check(alpha(12,6) === 0 && alpha(6,6) === 255 && alpha(1,1) === 0,
      'The frame sampler loses a moved luminance mask or a URL clipping receiver', { inline, erased:alpha(12,6), retained:alpha(6,6), outside:alpha(1,1) });
    report.maskSerializationCases++;
  }
}

async function comparePairs(page, cases, motionProps = {}) {
  const body = cases.map((props, index) => `<div class="row" data-case="${index}">${render(Icon, props)}${render(MotionIcon, { ...props, ...motionProps })}</div>`).join('');
  await content(page, body);
  const svgs = await serialize(page);
  await Promise.all(cases.map(async (props, index) => {
    const delta = differences(await raster(svgs[index * 2]), await raster(svgs[index * 2 + 1]));
    check(delta.pixels === 0, 'Resting pixels differ from the approved drawing', { ...props, difference: delta });
    report.pixelComparisons++;
  }));
}

async function restingChecks(page) {
  await comparePairs(page, [{ name: iconNames.find(name => !getIconMotion(name)), size:24 }], {active:true});
  for (const size of [16, 20, 24, 32]) {
    await comparePairs(page, motionIconNames.map(name => ({ name, size })));
  }
  const representatives = [...new Set(['send', 'inbox', 'notification', 'audio-waveform', 'user', 'shield-lock', 'save', motionIconNames[0]])]
    .filter(name => getIconMotion(name));
  for (const variant of [{ state: 'hover' }, { state: 'pressed' }, { state: 'selected' }, { state: 'disabled' },
    { tone: 'neutral' }, { tone: 'inverse' }, { tone: 'inherit', style: { color: '#a02972' } }, { outline: true }]) {
    await comparePairs(page, representatives.map(name => ({ name, size: 24, ...variant })));
  }
  const aliases = iconNames.filter(name => getIconMotion(name) && getIconMotion(name).name !== name);
  await comparePairs(page, aliases.map(name => ({ name, size: 24 })));
  for (const emphasis of ['action','hint']) {
    for (const size of [20,24]) await comparePairs(page, motionIconNames.map(name => ({ name, size })), { repeat: true, emphasis });
  }
}

async function semanticFrame(page, phase, probes = {}) {
  const markup = (await serialize(page, 'svg', phase))[0];
  const measurements = await page.evaluate(probes => {
    const svg = document.querySelector('svg');
    const inverse = svg.getCTM().inverse();
    return Object.fromEntries([...svg.querySelectorAll('.easm-motion-part')].map(part => {
      const box = part.getBBox(), matrix = inverse.multiply(part.getCTM());
      const points = [[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]]
        .map(([x,y]) => new DOMPoint(x,y).matrixTransform(matrix));
      const left = Math.min(...points.map(point => point.x)), right = Math.max(...points.map(point => point.x));
      const top = Math.min(...points.map(point => point.y)), bottom = Math.max(...points.map(point => point.y));
      return [part.dataset.part, { temporary: part.dataset.temporary === 'true',
        matrix: Object.fromEntries(['a','b','c','d','e','f'].map(key => [key,matrix[key]])),
        box: { left,right,top,bottom,cx:(left+right)/2,cy:(top+bottom)/2 },
        opacity: Number(getComputedStyle(part).opacity), visibility: getComputedStyle(part).visibility,
        strokeWidth: parseFloat(getComputedStyle(part).strokeWidth),
        strokeProbes: (probes[part.dataset.part] ?? []).map(([x,y]) => [...part.querySelectorAll('path,rect,line,polyline,circle,ellipse')]
          .some(shape => { const point = new DOMPoint(x,y).matrixTransform(shape.getCTM().inverse().multiply(svg.getCTM()));
            return shape.isPointInStroke(point); })) }];
    }));
  }, probes);
  const isolated = await page.evaluate(markup => {
    const source = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
    return [...source.querySelectorAll('[data-part]')].map(part => {
      const clone = source.cloneNode(true);
      clone.querySelector('[data-sampled-role="rest"]')?.remove();
      for (const candidate of clone.querySelectorAll('[data-part]')) {
        if (candidate.dataset.part !== part.dataset.part) candidate.style.display = 'none';
      }
      const without = source.cloneNode(true);
      without.querySelector(`[data-part="${part.dataset.part}"]`).style.display = 'none';
      return [part.dataset.part, new XMLSerializer().serializeToString(clone), new XMLSerializer().serializeToString(without)];
    });
  }, markup);
  const enlarge = svg => svg.replace(/width="24"/, 'width="240"').replace(/height="24"/, 'height="240"');
  const full = await raster(enlarge(markup));
  await Promise.all(isolated.map(async ([id, svg, without]) => {
    const image = await raster(enlarge(svg));
    let pixels = 0, alpha = 0, left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (let offset = 3; offset < image.data.length; offset += 4) {
      if (image.data[offset]) {
        pixels++;
        const point = (offset - 3) / 4, x = point % image.info.width, y = Math.floor(point / image.info.width);
        left = Math.min(left, x); right = Math.max(right, x + 1);
        top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
      }
      alpha += image.data[offset] / 255;
    }
    measurements[id].ink = { pixels, alpha,
      box: pixels ? { left: left / 10, right: right / 10, top: top / 10, bottom: bottom / 10 } : null };
    // An isolated actor may exist yet be completely covered by a later lid or receiver. A causal
    // event is only visible if removing that actor changes the composed picture the user sees.
    measurements[id].contribution = differences(full, await raster(enlarge(without)));
  }));
  measurements.$scene = { hash: crypto.createHash('sha256').update(full.data).digest('hex') };
  return measurements;
}

// The rules in src/motion-directed.ts that a browser can measure. A motion never makes its icon
// disappear (only send, whose plane flies out and back, may leave the box for a moment), adds no
// geometry, ends on the approved drawing, and repeats without a pause only for real activity.
const ACTIVITY = ['audio-waveform', 'voice', 'recording', 'brain-circuit', 'workflow'];
const LEAVES_THE_BOX = new Set(['send']);
// A blink closes the eye to a line: still the eye, with less ink. Nothing else may thin that far.
const CLOSES = new Set(['eye']);
async function inkOf(svgs) {
  return Promise.all(svgs.map(async svg => {
    const image = await raster(svg.replace(/width="24"/, 'width="96"').replace(/height="24"/, 'height="96"'));
    let alpha = 0;
    for (let offset = 3; offset < image.data.length; offset += 4) alpha += image.data[offset] / 255;
    return alpha;
  }));
}
async function directionChecks(page) {
  await content(page, motionIconNames.map(name => render(Icon, { name })).join(''));
  const resting = await inkOf(await serialize(page));
  for (const repeat of [false, true]) {
    await content(page, motionIconNames.map(name => render(MotionIcon, { name, active: true, repeat })).join(''));
    for (const phase of [.1, .2, .3, .4, .5, .6, .7, .8, .9]) {
      let frames;
      if (repeat) { await setCycleTime(page, 2 + phase); frames = await serialize(page); }
      else frames = await serialize(page, 'svg', phase);
      const ink = await inkOf(frames);
      motionIconNames.forEach((name, index) => {
        const kept = ink[index] / resting[index];
        if (!LEAVES_THE_BOX.has(name)) check(kept >= (CLOSES.has(name) ? .25 : .5), 'A motion makes its icon disappear', { name, repeat, phase, kept: +kept.toFixed(2) });
        check(kept <= 1.6, 'A motion paints far more than its icon (added geometry)', { name, repeat, phase, kept: +kept.toFixed(2) });
        report.semanticMilestones++;
      });
    }
  }
}

async function frameChecks(page) {
  await content(page, iconMotionRecipes.map(recipe => `<div class="row">${render(MotionIcon, { name: recipe.name, active: true })}</div>`).join(''));
  const structure = await page.evaluate(() => [...document.querySelectorAll('svg')].map(svg => {
    const moving = [...svg.querySelectorAll('.easm-motion-part[data-moving="true"]')];
    const animations = svg.getAnimations({ subtree: true });
    const animationTargets = animations.map(animation => animation.effect.target);
    return {
      name: svg.dataset.icon,
      moving: moving.length,
      animated: moving.filter(part => animationTargets.includes(part)).length,
      outerTransform: getComputedStyle(svg).transform,
      artworkTransform: getComputedStyle(svg.querySelector('.easm-icon-artwork')).transform,
      invalidTargets: animationTargets.filter(target => !target.matches('.easm-motion-part, .easm-motion-mask-part, .easm-motion-rest, .easm-motion-sequence')).length,
      movingLayers: [...svg.querySelectorAll('.easm-motion-rest, .easm-motion-sequence')]
        .some(layer => getComputedStyle(layer).transform !== 'none' || getComputedStyle(layer).opacity !== '1'),
      layerEffectsBeyondVisibility: animations.filter(animation => animation.effect.target.matches('.easm-motion-rest, .easm-motion-sequence'))
        .some(animation => animation.effect.getKeyframes().some(frame => Object.keys(frame)
          .some(property => !['offset', 'computedOffset', 'easing', 'composite', 'visibility'].includes(property)))),
      windows: [...svg.querySelectorAll('.easm-motion-window')].map(window => ({
        clip: getComputedStyle(window).clipPath, transform: getComputedStyle(window).transform,
        animated: animations.some(animation => animation.effect.target === window),
      })),
      repeated: svg.getAnimations({ subtree: true }).some(animation => animation.effect.getTiming().iterations !== 1),
    };
  }));
  for (const result of structure) {
    check(result.moving > 0 && result.moving === result.animated, 'A moving semantic part has no runnable CSS keyframes', result);
    check(result.outerTransform === 'none' && result.artworkTransform === 'none' && result.invalidTargets === 0
      && !result.movingLayers && !result.layerEffectsBeyondVisibility,
      'Animation moves the whole SVG or artwork rather than semantic parts', result);
    check(!result.repeated, 'An action repeats without an explicit process request', result);
    check(result.windows.every(window => window.clip !== 'none' && window.transform === 'none' && !window.animated),
      'A declared clipping window is missing or moves with its payload', result);
  }
  const reference = new Map();
  let moving = new Set();
  for (const phase of [0, .125, .25, .375, .5, .625, .75, .875, 1]) {
    const frames = await serialize(page, 'svg', phase);
    await Promise.all(frames.map(async (svg, index) => {
      const recipe = iconMotionRecipes[index];
      const current = await raster(svg);
      if (phase === 0) reference.set(recipe.name, current);
      else if (differences(reference.get(recipe.name), current).pixels > 0) moving.add(recipe.name);
      const expanded = svg.replace(/width="24"/, 'width="280"').replace(/height="24"/, 'height="280"')
        .replace('viewBox="0 0 24 24"', 'viewBox="-2 -2 28 28"');
      const over = await raster(expanded);
      let outside = 0;
      for (let y = 0; y < 280; y++) for (let x = 0; x < 280; x++) {
        if ((x < 20 || y < 20 || x >= 260 || y >= 260) && over.data[(y * 280 + x) * 4 + 3] > 10) outside++;
      }
      check(outside === 0, 'Motion clips beyond the approved 24-unit viewBox', { name: recipe.name, phase, outside });
      report.animationSamples++;
    }));
  }
  for (const name of motionIconNames) check(moving.has(name), 'The active recipe produces no visible movement', { name });
  const final = await serialize(page, 'svg', 1);
  await content(page, motionIconNames.map(name => render(Icon, { name })).join(''));
  const resting = await serialize(page);
  await Promise.all(final.map(async (svg, index) => {
    const delta = differences(await raster(svg), await raster(resting[index]));
    check(delta.pixels === 0, 'One-shot animation does not return to its original drawing', { name: motionIconNames[index], difference: delta });
    report.pixelComparisons++;
  }));
}

async function suppressionChecks(page, playback = {}) {
  const active = () => motionIconNames.map(name => render(MotionIcon, { name, active: true, ...playback })).join('');
  const variants = [
    ['off', `<div data-easm-motion="off">${active()}</div>`],
    ['manual-reduced', `<div data-easm-motion="reduced">${active()}</div>`],
    ['disabled-parent', `<button disabled>${active()}</button>`],
    ['aria-disabled-parent', `<div aria-disabled="true">${active()}</div>`],
    ['inert-parent', `<div inert>${active()}</div>`],
    ['off-icon', motionIconNames.map(name => render(MotionIcon, { name, active: true, ...playback, 'data-easm-motion': 'off' })).join('')],
    ['reduced-icon', motionIconNames.map(name => render(MotionIcon, { name, active: true, ...playback, 'data-easm-motion': 'reduced' })).join('')],
    ['aria-disabled-icon', motionIconNames.map(name => render(MotionIcon, { name, active: true, ...playback, 'aria-disabled': true })).join('')],
    ['disabled-icon', motionIconNames.map(name => render(MotionIcon, { name, active: true, ...playback, state: 'disabled' })).join('')],
    ['os-reduced', active()],
  ];
  for (const [kind, body] of variants) {
    if (kind === 'os-reduced') await page.emulateMedia({ reducedMotion: 'reduce' });
    await content(page, body);
    const animated = await page.evaluate(() => document.getAnimations().length);
    check(animated === 0, 'Motion suppression leaves active animations', { kind, animated, ...playback });
    const staticMarkup = motionIconNames.map(name => render(Icon, { name, state: kind === 'disabled-icon' ? 'disabled' : 'default' })).join('');
    const stopped = await serialize(page);
    await content(page, staticMarkup);
    const original = await serialize(page);
    await Promise.all(stopped.map(async (svg, index) => {
      const delta = differences(await raster(svg), await raster(original[index]));
      check(delta.pixels === 0, 'Suppressed motion does not show the approved static drawing', { kind, ...playback, name: motionIconNames[index], difference: delta });
      report.suppressionCases++;
    }));
    if (kind === 'os-reduced') await page.emulateMedia({ reducedMotion: 'no-preference' });
  }
  const pausable = motionIconNames[0];
  await content(page, render(MotionIcon, { name: pausable, active: true, ...playback, paused: true }));
  const frozenA = await serialize(page);
  await page.waitForTimeout(180);
  const frozenB = await serialize(page);
  assert.deepEqual(frozenA, frozenB, 'Paused motion changes over time');
  assert.ok(await page.evaluate(() => document.getAnimations().every(animation => animation.playState === 'paused')));
  report.suppressionCases++;
  for (const recipe of iconMotionRecipes) {
    await content(page, render(MotionIcon, { name: recipe.name, active: true, repeat: true }));
    const iterations = await page.evaluate(() => document.getAnimations().map(animation => animation.effect.getTiming().iterations));
    check(iterations.length > 0 && iterations.every(value => value === Infinity), 'An ongoing process does not repeat all its moving parts', { name: recipe.name });
  }
}

async function lifecycleChecks(page) {
  await content(page, motionIconNames.map(name => render(MotionIcon, { name, active: true })).join(''));
  await serialize(page, 'svg', .375);
  await page.evaluate(() => {
    window.previousIconAnimations = new Set(document.getAnimations());
    document.querySelectorAll('svg').forEach(svg => svg.removeAttribute('data-active'));
  });
  check(await page.evaluate(() => document.getAnimations().length === 0), 'Stopping activity leaves stale animations');
  const stopped = await serialize(page);
  await page.evaluate(() => document.querySelectorAll('svg').forEach(svg => svg.dataset.active = 'true'));
  const restarted = await page.evaluate(() => {
    const animations = document.getAnimations();
    return animations.length > 0 && animations.every(animation => !window.previousIconAnimations.has(animation));
  });
  check(restarted, 'A second real event cannot restart the motion sequence');
  await content(page, motionIconNames.map(name => render(Icon, { name })).join(''));
  const original = await serialize(page);
  await Promise.all(stopped.map(async (svg, index) => {
    const delta = differences(await raster(svg), await raster(original[index]));
    check(delta.pixels === 0, 'Stopping activity does not immediately restore the approved static drawing', { name: motionIconNames[index], difference: delta });
    report.lifecycleCases++;
  }));
  report.lifecycleCases += 2;
}

async function interactionChecks(page) {
  // Unhydrated server markup must stay still. Interactive completion/exit behaviour is exercised
  // through the actual React/controller harness below, rather than assuming a CSS hover toggle.
  await content(page, `<button id="interactive">${render(MotionIcon, { name: 'send', trigger: 'interaction' })}</button>`);
  await page.locator('#interactive').hover();
  check(await page.evaluate(() => document.getAnimations().length === 0), 'Server markup animates before its interaction controller is mounted');
  report.interactionCases++;
}

async function setCycleTime(page, cycle, offsetMs = 0) {
  await page.evaluate(({ cycle, offsetMs }) => {
    for (const svg of document.querySelectorAll('svg[data-recipe]')) {
      const animations = svg.getAnimations({ subtree: true });
      const duration = Number(animations[0]?.effect.getTiming().duration);
      for (const animation of animations) { animation.pause(); animation.currentTime = duration * cycle + offsetMs; }
    }
  }, { cycle, offsetMs });
}

async function smoothLoopChecks(page) {
  // Infinite animations sample the next iteration at an exact period. Comparing t=0 with t=T
  // would therefore pass even for a visible discontinuity. Compare the true near-limits after
  // multiple cycles, then retain ordinary 60fps boundary steps for human motion review.
  for (const emphasis of ['action','hint']) for (const size of [20,24]) {
    await content(page, iconMotionRecipes.map(recipe => render(MotionIcon, {
      name: recipe.name, size, active: true, repeat: true, emphasis,
    })).join(''));
    const structure = await page.evaluate(() => [...document.querySelectorAll('svg')].map(svg => {
      const animations = svg.getAnimations({ subtree: true });
      animations.forEach(animation => animation.pause());
      return { name: svg.dataset.icon, timing: animations.map(animation => {
        const t = animation.effect.getTiming();
        return { duration: t.duration, delay: t.delay, iterations: t.iterations,
          direction: t.direction, part: animation.effect.target.matches('.easm-motion-part,.easm-motion-mask-part') };
      }),
      outer: getComputedStyle(svg).transform,
      artwork: getComputedStyle(svg.querySelector('.easm-icon-artwork')).transform,
      sequence: getComputedStyle(svg.querySelector('.easm-motion-sequence')).visibility,
      rest: getComputedStyle(svg.querySelector('.easm-motion-rest')).visibility,
      layersStill: [...svg.querySelectorAll('.easm-motion-rest,.easm-motion-sequence')]
        .every(layer => getComputedStyle(layer).transform === 'none' && getComputedStyle(layer).opacity === '1'),
      windowsStill: [...svg.querySelectorAll('.easm-motion-window')].every(window =>
        getComputedStyle(window).transform === 'none' && getComputedStyle(window).clipPath !== 'none'
        && !animations.some(animation => animation.effect.target === window)),
      };
    }));
    for (const result of structure) {
      const recipe = getIconMotion(result.name), duration = recipe.loopDurationMs ?? recipe.durationMs;
      // A part's delay is a constant phase offset within the shared cycle (a stagger), never a second clock.
      check(result.timing.length > 0 && result.timing.every(item => item.part && Math.abs(item.duration - duration) < .000001
        && item.delay >= 0 && item.delay < duration && item.iterations === Infinity && item.direction === 'normal'),
      'Repeating actors do not share one forward cycle clock', { ...result, emphasis, size });
      check(result.outer === 'none' && result.artwork === 'none' && result.layersStill && result.windowsStill,
        'A repeated scene moves the whole drawing or its receiving window', { name: result.name, emphasis, size });
      check(result.sequence === 'visible' && result.rest === 'hidden',
        'A repeating scene swaps to the static original at its seam', { name: result.name, emphasis, size, ...result });
      report.loopModeCases += 3;
    }
    const captured = new Map();
    async function capture(key, cycle, offsetMs = 0) {
      await setCycleTime(page, cycle, offsetMs);
      captured.set(key, await Promise.all((await serialize(page)).map(raster)));
    }
    await capture('limitBefore', 3 - 1e-7);
    await capture('limitAfter', 3 + 1e-7);
    await capture('cycleA', 2.375);
    await capture('cycleB', 3.375);
    for (const offset of [-25,-1000/120,1000/120,25]) await capture(`step${offset}`, 3, offset);
    for (let index = 0; index < iconMotionRecipes.length; index++) {
      const name = iconMotionRecipes[index].name;
      const limit = differences(captured.get('limitBefore')[index], captured.get('limitAfter')[index]);
      // One channel level is the only tolerance: subpixel antialiasing may round on opposite
      // sides of an otherwise identical painted endpoint. Coordinate resets are allowed only
      // when they leave the composed picture continuous (e.g. a hidden delivered packet).
      check(limit.maximum <= 1, 'A cycle boundary has a discontinuous composed picture', { name, emphasis, size, difference: limit });
      const drift = differences(captured.get('cycleA')[index], captured.get('cycleB')[index]);
      check(drift.pixels === 0, 'The same point in successive cycles changes or drifts', { name, emphasis, size, difference: drift });
      const steps = [-25,-1000/120,1000/120,25].map(offset => captured.get(`step${offset}`)[index]);
      report.loopSeamStatistics.push({ name, emphasis, size, limit,
        equalFrameSteps: [differences(steps[0],steps[1]), differences(steps[1],steps[2]), differences(steps[2],steps[3])] });
      report.loopContinuityCases += 2;
    }
    const mirrors = await page.evaluate(() => [...document.querySelectorAll('.easm-motion-mask-part[data-mask-part]')].map(mirror => {
      const svg = mirror.ownerSVGElement;
      const actor = [...svg.querySelectorAll('.easm-motion-part[data-part]')].find(part => part.dataset.part === mirror.dataset.maskPart);
      const a = actor ? getComputedStyle(actor) : null, m = getComputedStyle(mirror);
      return { name:svg.dataset.icon,part:mirror.dataset.maskPart,insideDefs:!!mirror.closest('defs'),actor:!!actor,
        sameClock:!!a && a.animationDuration===m.animationDuration && a.animationDelay===m.animationDelay && a.animationIterationCount===m.animationIterationCount,
        samePose:!!a && a.transform===m.transform && a.transformOrigin===m.transformOrigin && a.opacity===m.opacity };
    }));
    for (const mirror of mirrors) {
      check(mirror.actor && mirror.insideDefs && mirror.sameClock && mirror.samePose,
        'An occlusion silhouette detaches from its actor or playback clock', { ...mirror,emphasis,size });
      report.maskMirrorCases++;
    }
    const reference = new Map();
    const moving = new Set();
    for (const phase of [0,.125,.25,.375,.5,.625,.75,.875]) {
      await setCycleTime(page, 2 + phase);
      const frames = await serialize(page);
      await Promise.all(frames.map(async (svg,index) => {
        const name = iconMotionRecipes[index].name, frame = await raster(svg);
        if (phase === 0) reference.set(name, frame);
        else if (differences(reference.get(name),frame).pixels) moving.add(name);
        if (size === 24) {
          const expanded = svg.replace(/width="24"/, 'width="280"').replace(/height="24"/, 'height="280"')
            .replace('viewBox="0 0 24 24"', 'viewBox="-2 -2 28 28"');
          const over = await raster(expanded);
          let outside = 0;
          for (let y = 0; y < 280; y++) for (let x = 0; x < 280; x++) {
            if ((x < 20 || y < 20 || x >= 260 || y >= 260) && over.data[(y * 280 + x) * 4 + 3] > 10) outside++;
          }
          check(outside === 0, 'A recurring actor paints beyond the approved viewBox', { name, emphasis, phase, outside });
        }
        report.loopBoundsSamples++;
      }));
    }
    for (const name of motionIconNames) check(moving.has(name), 'A recurring scene has no visible action', { name, emphasis, size });
    // Freeze actual in-flight loop tracks; suppression is covered separately and must restore
    // the original. This assertion intentionally preserves a non-rest frame while paused.
    await setCycleTime(page, 2.43);
    const frozen = await serialize(page);
    await page.waitForTimeout(70);
    check(JSON.stringify(frozen) === JSON.stringify(await serialize(page)), 'Paused recurring actors advance or reset', { emphasis, size });
    await page.evaluate(() => {
      window.__previousLoopTracks = new Set(document.getAnimations());
      document.querySelectorAll('svg').forEach(svg => svg.removeAttribute('data-active'));
    });
    check(await page.evaluate(() => !document.getAnimations().length), 'Stopping a recurring scene leaves live tracks', { emphasis, size });
    const stopped = await serialize(page);
    await page.evaluate(() => document.querySelectorAll('svg').forEach(svg => svg.dataset.active = 'true'));
    check(await page.evaluate(() => document.getAnimations().length > 0 && document.getAnimations().every(track => !window.__previousLoopTracks.has(track))),
      'Restarting a recurring scene reuses old activity clocks', { emphasis, size });
    await content(page, motionIconNames.map(name => render(Icon, { name, size })).join(''));
    const originals = await serialize(page);
    await Promise.all(stopped.map(async (svg,index) => {
      const difference = differences(await raster(svg), await raster(originals[index]));
      check(difference.pixels === 0, 'Stopping a cycle does not restore the exact original', { name: motionIconNames[index], emphasis, size, difference });
      report.loopLifecycleCases++;
    }));
    report.loopLifecycleCases += 3;
  }
  // A part that does not move keeps its exact frame while the others play.
  await content(page, iconMotionRecipes.map(recipe => render(MotionIcon, { name: recipe.name, active: true })).join(''));
  const drifting = await page.evaluate(() => [...document.querySelectorAll('svg')].flatMap(svg => {
    const still = [...svg.querySelectorAll('.easm-motion-part:not([data-moving])')];
    const original = still.map(part => part.getCTM());
    const animations = svg.getAnimations({ subtree: true });
    const end = Math.max(1, ...animations.map(animation => animation.effect.getComputedTiming().endTime));
    const moved = new Set();
    for (const phase of [.12, .28, .42, .58, .72, .9]) {
      for (const animation of animations) { animation.pause(); animation.currentTime = end * phase; }
      still.forEach((part, index) => { const now = part.getCTM();
        if (['a','b','c','d','e','f'].some(key => Math.abs(now[key] - original[index][key]) > .001)) moved.add(part.dataset.part); });
    }
    return [...moved].map(part => ({ name: svg.dataset.icon, part }));
  }));
  for (const item of drifting) check(false, 'A still part moves while the others play', item);
  report.connectionCases += iconMotionRecipes.length;
}

async function reactLifecycleChecks(page) {
  // Exercise the public component through actual React reconciliation and native CSS animation
  // events. No package files, dev server or compiled release assets are needed for this harness.
  const esbuild = createRequire(path.join(repo, 'packages/ui/package.json'))('esbuild');
  const recipe = getIconMotion('save');
  const durationScale = 2;
  const bundled = await esbuild.build({
    stdin: {
      contents: `
        import { createElement, createRef } from 'react';
        import { createRoot } from 'react-dom/client';
        import { flushSync } from 'react-dom';
        import { MotionIcon } from './src/MotionIcon';
        const root = createRoot(document.getElementById('react-motion-root'));
        const ref = createRef();
        let callbackNode;
        window.__easmRefCleanup = 0;
        window.__easmMotionHarness = {
          render(active, options = {}) {
            const callbackRef = node => {
              callbackNode = node;
              return () => { window.__easmRefCleanup++; };
            };
            flushSync(() => root.render(createElement('button', {
                id: 'react-motion-control', 'aria-label': 'Save', disabled: options.disabled,
                'data-easm-motion': options.motion,
              },
              createElement(MotionIcon, {
                name: options.name || 'save', trigger: 'interaction', active,
                ref: options.callbackRef ? callbackRef : ref,
                paused: options.paused, repeat: options.repeat, emphasis: options.emphasis,
                'data-easm-motion': options.svgMotion,
                style: { '--easm-motion-duration-scale': options.scale || ${durationScale} },
                onMotionComplete: window.__easmMotionCompleted,
              }))));
          },
          get svg() { return ref.current || callbackNode; },
          unmount() { flushSync(() => root.unmount()); },
        };
        window.__easmMotionHarness.render(false);
      `,
      sourcefile: 'part-motion-browser-harness.tsx',
      loader: 'tsx',
      resolveDir: pkg,
    },
    bundle: true, write: false, minify: true, format: 'iife', platform: 'browser', target: 'es2022',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  await page.mouse.move(0, 0);
  await content(page, '<div id="react-motion-root"></div>');
  await page.evaluate(() => {
    window.__easmMotionCompletions = 0;
    window.__easmMotionCompleted = () => {
      window.__easmMotionCompletions++;
      window.__easmMotionCompletedAt = performance.now();
    };
  });
  await page.addScriptTag({ content: bundled.outputFiles[0].text });
  await page.locator('#react-motion-control').hover();
  const transition = await page.evaluate(() => {
    const beforeSvg = document.querySelector('svg');
    const beforeRef = window.__easmMotionHarness.svg;
    const before = beforeSvg.getAnimations({ subtree: true });
    for (const animation of before) animation.currentTime = animation.effect.getComputedTiming().endTime * .4;
    const beforeTimes = before.map(animation => animation.currentTime);
    const prior = new Set(before);
    window.__easmMotionActionStartedAt = performance.now();
    window.__easmMotionHarness.render(true);
    const afterSvg = document.querySelector('svg');
    const after = afterSvg.getAnimations({ subtree: true });
    return {
      hovered: before.length > 0 && beforeTimes.every(time => time > 0),
      sameSvg: beforeSvg === afterSvg,
      sameRef: beforeRef === beforeSvg && beforeRef === window.__easmMotionHarness.svg
        && window.__easmMotionHarness.svg === afterSvg,
      freshTracks: after.length > 0 && after.every(animation => !prior.has(animation)),
      restarted: after.length > 0 && after.every(animation => (animation.currentTime ?? 0) < Math.min(...beforeTimes)),
      prematureCallbacks: window.__easmMotionCompletions,
    };
  });
  check(transition.hovered, 'React interaction preview did not enter an active sequence');
  check(transition.sameSvg, 'Action activation replaced the outer SVG');
  check(transition.sameRef, 'Action activation replaced the forwarded SVG ref');
  check(transition.freshTracks && transition.restarted, 'A confirmed action reuses its in-flight hover animation', transition);
  check(transition.prematureCallbacks === 0, 'Interrupted hover motion reports a completed action', transition);
  await page.waitForFunction(() => window.__easmMotionCompletions > 0, undefined, { timeout: 5000 });
  await page.waitForTimeout(100);
  const completion = await page.evaluate(() => ({
    count: window.__easmMotionCompletions,
    elapsed: window.__easmMotionCompletedAt - window.__easmMotionActionStartedAt,
  }));
  check(completion.count === 1, 'React bounded motion completion does not fire exactly once', completion);
  check(completion.elapsed >= recipe.durationMs * durationScale - 50,
    'Completion fires before the full scene ends', completion);
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.__easmMotionHarness.render(false, { scale: 1, callbackRef: true }));
  await page.locator('#react-motion-control').hover();
  const hintBefore = await page.evaluate(() => {
    window.__easmHintTracks = document.querySelector('svg').getAnimations({ subtree: true });
    for (const track of window.__easmHintTracks) track.currentTime = 180;
    return window.__easmHintTracks.length;
  });
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.__easmMotionHarness.render(false, { scale: 1, callbackRef: true }));
  const refAndExit = await page.evaluate(() => {
    const svg = document.querySelector('svg');
    const tracks = svg.getAnimations({ subtree: true });
    return { active: svg.dataset.active, sameTracks: tracks.length > 0 && tracks.every(track => window.__easmHintTracks.includes(track)), cleanup: window.__easmRefCleanup };
  });
  check(hintBefore > 0 && refAndExit.active === 'true' && refAndExit.sameTracks,
    'Pointer exit or a changing callback ref cuts off a hint', refAndExit);
  check(refAndExit.cleanup > 0, 'React callback-ref cleanup was discarded', refAndExit);
  await page.waitForFunction(() => !document.querySelector('svg').dataset.active, undefined, { timeout: 2500 });

  // A paused hint must keep its own tracks even beyond the original wall-clock deadline.
  await page.locator('#react-motion-control').hover();
  await page.evaluate(() => {
    window.__easmMotionHarness.render(false, { paused: true, scale: 1 });
    window.__easmPausedHintTracks = document.querySelector('svg').getAnimations({ subtree: true });
    for (const track of window.__easmPausedHintTracks) track.currentTime = 200;
  });
  await page.waitForTimeout(recipe.durationMs + 150);
  const pausedHint = await page.evaluate(() => {
    const svg = document.querySelector('svg');
    const tracks = svg.getAnimations({ subtree: true });
    return { active: svg.dataset.active, sameTracks: tracks.length > 0 && tracks.every(track => window.__easmPausedHintTracks.includes(track)), paused: tracks.every(track => track.playState === 'paused') };
  });
  check(pausedHint.active === 'true' && pausedHint.sameTracks && pausedHint.paused,
    'Paused interaction expires on its wall-clock timer', pausedHint);
  await page.evaluate(() => {
    window.__easmMotionHarness.render(false, { scale: 1 });
    for (const track of document.querySelector('svg').getAnimations({ subtree: true })) track.currentTime = Number(track.effect.getComputedTiming().endTime) - 50;
  });
  await page.waitForFunction(() => !document.querySelector('svg').dataset.active, undefined, { timeout: 1500 });

  // A looping-capable icon still gives a bounded interaction hint while inactive.
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.__easmMotionHarness.render(false, { name: 'voice', repeat: true, scale: 1 }));
  await page.locator('#react-motion-control').hover();
  const boundedHint = await page.evaluate(() => {
    const svg = document.querySelector('svg');
    const tracks = svg.getAnimations({ subtree: true });
    return { repeat: svg.dataset.repeat, tracks: tracks.length, bounded: tracks.every(track => track.effect.getTiming().iterations === 1) };
  });
  check(!boundedHint.repeat && boundedHint.tracks > 1 && boundedHint.bounded,
    'An inactive repeat prop puts a hover hint in infinite mode', boundedHint);
  await page.evaluate(() => window.__easmMotionHarness.render(false, { name: 'voice', repeat: true, scale: 1, svgMotion: 'off' }));
  await page.waitForFunction(() => document.querySelector('svg').getAnimations({ subtree: true }).length === 0 && !document.querySelector('svg').dataset.active);
  await page.evaluate(() => window.__easmMotionHarness.render(false, { name: 'voice', repeat: true, scale: 1 }));
  check(await page.evaluate(() => document.querySelector('svg').getAnimations({ subtree: true }).length === 0),
    'Removing motion suppression replays a stale interaction');

  // Native keyboard focus uses the same finite hint; a disabled parent suppresses it immediately.
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => document.querySelector('svg').dataset.active === 'true');
  await page.evaluate(() => window.__easmMotionHarness.render(false, { disabled: true, name: 'voice', repeat: true, scale: 1 }));
  await page.waitForFunction(() => document.querySelector('svg').getAnimations({ subtree: true }).length === 0 && !document.querySelector('svg').dataset.active);
  // A manually active cycle runs beyond multiple periods, pauses without losing its clocks,
  // and seeks/resumes on the same SVG and Animation objects. Repeat changes get fresh actors.
  for (const emphasis of ['action','hint']) {
    await page.evaluate(emphasis => {
      window.__easmMotionHarness.render(true, { name: 'save', repeat: true, emphasis, scale: 1 });
      window.__cycleSvg = document.querySelector('svg');
      window.__cycleTracks = window.__cycleSvg.getAnimations({ subtree: true });
      const period = Number(window.__cycleTracks[0].effect.getTiming().duration);
      for (const track of window.__cycleTracks) track.currentTime = 2.43 * period;
      window.__cycleCallbacks = window.__easmMotionCompletions;
      window.__easmMotionHarness.render(true, { name: 'save', repeat: true, emphasis, paused: true, scale: 1 });
    }, emphasis);
    const paused = await page.evaluate(() => {
      const svg = document.querySelector('svg'), tracks = svg.getAnimations({ subtree: true });
      window.__cyclePausedTime = Number(tracks[0].currentTime);
      return { sameSvg: svg === window.__cycleSvg, sameTracks: tracks.length > 0 && tracks.every(track => window.__cycleTracks.includes(track)),
        paused: tracks.every(track => track.playState === 'paused'), repeat: svg.dataset.repeat,
        beyondTwo: tracks.every(track => Number(track.currentTime) > 2 * Number(track.effect.getTiming().duration)) };
    });
    check(paused.sameSvg && paused.sameTracks && paused.paused && paused.repeat === 'true' && paused.beyondTwo,
      'Pausing a multi-cycle public component replaces or rewinds its actors', { emphasis, ...paused });
    await page.waitForTimeout(100);
    check(await page.evaluate(() => document.querySelector('svg').getAnimations({ subtree: true })
      .every(track => Math.abs(Number(track.currentTime) - window.__cyclePausedTime) < 1)),
      'The public paused prop does not freeze its recurring clocks', { emphasis });
    await page.evaluate(emphasis => {
      for (const track of window.__cycleTracks) track.currentTime = Number(track.effect.getTiming().duration) * 3.61;
      window.__cycleSeekTime = Number(window.__cycleTracks[0].currentTime);
      window.__easmMotionHarness.render(true, { name: 'save', repeat: true, emphasis, scale: 1 });
    }, emphasis);
    await page.waitForTimeout(90);
    const resumed = await page.evaluate(() => {
      const svg = document.querySelector('svg'), tracks = svg.getAnimations({ subtree: true });
      return { sameSvg: svg === window.__cycleSvg, sameTracks: tracks.length > 0 && tracks.every(track => window.__cycleTracks.includes(track)),
        running: tracks.every(track => track.playState === 'running'), advanced: tracks.every(track => Number(track.currentTime) > window.__cycleSeekTime + 20),
        callbacks: window.__easmMotionCompletions - window.__cycleCallbacks };
    });
    check(resumed.sameSvg && resumed.sameTracks && resumed.running && resumed.advanced && resumed.callbacks === 0,
      'A seeked recurring component fails to resume its existing clocks or reports one-shot completion', { emphasis, ...resumed });
    const handoff = await page.evaluate(emphasis => {
      window.__easmMotionHarness.render(true, { name: 'save', repeat: false, emphasis, scale: 1 });
      const svg = document.querySelector('svg'), tracks = svg.getAnimations({ subtree: true });
      return { sameSvg: svg === window.__cycleSvg, fresh: tracks.length > 0 && tracks.every(track => !window.__cycleTracks.includes(track)),
        bounded: tracks.every(track => track.effect.getTiming().iterations === 1), repeat: svg.dataset.repeat };
    }, emphasis);
    check(handoff.sameSvg && handoff.fresh && handoff.bounded && !handoff.repeat,
      'Switching a mounted loop to a bounded sequence keeps infinite or stale tracks', { emphasis, ...handoff });
    report.reactLifecycleCases += 4;
  }
  await page.evaluate(() => window.__easmMotionHarness.unmount());
  report.reactLifecycleCases += 16;
}

async function compositedVariantChecks(page, options = {}) {
  const pattern = 'background-color:#fff;background-image:repeating-linear-gradient(45deg,#dae3ed 0px,#dae3ed 4px,#fff 4px,#fff 8px)';
  const normal = [
    {id:'brand-surface',props:{},style:pattern,transparent:false},
    {id:'brand-outline',props:{outline:true},style:pattern,transparent:true},
    {id:'neutral',props:{tone:'neutral'},style:pattern,transparent:true},
    {id:'inverse',props:{tone:'inverse'},style:'background-color:#0f0f0e;background-image:repeating-linear-gradient(45deg,#0f0f0e 0px,#0f0f0e 4px,#283849 4px,#283849 8px)',transparent:true},
    {id:'inherit-purple',props:{tone:'inherit',outline:true},style:pattern+';color:#a02972',transparent:true},
    {id:'inherit-teal',props:{tone:'inherit',outline:true},style:'background-color:#10282b;background-image:linear-gradient(90deg,#10282b,#345157);color:#55e3d4;--easm-ui-surface:#10282b',transparent:true},
  ];
  for (const state of ['hover','pressed','selected']) normal.push({id:`brand-${state}-outline`,props:{outline:true,state},style:pattern,transparent:true});
  const forced = [{id:'forced-brand',props:{},style:'background:Canvas;color:CanvasText',transparent:true},
    {id:'forced-outline',props:{outline:true},style:'background:Canvas;color:CanvasText',transparent:true}];
  for (const [kind,variants] of [['pattern',normal],['forced',forced]]) {
    await page.emulateMedia({forcedColors:kind==='forced'?'active':'none',reducedMotion:'no-preference'});
    const cases = variants.flatMap(variant => ['action','hint'].flatMap(emphasis => [16,20,24,32].map(size => ({...variant,emphasis,size}))));
    await page.setViewportSize({width:1100,height:Math.max(800,Math.ceil(cases.length/8)*92)});
    await content(page, `<style>body{margin:0;background:transparent}.variant-grid{display:grid;grid-template-columns:repeat(8,120px)}.variant-probe{height:92px;padding:12px;box-sizing:border-box}.variant-probe small{display:block;font:9px Arial,sans-serif;padding-top:5px;color:inherit}</style><div class="variant-grid">${cases.map((item,index) => `<div class="variant-probe" data-case="${index}" style="${item.style}">${render(MotionIcon,{name:'copy',active:true,repeat:true,paused:true,size:item.size,emphasis:item.emphasis,...item.props})}<small>${item.id}<br>${item.size}px · ${item.emphasis}</small></div>`).join('')}</div>`);
    await setCycleTime(page,2.70);
    const boxes = await page.evaluate(() => [...document.querySelectorAll('.variant-probe > svg')].map(svg => {
      const rect=svg.getBoundingClientRect(),scale=rect.width/24;
      return {left:Math.ceil(rect.left+11*scale),top:Math.ceil(rect.top+11*scale),
        width:Math.floor(rect.left+18*scale)-Math.ceil(rect.left+11*scale),
        height:Math.floor(rect.top+18*scale)-Math.ceil(rect.top+11*scale),
        whole:{left:Math.round(rect.left),top:Math.round(rect.top),width:Math.round(rect.width),height:Math.round(rect.height)}};
    }));
    const full=await page.screenshot({animations:'allow'});
    if(options.proofDir) fs.writeFileSync(path.join(options.proofDir,`variation-copy-${kind}.png`),full);
    await page.evaluate(()=>document.querySelectorAll('.easm-motion-part[data-part="source-sheet"]').forEach(part=>part.style.setProperty('opacity','0','important')));
    const withoutSource=await page.screenshot({animations:'allow'});
    await page.evaluate(()=>document.querySelectorAll('.variant-probe > svg').forEach(svg=>svg.style.opacity='0'));
    const background=await page.screenshot({animations:'allow'});
    for(let index=0;index<cases.length;index++) {
      const item=cases[index],{whole,...box}=boxes[index];
      const extract=async(buffer,rect)=>sharp(buffer).extract(rect).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      const interior=await extract(full,box), erased=await extract(withoutSource,box), underlay=await extract(background,box);
      const leak=differences(interior,erased);
      check(leak.pixels===0,'Copy rear-sheet edges remain visible through the moving foreground sheet',{variant:item.id,emphasis:item.emphasis,size:item.size,difference:leak});
      if(item.transparent) {
        const patch=differences(interior,underlay);
        check(patch.maximum<=(item.id==='inherit-teal'?1:0),'A transparent foreground face paints over its patterned or gradient background',{variant:item.id,emphasis:item.emphasis,size:item.size,difference:patch});
        report.compositedVariantCases++;
      }
      const retained=differences(await extract(full,whole),await extract(withoutSource,whole));
      check(retained.pixels>0,'An occlusion fix removes the entire Copy source instead of only its covered region',{variant:item.id,emphasis:item.emphasis,size:item.size});
      report.compositedVariantCases+=2;
    }
    const masks=await page.evaluate(()=>[...document.querySelectorAll('mask')].map(mask=>({
      type:getComputedStyle(mask).maskType,adjust:getComputedStyle(mask).forcedColorAdjust})));
    check(masks.every(mask=>mask.type==='luminance'&&mask.adjust==='none'),
      'System colors can recolor the black/white occlusion masks',{kind,masks});
    report.compositedVariantCases++;
  }
  await page.emulateMedia({forcedColors:'none'});
  const disabledCases = ['brand','neutral','inverse','inherit'].flatMap(tone=>[16,20,24,32].map(size=>({name:'copy',state:'disabled',tone,outline:true,size})));
  await content(page,`<style>body{margin:0}.disabled-pair{display:flex;gap:0}.disabled-pair>span{display:block;width:120px;padding:8px;box-sizing:border-box;${pattern};color:#a02972}</style>${disabledCases.map(props=>`<div class="disabled-pair"><span>${render(Icon,props)}</span><span>${render(MotionIcon,{...props,active:true,repeat:true})}</span></div>`).join('')}`);
  check(await page.evaluate(()=>!document.getAnimations().length),'Disabled patterned variants keep live mask or actor tracks');
  const disabled=await serialize(page);
  for(let index=0;index<disabledCases.length;index++) {
    const delta=differences(await raster(disabled[index*2]),await raster(disabled[index*2+1]));
    check(delta.pixels===0,'Disabled variants do not restore the same transparent resting artwork',{...disabledCases[index],difference:delta});
    report.compositedVariantCases++;
  }
  await content(page, `<style>html,body{background:transparent!important}</style>${render(Icon,{name:'document-upload',size:24,style:{width:240,height:240}})}`);
  const native=await sharp(await page.locator('svg').screenshot({animations:'allow',omitBackground:true})).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const sampled=(await serialize(page))[0].replace(/width="24"/,'width="240"').replace(/height="24"/,'height="240"');
  const serialized=await raster(sampled);
  for(const [kind,image] of [['native',native],['sampled',serialized]]) {
    // The badge halo at(16.2,14.8) must erase the underlying page. A white flat-color patch
    // passes white-background screenshots but fails this transparent-alpha assertion.
    const alpha=image.data[(148*image.info.width+162)*4+3];
    check(alpha===0,'A clearance halo is opaque paint instead of genuine transparent erasure',{kind,alpha});
    report.transparentClearanceCases++;
  }
  if(options.proofDir) await page.locator('svg').screenshot({path:path.join(options.proofDir,'variation-transparent-clearance.png'),animations:'allow',omitBackground:true});
}

async function hydrationChecks(page) {
  const prefix = 'qa-hydrated-icons-';
  // document-upload keeps its badge's knock-out mask while its arrow moves, so its instances carry definitions.
  const props = [ {name:'document-upload',active:true,repeat:true,paused:true,outline:true,size:24},
    {name:'document-upload',active:true,repeat:true,paused:true,tone:'inverse',size:24} ];
  function ServerApp() { return React.createElement('main',null,props.map((value,index) => React.createElement(MotionIcon,{...value,key:index}))); }
  const tree = React.createElement(ServerApp);
  const markup = renderToString(tree,{identifierPrefix:prefix});
  const esbuild = createRequire(path.join(repo,'packages/ui/package.json'))('esbuild');
  const bundle = await esbuild.build({stdin:{contents:`
    import { createElement, useEffect } from 'react';
    import { hydrateRoot } from 'react-dom/client';
    import { MotionIcon } from './src/MotionIcon';
    const props = ${JSON.stringify(props)};
    function App() { useEffect(() => { window.__iconsHydrated=true; },[]);
      return createElement('main',null,props.map((props,index)=>createElement(MotionIcon,{...props,key:index}))); }
    window.__hydrationErrors=[];
    hydrateRoot(document.getElementById('hydration-root'),createElement(App),{
      identifierPrefix:${JSON.stringify(prefix)},onRecoverableError:error=>window.__hydrationErrors.push(error.message)
    });`,loader:'tsx',resolveDir:pkg,sourcefile:'mask-hydration-harness.tsx'},bundle:true,write:false,minify:true,
    format:'iife',platform:'browser',target:'es2022',define:{'process.env.NODE_ENV':'"production"'}});
  await content(page,`<div id="hydration-root">${markup}</div>`);
  const before = await page.evaluate(() => { window.__ssrSvgs=[...document.querySelectorAll('svg')];
    return [...document.querySelectorAll('svg [id]')].map(element=>element.id); });
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.waitForFunction(()=>window.__iconsHydrated);
  const hydrated = await page.evaluate(() => ({ids:[...document.querySelectorAll('svg [id]')].map(element=>element.id),
    sameSvgs:[...document.querySelectorAll('svg')].every((svg,index)=>svg===window.__ssrSvgs[index]),errors:window.__hydrationErrors}));
  check(before.length > 0 && new Set(before).size === before.length, 'Separate same-icon instances collide on SVG definition IDs', {ids:before});
  check(JSON.stringify(before)===JSON.stringify(hydrated.ids) && hydrated.sameSvgs && !hydrated.errors.length,
    'Mask definitions mismatch or replace their SVG while hydrating', hydrated);
  await page.evaluate(()=>document.querySelectorAll('svg').forEach((svg,index)=>{
    const tracks=svg.getAnimations({subtree:true});const duration=Number(tracks[0].effect.getTiming().duration);
    for(const track of tracks){track.pause();track.currentTime=duration*(index?2.7:2.25);}
  }));
  const second = page.locator('main > svg').nth(1);
  const frozenA = await sharp(await second.screenshot({animations:'allow'})).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  await page.evaluate(()=>{
    const svg=document.querySelector('main > svg'),tracks=svg.getAnimations({subtree:true});
    for(const track of tracks)track.currentTime=Number(track.effect.getTiming().duration)*2.82;
  });
  const frozenB = await sharp(await second.screenshot({animations:'allow'})).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const delta = differences(frozenA,frozenB);
  check(delta.pixels===0,'Seeking one instance changes another through shared mask IDs',{difference:delta});
  report.hydrationCases+=3;
}

async function main() {
  ssrChecks();
  callbackAndCompatibilityChecks();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => issues.push({ message: 'Browser page error', error: error.message }));
    const run = async (label, task) => { if (process.env.MOTION_QA_PROGRESS) console.error(label); await task(); };
    await run('Mask sampler', () => maskSerializationChecks(page));
    await run('Rest parity', () => restingChecks(page));
    await run('One-shot bounds', () => frameChecks(page));
    await run('Stop/restart', () => lifecycleChecks(page));
    await suppressionChecks(page);
    await suppressionChecks(page, { repeat: true, emphasis: 'action' });
    await suppressionChecks(page, { repeat: true, emphasis: 'hint' });
    await run('SSR interaction', () => interactionChecks(page));
    await run('All recurring scenes', () => smoothLoopChecks(page));
    await run('Direction rules', () => directionChecks(page));
    await run('React lifecycle', () => reactLifecycleChecks(page));
    await run('SSR hydration and mask instance independence', () => hydrationChecks(page));
    await run('Composited patterned/forced-color variants', () => compositedVariantChecks(page));
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify({ ...report, scope: 'Geometry, suppression, multi-cycle composed continuity and the direction rules (the icon stays, nothing is added, gestures end at rest, only activity repeats). Mechanical checks do not certify artistic quality.', passed: issues.length === 0, issues }, null, 2));
  if (issues.length) process.exitCode = 1;
}
module.exports = { reactLifecycleChecks, compositedVariantChecks, maskSerializationChecks, hydrationChecks, directionChecks, report, issues, content, serialize, raster, differences, render, MotionIcon, Icon, iconMotionRecipes, css };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
