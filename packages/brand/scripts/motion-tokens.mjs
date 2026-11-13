// Writes the motion design files from the engines themselves (so they can never drift from the code):
//   tokens/easm-motion.tokens.json   design tokens (W3C DTCG format: Style Dictionary, Tokens Studio, Figma variables)
//   tokens/easm-motion.css           the same as CSS custom properties
//   tokens/easm-motion-states.json   every state, mode and variant, shaped like the EASM One library's icons/data/motion.json
//   tokens/easm-dots.css             the dots' CSS (DOTS_CSS) for server-rendered pages and strict CSPs
//   brand-assets/brand-kit/motion/README.md   the state tables between the <!-- tables:start/end --> markers
//   pnpm --filter @easm-ui/brand build && pnpm --filter @easm-ui/brand motion-tokens
//   pnpm --filter @easm-ui/brand motion-tokens:check   (fails if a file on disk differs from what the engines make)
// Ported from brand-assets/brand-kit/motion/tools/tokens.mjs, which read a dist/ that no longer exists there.
// EASM_BRAND_DIST=<dir> reads the engines from another compiled copy of src (for checking before a build).
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '..');
const DIST = process.env.EASM_BRAND_DIST ? resolve(process.env.EASM_BRAND_DIST) : resolve(ROOT, 'dist');
const check = process.argv.includes('--check');
const K = await import(pathToFileURL(resolve(DIST, 'motion/engines.js')).href);
// The motion kit keeps its own name and version in these files: the tokens describe the kit, not the package.
const KIT = { name: '@easm/motion', version: '1.1.0' };

const I = K.ICON_TIMING, ms = s => Math.round(s * 1000);
const cycle = {
  connecting: I.connecting, thinking: I.thinking, searching: I.searching, toolCalling: I.toolCall, writing: I.writing,
  awaiting: I.awaiting, done: I.done, error: I.error,
};

// ── tokens (DTCG) ──
const dur = (s, d) => ({ $type: 'duration', $value: `${ms(s)}ms`, $description: d });
const bez = (v, d) => ({ $type: 'cubicBezier', $value: v, $description: d });
const col = (v, d) => ({ $type: 'color', $value: v, $description: d });
const tokens = {
  easm: {
    motion: {
      $description: `${KIT.name} ${KIT.version}: the EASM One app's icon states, voice waveform and dots (logo v6). Generated from the kit; do not edit by hand.`,
      ease: {
        io: bez([0.65, 0, 0.35, 1], 'Ease in and out: blends between states, drains, docking.'),
        soft: bez([0.45, 0, 0.2, 1], 'Sets off from rest and lands softly: light leaving the core, fills.'),
        snap: bez([0.5, 0, 0.2, 1], 'A quicker landing.'),
        dots: bez([0.45, 0, 0.55, 1], 'The three-dot indicators.'),
      },
      duration: {
        blend: dur(I.blend, 'Every change of icon state blends over this.'),
        'blend-one-shot': dur(I.blendOneShot, 'A change into done or error (an event) blends faster.'),
        'wave-blend': dur(K.WAVE.blend, 'Every change of waveform mode blends over this.'),
        ...Object.fromEntries(Object.entries(cycle).map(([k, v]) => [`icon-${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}`,
          dur(v, K.ONE_SHOT.has(k) ? `${k}: plays once, then the still mark.` : k === 'toolCalling' ? 'One tool call (the loop visits all six systems).' : `${k}: one cycle.`)])),
        'icon-voice-loop': dur(K.VOICE_LOOP_SECONDS, 'The EASM voice rhythm that speaking and listening follow without live audio.'),
        'wave-loading': dur(K.WAVE.loadPeriod, 'One loading crest across the waveform, then rest.'),
        ...Object.fromEntries(Object.entries(K.DOTS_PERIOD).map(([k, v]) => [`dots-${k}`, dur(v, `${k} dots: one cycle at speed 1.`)])),
      },
      color: {
        core: col(K.ORANGE, 'The core and every light: signature orange, always fully opaque.'),
        'core-glow': col('#FF8A33', 'The core at the top of a syllable while speaking.'),
        'rail-on-light': col(K.railColor('light'), 'Rails on light surfaces (ink).'),
        'rail-on-dark': col(K.railColor('dark'), 'Rails on dark surfaces (paper).'),
      },
      size: {
        'icon-min': { $type: 'dimension', $value: '16px', $description: 'Smallest icon size; every state stays legible here.' },
        'icon-default': { $type: 'dimension', $value: '24px', $description: 'Status lines and chat avatars.' },
        'dots-default': { $type: 'dimension', $value: '6px', $description: 'Dot diameter for chat bubbles.' },
        'wave-default': { $type: 'dimension', $value: '28px', $description: 'Waveform height in a composer.' },
      },
    },
  },
};
const files = new Map();
files.set('tokens/easm-motion.tokens.json', JSON.stringify(tokens, null, 2) + '\n');

