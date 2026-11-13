// Export the EASM logo v6 artwork files from the same builder the React components use (dist/logo/svg.js).
//   pnpm --filter @easm-ui/brand build && pnpm --filter @easm-ui/brand artwork
//   pnpm --filter @easm-ui/brand artwork:check     (fails if an SVG on disk differs from what the builder makes)
// Writes svg/logo/ (every lockup and version), svg/app-icon/ (tiles), and png/ (app icons, favicons, and
// 2x lockups for documents). Never edit these files by hand; change the builder and run this again.
// EASM_BRAND_DIST=<dir> reads the builder from another compiled copy of src (for checking before a build).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dist = process.env.EASM_BRAND_DIST ? path.resolve(process.env.EASM_BRAND_DIST) : path.join(root, 'dist');
const check = process.argv.includes('--check');
const load = rel => import(pathToFileURL(path.join(dist, rel)).href);
const { logoArt, markArt, tileArt, svgFile } = await load('logo/svg.js');
const { PRODUCT_NAMES } = await load('logo/artwork.js');
const { PRODUCTS: FAMILY } = await load('brand.js');

const THEMES = ['light', 'dark', 'ink', 'white'];
// The product family comes from PRODUCTS (brand.ts), platform first: one list for the data, the artwork and the docs.
const PRODUCTS = [...FAMILY].sort((a, b) => Number(b.platform) - Number(a.platform)).map(p => p.product);
const PLATFORM = FAMILY.filter(p => p.platform).map(p => p.product);
const missing = PRODUCTS.filter(p => !PRODUCT_NAMES[p]);
if (missing.length) throw new Error(`artwork: no outlined name for ${missing.join(', ')} (add it to src/logo/artwork.ts)`);
const productLockups = PRODUCTS.filter(p => !PLATFORM.includes(p));
const slug = p => (p ? `easm-${p.toLowerCase()}` : 'easm');

// ── SVG ──
const svgs = new Map();
const svg = (rel, text) => { svgs.set(rel, text); return text; };
for (const theme of THEMES) {
  for (const product of [undefined, ...PRODUCTS]) svg(`svg/logo/${slug(product)}-${theme}.svg`, svgFile(logoArt({ product, theme })));
  svg(`svg/logo/easm-wordmark-${theme}.svg`, svgFile(logoArt({ variant: 'wordmark', theme })));
  svg(`svg/logo/easm-stacked-${theme}.svg`, svgFile(logoArt({ variant: 'stacked', theme })));
  svg(`svg/logo/easm-descriptor-${theme}.svg`, svgFile(logoArt({ variant: 'descriptor', theme })));
  svg(`svg/logo/easm-descriptor-under-${theme}.svg`, svgFile(logoArt({ variant: 'descriptor-under', theme })));
  svg(`svg/logo/easm-mark-${theme}.svg`, svgFile(markArt({ theme })));
}
for (const product of productLockups) for (const theme of ['light', 'dark']) svg(`svg/logo/${slug(product)}-mark-${theme}.svg`, svgFile(markArt({ theme, product })));
for (const product of [undefined, ...productLockups]) svg(`svg/app-icon/${slug(product)}.svg`, svgFile(tileArt({ product })));
const favicon = svg('png/favicon/favicon.svg', svgFile(tileArt({})));

if (check) {
  const stale = [];
  for (const [rel, text] of svgs) {
    const f = path.join(root, rel);
    if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== text) stale.push(rel);
  }
  for (const dir of ['svg/logo', 'svg/app-icon']) {
    for (const name of fs.readdirSync(path.join(root, dir))) if (!svgs.has(`${dir}/${name}`)) stale.push(`${dir}/${name} (not made by the builder)`);
  }
  if (stale.length) { console.error(`artwork: ${stale.length} file(s) differ from the builder; run pnpm --filter @easm-ui/brand artwork\n  ${stale.join('\n  ')}`); process.exit(1); }
  console.log(`artwork: ${svgs.size} SVG files match the builder`);
  process.exit(0);
}

const sharp = createRequire(path.join(root, '../icons/package.json'))('sharp');
const files = [];
const out = (rel, data) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); files.push(rel); return rel; };
for (const dir of ['svg/logo', 'svg/app-icon', 'png']) fs.rmSync(path.join(root, dir), { recursive: true, force: true });
for (const [rel, text] of svgs) out(rel, text);

// Raster copies for places that cannot take SVG, compressed losslessly at the highest level.
const png = async (svgText, size, rel, height) => {
  // Render at twice the target from the viewBox height (SVG units are px at 72 dpi), then downsample.
  const units = Number(/viewBox="[^ ]+ [^ ]+ [^ ]+ ([\d.]+)"/.exec(svgText)[1]);
  const density = Math.max(1, (72 * 2 * (height || size)) / units);
  const data = await sharp(Buffer.from(svgText), { density }).resize(height ? { height } : { width: size, height: size })
    .png({ compressionLevel: 9 }).toBuffer();
  out(rel, data);
  return data;
};
for (const product of [undefined, ...productLockups]) {
  const tile = svgFile(tileArt({ product }));
  for (const size of [512, 192, 180]) await png(tile, size, `png/app-icon/${slug(product)}-${size}.png`);
}
const icoParts = [];
for (const size of [16, 32, 48]) icoParts.push([size, await png(favicon, size, `png/favicon/favicon-${size}.png`)]);
// favicon.ico: an ICO directory holding the three PNGs.
const header = Buffer.alloc(6 + 16 * icoParts.length);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(icoParts.length, 4);
let offset = header.length;
icoParts.forEach(([size, data], i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(size === 256 ? 0 : size, e); header.writeUInt8(size === 256 ? 0 : size, e + 1);
  header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6); header.writeUInt32LE(data.length, e + 8); header.writeUInt32LE(offset, e + 12);
  offset += data.length;
});
out('png/favicon/favicon.ico', Buffer.concat([header, ...icoParts.map(([, d]) => d)]));
for (const theme of ['light', 'dark']) for (const product of [undefined, 'One']) await png(svgFile(logoArt({ product, theme })), 0, `png/logo/${slug(product)}-${theme}@2x.png`, 96);

console.log(`artwork: ${files.length} files in svg/logo, svg/app-icon and png`);
