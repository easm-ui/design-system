// Writes src/motion-verbs.css: the vocabulary every directed icon motion is built from.
// node packages/icons/scripts/motion-verbs.mjs [--check]
//
// A verb is one gesture of a part of the drawing (nudge, swing, press…). Each starts and ends at the
// approved pose. A part sets the size of its gesture with custom properties (--mx/--my in px, --mr in
// degrees, --ms/--msx/--msy as scale deltas, --mt for a full turn), so one keyframe set serves every icon.
// Hints multiply the size by --easm-motion-amplitude; a turn never does, because it must land on a
// symmetric pose. Every verb also has a "-loop" form for repeat playback: the same gesture in the first
// 62% of the cycle and the approved pose for the rest, so a repeated gesture breathes between plays.
// Continuous verbs (level, spin) repeat with no pause.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../src/motion-verbs.css', import.meta.url));
const A = 'var(--easm-motion-amplitude, 1)';
// The design system's one motion curve (--easm-ui-ease), so icons move like every other control.
const settle = 'cubic-bezier(.2, 0, 0, 1)';
const smooth = 'cubic-bezier(.45, 0, .55, 1)';

// Stops: [percent, { x, y, r, s, sx, sy, t, o }] as multiples of the part's gesture size.
const verbs = {
  // Move along the part's direction and spring back with a small overshoot: arrows, chevrons, payloads.
  nudge: [[0, {}], [36, { x: 1, y: 1, r: 1 }], [64, { x: -.16, y: -.16, r: -.16 }], [84, { x: .05, y: .05, r: .05 }], [100, {}]],
  // Go, hold, return: a slider knob, a drawer edge, a lid that stays open for a moment.
  slide: [[0, {}], [30, { x: 1, y: 1, r: 1 }], [58, { x: 1, y: 1, r: 1 }], [86, { x: -.06, y: -.06, r: -.06 }], [100, {}]],
  // Leave through one edge and come back in from the opposite one: a sent message.
  travel: [[0, { o: 1 }], [40, { x: 1, y: 1, o: 0 }], [40.01, { x: -1, y: -1, o: 0 }], [78, { x: .04, y: .04, o: 1 }], [100, { o: 1 }]],
  // Pendulum that decays: a bell, a tag on its hole, a tassel.
  swing: [[0, {}], [16, { r: 1 }], [36, { r: -.62 }], [55, { r: .34 }], [73, { r: -.14 }], [88, { r: .04 }], [100, {}]],
  // Quick vibration: a ringing phone.
  ring: [[0, {}], [8, { r: 1 }], [16, { r: -1 }], [24, { r: 1 }], [32, { r: -1 }], [40, { r: .8 }], [48, { r: -.6 }], [58, { r: .3 }], [68, {}], [100, {}]],
  // Horizontal refusal: an error, a warning.
  shake: [[0, {}], [10, { x: 1 }], [22, { x: -1 }], [34, { x: .8 }], [46, { x: -.6 }], [58, { x: .3 }], [70, {}], [100, {}]],
  // Scale up and settle: something created, chosen or confirmed.
  pop: [[0, {}], [34, { s: 1 }], [62, { s: -.28 }], [82, { s: .08 }], [100, {}]],
  // Pressed in and released: a button-like object reacting to the click.
  press: [[0, {}], [26, { s: -1 }], [58, { s: .3 }], [80, { s: -.08 }], [100, {}]],
  // Jump and land: a pin dropped, a person checking in.
  hop: [[0, {}], [34, { y: 1 }], [60, {}], [70, { y: -.14 }], [84, { y: .04 }], [100, {}]],
  // Close and open on the vertical axis: an eye, a robot's eyes.
  blink: [[0, {}], [30, { sy: 1 }], [40, { sy: 1 }], [70, {}], [100, {}]],
  // Narrow and widen on the horizontal axis: rows being filtered, a globe's meridian turning.
  squeeze: [[0, {}], [36, { sx: 1 }], [56, { sx: 1 }], [86, { sx: -.05 }], [100, {}]],
  // Arrive from an offset (and size) and settle on the approved pose: a copy separating, bars growing.
  arrive: [[0, { x: 1, y: 1, sx: 1, sy: 1, s: 1 }], [62, { x: -.06, y: -.06, sx: -.06, sy: -.06, s: -.06 }], [82, { x: .02, y: .02 }], [100, {}]],
  // Turn about the part's own vertical axis and back: an envelope flap opening.
  flip: [[0, {}], [34, { sy: 1 }], [60, { sy: 1 }], [90, {}], [100, {}]],
  // A small loop around the resting place: a magnifier scanning.
  orbit: [[0, {}], [22, { x: -1, y: -.5 }], [46, { x: .4, y: -1 }], [70, { x: 1, y: .6 }], [88, { x: -.15, y: .1 }], [100, {}]],
  // Writing: small strokes that end where they started.
  scribble: [[0, {}], [18, { x: -1, y: 1, r: -1 }], [36, { x: .8, y: -.4, r: .6 }], [54, { x: -.6, y: .8, r: -.5 }], [72, { x: .3, y: -.2, r: .2 }], [100, {}]],
  // A wave travelling outward and fading back in: sound from a speaker.
  ripple: [[0, { o: 1 }], [40, { x: 1, y: 1, o: .2 }], [41, { x: -.4, y: -.4, o: .2 }], [80, { o: 1 }], [100, { o: 1 }]],
  // A whole turn by --mt (choose a symmetry of the drawing so the final frame is the approved pose).
  turn: [[0, {}], [74, { t: 1.03 }], [100, { t: 1 }]],
  // Continuous level change around the approved length: audio bars.
  level: [[0, {}], [25, { sy: 1 }], [50, { sy: -.35 }], [75, { sy: .55 }], [100, {}]],
  // Continuous rotation at a constant speed.
  spin: [[0, {}], [100, { t: 1 }]],
};
const continuous = new Set(['level', 'spin']);
// Repeat forms that cannot simply be compressed. Every cycle must begin exactly where the last ended.
const loopForms = {
  // Leave the approved pose for the starting offset first, then arrive as usual.
  arrive: [[0, {}], [16, verbs.arrive[0][1]], ...verbs.arrive.slice(1).map(([at, stop]) => [16 + at * .46, stop]), [100, {}]],
  // A whole revolution per cycle (the recipe sets --mt to 360deg), easing out of and into rest.
  turn: Object.assign([[0, {}], [100, { t: 1 }]], { ease: smooth }),
};
const linear = new Set(['spin']);

