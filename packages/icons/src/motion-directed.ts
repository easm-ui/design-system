import { geometry, type GeometryNode, type IconName } from './registry';
import { part, type IconMotionPart, type IconMotionRecipe } from './motion-parts';

// Every motion is the object doing its own job: a bell rings, a lid lifts, an arrow pushes the way it
// points. Four rules hold for all of them:
// 1. The icon never disappears. Every frame is recognisably the same icon; only a detail stroke inside it
//    (a check, a slash, writing) may be redrawn.
// 2. Nothing is added. No checks, packets, bars or panels that the drawing does not have.
// 3. One gesture, then rest. Actions last 0.55–1 s and end exactly on the approved drawing.
// 4. Only real activity repeats without a pause (audio, listening, recording, thinking, a running flow).
// Gestures come from the verbs in motion-verbs.css (scripts/motion-verbs.mjs).

type Verb = 'gap' | 'nudge' | 'slide' | 'travel' | 'swing' | 'ring' | 'shake' | 'pop' | 'press' | 'hop' | 'blink'
  | 'squeeze' | 'arrive' | 'flip' | 'orbit' | 'scribble' | 'ripple' | 'turn' | 'level' | 'spin' | 'draw';
interface Gesture {
  verb: Verb;
  /** Gesture size: px in the 24-unit box, degrees, and scale deltas. */
  x?: number; y?: number; r?: number; s?: number; sx?: number; sy?: number; t?: number;
  /** For gap: the resting dash offset and the knob's travel, as fractions of the track's length. */
  rest?: number; shift?: number;
  origin?: [number, number];
  delay?: number;
  dur?: number;
  clip?: string;
}
// One duration scale for every gesture (450 / 600 / 750 / 900 ms) and one stagger step.
const DURATION: Record<Verb, number> = {
  press: 450, blink: 450,
  nudge: 600, shake: 600, pop: 600, draw: 600,
  hop: 750, squeeze: 750, arrive: 750, turn: 750,
  gap: 900, slide: 900, travel: 900, swing: 900, ring: 900, flip: 900, orbit: 900, scribble: 900, ripple: 900, spin: 900,
  level: 1200,
};
const STEP = 80;
// Stroke weight is part of the drawing. A uniform scale changes it by the same factor, so a pop on an
// outlined shape stays within 15%; a squeeze or blink thins strokes along its axis, so a turn stops at half
// width. Only round dots (a zero-length stroke) and the deliberate blink go further.
const CONTINUOUS = new Set<Verb>(['level', 'spin']);

/** A piece of an approved drawing with a different `d`, keeping its stroke, fill and transform. */
function cut(name: IconName, index: number, d: string, attrs: Record<string, string | number> = {}): GeometryNode {
  const node = geometry[name][index];
  return { ...node, attrs: { ...node.attrs, d, ...attrs } };
}
const nodes = (name: IconName, ...indexes: number[]) => indexes.map(i => geometry[name][i]);
const still = (id: string, drawing: readonly GeometryNode[] | GeometryNode) => part(id, drawing);
// A knock-out ring or face (stroke or fill: background) is drawn with an SVG mask, and Chrome does not move a mask
// with an animated part. Badges therefore stay still and only their contents move.
const knocksOut = (node: GeometryNode): boolean => node.attrs?.stroke === 'background' || node.attrs?.fill === 'background'
  || (node.children ?? []).some(knocksOut);
function act(id: string, drawing: readonly GeometryNode[] | GeometryNode, g: Gesture): IconMotionPart {
  if ((Array.isArray(drawing) ? drawing : [drawing as GeometryNode]).some(knocksOut)) throw new Error(`Motion part ${id} moves a knock-out ring`);
  const px = (v?: number) => v === undefined ? undefined : `${v}px`;
  const deg = (v?: number) => v === undefined ? undefined : `${v}deg`;
  const vars = Object.fromEntries(Object.entries({
    '--mx': px(g.x), '--my': px(g.y), '--mr': deg(g.r), '--mt': deg(g.t),
    '--ms': g.s, '--msx': g.sx, '--msy': g.sy, '--gap-rest': g.rest, '--gap-shift': g.shift,
  }).filter(([, v]) => v !== undefined)) as Record<string, string | number>;
  return part(id, drawing, `easm-verb-${g.verb}`, {
    durationMs: g.dur ?? DURATION[g.verb], delayMs: g.delay ?? 0, easing: 'linear',
    origin: g.origin ? `${g.origin[0]}px ${g.origin[1]}px` : undefined,
    clipInset: g.clip, vars,
  });
}

interface Direction {
  name: IconName;
  family: IconMotionRecipe['family'];
  title: string;
  story: string;
  loopAllowed?: boolean;
  parts: readonly IconMotionPart[];
}
function recipe({ name, family, title, story, loopAllowed, parts }: Direction): IconMotionRecipe {
  const durationMs = Math.max(...parts.map(p => (p.delayMs ?? 0) + (p.durationMs ?? 0)));
  const continuous = parts.every(p => !p.animation || CONTINUOUS.has(p.animation.replace('easm-verb-', '') as Verb));
  // Repeat playback: the same gesture, then the approved pose until the next cycle.
  const loopDurationMs = continuous ? durationMs : Math.round(durationMs / .62 / 10) * 10;
  // A turn lands on a symmetry of the drawing; repeating, it makes a whole revolution so every cycle
  // begins on exactly the same pixels.
  const loopParts = parts.map(p => {
    const vars = p.animation === 'easm-verb-turn' ? { ...p.vars, '--mt': String(p.vars?.['--mt']).startsWith('-') ? '-360deg' : '360deg' } : p.vars;
    return p.animation && !continuous ? { ...p, vars, animation: `${p.animation}-loop`, durationMs: undefined } : { ...p, durationMs: undefined };
  });
  return { name, family, title, story, loopAllowed, durationMs, loopDurationMs, loopParts, loopStory: loopAllowed
    ? 'Repeats for as long as the activity lasts.' : 'Repeats the gesture with a rest between plays, for review.', parts };
}

const arrow = (name: IconName, x: number, y: number, title: string, family: Direction['family'] = 'Actions') => recipe({
  name, family, title, story: 'The arrow pushes the way it points and springs back.',
  parts: [act('arrow', geometry[name], { verb: 'nudge', x, y })],
});
const whole = (name: IconName, family: Direction['family'], title: string, story: string, g: Gesture, loopAllowed?: boolean) =>
  recipe({ name, family, title, story, loopAllowed, parts: [act(name, geometry[name], g)] });
const badgeCentre: [number, number] = [18, 18];
// Track y, knob centre x and knob travel for each slider row.
const sliderRows = [[6, 11, 3], [12, 16, -4], [18, 8, 4]] as const;

const audioBars = ['M3.2 10.5v3', 'M5.4 8.5v7', 'M7.6 6.5v11', 'M9.8 9v6', 'M12 3.7v16.6', 'M14.2 7v10', 'M16.4 5.5v13', 'M18.6 8.5v7', 'M20.8 10.5v3'];
const audioLevels = [.6, -.3, .25, .55, -.22, .3, -.25, .4, -.45];
const keyboardDots = [[6.5, 9], [10, 9], [14, 9], [17.5, 9], [6.5, 12.5], [10, 12.5], [14, 12.5], [17.5, 12.5]];
// Five keystrokes at the stagger step; the other keys rest.
const typingOrder = [0, 5, 2, 7, 3];

/** A drawing's own parts in paint order: the listed ones move, runs of the others stay still together. */
function by(name: IconName, moving: Record<number, Gesture & { id?: string }>): IconMotionPart[] {
  const out: IconMotionPart[] = [];
  let run: GeometryNode[] = [];
  const flush = () => { if (run.length) out.push(still(`still-${out.length + 1}`, run)); run = []; };
  geometry[name].forEach((node, i) => {
    const g = moving[i];
    if (!g) { run.push(node); return; }
    flush();
    out.push(act(g.id ?? `part-${i + 1}`, node, g));
  });
  flush();
  return out;
}
const badged = (name: IconName, family: Direction['family'], title: string, story: string, moving: Record<number, Gesture & { id?: string }>) =>
  recipe({ name, family, title, story, parts: by(name, moving) });
// The gestures every badge uses, so the same mark moves the same way on every icon.
const PLUS = (origin: [number, number] = [18, 17.5]): Gesture & { id: string } => ({ id: 'plus', verb: 'turn', t: 90, origin });
const CHECK: Gesture & { id: string } = { id: 'check', verb: 'draw' };
const HAND: Gesture & { id: string } = { id: 'hand', verb: 'turn', t: 360, origin: [17.7, 17.7] };
const ALERT: Gesture & { id: string } = { id: 'alert', verb: 'shake', x: .8 };
const SWAP = (origin: [number, number] = [18, 17.65]): Gesture & { id: string } => ({ id: 'swap', verb: 'turn', t: 180, origin });
const KEY = (origin: [number, number]): Gesture & { id: string } => ({ id: 'key', verb: 'slide', r: -20, origin });
const BARS = (origin: [number, number]): Gesture & { id: string } => ({ id: 'bars', verb: 'arrive', sy: -.5, origin });
const ASK = (origin: [number, number]): Gesture & { id: string } => ({ id: 'question', verb: 'swing', r: 12, origin });
/** Lines of text written one after another. */
const writing = (name: IconName, index: number, lines: readonly string[]) =>
  lines.map((d, i) => act(`line-${i + 1}`, cut(name, index, d), { verb: 'draw', delay: i * STEP }));
/** Rows that narrow in turn from their left edge, as a list being worked through. */
const rows = (name: IconName, index: number, lines: readonly [string, number, number][]) =>
  lines.map(([d, x, y], i) => act(`row-${i + 1}`, cut(name, index, d), { verb: 'squeeze', sx: -.3, origin: [x, y], delay: i * STEP }));