// ── CSS custom properties ──
const flat = [];
const walk = (o, path) => { for (const [k, v] of Object.entries(o)) { if (k.startsWith('$')) continue; if (v && v.$value !== undefined) flat.push([[...path, k].join('-'), v]); else walk(v, [...path, k]); } };
walk(tokens.easm.motion, ['easm-motion']);
const cssVal = v => (v.$type === 'cubicBezier' ? `cubic-bezier(${v.$value.join(', ')})` : v.$value);
files.set('tokens/easm-motion.css',
  `/* ${KIT.name} ${KIT.version}: motion tokens for the EASM One app (generated from the kit by tools/tokens.mjs; do not edit). */\n:root {\n` +
  flat.map(([n, v]) => `  --${n}: ${cssVal(v)}; /* ${v.$description} */`).join('\n') + '\n}\n');

// ── the dots' CSS, for pages that cannot inject it at run time ──
files.set('tokens/easm-dots.css',
  '/* @easm-ui/brand: the CSS EasmDots and mountDots() inject (DOTS_CSS), for server-rendered pages and strict CSPs.\n' +
  ' * Generated by scripts/motion-tokens.mjs; do not edit. Include it once per document or shadow root. */\n' + K.DOTS_CSS + '\n');

// ── the state manifest (the library's motion.json shape, extended) ──
const kebab = s => s.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
const icon = K.ICON_STATES.map(s => {
  const once = K.ONE_SHOT.has(s), still = s === 'idle' || s === 'offline', live = s === 'speaking' || s === 'listening';
  return {
    name: s, component: 'EasmIcon', prop: `state="${s}"`, group: K.ICON_META[s].group,
    durationMs: still ? 0 : live ? null : ms(cycle[s]), loopAllowed: !once && !still, oneShot: once, followsAudio: live,
    label: K.ICON_META[s].label, use: K.ICON_META[s].use, motion: K.ICON_META[s].motion,
    reducedMotion: s === 'offline' ? 'The empty core, still' : 'The still mark',
    svg: [`svg/icon/easm-icon-${kebab(s)}-light.svg`, `svg/icon/easm-icon-${kebab(s)}-dark.svg`],
  };
});
const wave = Object.keys(K.WAVE_META).map(m => ({
  name: m, component: 'EasmWaveform', prop: `mode="${m}"`, durationMs: m === 'loading' ? ms(K.WAVE.loadPeriod) : m === 'idle' ? 0 : null,
  loopAllowed: m !== 'idle', followsAudio: m === 'listening' || m === 'speaking', label: K.WAVE_META[m].label, use: K.WAVE_META[m].use, motion: K.WAVE_META[m].motion,
  reducedMotion: 'A still row of dots', svg: m === 'loading' ? ['svg/waveform/easm-waveform-loading-24.svg', 'svg/waveform/easm-waveform-loading-12.svg'] : [],
}));
const dots = Object.keys(K.DOTS_META).map(v => ({
  name: v, component: 'EasmDots', prop: `variant="${v}"`, durationMs: ms(K.DOTS_PERIOD[v]), loopAllowed: true,
  label: K.DOTS_META[v].label, use: K.DOTS_META[v].use, motion: K.DOTS_META[v].motion, reducedMotion: 'Three still dots',
  svg: ['ink', 'grey', 'paper', 'orange'].map(c => `svg/dots/easm-dots-${v}-${c}.svg`),
}));
const manifest = {
  package: KIT.name, version: KIT.version,
  grammar: 'The core is EASM; a rail is a system (or the channel to the person); orange light inside a rail is information moving (out of the core: EASM reaching out; in: something arriving). A docked rail is in use. The core turning is thinking, glowing is EASM’s voice only, empty is no connection.',
  activeByDefault: false,
  reducedMotion: 'prefers-reduced-motion or data-easm-motion="off" on any ancestor: the still picture of each state',
  manualPause: 'data-easm-motion="off"',
  replay: 'One-shots (done, error) play once and rest on the still mark; change replayKey (React) or call replay() to play again',
  rule: 'Switch state when the real event happens, never on a timer; pair every working state with text that names the work.',
  icon, waveform: wave, dots,
};
files.set('tokens/easm-motion-states.json', JSON.stringify(manifest, null, 2) + '\n');
// every file the manifest points at exists
const missingSvg = [...icon, ...wave, ...dots].flatMap(s => s.svg).filter(rel => !existsSync(resolve(ROOT, rel)));
if (missingSvg.length) { console.error(`motion-tokens: the manifest names missing files:\n  ${missingSvg.join('\n  ')}`); process.exit(1); }