const f = v => +v.toFixed(3);
function frame(stop) {
  const { x = 0, y = 0, r = 0, s = 0, sx = 0, sy = 0, t = 0, o } = stop;
  const scale = (k, axis) => `calc(1 + (var(--ms, 0) * ${f(s)} + var(${axis}, 0) * ${f(k)}) * ${A})`;
  const transform = `translate(calc(var(--mx, 0px) * ${f(x)} * ${A}), calc(var(--my, 0px) * ${f(y)} * ${A})) `
    + `rotate(calc(var(--mr, 0deg) * ${f(r)} * ${A} + var(--mt, 0deg) * ${f(t)})) `
    + `scale(${scale(sx, '--msx')}, ${scale(sy, '--msy')})`;
  return `transform: ${transform};${o === undefined ? '' : ` opacity: ${o};`}`;
}
function keyframes(name, stops, ease, squeezeTo) {
  const lines = stops.map(([at, stop]) => {
    const pct = squeezeTo ? f(at * squeezeTo) : at;
    return `  ${pct}% { ${frame(stop)} animation-timing-function: ${ease}; }`;
  });
  // Hold the final pose (a turn ends on a symmetric angle, so the next cycle starts seamlessly).
  if (squeezeTo) lines.push(`  100% { ${frame(stops.at(-1)[1])} }`);
  return `@keyframes easm-verb-${name} {\n${lines.join('\n')}\n}`;
}

const blocks = [];
for (const [name, stops] of Object.entries(verbs)) {
  const ease = linear.has(name) ? 'linear' : name === 'turn' || name === 'level' ? smooth : settle;
  blocks.push(keyframes(name, stops, ease));
  blocks.push(continuous.has(name) ? keyframes(`${name}-loop`, stops, ease)
    : loopForms[name] ? keyframes(`${name}-loop`, loopForms[name], loopForms[name].ease ?? ease)
    : keyframes(`${name}-loop`, stops, ease, .62));
}
// A detail being written: only strokes inside an icon draw, never the icon's outline. The dash is the
// whole path (length 1) and the gap a little longer, so a hidden dash lies wholly off the path and no
// round cap shows at either end.
const DASH = 'stroke-dasharray: 1 1.1';
const draw = (name, end) => `@keyframes easm-verb-${name} {\n  0% { ${DASH}; stroke-dashoffset: 1.05; animation-timing-function: ${settle}; }\n`
  + `  ${end}% { ${DASH}; stroke-dashoffset: 0; }\n  100% { ${DASH}; stroke-dashoffset: 0; }\n}`;
blocks.push(draw('draw', 60));
// Repeating: the stroke retracts forward (offset 0 → -1.05), then is written again (1.05 → 0). With a
// dash period of 2.1, offsets -1.05 and 1.05 paint the same (nothing), so the cycle has no jump.
// It rests for the first 2% so the cycle's first instant paints exactly what its last did.
blocks.push(`@keyframes easm-verb-draw-loop {\n  0%, 2% { ${DASH}; stroke-dashoffset: 0; animation-timing-function: ${smooth}; }\n`
  + `  16% { ${DASH}; stroke-dashoffset: -1.05; }\n  16.01% { ${DASH}; stroke-dashoffset: 1.05; animation-timing-function: ${settle}; }\n`
  + `  54% { ${DASH}; stroke-dashoffset: 0; }\n  100% { ${DASH}; stroke-dashoffset: 0; }\n}`);
// A gap in a dashed track that travels with a slider knob: --gap-rest is the resting dash offset and
// --gap-shift the knob's travel, both as fractions of the normalised path length.
const gap = (name, squeezeTo = 1) => `@keyframes easm-verb-${name} {\n${verbs.slide.map(([at, { x = 0 }]) =>
  `  ${f(at * squeezeTo)}% { stroke-dashoffset: calc(var(--gap-rest) - var(--gap-shift) * ${f(x)} * ${A}); animation-timing-function: ${settle}; }`).join('\n')}`
  + (squeezeTo < 1 ? `\n  100% { stroke-dashoffset: var(--gap-rest); }` : '') + '\n}';
blocks.push(gap('gap'), gap('gap-loop', .62));

const css = `/* Generated by packages/icons/scripts/motion-verbs.mjs. Do not edit by hand. */\n${blocks.join('\n')}\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(out, 'utf8') !== css) { console.error('motion-verbs.css is out of date: run node packages/icons/scripts/motion-verbs.mjs'); process.exit(1); }
} else writeFileSync(out, css);