export const directedMotionRecipes: readonly IconMotionRecipe[] = [
  // Actions: the control's own object carries out the action.
  recipe({ name: 'download', family: 'Actions', title: 'Download', story: 'The arrow drops into the tray and springs back.',
    parts: [still('tray', cut('download', 0, 'M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2')),
      act('arrow', cut('download', 0, 'M12 3.8V16M7.8 11.8 12 16l4.2-4.2'), { verb: 'nudge', y: 2.6 })] }),
  recipe({ name: 'upload', family: 'Actions', title: 'Upload', story: 'The arrow lifts out of the tray and springs back.',
    parts: [still('tray', cut('upload', 0, 'M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2')),
      act('arrow', cut('upload', 0, 'M12 16V3.8M7.8 8.1 12 3.8l4.2 4.3'), { verb: 'nudge', y: -2.6 })] }),
  recipe({ name: 'cloud-upload', family: 'Actions', title: 'Upload to the cloud', story: 'The arrow rises into the cloud and springs back.',
    parts: [still('cloud', geometry['cloud-upload'][0]), act('arrow', geometry['cloud-upload'][1], { verb: 'nudge', y: -2.4 })] }),
  whole('send', 'Actions', 'Send', 'The plane flies out through the top right and the next one glides in from the lower left.',
    { verb: 'travel', x: 10, y: -10, clip: '0px' }),
  whole('save', 'Actions', 'Save', 'The disk is pressed in and released.', { verb: 'press', s: .06, origin: [12, 12] }),
  recipe({ name: 'delete', family: 'Actions', title: 'Delete', story: 'The lid tips open on its hinge, holds, and closes.',
    parts: [still('bin', cut('delete', 0, 'M5.5 6.5l.9 12.6A2 2 0 0 0 8.4 21h7.2a2 2 0 0 0 2-1.9l.9-12.6M10 10.5v6M14 10.5v6')),
      act('lid', cut('delete', 0, 'M3.5 6.5h17M9 6.5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2.5', { fill: 'none' }),
        { verb: 'slide', y: -.8, r: 5, origin: [20.5, 6.5] })] }),
  recipe({ name: 'copy', family: 'Actions', title: 'Copy', story: 'The copy separates from the source sheet and settles beside it.',
    parts: [still('source-sheet', geometry.copy[1]), act('copy-sheet', geometry.copy[0], { verb: 'arrive', x: -5, y: -5 })] }),
  recipe({ name: 'archive', family: 'Actions', title: 'Archive', story: 'The lid lifts off the box, holds, and closes.',
    parts: [still('box', geometry.archive[1]), act('lid', geometry.archive[0], { verb: 'slide', y: -2.2 })] }),
  recipe({ name: 'folder-open', family: 'Actions', title: 'Open folder', story: 'The front flap opens further and returns.',
    parts: [still('back', cut('folder-open', 0, 'M3 9V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2', { fill: 'none' })),
      act('flap', cut('folder-open', 0, 'M3 9h15.8a1.7 1.7 0 0 1 1.6 2.2l-2 7A2.5 2.5 0 0 1 16 20H5a2 2 0 0 1-2-2V9Z'),
        { verb: 'flip', sy: -.24, origin: [3, 20] })] }),
  whole('search', 'Actions', 'Search', 'The magnifier makes one small scanning circle.', { verb: 'orbit', x: 1.5, y: 1.5 }),
  recipe({ name: 'filter-list', family: 'Actions', title: 'Filter the list', story: 'Each row narrows in turn, then the list returns.',
    parts: [['M4 6h16', 12, 6, -.3], ['M7 12h10', 12, 12, -.35], ['M10 18h4', 12, 18, -.4]].map(([d, x, y, sx], i) =>
      act(`row-${i + 1}`, cut('filter-list', 0, d as string), { verb: 'squeeze', sx: sx as number, origin: [x as number, y as number], delay: i * STEP })) }),
  recipe({ name: 'sliders', family: 'Actions', title: 'Adjust', story: 'The three knobs slide to new values, hold, and return; each track keeps its gap around its knob.',
    // Each 16-unit track is one dashed stroke whose 4-unit gap sits under its knob, so the gap travels with it.
    parts: sliderRows.flatMap(([y, knob, x], n) => [
      act(`track-${n + 1}`, cut('sliders', 0, `M4 ${y}h16`, { 'stroke-dasharray': '1 .25 1' }),
        { verb: 'gap', rest: 1 - (knob - 6) / 16, shift: x / 16, delay: n * STEP }),
      act(`knob-${n + 1}`, geometry.sliders[n + 1], { verb: 'slide', x, delay: n * STEP })]) }),
  whole('settings', 'Actions', 'Settings', 'The gear turns one tooth.', { verb: 'turn', t: 60, origin: [12, 12] }),
  whole('edit', 'Actions', 'Edit', 'The pencil writes a short stroke and returns.', { verb: 'scribble', x: 1, y: 1, r: 4, origin: [4, 20] }),
  recipe({ name: 'menu', family: 'Actions', title: 'Menu', story: 'The three lines shift in turn and settle.',
    parts: ['M4 6h16', 'M4 12h16', 'M4 18h16'].map((d, i) => act(`line-${i + 1}`, cut('menu', 0, d), { verb: 'nudge', x: 2, delay: i * STEP })) }),
  recipe({ name: 'more-horizontal', family: 'Actions', title: 'More', story: 'The three dots hop in turn.',
    parts: geometry['more-horizontal'].map((node, i) => act(`dot-${i + 1}`, node, { verb: 'hop', y: -2.5, delay: i * STEP })) }),
  whole('add', 'Actions', 'Add', 'The plus turns a quarter.', { verb: 'turn', t: 90, origin: [12, 12] }),
  whole('close', 'Actions', 'Close', 'The cross turns a quarter.', { verb: 'turn', t: 90, origin: [12, 12] }),
  arrow('arrow-right', 2.5, 0, 'Forward'),
  arrow('arrow-left', -2.5, 0, 'Back'),
  arrow('arrow-up', 0, -2.5, 'Up'),
  arrow('arrow-down', 0, 2.5, 'Down'),
  arrow('chevron-right', 2, 0, 'Next'),
  arrow('chevron-left', -2, 0, 'Previous'),
  arrow('chevron-up', 0, -2, 'Collapse'),
  arrow('chevron-down', 0, 2, 'Expand'),
  whole('sync', 'Actions', 'Synchronise', 'Both arrows turn half a circle together.', { verb: 'turn', t: 180, origin: [12, 12] }),
  whole('refresh', 'Actions', 'Refresh', 'The arrow turns one full circle.', { verb: 'turn', t: 360, origin: [12, 12.5] }),
  recipe({ name: 'open-external', family: 'Actions', title: 'Open elsewhere', story: 'The arrow pushes out of the corner and springs back.',
    parts: [still('frame', cut('open-external', 0, 'M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4')),
      act('arrow', cut('open-external', 0, 'M14 4h6v6M20 4l-9 9'), { verb: 'nudge', x: 2, y: -2 })] }),
  recipe({ name: 'home', family: 'Actions', title: 'Home', story: 'The roof lifts and settles back on the house.',
    parts: [still('house', cut('home', 0, 'M5 9.3V19a2 2 0 0 0 2 2h3v-6h4v6h3a2 2 0 0 0 2-2V9.3')),
      act('roof', cut('home', 0, 'm3 11 7.1-6.5a2.8 2.8 0 0 1 3.8 0L21 11', { fill: 'none' }), { verb: 'hop', y: -1.6 })] }),
  recipe({ name: 'apps', family: 'Actions', title: 'Apps', story: 'The four tiles pop in turn, clockwise.',
    parts: ([[0, 6.5, 6.5], [1, 17.5, 6.5], [3, 17.5, 17.5], [2, 6.5, 17.5]] as const).map(([i, x, y], n) =>
      act(`tile-${i + 1}`, geometry.apps[i], { verb: 'pop', s: .15, origin: [x, y], delay: n * STEP })) }),
  recipe({ name: 'app-list', family: 'Actions', title: 'App list', story: 'Each row slides right in turn and settles.',
    parts: [act('row-1', [geometry['app-list'][0], cut('app-list', 2, 'M12 6.5h8')], { verb: 'nudge', x: 2 }),
      act('row-2', [geometry['app-list'][1], cut('app-list', 2, 'M12 17.5h8')], { verb: 'nudge', x: 2, delay: STEP })] }),
  recipe({ name: 'sidebar-right', family: 'Actions', title: 'Show panel', story: 'The panel opens wider, holds, and returns.',
    parts: [still('frame', geometry['sidebar-right'][0]), act('divider', geometry['sidebar-right'][1], { verb: 'slide', x: -3 })] }),
  recipe({ name: 'sidebar-right-collapse', family: 'Actions', title: 'Hide panel', story: 'The panel closes towards the edge as the arrow points it away.',
    parts: [still('frame', geometry['sidebar-right-collapse'][0]),
      act('divider', geometry['sidebar-right-collapse'][1], { verb: 'slide', x: 2.5 }),
      act('arrow', geometry['sidebar-right-collapse'][2], { verb: 'nudge', x: -2.5 })] }),
  whole('filter', 'Actions', 'Filter', 'The funnel narrows and widens again.', { verb: 'squeeze', sx: -.18, origin: [12, 4] }),
  recipe({ name: 'sort', family: 'Actions', title: 'Sort', story: 'The arrows push apart, one up and one down.',
    parts: [act('up', cut('sort', 0, 'M8 20V4M5 7l3-3 3 3'), { verb: 'nudge', y: -2.4 }),
      act('down', cut('sort', 0, 'M16 4v16M13 17l3 3 3-3'), { verb: 'nudge', y: 2.4 })] }),
  recipe({ name: 'sort-descending', family: 'Actions', title: 'Sort descending', story: 'The arrow pushes down while the rows narrow from longest to shortest.',
    parts: [act('arrow', cut('sort-descending', 0, 'M7 4v16M4 17l3 3 3-3'), { verb: 'nudge', y: 2.4 }),
      ...['M13 5h7', 'M13 9h5', 'M13 13h3'].map((d, i) => act(`row-${i + 1}`, cut('sort-descending', 0, d),
        { verb: 'squeeze', sx: -.4, origin: [13, 5 + i * 4], delay: i * STEP }))] }),
  recipe({ name: 'swap', family: 'Actions', title: 'Swap', story: 'The arrows push in opposite directions and spring back.',
    parts: [act('right', cut('swap', 0, 'M3.5 8h17M16.5 4l4 4-4 4'), { verb: 'nudge', x: 2.5 }),
      act('left', cut('swap', 0, 'M20.5 16h-17M7.5 12l-4 4 4 4'), { verb: 'nudge', x: -2.5, delay: STEP })] }),
  whole('undo', 'Actions', 'Undo', 'The arrow tips back and returns.', { verb: 'nudge', x: -1, r: -14, origin: [12, 14] }),
  whole('reset', 'Actions', 'Reset', 'The arrow winds back and springs to rest.', { verb: 'nudge', r: -35, origin: [12.5, 14.5] }),
  whole('attach', 'Actions', 'Attach', 'The paperclip swings from its top.', { verb: 'swing', r: 10, origin: [17.1, 3.2] }),
  recipe({ name: 'document-upload', family: 'Actions', title: 'Upload a document', story: 'The arrow in the badge pushes up and springs back.',
    parts: [still('document', geometry['document-upload'][0]),
      still('badge', geometry['document-upload'][1]), act('arrow', geometry['document-upload'][2], { verb: 'nudge', y: -1 })] }),
  recipe({ name: 'document-search', family: 'Actions', title: 'Search documents', story: 'The magnifier in the badge makes one small scanning circle.',
    parts: [still('document', geometry['document-search'][0]), still('badge', geometry['document-search'][1]),
      act('lens', nodes('document-search', 2, 3), { verb: 'orbit', x: .7, y: .7 })] }),
  recipe({ name: 'image', family: 'Actions', title: 'Image', story: 'The sun rises a little and sets back.',
    parts: [still('frame', geometry.image[0]), act('sun', geometry.image[1], { verb: 'hop', y: -1.5 }), still('hills', geometry.image[2])] }),
  recipe({ name: 'add-circle', family: 'Actions', title: 'Add', story: 'The plus turns a quarter inside its circle.',
    parts: [still('circle', geometry['add-circle'][0]), act('plus', geometry['add-circle'][1], { verb: 'turn', t: 90, origin: [12, 12] })] }),
  recipe({ name: 'keyboard', family: 'Actions', title: 'Keyboard', story: 'Keys are pressed in a typing rhythm.',
    parts: [still('frame', geometry.keyboard[0]), still('space', cut('keyboard', 1, 'M7.5 16h9')),
      ...typingOrder.map((k, n) => act(`key-${k + 1}`, cut('keyboard', 1, `M${keyboardDots[k][0]} ${keyboardDots[k][1]}h.01`),
        { verb: 'press', s: .9, origin: keyboardDots[k] as [number, number], delay: n * STEP })),
      ...keyboardDots.flatMap(([x, y], k) => typingOrder.includes(k) ? [] : [still(`key-${k + 1}`, cut('keyboard', 1, `M${x} ${y}h.01`))])] }),
  whole('location', 'Actions', 'Location', 'The pin hops and lands on its point.', { verb: 'hop', y: -1.8 }),
  whole('tag', 'Actions', 'Tag', 'The tag swings on its hole.', { verb: 'swing', r: 10, origin: [7.5, 7.5] }),
  whole('ticket', 'Actions', 'Ticket', 'The ticket tilts and settles.', { verb: 'nudge', r: -8, origin: [12, 12] }),
  recipe({ name: 'ticket-priority', family: 'Actions', title: 'Priority', story: 'The exclamation mark in the badge shakes for attention.',
    parts: [still('ticket', geometry['ticket-priority'][0]), still('badge', geometry['ticket-priority'][1]),
      act('mark', geometry['ticket-priority'][2], { verb: 'shake', x: .8 })] }),
  recipe({ name: 'queue', family: 'Actions', title: 'Queue', story: 'The rows advance in turn towards the arrow.',
    parts: [...['M3 5h13', 'M3 12h13', 'M3 19h13'].map((d, i) => act(`row-${i + 1}`, cut('queue', 0, d), { verb: 'nudge', x: 1.2, delay: i * STEP })),
      act('arrow', cut('queue', 0, 'M18 10l3 2-3 2'), { verb: 'nudge', x: 1.5, delay: STEP })] }),

  // Status: the result is stated, and errors ask for attention.
  recipe({ name: 'notification', family: 'Status', title: 'Notification', story: 'The bell swings from its hook; the clapper follows.',
    parts: [act('bell', cut('notification', 0, 'M6 10a6 6 0 0 1 12 0v4.5l1.8 2.5c.3.5 0 1.1-.6 1.1H4.8c-.6 0-.9-.6-.6-1.1L6 14.5V10ZM12 2.5V4'),
      { verb: 'swing', r: 10, origin: [12, 2.5] }),
      act('clapper', cut('notification', 0, 'M10 21h4', { fill: 'none' }), { verb: 'swing', r: 8, origin: [12, 2.5], delay: STEP })] }),
  recipe({ name: 'check-circle', family: 'Status', title: 'Confirmed', story: 'The circle pops and the check is written.',
    parts: [act('circle', geometry['check-circle'][0], { verb: 'pop', s: .06, origin: [12, 12] }),
      act('check', geometry['check-circle'][1], { verb: 'draw', delay: STEP })] }),
  whole('error-circle', 'Status', 'Error', 'The sign shakes once.', { verb: 'shake', x: 1.4 }),
  whole('warning', 'Status', 'Warning', 'The sign shakes once.', { verb: 'shake', x: 1.2 }),
  recipe({ name: 'checkbox-checked', family: 'Status', title: 'Checked', story: 'The box is pressed and the check is written.',
    parts: [act('box', geometry['checkbox-checked'][0], { verb: 'press', s: .08, origin: [12, 12] }),
      act('check', geometry['checkbox-checked'][1], { verb: 'draw', delay: STEP })] }),
  whole('checkbox-unchecked', 'Status', 'Unchecked', 'The box is pressed and released.', { verb: 'press', s: .08, origin: [12, 12] }),
  recipe({ name: 'info-circle', family: 'Status', title: 'Information', story: 'The i hops inside its circle.',
    parts: [still('circle', geometry['info-circle'][0]), act('mark', geometry['info-circle'][1], { verb: 'hop', y: -1.4 })] }),
  recipe({ name: 'question-circle', family: 'Status', title: 'Help', story: 'The question mark tilts as if wondering.',
    parts: [still('circle', geometry['question-circle'][0]), act('mark', geometry['question-circle'][1], { verb: 'swing', r: 14, origin: [12, 17] })] }),
  recipe({ name: 'clock', family: 'Status', title: 'Time', story: 'The minute hand sweeps a full hour.',
    parts: [still('face', geometry.clock[0]), act('minute', cut('clock', 1, 'M12 7v5'), { verb: 'turn', t: 360, origin: [12, 12] }),
      still('hour', cut('clock', 1, 'M12 12l3.5 2'))] }),
  recipe({ name: 'thumbs-up', family: 'Status', title: 'Approve', story: 'The thumb tips up and settles.',
    parts: [act('hand', geometry['thumbs-up'], { verb: 'nudge', y: -1, r: -12, origin: [8, 20] })] }),
  whole('rating-star', 'Status', 'Rate', 'The star pops.', { verb: 'pop', s: .1, origin: [12, 12.98] }),

  // Communication.
  recipe({ name: 'audio-waveform', family: 'Communication', title: 'Audio', loopAllowed: true,
    story: 'Each bar rises and falls around its own length while audio plays.',
    parts: audioBars.map((d, i) => act(`bar-${i + 1}`, cut('audio-waveform', 0, d), { verb: 'level', sy: audioLevels[i], origin: [3.2 + i * 2.2, 12], delay: i * STEP })) }),
  recipe({ name: 'voice', family: 'Communication', title: 'Listening', loopAllowed: true, story: 'The microphone capsule breathes while it listens.',
    parts: [act('capsule', geometry.voice[0], { verb: 'level', sy: .07, origin: [12, 14] }), still('stand', geometry.voice[1])] }),
  recipe({ name: 'speaker-volume', family: 'Communication', title: 'Sound', story: 'The sound waves travel outward from the speaker, near then far.',
    parts: [still('speaker', geometry['speaker-volume'][0]),
      act('near-wave', cut('speaker-volume', 1, 'M16 8a6 6 0 0 1 0 8'), { verb: 'ripple', x: 1.2 }),
      act('far-wave', cut('speaker-volume', 1, 'M18 5a10 10 0 0 1 0 14'), { verb: 'ripple', x: 1.2, delay: STEP })] }),
  recipe({ name: 'microphone-off', family: 'Communication', title: 'Mute', story: 'The mute stroke is drawn across the microphone.',
    parts: [still('microphone', nodes('microphone-off', 0, 1)), act('slash', geometry['microphone-off'][2], { verb: 'draw' })] }),
  whole('play', 'Communication', 'Play', 'The triangle pushes forward and springs back.', { verb: 'nudge', x: 1.6 }),
  recipe({ name: 'pause', family: 'Communication', title: 'Pause', story: 'Each bar is pressed in turn.',
    parts: [act('left', geometry.pause[0], { verb: 'press', s: .1, origin: [8, 12] }), act('right', geometry.pause[1], { verb: 'press', s: .1, origin: [16, 12], delay: STEP })] }),
  recipe({ name: 'recording', family: 'Communication', title: 'Recording', loopAllowed: true, story: 'The record dot pulses while recording.',
    parts: [still('microphone', geometry.recording[0]), still('badge', geometry.recording[1]),
      act('dot', geometry.recording[2], { verb: 'pop', s: .15, origin: badgeCentre })] }),
  whole('call', 'Communication', 'Call', 'The handset rings.', { verb: 'ring', r: 9, origin: [12, 12] }),
  whole('chat', 'Communication', 'Message', 'The bubble pops from its tail.', { verb: 'pop', s: .1, origin: [5, 20] }),
  recipe({ name: 'mail', family: 'Communication', title: 'Mail', story: 'The envelope flap opens, holds, and closes.',
    parts: [still('envelope', geometry.mail[0]), act('flap', geometry.mail[1], { verb: 'flip', sy: -1.6, origin: [12, 6.5] })] }),
  recipe({ name: 'inbox', family: 'Communication', title: 'Inbox', story: 'The tray dips as something arrives.',
    parts: [still('tray', geometry.inbox[0]), act('well', geometry.inbox[1], { verb: 'nudge', y: 1.4 })] }),
  recipe({ name: 'chat-multiple', family: 'Communication', title: 'Conversations', story: 'The front bubble pops and the one behind steps back.',
    parts: [act('back', geometry['chat-multiple'][0], { verb: 'nudge', x: -1, y: -1, delay: STEP }),
      act('front', geometry['chat-multiple'][1], { verb: 'pop', s: .08, origin: [10, 22] })] }),
  recipe({ name: 'chat-history', family: 'Communication', title: 'History', story: 'The clock hand winds back one turn.',
    parts: [still('chat', geometry['chat-history'][0]), still('badge', geometry['chat-history'][1]),
      act('hand', geometry['chat-history'][2], { verb: 'turn', t: -360, origin: [17.7, 17.7] })] }),
  recipe({ name: 'call-inbound', family: 'Communication', title: 'Incoming call', story: 'The arrow pushes in towards the handset.',
    parts: [still('handset', geometry['call-inbound'][0]), act('arrow', geometry['call-inbound'][1], { verb: 'nudge', x: -2, y: 2 })] }),
  recipe({ name: 'call-outbound', family: 'Communication', title: 'Outgoing call', story: 'The arrow pushes out from the handset.',
    parts: [still('handset', geometry['call-outbound'][0]), act('arrow', geometry['call-outbound'][1], { verb: 'nudge', x: 2, y: -2 })] }),
  whole('call-end', 'Communication', 'End call', 'The handset is put down.', { verb: 'nudge', y: 2 }),
  recipe({ name: 'call-transfer', family: 'Communication', title: 'Transfer', story: 'The arrow in the badge pushes onward.',
    parts: [still('handset', geometry['call-transfer'][0]), still('badge', geometry['call-transfer'][1]),
      act('arrow', geometry['call-transfer'][2], { verb: 'nudge', x: 1.2 })] }),
  whole('headset', 'Communication', 'Headset', 'The headset tilts like a listening head.', { verb: 'swing', r: 7, origin: [12, 3] }),
  recipe({ name: 'video', family: 'Communication', title: 'Video', story: 'The lens pushes forward and springs back.',
    parts: [still('body', geometry.video[0]), act('lens', geometry.video[1], { verb: 'nudge', x: 1.6 })] }),
  recipe({ name: 'camera', family: 'Communication', title: 'Camera', story: 'The body is pressed and the lens focuses.',
    parts: [act('body', geometry.camera[0], { verb: 'press', s: .05, origin: [12, 12] }),
      act('lens', geometry.camera[1], { verb: 'pop', s: -.15, origin: [12, 12.5], delay: STEP })] }),
  whole('agent', 'Communication', 'Agent', 'The agent hops to attention.', { verb: 'hop', y: -1.4 }),
  recipe({ name: 'screen-share', family: 'Communication', title: 'Share screen', story: 'The arrow pushes up out of the screen.',
    parts: [still('screen', geometry['screen-share'][0]), still('stand', cut('screen-share', 1, 'M8 21h8M12 17v4')),
      act('arrow', cut('screen-share', 1, 'M12 13V6M9 9l3-3 3 3'), { verb: 'nudge', y: -2 })] }),
  recipe({ name: 'handoff', family: 'Communication', title: 'Hand off', story: 'The exchange arrows turn half a circle.',
    parts: [still('chat', geometry.handoff[0]), still('badge', geometry.handoff[1]),
      act('arrows', geometry.handoff[2], { verb: 'turn', t: 180, origin: [18, 17.65] })] }),
  recipe({ name: 'translate', family: 'Communication', title: 'Translate', story: 'The first script is pressed and the translation pops beside it.',
    parts: [act('source', cut('translate', 0, 'M3 5h11M8.5 3v2M5.5 7c1.5 4 4 7 7 9M11.5 5c0 5-3 9-8 12'), { verb: 'press', s: .08, origin: [8.5, 10] }),
      act('target', cut('translate', 0, 'M13 21l4.5-11L22 21M14.5 17h6'), { verb: 'pop', s: .15, origin: [17.5, 15.5], delay: STEP })] }),
  recipe({ name: 'globe', family: 'Communication', title: 'Globe', story: 'The meridian narrows and widens as the globe turns.',
    parts: [still('sphere', geometry.globe[0]), act('meridian', geometry.globe[1], { verb: 'squeeze', sx: -.5, origin: [12, 12] }), still('equator', geometry.globe[2])] }),

  // AI and data.
  recipe({ name: 'ai-agent', family: 'AI and data', title: 'AI agent', story: 'The antenna lifts and the eyes blink.',
    parts: [act('antenna', cut('ai-agent', 0, 'M12 3v3'), { verb: 'hop', y: -1.2 }), still('ears', cut('ai-agent', 0, 'M2.7 10.5v3.8M21.3 10.5v3.8')),
      still('head', geometry['ai-agent'][1]),
      act('left-eye', geometry['ai-agent'][2], { verb: 'blink', sy: -.85, origin: [8.9, 11.3], delay: STEP }),
      act('right-eye', geometry['ai-agent'][3], { verb: 'blink', sy: -.85, origin: [15.1, 11.3], delay: STEP }),
      still('mouth', geometry['ai-agent'][4])] }),
  recipe({ name: 'brain-circuit', family: 'AI and data', title: 'Thinking', loopAllowed: true, story: 'The circuit nodes light in turn while the model works.',
    parts: [still('brain', geometry['brain-circuit'][0]),
      ...([[1, 18, 6], [2, 20, 12], [3, 18, 18]] as const).map(([i, x, y], n) => act(`node-${n + 1}`, geometry['brain-circuit'][i],
        { verb: 'pop', s: .15, origin: [x, y], delay: n * STEP }))] }),
  recipe({ name: 'workflow', family: 'AI and data', title: 'Workflow', loopAllowed: true, story: 'Each step pops in the order the flow runs.',
    parts: [still('connectors', geometry.workflow[3]),
      act('start', geometry.workflow[0], { verb: 'pop', s: .15, origin: [6, 5.5] }),
      act('decision', geometry.workflow[1], { verb: 'pop', s: .15, origin: [17, 11], delay: STEP }),
      act('end', geometry.workflow[2], { verb: 'pop', s: .15, origin: [17.5, 19], delay: 2 * STEP })] }),
  whole('database', 'AI and data', 'Database', 'The cylinder is pressed and released.', { verb: 'press', s: .06, origin: [12, 13.5] }),
  recipe({ name: 'analytics', family: 'AI and data', title: 'Analytics', story: 'The bars grow in turn from the axis.',
    parts: [still('axis', geometry.analytics[0]),
      ...[[1, 8.5], [2, 13.5], [3, 18.5]].map(([i, x], n) => act(`bar-${n + 1}`, geometry.analytics[i], { verb: 'arrive', sy: -.5, origin: [x, 18], delay: n * STEP }))] }),
  recipe({ name: 'chart-pie', family: 'AI and data', title: 'Share', story: 'The highlighted slice lifts out and returns.',
    parts: [still('pie', geometry['chart-pie'][0]), still('spoke', cut('chart-pie', 1, 'M12 12l-6.4 6.4')),
      act('slice', cut('chart-pie', 1, 'M12 3v9h9'), { verb: 'nudge', x: 1.2, y: -1.2 })] }),
  recipe({ name: 'trend-up', family: 'AI and data', title: 'Trend', story: 'The trend line is drawn and its arrow pops at the top.',
    parts: [still('axis', cut('trend-up', 0, 'M3 21h18')), act('line', cut('trend-up', 0, 'M4 16l5-6 4 3 7-9'), { verb: 'draw' }),
      act('head', cut('trend-up', 0, 'M15 4h5v5'), { verb: 'pop', s: .15, origin: [20, 4], delay: 3 * STEP })] }),
  recipe({ name: 'agent-group', family: 'AI and data', title: 'Agents', story: 'The two agents hop one after the other.',
    parts: [act('first', nodes('agent-group', 0, 1, 2, 3, 4, 5), { verb: 'hop', y: -1.4 }),
      act('second', nodes('agent-group', 6, 7, 8, 9, 10), { verb: 'hop', y: -1.4, delay: STEP })] }),
  recipe({ name: 'tool-call', family: 'AI and data', title: 'Tool call', story: 'The wrench turns and the run mark in the badge is pressed.',
    parts: [act('wrench', geometry['tool-call'][0], { verb: 'swing', r: -14, origin: [10, 10] }),
      still('badge', geometry['tool-call'][1]), act('run', geometry['tool-call'][2], { verb: 'press', s: .2, origin: [18.3, 18], delay: STEP })] }),
  recipe({ name: 'source-citation', family: 'AI and data', title: 'Source', story: 'The two quotation marks pop in turn.',
    parts: [still('frame', geometry['source-citation'][0]),
      act('open', cut('source-citation', 1, 'M6.5 13.5V10A2 2 0 0 1 8.5 8M6.5 13.5h3V11h-3'), { verb: 'pop', s: .15, origin: [8, 11] }),
      act('close', cut('source-citation', 1, 'M12.5 13.5V10a2 2 0 0 1 2-2M12.5 13.5h3V11h-3'), { verb: 'pop', s: .15, origin: [14, 11], delay: STEP })] }),

  // Access.
  recipe({ name: 'user-add', family: 'Access', title: 'Add person', story: 'The plus in the badge turns a quarter.',
    parts: [still('person', nodes('user-add', 0, 1)), still('badge', geometry['user-add'][2]),
      act('plus', geometry['user-add'][3], { verb: 'turn', t: 90, origin: [18, 17.5] })] }),
  recipe({ name: 'lock-closed', family: 'Access', title: 'Lock', story: 'The shackle lifts, holds, and drops shut.',
    parts: [act('shackle', cut('lock-closed', 1, 'M8 10V7a4 4 0 0 1 8 0v3'), { verb: 'slide', y: -1.8 }),
      still('body', geometry['lock-closed'][0]), still('keyhole', cut('lock-closed', 1, 'M12 14v3'))] }),
  recipe({ name: 'lock-open', family: 'Access', title: 'Unlock', story: 'The open shackle swings on its hinge.',
    parts: [act('shackle', cut('lock-open', 1, 'M8 10V7a4 4 0 0 1 8 0'), { verb: 'swing', r: -14, origin: [8, 10] }),
      still('body', geometry['lock-open'][0]), still('keyhole', cut('lock-open', 1, 'M12 14v3'))] }),
  recipe({ name: 'shield-check', family: 'Access', title: 'Protected', story: 'The shield pops and the check is written.',
    parts: [act('shield', geometry['shield-check'][0], { verb: 'pop', s: .06, origin: [12, 12] }),
      act('check', geometry['shield-check'][1], { verb: 'draw', delay: STEP })] }),
  recipe({ name: 'shield-lock', family: 'Access', title: 'Secured', story: 'The shackle inside the shield lifts and drops shut.',
    parts: [still('shield', geometry['shield-lock'][0]), act('shackle', geometry['shield-lock'][2], { verb: 'slide', y: -1.4 }),
      still('body', geometry['shield-lock'][1])] }),
  whole('key', 'Access', 'Key', 'The key turns, holds, and turns back.', { verb: 'slide', r: -12, origin: [7.2, 7.2] }),
  recipe({ name: 'sign-in', family: 'Access', title: 'Sign in', story: 'The arrow pushes in through the door.',
    parts: [still('door', cut('sign-in', 0, 'M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4')),
      act('arrow', cut('sign-in', 0, 'M3 12h12M11 8l4 4-4 4'), { verb: 'nudge', x: 2 })] }),
  recipe({ name: 'sign-out', family: 'Access', title: 'Sign out', story: 'The arrow pushes out through the door.',
    parts: [still('door', cut('sign-out', 0, 'M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4')),
      act('arrow', cut('sign-out', 0, 'M9 12h12M17 8l4 4-4 4'), { verb: 'nudge', x: 1.5 })] }),
  recipe({ name: 'plug-disconnected', family: 'Access', title: 'Disconnected', story: 'The two plugs reach for each other, hold, and part.',
    parts: [act('left', [geometry['plug-disconnected'][0], cut('plug-disconnected', 2, 'M1.8 12h1.3M8.3 10.2h2M8.3 13.8h2')], { verb: 'slide', x: 1.5 }),
      act('right', [geometry['plug-disconnected'][1], cut('plug-disconnected', 2, 'M20.9 12h1.3'), geometry['plug-disconnected'][3]], { verb: 'slide', x: -1.5 })] }),
  recipe({ name: 'link', family: 'Access', title: 'Link', story: 'The two links pull apart and snap back together.',
    parts: [still('bar', cut('link', 0, 'M9.5 14.5l5-5')),
      act('lower', cut('link', 0, 'M8 15.5l-1 1a3 3 0 0 0 4.3 4.3l4.5-4.5a3 3 0 0 0 0-4.3'), { verb: 'nudge', x: -1.2, y: 1.2 }),
      act('upper', cut('link', 0, 'M16 8.5l1-1a3 3 0 0 0-4.3-4.3L8.2 7.7a3 3 0 0 0 0 4.3'), { verb: 'nudge', x: 1.2, y: -1.2 })] }),
  whole('user', 'Access', 'Person', 'The person hops.', { verb: 'hop', y: -1.6 }),
  recipe({ name: 'users', family: 'Access', title: 'People', story: 'The person behind hops up from behind the one in front.',
    parts: [act('back', nodes('users', 0, 1), { verb: 'hop', y: -1.6 }), still('front', nodes('users', 2, 3, 4))] }),
  whole('eye', 'Access', 'Show', 'The eye blinks.', { verb: 'blink', sy: -.72, origin: [12, 12] }),
  recipe({ name: 'eye-off', family: 'Access', title: 'Hide', story: 'The stroke is drawn across the eye.',
    parts: [still('eye', nodes('eye-off', 0, 1)), act('slash', geometry['eye-off'][2], { verb: 'draw' })] }),
  recipe({ name: 'fingerprint', family: 'Access', title: 'Fingerprint', story: 'The inner ridges are traced as the finger is read.',
    parts: [still('outer', cut('fingerprint', 0, 'M5 8a7.5 7.5 0 0 1 14 0M3.5 12v2.5M20.5 12v2.5M6 12a6 6 0 0 1 12 0v2c0 2.4.6 4.5 1.5 6')),
      ...['M12 8a4 4 0 0 0-4 4v3c0 2.4-.7 4.5-1.5 6', 'M12 12v4c0 2.2-.4 3.8-1 5', 'M16 12v3c0 2.3.4 4.3 1 6'].map((d, i) =>
        act(`ridge-${i + 1}`, cut('fingerprint', 0, d), { verb: 'draw', delay: i * STEP }))] }),

  // Education.
  recipe({ name: 'calendar', family: 'Education', title: 'Calendar', story: 'The days pop in order.',
    parts: [still('page', geometry.calendar[0]), still('binding', cut('calendar', 1, 'M3.5 10h17M8 2.5V7M16 2.5V7')),
      ...[[8, 14], [12, 14], [16, 14], [8, 18], [12, 18]].map(([x, y], i) => act(`day-${i + 1}`, cut('calendar', 1, `M${x} ${y}h.01`),
        { verb: 'pop', s: .9, origin: [x, y], delay: i * STEP }))] }),
  recipe({ name: 'document-text', family: 'Education', title: 'Document', story: 'The two lines of text are written.',
    parts: [still('page', nodes('document-text', 0, 1)),
      ...['M8 12h7', 'M8 16h7'].map((d, i) => act(`line-${i + 1}`, cut('document-text', 2, d), { verb: 'draw', delay: i * STEP }))] }),
  whole('book', 'Education', 'Book', 'The book tips forward and settles.', { verb: 'nudge', r: -6, origin: [4, 20] }),
  recipe({ name: 'graduation-cap', family: 'Education', title: 'Graduation', story: 'The cap is tossed up; the tassel follows a moment later.',
    parts: [act('cap', nodes('graduation-cap', 0, 1), { verb: 'hop', y: -2 }), act('tassel', nodes('graduation-cap', 2, 3), { verb: 'hop', y: -2, delay: STEP })] }),
  whole('knowledge', 'Education', 'Knowledge', 'The open book pops.', { verb: 'pop', s: .06, origin: [12, 12.5] }),
  recipe({ name: 'clipboard-task', family: 'Education', title: 'Task', story: 'The check is written on the clipboard.',
    parts: [still('board', nodes('clipboard-task', 0, 1)), act('check', geometry['clipboard-task'][2], { verb: 'draw' })] }),
  recipe({ name: 'calendar-clock', family: 'Education', title: 'Schedule', story: 'The clock hand sweeps one turn.',
    parts: [still('calendar', geometry['calendar-clock'][0]), still('badge', geometry['calendar-clock'][1]),
      act('hand', geometry['calendar-clock'][2], { verb: 'turn', t: 360, origin: [17.7, 17.7] })] }),
  recipe({ name: 'assignment', family: 'Education', title: 'Assignment', story: 'The check in the badge is written.',
    parts: [still('board', geometry.assignment[0]), still('badge', geometry.assignment[1]),
      act('check', geometry.assignment[2], { verb: 'draw', delay: STEP })] }),
  // Badged icons: the drawing stays; the mark in its badge does what it says.
  ...([['book-add', 'Education', 'Add book'], ['building-add', 'Access', 'Add building'], ['calendar-add', 'Education', 'Add to calendar'],
    ['call-add', 'Communication', 'Add call'], ['campaign-add', 'Actions', 'New campaign'], ['connector-add', 'AI and data', 'Add connector'],
    ['document-add', 'Actions', 'Add document'], ['emoji-add', 'Communication', 'Add reaction'], ['form-add', 'Actions', 'New form'],
    ['integrations-add', 'AI and data', 'Add integration'], ['library-add', 'Education', 'Add to library'], ['link-add', 'Access', 'Add link'],
    ['question-add', 'Status', 'Add question'], ['tag-add', 'Actions', 'Add tag']] as const).map(([name, family, title]) =>
    badged(name, family, title, 'The plus in the badge turns a quarter.', { 2: PLUS() })),
  badged('top-up', 'Actions', 'Top up', 'The plus in the badge turns a quarter.', { 2: PLUS([18, 18]) }),
  ...([['billing-integrity', 'Actions', 'Billing checked'], ['connection-health', 'AI and data', 'Connection healthy'], ['consent', 'Access', 'Consent given'],
    ['grounded-answer', 'AI and data', 'Grounded answer'], ['health-check', 'Status', 'Healthy'], ['human-approval', 'AI and data', 'Approved by a person'],
    ['role', 'Access', 'Role']] as const).map(([name, family, title]) =>
    badged(name, family, title, 'The check in the badge is written.', { 2: CHECK })),
  badged('enrollment', 'Education', 'Enrolled', 'The check in the badge is written.', { 5: CHECK }),
  badged('person-available', 'Access', 'Available', 'The check in the badge is written.', { 4: CHECK }),
  ...([['audit-trail', 'Actions', 'Audit trail'], ['callback', 'Communication', 'Callback'], ['tour-booking', 'Education', 'Tour booking']] as const)
    .map(([name, family, title]) => badged(name, family, title, 'The clock hand in the badge sweeps one turn.', { 2: HAND })),
  badged('retention', 'AI and data', 'Retention', 'The clock hand in the badge sweeps one turn.', { 4: HAND }),
  ...([['deadline', 'Education', 'Deadline'], ['incident', 'Status', 'Incident'], ['sla-breach', 'Status', 'Service level missed'],
    ['usage-limit', 'Status', 'Usage limit']] as const).map(([name, family, title]) =>
    badged(name, family, title, 'The exclamation mark in the badge shakes for attention.', { 2: ALERT })),
  ...([['impersonation', 'Access', 'Act as someone'], ['password-reset', 'Access', 'Reset password'], ['tenant-switch', 'Access', 'Switch workspace']] as const)
    .map(([name, family, title]) => badged(name, family, title, 'The exchange arrows in the badge turn half a circle.', { 2: SWAP() })),
  badged('person-swap', 'Access', 'Switch person', 'The exchange arrows in the badge turn half a circle.', { 4: SWAP([17.7, 17.7]) }),
  badged('backup', 'AI and data', 'Back up', 'The arrow in the badge pushes up and springs back.', { 2: { id: 'arrow', verb: 'nudge', y: -1 } }),
  badged('financial-hold', 'Actions', 'Financial hold', 'The shackle of the lock in the badge lifts and drops shut.', { 3: { id: 'shackle', verb: 'slide', y: -.6 } }),
  badged('internal-note', 'Communication', 'Internal note', 'The shackle of the lock in the badge lifts and drops shut.', { 3: { id: 'shackle', verb: 'slide', y: -.6 } }),
  recipe({ name: 'database-person', family: 'AI and data', title: 'Person records', story: 'The person in the badge hops.',
    parts: [still('database', nodes('database-person', 0, 1)), act('person', nodes('database-person', 2, 3), { verb: 'hop', y: -.6 })] }),
  badged('chat-sparkle', 'AI and data', 'AI reply', 'The sparkle in the badge turns a quarter.', { 2: { id: 'sparkle', verb: 'turn', t: 90, origin: [18, 18] } }),
  badged('grade', 'Education', 'Grade', 'The grade letter in the badge pops.', { 2: { id: 'letter', verb: 'pop', s: .15, origin: [18, 18] } }),
  badged('scholarship', 'Education', 'Scholarship', 'The dollar sign in the badge pops.', { 2: { id: 'dollar', verb: 'pop', s: .15, origin: [18, 18] } }),
  badged('canned-response', 'Communication', 'Saved reply', 'The bookmark in the badge hops.', { 2: { id: 'bookmark', verb: 'hop', y: -.8 } }),
  badged('knowledge-gap', 'Education', 'Knowledge gap', 'The question mark in the badge tilts as if wondering.', { 2: ASK([18, 20.1]) }),
  recipe({ name: 'person-question-mark', family: 'Access', title: 'Unknown person', story: 'The question mark in the badge tilts as if wondering.',
    parts: [still('person', nodes('person-question-mark', 0, 1, 2, 3)), act('question', nodes('person-question-mark', 4, 5), ASK([17.7, 20.1]))] }),
  recipe({ name: 'book-question', family: 'Education', title: 'Book question', story: 'The question mark on the cover tilts as if wondering.',
    parts: [still('book', nodes('book-question', 0, 1)), act('question', nodes('book-question', 2, 3), ASK([11.3, 13.75]))] }),
  badged('source-confidence', 'AI and data', 'Source confidence', 'The bars in the badge grow from their base.', { 2: BARS([18, 19.5]) }),
  badged('lead-score', 'Access', 'Lead score', 'The bars in the badge grow from their base.', { 4: BARS([17.7, 19.6]) }),
  badged('person-voice', 'Communication', 'Speaking', 'The voice bars in the badge grow from their middle.', { 4: BARS([17.7, 17.7]) }),
  recipe({ name: 'person-key', family: 'Access', title: 'Person key', story: 'The key in the badge turns, holds, and turns back.',
    parts: [still('person', nodes('person-key', 0, 1, 2, 3)), act('key', nodes('person-key', 4, 5), KEY([16.7, 16.7]))] }),
  recipe({ name: 'passkey', family: 'Access', title: 'Passkey', story: 'The key in the badge turns, holds, and turns back.',
    parts: [still('fingerprint', nodes('passkey', 0, 1, 2, 3, 4)), act('key', nodes('passkey', 5, 6), KEY([16.7, 16.7]))] }),
  recipe({ name: 'permission', family: 'Access', title: 'Permission', story: 'The key in the badge turns, holds, and turns back.',
    parts: [still('shield', nodes('permission', 0, 1)), act('key', nodes('permission', 2, 3), KEY([17.3, 17.3]))] }),
  badged('user-remove', 'Access', 'Remove person', 'The minus in the badge narrows and returns.', { 3: { id: 'minus', verb: 'squeeze', sx: -.4, origin: [18, 17.5] } }),
  recipe({ name: 'data-residency', family: 'AI and data', title: 'Data residency', story: 'The globe turns behind the pin that marks where data lives.',
    parts: [still('globe', geometry['data-residency'][0]), still('equator', cut('data-residency', 1, 'M2.5 10.5h16')),
      act('meridians', cut('data-residency', 1, 'M10.5 2.5c-4 4.5-4 11.5 0 16M10.5 2.5c4 4.5 4 11.5 0 16'), { verb: 'squeeze', sx: -.5, origin: [10.5, 10.5] }),
      still('pin', nodes('data-residency', 2, 3))] }),
  recipe({ name: 'noise-suppression', family: 'Communication', title: 'Noise suppression', story: 'The noise is pressed flat under the stroke and comes back.',
    parts: [act('noise', geometry['noise-suppression'][0], { verb: 'blink', sy: -.45, origin: [12, 12] }), still('stroke', nodes('noise-suppression', 1, 2))] }),
  recipe({ name: 'two-factor', family: 'Access', title: 'Two-step sign-in', story: 'The shield beside the phone pops and its check is written.',
    parts: [still('phone', nodes('two-factor', 0, 1)), act('shield', geometry['two-factor'][2], { verb: 'pop', s: .08, origin: [18, 15] }),
      act('check', geometry['two-factor'][3], { verb: 'draw', delay: STEP })] }),
  badged('visitor', 'Access', 'Visitor', 'The pass swings on its clip.', { 0: { id: 'card', verb: 'swing', r: 5, origin: [12, 3] }, 2: { id: 'face', verb: 'swing', r: 5, origin: [12, 3] }, 3: { id: 'shoulders', verb: 'swing', r: 5, origin: [12, 3] } }),

  // Objects that act.
  recipe({ name: 'action', family: 'Actions', title: 'Action', story: 'The bolt pops inside its tile.',
    parts: [still('tile', geometry.action[0]), act('bolt', geometry.action[1], { verb: 'pop', s: .12, origin: [12, 12] })] }),
  whole('flash', 'Actions', 'Trigger', 'The bolt strikes: it pops and settles.', { verb: 'pop', s: .1, origin: [12, 12] }),
  recipe({ name: 'api', family: 'AI and data', title: 'API', story: 'The brackets open apart and close again.',
    parts: [still('frame', geometry.api[0]), act('open', cut('api', 1, 'M8 9l-3 3 3 3'), { verb: 'nudge', x: -.8 }),
      act('close', cut('api', 1, 'M16 9l3 3-3 3'), { verb: 'nudge', x: .8 }), still('slash', cut('api', 1, 'M13 8l-2 8'))] }),
  recipe({ name: 'code', family: 'AI and data', title: 'Code', story: 'The brackets open apart and close again.',
    parts: [act('open', cut('code', 0, 'M8 6l-6 6 6 6'), { verb: 'nudge', x: -.8 }), act('close', cut('code', 0, 'M16 6l6 6-6 6'), { verb: 'nudge', x: .8 }),
      still('slash', cut('code', 0, 'M14 3l-4 18'))] }),
  recipe({ name: 'braces', family: 'AI and data', title: 'Braces', story: 'The braces open apart and close again.',
    parts: [act('open', cut('braces', 0, 'M8 3H6.5A1.5 1.5 0 0 0 5 4.5V9a3 3 0 0 1-2 3 3 3 0 0 1 2 3v4.5A1.5 1.5 0 0 0 6.5 21H8'), { verb: 'nudge', x: -.8 }),
      act('close', cut('braces', 0, 'M16 3h1.5A1.5 1.5 0 0 1 19 4.5V9a3 3 0 0 0 2 3 3 3 0 0 0-2 3v4.5a1.5 1.5 0 0 1-1.5 1.5H16'), { verb: 'nudge', x: .8 })] }),
  recipe({ name: 'attribution', family: 'AI and data', title: 'Attribution', story: 'Both sources pop in turn, then the result they lead to.',
    parts: by('attribution', { 0: { verb: 'pop', s: .15, origin: [5, 6] }, 1: { verb: 'pop', s: .15, origin: [5, 18], delay: STEP }, 2: { verb: 'pop', s: .15, origin: [19, 12], delay: 2 * STEP } }) }),
  whole('audience', 'Access', 'Audience', 'The audience hops together.', { verb: 'hop', y: -1.2 }),
  whole('people-team', 'Access', 'Team', 'The team hops together.', { verb: 'hop', y: -1.2 }),
  whole('beaker', 'Education', 'Lab', 'The beaker swirls on its rim.', { verb: 'swing', r: 6, origin: [12, 3] }),
  recipe({ name: 'board', family: 'Actions', title: 'Board', story: 'The cards in each column grow in turn.',
    parts: [still('board', geometry.board[0]), still('columns', cut('board', 1, 'M9 4v16M15 4v16')),
      ...(['M6 8v5', 'M12 8v8', 'M18 8v3'] as const).map((d, i) => act(`card-${i + 1}`, cut('board', 1, d), { verb: 'arrive', sy: -.5, origin: [6 + i * 6, 8], delay: i * STEP }))] }),
  whole('bookmark', 'Actions', 'Bookmark', 'The bookmark hops.', { verb: 'hop', y: -1.2 }),
  recipe({ name: 'branch', family: 'AI and data', title: 'Branch', story: 'The branch points pop in the order the line splits.',
    parts: by('branch', { 0: { verb: 'pop', s: .15, origin: [6, 4.5] }, 2: { verb: 'pop', s: .15, origin: [6, 19.5], delay: STEP }, 1: { verb: 'pop', s: .15, origin: [18, 4.5], delay: 2 * STEP } }) }),
  recipe({ name: 'merge', family: 'AI and data', title: 'Merge', story: 'Both branches pop, then the point where they join.',
    parts: by('merge', { 0: { verb: 'pop', s: .15, origin: [6, 4.5] }, 1: { verb: 'pop', s: .15, origin: [18, 4.5], delay: STEP }, 2: { verb: 'pop', s: .15, origin: [12, 19.5], delay: 2 * STEP } }) }),
  whole('broom', 'Actions', 'Clean up', 'The broom sweeps from its handle.', { verb: 'swing', r: 8, origin: [18.4, 2.9] }),
  ...(['budget', 'wallet'] as const).map(name => badged(name, 'Actions', name === 'budget' ? 'Budget' : 'Wallet',
    'The clasp slides out and back.', { 2: { id: 'clasp', verb: 'nudge', x: .8 }, 3: { id: 'stud', verb: 'nudge', x: .8 } })),
  recipe({ name: 'building', family: 'Access', title: 'Building', story: 'The windows light up floor by floor.',
    parts: [still('building', geometry.building[0]), still('door', cut('building', 1, 'M10 21v-3h4v3')),
      ...([[9, 15], [15, 15], [9, 11], [15, 11], [9, 7], [15, 7]] as const).map(([x, y], i) =>
        act(`window-${i + 1}`, cut('building', 1, `M${x} ${y}h.01`), { verb: 'pop', s: .9, origin: [x, y], delay: Math.floor(i / 2) * STEP }))] }),
  recipe({ name: 'building-bank', family: 'Access', title: 'Institution', story: 'The roof lifts and settles on the columns.',
    parts: [still('columns', cut('building-bank', 0, 'M5 8v10M9.7 8v10M14.3 8v10M19 8v10M3 21h18M4 18h16', { fill: 'none' })),
      act('roof', cut('building-bank', 0, 'M3 8l9-5 9 5H3Z'), { verb: 'hop', y: -1.2 })] }),
  whole('campus', 'Education', 'Campus', 'The campus settles like a pressed button.', { verb: 'press', s: .05, origin: [12, 21] }),
  whole('cable', 'AI and data', 'Cable', 'The cable sways from its loop.', { verb: 'swing', r: 5, origin: [11, 18] }),
  recipe({ name: 'calendar-ltr', family: 'Education', title: 'Timetable', story: 'The entries are written into the week.',
    parts: [still('page', geometry['calendar-ltr'][0]), still('binding', cut('calendar-ltr', 1, 'M3.5 10h17M8 2.5V7M16 2.5V7')),
      ...writing('calendar-ltr', 1, ['M7 14h3', 'M14 14h3', 'M7 18h3', 'M14 18h3'])] }),
  whole('campaign', 'Actions', 'Campaign', 'The megaphone sounds.', { verb: 'ring', r: 3, origin: [8, 12] }),
  recipe({ name: 'certificate', family: 'Education', title: 'Certificate', story: 'The seal swings on its ribbon.',
    parts: [still('certificate', nodes('certificate', 0, 1)), act('seal', nodes('certificate', 2, 3), { verb: 'swing', r: 10, origin: [16, 16] })] }),
  recipe({ name: 'channel', family: 'Communication', title: 'Channel', story: 'Both sources pop, then the point they reach.',
    parts: by('channel', { 0: { verb: 'pop', s: .15, origin: [6, 5.5] }, 1: { verb: 'pop', s: .15, origin: [18, 5.5], delay: STEP }, 2: { verb: 'pop', s: .15, origin: [12, 18.5], delay: 2 * STEP } }) }),
  recipe({ name: 'network', family: 'AI and data', title: 'Network', story: 'The top node pops, then the two it reaches.',
    parts: by('network', { 0: { verb: 'pop', s: .15, origin: [12, 5.5] }, 1: { verb: 'pop', s: .15, origin: [6, 18.5], delay: STEP }, 2: { verb: 'pop', s: .15, origin: [18, 18.5], delay: STEP } }) }),
  recipe({ name: 'taxonomy', family: 'Education', title: 'Taxonomy', story: 'The parent pops, then its two children.',
    parts: by('taxonomy', { 0: { verb: 'pop', s: .15, origin: [12, 5.5] }, 1: { verb: 'pop', s: .15, origin: [6, 18.5], delay: STEP }, 2: { verb: 'pop', s: .15, origin: [18, 18.5], delay: STEP } }) }),
  recipe({ name: 'webhook', family: 'AI and data', title: 'Webhook', story: 'The three points pop in turn round the loop.',
    parts: by('webhook', { 0: { verb: 'pop', s: .15, origin: [7, 7] }, 1: { verb: 'pop', s: .15, origin: [18, 8], delay: STEP }, 2: { verb: 'pop', s: .15, origin: [12, 18], delay: 2 * STEP } }) }),
  recipe({ name: 'connector', family: 'AI and data', title: 'Connector', story: 'One end pops, then the other it connects to.',
    parts: by('connector', { 0: { verb: 'pop', s: .15, origin: [6, 6.5] }, 1: { verb: 'pop', s: .15, origin: [18, 17.5], delay: 2 * STEP } }) }),
  recipe({ name: 'integrations', family: 'AI and data', title: 'Integrations', story: 'One system pops, then the one it connects to.',
    parts: by('integrations', { 1: { verb: 'pop', s: .15, origin: [6.5, 7.5] }, 2: { verb: 'pop', s: .15, origin: [17.5, 16.5], delay: 2 * STEP } }) }),
  recipe({ name: 'flow', family: 'AI and data', title: 'Flow', story: 'The first step pops, then the last.',
    parts: by('flow', { 0: { verb: 'pop', s: .15, origin: [6, 5.5] }, 1: { verb: 'pop', s: .15, origin: [18, 18.5], delay: 2 * STEP } }) }),
  recipe({ name: 'embedding', family: 'AI and data', title: 'Embedding', story: 'The arrow pushes into the vector, whose points pop in turn.',
    parts: by('embedding', { 2: { verb: 'nudge', x: .8 }, 4: { verb: 'pop', s: .15, origin: [19, 6], delay: STEP }, 5: { verb: 'pop', s: .15, origin: [19, 12], delay: 2 * STEP }, 6: { verb: 'pop', s: .15, origin: [19, 18], delay: 3 * STEP } }) }),
  recipe({ name: 'chart-area', family: 'AI and data', title: 'Area chart', story: 'The area grows up from the axis.',
    parts: [still('axis', cut('chart-area', 0, 'M3.5 4v16.5h17', { fill: 'none' })),
      act('area', cut('chart-area', 0, 'M4 16l5-5 5 2 6-7v14H4V16Z'), { verb: 'arrive', sy: -.5, origin: [12, 20] })] }),
  whole('check', 'Status', 'Done', 'The check pops.', { verb: 'pop', s: .12, origin: [12, 11] }),
  recipe({ name: 'chevron-up-down', family: 'Actions', title: 'Choose', story: 'The two chevrons push apart and spring back.',
    parts: [act('up', cut('chevron-up-down', 0, 'M8 8l4-4 4 4'), { verb: 'nudge', y: -1.5 }), act('down', cut('chevron-up-down', 0, 'M8 16l4 4 4-4'), { verb: 'nudge', y: 1.5 })] }),
  recipe({ name: 'clipboard-list', family: 'Education', title: 'List', story: 'The items are written on the clipboard.',
    parts: [still('board', nodes('clipboard-list', 0, 1)), still('bullets', cut('clipboard-list', 2, 'M8 12h.01M8 16h.01')),
      ...writing('clipboard-list', 2, ['M11 12h5', 'M11 16h5'])] }),
  recipe({ name: 'close-circle', family: 'Status', title: 'Dismiss', story: 'The cross turns a quarter inside its circle.',
    parts: [still('circle', geometry['close-circle'][0]), act('cross', geometry['close-circle'][1], { verb: 'turn', t: 90, origin: [12, 12] })] }),
  recipe({ name: 'condition', family: 'AI and data', title: 'Condition', story: 'The question mark tilts as if deciding.',
    parts: [still('diamond', geometry.condition[0]), act('question', nodes('condition', 1, 2), ASK([12, 16.8]))] }),
  recipe({ name: 'contact-card', family: 'Access', title: 'Contact', story: 'The details are written beside the photo.',
    parts: [still('card', nodes('contact-card', 0, 1)), still('shoulders', cut('contact-card', 2, 'M5 16c.3-1.8 1.2-2.5 3-2.5s2.7.7 3 2.5')),
      ...writing('contact-card', 2, ['M14 10h4', 'M14 14h4'])] }),
  whole('conversion', 'AI and data', 'Conversion', 'The funnel narrows and widens again.', { verb: 'squeeze', sx: -.15, origin: [12, 4] }),
  recipe({ name: 'course', family: 'Education', title: 'Course', story: 'The lines are written on the page.',
    parts: [still('book', geometry.course[0]), still('spine', cut('course', 1, 'M8 3v18')), ...writing('course', 1, ['M12 7h5', 'M12 11h3'])] }),
  recipe({ name: 'creative', family: 'Actions', title: 'Creative', story: 'The sun rises a little and sets back.',
    parts: by('creative', { 2: { id: 'sun', verb: 'hop', y: -1.5 } }) }),
  recipe({ name: 'crown', family: 'Status', title: 'Top', story: 'The crown lifts off its base and settles back.',
    parts: by('crown', { 0: { id: 'crown', verb: 'hop', y: -1.2 } }) }),
  whole('currency-dollar', 'Actions', 'Currency', 'The coin turns over once.', { verb: 'squeeze', sx: -.35, origin: [12, 12] }),
  recipe({ name: 'currency-dollar-euro', family: 'Actions', title: 'Currencies', story: 'Each coin turns over in turn.',
    parts: [act('dollar', geometry['currency-dollar-euro'][0], { verb: 'squeeze', sx: -.35, origin: [7.55, 11.6] }),
      act('euro', geometry['currency-dollar-euro'][1], { verb: 'squeeze', sx: -.35, origin: [17.3, 12], delay: STEP })] }),
  recipe({ name: 'deployment', family: 'AI and data', title: 'Deploy', story: 'The arrow pushes up out of the box and springs back.',
    parts: [still('box', geometry.deployment[0]), still('light', cut('deployment', 1, 'M7 17h.01')),
      act('arrow', cut('deployment', 1, 'M12 14V3M8 7l4-4 4 4'), { verb: 'nudge', y: -1.5 })] }),
  recipe({ name: 'devices', family: 'Communication', title: 'Devices', story: 'The screen slides behind the phone and returns.',
    parts: [act('screen', nodes('devices', 0, 1), { verb: 'nudge', x: -1 }), still('phone', nodes('devices', 2, 3))] }),
  whole('document', 'Actions', 'Document', 'The page lifts and settles.', { verb: 'hop', y: -1.2 }),
  recipe({ name: 'document-bullet-list', family: 'Actions', title: 'Document list', story: 'The items are written on the page.',
    parts: [still('page', nodes('document-bullet-list', 0, 1)), still('bullets', cut('document-bullet-list', 2, 'M8 12h.01M8 16h.01')),
      ...writing('document-bullet-list', 2, ['M11 12h4', 'M11 16h4'])] }),
  recipe({ name: 'document-copy', family: 'Actions', title: 'Copy document', story: 'The copy separates from the source page and settles beside it.',
    parts: [still('source-sheet', geometry['document-copy'][0]), act('copy-sheet', nodes('document-copy', 1, 2), { verb: 'arrive', x: -2, y: -2 })] }),
  recipe({ name: 'document-pdf', family: 'Actions', title: 'PDF', story: 'The PDF label pops on the page.',
    parts: by('document-pdf', { 2: { id: 'label', verb: 'pop', s: .1, origin: [12, 14.5] } }) }),
  recipe({ name: 'document-table', family: 'Actions', title: 'Spreadsheet', story: 'The table pops on the page.',
    parts: [still('page', nodes('document-table', 0, 1)), act('table', nodes('document-table', 2, 3), { verb: 'pop', s: .1, origin: [12, 14.75] })] }),
  recipe({ name: 'fee-voucher', family: 'Education', title: 'Fee voucher', story: 'The dollar sign turns over like a coin.',
    parts: by('fee-voucher', { 2: { id: 'dollar', verb: 'squeeze', sx: -.5, origin: [11.75, 14.5] } }) }),
  recipe({ name: 'easm-one', family: 'AI and data', title: 'EASM One', story: 'The core pops and the six rays turn one step around it.',
    parts: [act('rays', nodes('easm-one', 0, 1, 2, 3, 4, 5), { verb: 'turn', t: 60, origin: [12, 12] }),
      act('core', geometry['easm-one'][6], { verb: 'pop', s: .15, origin: [12, 12] })] }),
  ...([['fullscreen', 'Enter full screen', 'pop'], ['fullscreen-exit', 'Exit full screen', 'press']] as const).map(([name, title, verb]) =>
    whole(name, 'Actions', title, verb === 'pop' ? 'The frame opens outward and settles.' : 'The frame closes inward and settles.', { verb, s: .08, origin: [12, 12] })),
  whole('hand-left', 'Communication', 'Raise hand', 'The hand waves from the wrist.', { verb: 'swing', r: 12, origin: [12, 21] }),
  recipe({ name: 'heart-pulse', family: 'Status', title: 'Health', story: 'The heart beats and the pulse is traced across it.',
    parts: [act('heart', geometry['heart-pulse'][0], { verb: 'pop', s: .06, origin: [12, 12.5] }), act('pulse', geometry['heart-pulse'][1], { verb: 'draw', delay: STEP })] }),
  recipe({ name: 'history', family: 'Status', title: 'History', story: 'The hand winds back one turn.',
    parts: [still('arrow', cut('history', 0, 'M3.5 10a8.5 8.5 0 1 1 .7 6.2M3.5 4.5V10H9')),
      act('hand', cut('history', 0, 'M12 7.5v5'), { verb: 'turn', t: -360, origin: [12, 12.5] }), still('hour', cut('history', 0, 'M12 12.5l3.3 2'))] }),
  ...(['hybrid-search', 'keyword-search', 'semantic-search'] as const).map(name =>
    whole(name, 'AI and data', name === 'hybrid-search' ? 'Hybrid search' : name === 'keyword-search' ? 'Keyword search' : 'Semantic search',
      'The magnifier makes one small scanning circle.', { verb: 'orbit', x: 1.2, y: 1.2 })),
  recipe({ name: 'search-square', family: 'Actions', title: 'Search', story: 'The magnifier makes one small scanning circle inside its frame.',
    parts: [still('frame', geometry['search-square'][0]), act('lens', nodes('search-square', 1, 2), { verb: 'orbit', x: .9, y: .9 })] }),
  recipe({ name: 'key-multiple', family: 'Access', title: 'Keys', story: 'The keys turn one after the other.',
    parts: [act('first', geometry['key-multiple'][0], { verb: 'slide', r: -12, origin: [7.2, 6.5] }),
      act('second', nodes('key-multiple', 1, 2), { verb: 'slide', r: 12, origin: [16.5, 7.8], delay: STEP })] }),
  recipe({ name: 'kiosk', family: 'Communication', title: 'Kiosk', story: 'The text appears on the screen.',
    parts: [still('screen', geometry.kiosk[0]), still('stand', cut('kiosk', 1, 'M8 21h8M12 17v4')), ...writing('kiosk', 1, ['M9 7h6', 'M9 11h6'])] }),
  recipe({ name: 'language', family: 'Communication', title: 'Language', story: 'The meridians narrow and widen as the globe turns.',
    parts: [still('sphere', geometry.language[0]), still('equator', cut('language', 1, 'M3 12h18')),
      act('meridians', cut('language', 1, 'M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18'), { verb: 'squeeze', sx: -.5, origin: [12, 12] })] }),
  recipe({ name: 'layers', family: 'Actions', title: 'Layers', story: 'The top layer lifts and settles back on the stack.',
    parts: [still('stack', geometry.layers[1]), act('top', geometry.layers[0], { verb: 'hop', y: -1.5 })] }),
  whole('lead-hot', 'Status', 'Hot lead', 'The flame flickers.', { verb: 'ring', r: 3, origin: [12, 21] }),
  recipe({ name: 'library', family: 'Education', title: 'Library', story: 'The leaning book straightens and leans back.',
    parts: by('library', { 2: { id: 'book', verb: 'nudge', r: -6, origin: [19.3, 19.4] } }) }),
  whole('moon', 'Status', 'Night', 'The moon rocks gently.', { verb: 'swing', r: -10, origin: [12, 12] }),
  whole('mosque', 'Education', 'Prayer room', 'The building settles gently.', { verb: 'press', s: .04, origin: [12, 20.5] }),
  whole('music-note', 'Communication', 'Music', 'The note swings on its head.', { verb: 'swing', r: 10, origin: [6.5, 18] }),
  whole('navigation', 'Actions', 'Navigate', 'The pointer pushes the way it points and springs back.', { verb: 'nudge', x: 1.2, y: -1.2 }),
  recipe({ name: 'note', family: 'Education', title: 'Note', story: 'The lines are written on the note.',
    parts: [still('note', geometry.note[0]), still('fold', cut('note', 1, 'M15.5 20.5V17a1.5 1.5 0 0 1 1.5-1.5h3')), ...writing('note', 1, ['M8 8h8', 'M8 12h5'])] }),
  recipe({ name: 'notepad', family: 'Education', title: 'Notepad', story: 'The lines are written on the pad.',
    parts: [still('pad', geometry.notepad[0]), still('rings', cut('notepad', 1, 'M8 2.5v3M16 2.5v3')), ...writing('notepad', 1, ['M8 10h8', 'M8 14h8', 'M8 18h4'])] }),
  recipe({ name: 'parent-context', family: 'AI and data', title: 'Parent context', story: 'The inner frame is pressed and released.',
    parts: by('parent-context', { 1: { id: 'inner', verb: 'press', s: .1, origin: [12, 12] } }) }),
  recipe({ name: 'person-circle', family: 'Access', title: 'Profile', story: 'The person hops inside the circle.',
    parts: [still('circle', geometry['person-circle'][0]), act('person', nodes('person-circle', 1, 2), { verb: 'hop', y: -1 })] }),
  whole('phone', 'Communication', 'Phone', 'The phone rings.', { verb: 'ring', r: 6, origin: [12, 12] }),
  recipe({ name: 'play-circle', family: 'Communication', title: 'Play', story: 'The triangle pushes forward and springs back.',
    parts: by('play-circle', { 1: { id: 'triangle', verb: 'nudge', x: 1.2 } }) }),
  recipe({ name: 'print', family: 'Actions', title: 'Print', story: 'The printer is pressed and released.',
    parts: by('print', { 1: { id: 'body', verb: 'press', s: .05, origin: [12, 12.5] } }) }),
  whole('pulse', 'Status', 'Activity', 'The pulse rises and falls once.', { verb: 'flip', sy: .3, origin: [12, 12] }),
  recipe({ name: 'reaction', family: 'Communication', title: 'Reaction', story: 'The face looks up and smiles.',
    parts: by('reaction', { 1: { id: 'face', verb: 'hop', y: -.8 } }) }),
  recipe({ name: 'redaction', family: 'Access', title: 'Redact', story: 'The black bars are drawn across the text.',
    parts: by('redaction', { 2: { verb: 'arrive', sx: -.6, origin: [7, 12.5] }, 3: { verb: 'arrive', sx: -.6, origin: [7, 17], delay: STEP } }) }),
  recipe({ name: 'rename', family: 'Actions', title: 'Rename', story: 'The pencil writes beside the cursor.',
    parts: [act('pencil', cut('rename', 0, 'M4 16.5 13.5 7a2.1 2.1 0 0 1 3 3L7 19.5H4v-3Z'), { verb: 'scribble', x: .8, y: .8, r: 3, origin: [4, 19.5] }),
      still('cursor', cut('rename', 0, 'M15 3.5h6M18 3.5v17M15 20.5h6', { fill: 'none' }))] }),
  recipe({ name: 'rerank', family: 'AI and data', title: 'Rerank', story: 'The arrow pushes up while the rows narrow in turn.',
    parts: [...rows('rerank', 0, [['M4 5h10', 4, 5], ['M4 12h7', 4, 12], ['M4 19h4', 4, 19]]),
      act('arrow', cut('rerank', 0, 'M18 20V4M15 7l3-3 3 3'), { verb: 'nudge', y: -2 })] }),
  recipe({ name: 'return-on-spend', family: 'AI and data', title: 'Return on spend', story: 'The coin turns over above the rising trend.',
    parts: [still('trend', geometry['return-on-spend'][0]), act('coin', nodes('return-on-spend', 1, 2), { verb: 'squeeze', sx: -.5, origin: [7, 6] })] }),
  whole('ribbon', 'Status', 'Award', 'The award pops.', { verb: 'pop', s: .08, origin: [12, 11] }),
  recipe({ name: 'server', family: 'AI and data', title: 'Server', story: 'The two units light in turn.',
    parts: [still('units', nodes('server', 0, 1)), act('light-1', cut('server', 2, 'M7 7h.01'), { verb: 'pop', s: .9, origin: [7, 7] }),
      act('light-2', cut('server', 2, 'M7 17h.01'), { verb: 'pop', s: .9, origin: [7, 17], delay: STEP }), still('labels', cut('server', 2, 'M12 7h5M12 17h5'))] }),
  recipe({ name: 'share', family: 'Actions', title: 'Share', story: 'The source pops, then the two it shares with.',
    parts: by('share', { 2: { verb: 'pop', s: .15, origin: [6.2, 12] }, 1: { verb: 'pop', s: .15, origin: [17.8, 5.8], delay: STEP }, 3: { verb: 'pop', s: .15, origin: [17.8, 18.2], delay: STEP } }) }),
  whole('shield', 'Access', 'Security', 'The shield pops.', { verb: 'pop', s: .06, origin: [12, 12] }),
  recipe({ name: 'shield-denied', family: 'Access', title: 'Denied', story: 'The cross in the shield shakes once.',
    parts: by('shield-denied', { 1: { id: 'cross', verb: 'shake', x: .8 } }) }),
  recipe({ name: 'shield-policy', family: 'Access', title: 'Policy', story: 'The lines of the policy are written on the shield.',
    parts: [still('shield', geometry['shield-policy'][0]), ...writing('shield-policy', 1, ['M8.5 8h7', 'M8.5 11.5h7', 'M8.5 15h4'])] }),
  whole('sparkle', 'AI and data', 'AI', 'The sparkle turns a quarter.', { verb: 'turn', t: 90, origin: [12, 12] }),
  whole('stop', 'Communication', 'Stop', 'The square is pressed and released.', { verb: 'press', s: .1, origin: [12, 12] }),
  whole('subtract', 'Actions', 'Remove', 'The minus narrows and returns.', { verb: 'squeeze', sx: -.4, origin: [12, 12] }),
  recipe({ name: 'sun', family: 'Status', title: 'Day', story: 'The rays turn one step around the sun.',
    parts: by('sun', { 1: { id: 'rays', verb: 'turn', t: 45, origin: [12, 12] } }) }),
  whole('table', 'AI and data', 'Table', 'The table is pressed and released.', { verb: 'press', s: .05, origin: [12, 12] }),
  recipe({ name: 'target', family: 'Status', title: 'Target', story: 'The rings pop from the centre outward.',
    parts: by('target', { 2: { verb: 'pop', s: .15, origin: [12, 12] }, 1: { verb: 'pop', s: .1, origin: [12, 12], delay: STEP } }) }),
  recipe({ name: 'target-arrow', family: 'Status', title: 'Goal', story: 'The arrow strikes the centre and springs back.',
    parts: by('target-arrow', { 2: { id: 'arrow', verb: 'nudge', x: -1.2, y: 1.2 } }) }),
  whole('text-bold', 'Actions', 'Bold', 'The letter is pressed and released.', { verb: 'press', s: .08, origin: [12, 12] }),
  whole('text-italic', 'Actions', 'Italic', 'The letter leans further and returns.', { verb: 'nudge', r: 8, origin: [12, 20] }),
  recipe({ name: 'text-bullet-list', family: 'Actions', title: 'List', story: 'Each line narrows in turn and returns.',
    parts: [still('bullets', cut('text-bullet-list', 0, 'M4 6h.01M4 12h.01M4 18h.01')), ...rows('text-bullet-list', 0, [['M8 6h12', 8, 6], ['M8 12h12', 8, 12], ['M8 18h12', 8, 18]])] }),
  recipe({ name: 'text-bullet-list-square', family: 'Actions', title: 'List', story: 'Each line narrows in turn and returns.',
    parts: [still('frame', geometry['text-bullet-list-square'][0]), still('bullets', cut('text-bullet-list-square', 1, 'M7 8h.01M7 12h.01M7 16h.01')),
      ...rows('text-bullet-list-square', 1, [['M11 8h6', 11, 8], ['M11 12h6', 11, 12], ['M11 16h6', 11, 16]])] }),
  recipe({ name: 'text-description', family: 'Actions', title: 'Text', story: 'Each line narrows in turn and returns.',
    parts: rows('text-description', 0, [['M4 5h16', 4, 5], ['M4 10h16', 4, 10], ['M4 15h16', 4, 15], ['M4 20h10', 4, 20]]) }),
  recipe({ name: 'thumbs-down', family: 'Status', title: 'Disapprove', story: 'The thumb tips down and settles.',
    parts: [act('hand', geometry['thumbs-down'], { verb: 'nudge', y: 1, r: 12, origin: [8, 4] })] }),
  recipe({ name: 'timer', family: 'Status', title: 'Timer', story: 'The button is pressed and the hand sweeps one turn.',
    parts: [still('face', geometry.timer[0]), act('crown', cut('timer', 1, 'M9 2.5h6M12 2.5V6'), { verb: 'nudge', y: .8 }), still('button', cut('timer', 1, 'M17.5 8l2-2')),
      act('hand', cut('timer', 1, 'M12 13.5v-4'), { verb: 'turn', t: 360, origin: [12, 13.5], delay: STEP })] }),
  whole('wrench', 'Actions', 'Tools', 'The wrench turns and returns.', { verb: 'swing', r: -14, origin: [12, 12] }),
  recipe({ name: 'zoom-in', family: 'Actions', title: 'Zoom in', story: 'The lens grows and settles.',
    parts: [act('lens', geometry['zoom-in'], { verb: 'pop', s: .08, origin: [10.5, 10.5] })] }),
  recipe({ name: 'zoom-out', family: 'Actions', title: 'Zoom out', story: 'The lens shrinks and settles.',
    parts: [act('lens', geometry['zoom-out'], { verb: 'press', s: .08, origin: [10.5, 10.5] })] }),
  // Product verbs (demand list ACT, wave 4d, 2026-10-29): the actions people repeat all day, where the result has to
  // be felt. Each tells its three beats with the drawing's own parts, in about 0.6 s, and rests on the drawing. A badge
  // ring never moves (it is a knock-out); only what is inside it does. Verbs whose drawing already moves (resolve and
  // approve through check-circle, retry through refresh, reject, mark as spam, take over, the Knowledge mark through
  // grounded-answer) keep their motion.
  recipe({ name: 'claim', family: 'Communication', title: 'Claim', story: 'The conversation is drawn toward its new owner, who answers with a nod.',
    parts: by('claim', { 0: { id: 'conversation', verb: 'nudge', x: 1.4, y: 1.4, dur: 450 }, 2: { id: 'head', verb: 'pop', s: .15, origin: [17.7, 16.6], delay: 240, dur: 450 },
      3: { id: 'shoulders', verb: 'pop', s: .12, origin: [17.7, 19.2], delay: 240, dur: 450 } }) }),
  recipe({ name: 'event-returned-to-queue', family: 'Communication', title: 'Return to queue', story: 'The conversation drops into the tray and the tray takes it.',
    parts: by('event-returned-to-queue', { 1: { id: 'path', verb: 'nudge', y: 1.6, dur: 450 }, 2: { id: 'arrow', verb: 'nudge', y: 1.6, dur: 450 },
      0: { id: 'tray', verb: 'press', s: .05, origin: [12, 17], delay: 200, dur: 450 } }) }),
  recipe({ name: 'ai-resumed', family: 'AI and data', title: 'Hand back to the assistant', story: 'Play pushes forward and the assistant settles back in.',
    parts: by('ai-resumed', { 2: { id: 'play', verb: 'nudge', x: .8, dur: 450 }, 0: { id: 'assistant', verb: 'press', s: .05, origin: [12, 12], delay: 160, dur: 450 } }) }),
  recipe({ name: 'ai-paused', family: 'AI and data', title: 'Pause the assistant', story: 'The pause bars press in and the assistant steps back.',
    parts: by('ai-paused', { 2: { id: 'pause', verb: 'press', s: .2, origin: [18, 18], dur: 450 }, 0: { id: 'assistant', verb: 'press', s: .04, origin: [12, 12], delay: 120, dur: 450 } }) }),
  recipe({ name: 'event-reopened', family: 'Communication', title: 'Reopen', story: 'The ring unwinds once and the conversation is open again.',
    parts: by('event-reopened', { 0: { id: 'ring', verb: 'turn', t: -360, origin: [12, 12], dur: 600 }, 1: { id: 'dot', verb: 'pop', s: .15, origin: [12, 12.3], delay: 360, dur: 450 } }) }),
  recipe({ name: 'call-ringing', family: 'Communication', title: 'Answer', story: 'The arcs ring out and the handset lifts.',
    parts: by('call-ringing', { 1: { id: 'arcs', verb: 'ripple', x: .8, y: -.8, dur: 600 }, 0: { id: 'handset', verb: 'nudge', y: -1, r: -8, origin: [12, 12], delay: 160, dur: 450 } }) }),
  recipe({ name: 'call-hold', family: 'Communication', title: 'Hold', story: 'The two bars rise and the call waits behind them.',
    parts: by('call-hold', { 2: { ...BARS([18, 20.3]), dur: 600 }, 0: { id: 'handset', verb: 'press', s: .05, origin: [12, 12], delay: 120, dur: 450 } }) }),
  recipe({ name: 'keypad', family: 'Communication', title: 'Dial', story: 'Keys dip in turn as a number is dialled.',
    parts: by('keypad', { 1: { id: 'key-2', verb: 'press', s: .15, origin: [12, 4.5], dur: 450 }, 5: { id: 'key-6', verb: 'press', s: .15, origin: [17.5, 9.5], delay: STEP, dur: 450 },
      7: { id: 'key-8', verb: 'press', s: .15, origin: [12, 14.5], delay: STEP * 2, dur: 450 } }) }),
  recipe({ name: 'stage-advance', family: 'Actions', title: 'Move to the next stage', story: 'The card steps toward the next stage and lands.',
    parts: by('stage-advance', { 0: { id: 'card', verb: 'nudge', x: 2.2, dur: 600 }, 1: { id: 'card-lines', verb: 'nudge', x: 2.2, dur: 600 },
      2: { id: 'shaft', verb: 'nudge', x: .8, delay: 160, dur: 450 }, 3: { id: 'head', verb: 'nudge', x: .8, delay: 160, dur: 450 } }) }),
  recipe({ name: 'ai-draft', family: 'AI and data', title: 'Draft with AI', story: 'The spark turns and the lines write themselves onto the page.',
    parts: by('ai-draft', { 5: { id: 'sparkle', verb: 'turn', t: 90, origin: [17.7, 17.7], dur: 450 }, 1: { id: 'line-1', verb: 'draw', delay: 120 },
      2: { id: 'line-2', verb: 'draw', delay: 200 }, 3: { id: 'line-3', verb: 'draw', delay: 280 } }) }),
  recipe({ name: 'published', family: 'Status', title: 'Publish', story: 'The globe is pressed and the check draws: it is out.',
    parts: by('published', { 0: { id: 'globe', verb: 'press', s: .05, origin: [10.8, 10.8], dur: 450 }, 2: { ...CHECK, delay: 160 } }) }),
  recipe({ name: 'unpublished', family: 'Status', title: 'Unpublish', story: 'The globe is pressed and the cross draws: it is taken down.',
    parts: by('unpublished', { 0: { id: 'globe', verb: 'press', s: .05, origin: [10.8, 10.8], dur: 450 }, 2: { id: 'cross', verb: 'draw', delay: 160 } }) }),
  recipe({ name: 'freshness-fresh', family: 'Status', title: 'Mark reviewed', story: 'The lines are read through and the check draws.',
    parts: by('freshness-fresh', { 1: { id: 'lines', verb: 'squeeze', sx: -.2, origin: [7.5, 11], dur: 450 }, 3: { ...CHECK, delay: 200 } }) }),
  recipe({ name: 'source-sync', family: 'AI and data', title: 'Apply an import', story: 'The sync mark turns once and the source takes the change.',
    parts: by('source-sync', { 2: { id: 'arc', verb: 'turn', t: 360, origin: [17.7, 17.7], dur: 600 }, 3: { id: 'head', verb: 'turn', t: 360, origin: [17.7, 17.7], dur: 600 },
      0: { id: 'source', verb: 'press', s: .04, origin: [10.8, 10.8], delay: 300, dur: 450 } }) }),
  recipe({ name: 'dead-letter', family: 'Communication', title: 'Send again', story: 'The letter lifts back into the queue and the cross turns away.',
    parts: by('dead-letter', { 0: { id: 'letter', verb: 'hop', y: -1.4, dur: 600 }, 2: { id: 'cross', verb: 'turn', t: 90, origin: [18, 18], delay: 160, dur: 600 } }) }),
  recipe({ name: 'audience-upload', family: 'Access', title: 'Add to an audience', story: 'The arrow lifts and the people rise with it into the audience.',
    parts: by('audience-upload', { 2: { id: 'arrow', verb: 'nudge', y: -1, dur: 450 }, 0: { id: 'people', verb: 'hop', y: -.8, delay: 120, dur: 600 } }) }),
  recipe({ name: 'consent-suppressed', family: 'Access', title: 'Hold back', story: 'The bar draws across and the shield closes on it.',
    parts: by('consent-suppressed', { 3: { id: 'bar', verb: 'draw', dur: 450 }, 0: { id: 'shield', verb: 'press', s: .04, origin: [10.8, 10.8], delay: 120, dur: 450 } }) }),
  recipe({ name: 'consent-erased', family: 'Access', title: 'Erase a person', story: 'Slow and final: the cross draws, and the shield that kept them settles.',
    parts: by('consent-erased', { 2: { id: 'cross', verb: 'draw', dur: 900 }, 0: { id: 'shield', verb: 'press', s: .05, origin: [10.8, 10.8], delay: 400, dur: 600 } }) }),
  recipe({ name: 'go-live', family: 'Status', title: 'Go live', story: 'The source pops and the waves go out from it: it is live.',
    parts: by('go-live', { 0: { id: 'source', verb: 'pop', s: .15, origin: [12, 12], dur: 450 }, 1: { id: 'near', verb: 'pop', s: .1, origin: [12, 12], delay: STEP, dur: 450 },
      2: { id: 'far', verb: 'pop', s: .08, origin: [12, 12], delay: STEP * 2, dur: 450 } }) }),
  recipe({ name: 'dashboard-support', family: 'Communication', title: 'Support', story: 'The front message hops and the one behind it answers.',
    parts: by('dashboard-support', { 1: { id: 'front', verb: 'hop', y: -1, dur: 600 }, 0: { id: 'back', verb: 'hop', y: -1, delay: STEP * 2, dur: 600 } }) }),
  recipe({ name: 'dashboard-marketing', family: 'AI and data', title: 'Marketing', story: 'The channels light in turn and the target answers.',
    parts: by('dashboard-marketing', { 1: { id: 'channel-1', verb: 'pop', s: .15, origin: [4.8, 5.6], dur: 450 }, 2: { id: 'channel-2', verb: 'pop', s: .15, origin: [4.8, 12], delay: STEP, dur: 450 },
      3: { id: 'channel-3', verb: 'pop', s: .15, origin: [4.8, 18.4], delay: STEP * 2, dur: 450 }, 4: { id: 'target', verb: 'pop', s: .1, origin: [16.6, 12], delay: STEP * 3, dur: 450 } }) }),
  recipe({ name: 'dashboard-automation', family: 'AI and data', title: 'Automation', story: 'The core turns a quarter and each connection answers in turn.',
    parts: by('dashboard-automation', { 5: { id: 'core', verb: 'turn', t: 90, origin: [12, 12], dur: 600 }, 1: { id: 'node-1', verb: 'pop', s: .15, origin: [12, 3.8], delay: STEP, dur: 450 },
      4: { id: 'node-2', verb: 'pop', s: .15, origin: [20.2, 12], delay: STEP * 2, dur: 450 }, 2: { id: 'node-3', verb: 'pop', s: .15, origin: [12, 20.2], delay: STEP * 3, dur: 450 },
      3: { id: 'node-4', verb: 'pop', s: .15, origin: [3.8, 12], delay: STEP * 4, dur: 450 } }) }),
  recipe({ name: 'dashboard-forms', family: 'Actions', title: 'Forms', story: 'The questions answer in turn: the dots pop and the lines slide along.',
    parts: by('dashboard-forms', { 1: { id: 'dots', verb: 'pop', s: .15, origin: [8.4, 12], dur: 450 }, 2: { id: 'lines', verb: 'nudge', x: 1, delay: STEP * 2, dur: 600 } }) }),
];