// ── README tables (the kit's documentation) ──
const esc = s => s.replace(/\|/g, '\\|');
const timing = s => s.durationMs === 0 ? 'still' : s.durationMs == null ? 'follows audio' : s.oneShot ? `once, ${s.durationMs / 1000} s` : s.name === 'toolCalling' ? `${s.durationMs / 1000} s per call` : `loop, ${s.durationMs / 1000} s`;
const tables =
  '### Icon states (`<EasmIcon state>`)\n\n| State | Switch to it when… | What moves | Timing |\n|---|---|---|---|\n' +
  icon.map(s => `| \`${s.name}\` | ${esc(s.use)} | ${esc(s.motion)} | ${timing(s)} |`).join('\n') +
  '\n\n### Waveform modes (`<EasmWaveform mode>`)\n\n| Mode | Use when… | What moves |\n|---|---|---|\n' +
  wave.map(s => `| \`${s.name}\` | ${esc(s.use)} | ${esc(s.motion)} |`).join('\n') +
  '\n\n### Dots (`<EasmDots variant>`)\n\n| Variant | Use when… | What moves | Cycle |\n|---|---|---|---|\n' +
  dots.map(s => `| \`${s.name}\` | ${esc(s.use)} | ${esc(s.motion)} | ${s.durationMs / 1000} s |`).join('\n') + '\n';
const readmePath = resolve(ROOT, '../../brand-assets/brand-kit/motion/README.md');
const A = '<!-- tables:start (generated by tools/tokens.mjs) -->', B = '<!-- tables:end -->';
if (existsSync(readmePath)) {
  const readme = readFileSync(readmePath, 'utf8');
  if (readme.includes(A) && readme.includes(B)) {
    files.set('../../brand-assets/brand-kit/motion/README.md', readme.slice(0, readme.indexOf(A) + A.length) + '\n' + tables + readme.slice(readme.indexOf(B)));
  }
}

if (check) {
  const stale = [...files].filter(([rel, text]) => !existsSync(resolve(ROOT, rel)) || readFileSync(resolve(ROOT, rel), 'utf8') !== text).map(([rel]) => rel);
  if (stale.length) { console.error(`motion-tokens: ${stale.length} file(s) differ from the engines; run pnpm --filter @easm-ui/brand motion-tokens\n  ${stale.join('\n  ')}`); process.exit(1); }
  console.log(`motion-tokens: ${files.size} files match the engines`);
} else {
  for (const [rel, text] of files) writeFileSync(resolve(ROOT, rel), text);
  console.log(`motion-tokens: ${flat.length} tokens · icon states: ${icon.length} · waveform modes: ${wave.length} · dots: ${dots.length} · ${files.size} files written`);
}
