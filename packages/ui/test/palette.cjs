/* The palette's promises, measured.
 * 1. The default series order (chartTones, CLR-12): every neighbour, and every pair among the first four, stays apart
 *    under normal vision and simulated deuteranopia and protanopia (Machado 2009, full severity), by CIE76 distance in
 *    Lab. Blue then violet, the old first two, were 4.3 apart for a deuteranope: one colour.
 * 2. The colour roles (roles.ts) point at the same hues as the tokens, so a chart series and a chip agree. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const tokens = JSON.parse(fs.readFileSync(path.join(root, 'tokens/easm.tokens.json'), 'utf8')).color;
const palette = fs.readFileSync(path.join(__dirname, '../src/palette.ts'), 'utf8');
const rolesSource = fs.readFileSync(path.join(__dirname, '../src/roles.ts'), 'utf8');
const problems = [];

const order = [...palette.match(/export const chartTones[^=]*=\s*\[([^\]]+)\]/)[1].matchAll(/'([a-z]+)'/g)].map(m => m[1]);
const linear = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const matrices = {
  normal: null,
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
};
const lab = (hex, matrix) => {
  let rgb = hex.slice(1).match(/../g).map(c => linear(parseInt(c, 16) / 255));
  if (matrix) rgb = matrix.map(row => row.reduce((sum, k, i) => sum + k * rgb[i], 0));
  const [r, g, b] = rgb.map(v => Math.min(1, Math.max(0, v)));
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
const distance = (a, b) => Math.min(...Object.values(matrices).map(m => Math.hypot(...lab(tokens[`chart-${a}`].$value, m).map((v, i) => v - lab(tokens[`chart-${b}`].$value, m)[i]))));
const NEIGHBOURS = 25, FIRST_FOUR = 20;
if (order.length !== 12) problems.push(`chartTones has ${order.length} tones; CLR-12 asks for twelve`);
for (let i = 1; i < order.length; i++) {
  const d = distance(order[i - 1], order[i]);
  if (d < NEIGHBOURS) problems.push(`chartTones: ${order[i - 1]} then ${order[i]} are ${d.toFixed(1)} apart for some reader; neighbours need ${NEIGHBOURS}`);
}
for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
  const d = distance(order[i], order[j]);
  if (d < FIRST_FOUR) problems.push(`chartTones: ${order[i]} and ${order[j]} (both in the first four) are ${d.toFixed(1)} apart; they need ${FIRST_FOUR}`);
}
if (order.includes('orange')) problems.push('chartTones must not include orange: it is the attention accent');

const block = rolesSource.match(/export const colourRoles = \{([\s\S]*?)\} as const/)[1];
let roles = 0;
for (const [, family, body] of block.matchAll(/(\w+): \{([^}]*)\}/g))
  for (const [, name, tone] of body.matchAll(/'?([\w-]+)'?: '(\w+)'/g)) {
    roles++;
    const token = tokens[`${family}-${name}`];
    if (!token) { problems.push(`roles.ts names ${family}-${name}, which has no token`); continue; }
    for (const part of ['', '-tint', '-ink'])
      if (tokens[`${family}-${name}${part}`]?.$value !== `{color.chart-${tone}${part}}`) problems.push(`token ${family}-${name}${part} is not chart-${tone}${part}, as roles.ts says`);
  }

if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`palette: ${order.length} series tones apart for colour-blind readers, ${roles} colour roles match their tokens`);
