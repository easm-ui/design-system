import { RAIL_ANGLES } from '../motion/core/brand';
import { EASM_BACKGROUND_PALETTES, type EasmBackgroundPalette, type EasmBackgroundVariant } from './palettes';

export interface ParticleFieldPointer {
  /** Normalized position on the containing surface. */
  x: number;
  y: number;
  /** Smoothed presence, from 0 to 1. Zero reproduces the authored unassisted loop. */
  strength: number;
}

export interface ParticleFieldOptions {
  variant?: EasmBackgroundVariant;
  /** 0 is the quiet atmospheric ground; 1 is the full authored mesh. Default 0.82. */
  intensity?: number;
  pointer?: ParticleFieldPointer;
}

const TAU = Math.PI * 2;
const COLUMNS = 74;
const ROWS = 42;
// The Junction's six rail directions become the lattice topology, without drawing a logo.
// Alternate rows are offset by half a cell: each interior point has six equally distant
// neighbours at 0/60/120/180/240/300 degrees before the surface is projected in perspective.
const LATTICE_ANGLE = (RAIL_ANGLES[1] - RAIL_ANGLES[0]) * Math.PI / 180;
const CELL = 11.2 / (COLUMNS - 1);
const ROW_STEP = CELL * Math.sin(LATTICE_ANGLE);
const ROW_OFFSET = CELL * Math.cos(LATTICE_ANGLE);
const clamp = (value: number, low = 0, high = 1): number => Math.min(high, Math.max(low, value));
const smooth = (value: number): number => { const v = clamp(value); return v * v * (3 - 2 * v); };
type Surface = HTMLCanvasElement | OffscreenCanvas;
type SurfaceContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
interface Cache {
  width: number;
  height: number;
  bitmapWidth: number;
  bitmapHeight: number;
  variant: EasmBackgroundVariant;
  atmosphere: Surface | null;
  grain: CanvasPattern | null;
}
const caches = new WeakMap<CanvasRenderingContext2D, Cache>();

function surfaceFor(ctx: CanvasRenderingContext2D, width: number, height: number): Surface | null {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const owner = ctx.canvas.ownerDocument;
  if (!owner) return null;
  const surface = owner.createElement('canvas');
  surface.width = width;
  surface.height = height;
  return surface;
}

function hexRgb(hex: string): string {
  return `${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}`;
}

function pool(ctx: SurfaceContext, x: number, y: number, rx: number, ry: number, colour: string, alpha: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx, ry);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  const rgb = hexRgb(colour);
  gradient.addColorStop(0, `rgba(${rgb}, ${alpha})`);
  gradient.addColorStop(0.44, `rgba(${rgb}, ${alpha * 0.42})`);
  gradient.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

function paintAtmosphere(ctx: SurfaceContext, width: number, height: number, palette: EasmBackgroundPalette): void {
  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, 0, width, height);
  pool(ctx, width * 0.9, height * 0.16, width * 0.58, height * 0.94, palette.far, palette.light ? 0.56 : 0.97);
  pool(ctx, width * 0.97, height * 0.31, width * 0.48, height * 0.8, palette.steel, palette.light ? 0.25 : 0.31);
  pool(ctx, width * 0.66, height * 1.01, width * 0.56, height * 0.78, palette.rust, palette.light ? 0.34 : 0.66);
  pool(ctx, width * 0.86, height * 0.96, width * 0.39, height * 0.48, palette.orange, palette.light ? 0.18 : 0.28);
  pool(ctx, width * 0.35, height * 0.95, width * 0.35, height * 0.55, palette.rust, palette.light ? 0.09 : 0.15);

  // Deliberately unlit upper-left: dashboard headings and controls keep a calm ground.
  const quiet = ctx.createLinearGradient(0, 0, width * 0.7, height * 0.45);
  quiet.addColorStop(0, palette.ground);
  quiet.addColorStop(0.42, `rgba(${hexRgb(palette.ground)}, ${palette.light ? 0.54 : 0.65})`);
  quiet.addColorStop(1, `rgba(${hexRgb(palette.ground)}, 0)`);
  ctx.fillStyle = quiet;
  ctx.fillRect(0, 0, width, height);
}

function grainFor(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const texture = surfaceFor(ctx, 144, 144);
  const textureCtx = texture?.getContext('2d') as SurfaceContext | null;
  if (!texture || !textureCtx) return null;
  const image = textureCtx.createImageData(144, 144);
  let seed = 2_617_803;
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = seed >>> 24;
    image.data[i] = value;
    image.data[i + 1] = value;
    image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  textureCtx.putImageData(image, 0, 0);
  return ctx.createPattern(texture, 'repeat');
}

function cacheFor(ctx: CanvasRenderingContext2D, width: number, height: number, variant: EasmBackgroundVariant): Cache {
  // Match the caller's backing resolution, including its DPR/pixel budget. A large CSS parent
  // must not silently allocate an uncapped 4K/8K atmosphere behind a smaller display canvas.
  const bitmapWidth = Math.max(1, Math.min(ctx.canvas.width, 2400));
  const bitmapHeight = Math.max(1, Math.min(ctx.canvas.height, 1600));
  let cache = caches.get(ctx);
  if (cache && cache.width === width && cache.height === height && cache.bitmapWidth === bitmapWidth && cache.bitmapHeight === bitmapHeight && cache.variant === variant) return cache;
  const atmosphere = surfaceFor(ctx, bitmapWidth, bitmapHeight);
  const atmosphereCtx = atmosphere?.getContext('2d') as SurfaceContext | null;
  if (atmosphereCtx) {
    atmosphereCtx.setTransform(bitmapWidth / width, 0, 0, bitmapHeight / height, 0, 0);
    paintAtmosphere(atmosphereCtx, width, height, EASM_BACKGROUND_PALETTES[variant]);
  }
  cache = { width, height, bitmapWidth, bitmapHeight, variant, atmosphere, grain: cache?.grain ?? grainFor(ctx) };
  caches.set(ctx, cache);
  return cache;
}

interface ProjectedPoint {
  x: number;
  y: number;
  perspective: number;
  height: number;
  slope: number;
}

export interface ParticleFieldPoint {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  /** An incoming system stream, 0–5, merging into the shared intelligence surface. */
  stream: number;
  warmth: number;
}

/** Separate system streams join a common surface, then leave in a coordinated flow.
 * Stream identity is spatial; no geometry disappears or is replaced at a loop boundary. */
function project(u: number, v: number, turn: number, width: number, height: number, pointer?: ParticleFieldPointer): ProjectedPoint {
  const stream = Math.min(5, Math.max(0, Math.floor((v + 2.25) / (ROW_STEP * 7))));
  const centre = -2.25 + (stream * 7 + 3) * ROW_STEP;
  const joined = smooth((u + 1.9) / 3.3);
  const routedV = v + (centre - v) * .64 * (1 - joined);
  const independence = (stream - 2.5) * .16 * (1 - joined);
  const travel = u * .96 + routedV * .34 - turn + independence;
  const swell = Math.sin(travel);
  const fold = Math.sin(u * .45 - routedV * .48 + turn);
  const lift = .62 * swell + .16 * fold + .05 * u;
  const slope = .5952 * Math.cos(travel) + .072 * Math.cos(u * .45 - routedV * .48 + turn) + .05;
  const depth = routedV * .972 - u * .235;
  const sideways = u * .972 + routedV * .235;
  const cameraY = lift * .921 + depth * .389;
  const cameraDepth = 6.7 + depth * .921 - lift * .389;
  const perspective = 5.35 / cameraDepth;
  const scale = Math.max(width * .126, height * .25);
  let x = width * .66 + sideways * scale * perspective;
  let y = height * .69 - cameraY * scale * perspective;
  const presence = pointer && Number.isFinite(pointer.strength) ? clamp(pointer.strength) : 0;
  if (presence && pointer) {
    const dx = clamp(pointer.x) * width - x, dy = clamp(pointer.y) * height - y;
    const radius = Math.max(100, Math.min(width, height) * .3);
    const influence = Math.exp(-(dx * dx + dy * dy) / (radius * radius) * 1.7) * presence;
    // The surface yields locally to a person's presence; its grid and films stay attached.
    x += dx * .12 * influence + (clamp(pointer.x) - .5) * 20 * presence;
    y += dy * .12 * influence + (clamp(pointer.y) - .5) * 10 * presence;
  }
  return { x, y, perspective, height: lift, slope };
}

function paintOptions(phase: number, options: ParticleFieldOptions): { variant: EasmBackgroundVariant; intensity: number; turn: number } {
  return {
    variant: options.variant && Object.prototype.hasOwnProperty.call(EASM_BACKGROUND_PALETTES, options.variant) ? options.variant : 'charcoal',
    intensity: Number.isFinite(options.intensity) ? clamp(options.intensity as number) : 0.82,
    turn: (Number.isFinite(phase) ? ((phase % 1) + 1) % 1 : 0) * TAU,
  };
}


function safePointer(pointer?: ParticleFieldPointer): ParticleFieldPointer | undefined {
  if (!pointer || !Number.isFinite(pointer.x) || !Number.isFinite(pointer.y) || !Number.isFinite(pointer.strength)) return undefined;
  return { x: clamp(pointer.x), y: clamp(pointer.y), strength: clamp(pointer.strength) };
}

function forEachPoint(width: number, height: number, turn: number, intensity: number, palette: EasmBackgroundPalette, visit: (point: ParticleFieldPoint) => void, pointer?: ParticleFieldPointer): void {
  for (let row = ROWS - 1; row >= 0; row--) {
    const v = -2.25 + row * ROW_STEP;
    const edgeV = smooth(row / 3.5) * smooth((ROWS - 1 - row) / 4.5);
    for (let column = 0; column < COLUMNS; column++) {
      const u = -5.6 + column * CELL + (row % 2) * ROW_OFFSET;
      const point = project(u, v, turn, width, height, pointer);
      if (point.x < -4 || point.x > width + 4 || point.y < -4 || point.y > height + 4) continue;
      const edgeU = smooth(column / 7) * smooth((COLUMNS - 1 - column) / 7);
      const quiet = smooth((point.x / width - 0.15) / 0.38) * smooth((point.y / height - 0.31) / 0.24);
      const lighting = clamp(0.68 - point.slope * 0.36 + point.height * 0.13, 0.16, 1);
      const depthFade = clamp(point.perspective * 0.71, 0.28, 0.96);
      // A continuous travelling emphasis enters on the separate lanes, crosses the shared
      // intelligence layer, then continues through the ordered output. It never flashes.
      const transmission = Math.pow(Math.max(0, Math.cos((u + 5.6) / 11.2 * TAU - turn)), 10);
      const presence = pointer ? clamp(pointer.strength) : 0;
      const dx = pointer ? point.x - pointer.x * width : 0;
      const dy = pointer ? point.y - pointer.y * height : 0;
      const attentionRadius = Math.max(100, Math.min(width, height) * .3);
      const attention = presence * Math.exp(-(dx * dx + dy * dy) / (attentionRadius * attentionRadius) * 1.7);
      const luminance = clamp(edgeU * edgeV * quiet * lighting * depthFade * intensity
        * (palette.light ? .54 : 1.18) * (.8 + transmission * .3 + attention * .42));
      // Thirty-two perceptual levels let the painter submit each luminance group in one path.
      const alpha = Math.round(luminance * 32) / 32;
      if (alpha <= 0) continue;
      const sizeScale = clamp(width / 1400, 0.7, 1.18);
      const radius = clamp((0.6 + point.perspective * 0.44) * sizeScale, 0.43, 1.46);
      const sharedLayer = Math.exp(-Math.pow((u - .15) / 1.1, 2));
      const warmth = Math.round(sharedLayer * (.5 + transmission * .5) * 8) / 8;
      visit({ x: point.x, y: point.y, radius: radius * (1 + attention * .14), alpha,
        stream: Math.min(5, Math.floor(row / 7)), warmth });
    }
  }
}

/** SSR-safe poster geometry, exactly matching the canvas painter's sample, fade and lighting. */
export function getParticleFieldPoints(width: number, height: number, phase: number, options: ParticleFieldOptions = {}): readonly ParticleFieldPoint[] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return [];
  const { variant, intensity, turn } = paintOptions(phase, options);
  const points: ParticleFieldPoint[] = [];
  forEachPoint(width, height, turn, intensity, EASM_BACKGROUND_PALETTES[variant], point => points.push(point), safePointer(options.pointer));
  return points;
}

function paintGel(ctx: CanvasRenderingContext2D, width: number, height: number, turn: number, palette: EasmBackgroundPalette, intensity: number, pointer?: ParticleFieldPointer): void {
  // A wide, translucent film follows the same surface as the particles. No separate floating objects.
  ctx.save();
  for (let band = 0; band < 2; band++) {
    const v = 0.4 + band * 1.2;
    const gradient = ctx.createLinearGradient(width * 0.44, height * 0.9, width, height * 0.34);
    gradient.addColorStop(0, `rgba(${palette.highlight}, 0)`);
    gradient.addColorStop(0.48, `rgba(${palette.highlight}, ${intensity * (palette.light ? 0.09 : 0.021)})`);
    gradient.addColorStop(0.84, `rgba(${hexRgb(palette.steel)}, ${intensity * (palette.light ? 0.07 : 0.045)})`);
    gradient.addColorStop(1, `rgba(${palette.highlight}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    for (let i = 0; i <= 90; i++) {
      const u = -5.6 + i / 90 * 11.2;
      const point = project(u, v, turn, width, height, pointer);
      if (!i) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
    }
    for (let i = 90; i >= 0; i--) {
      const u = -5.6 + i / 90 * 11.2;
      const point = project(u, v + 0.38, turn, width, height, pointer);
      ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Paint an EASM dashboard atmosphere at a deterministic phase in turns.
 * The caller owns canvas sizing, device pixel ratio, visibility and the animation clock.
 * Coordinates are CSS pixels; set the context transform to the chosen DPR before calling.
 * This function keeps no clock and schedules no work. phase 0 and 1 render identically.
 */
export function renderParticleField(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number, options: ParticleFieldOptions = {}): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  const { variant, intensity, turn } = paintOptions(phase, options);
  const palette = EASM_BACKGROUND_PALETTES[variant];
  const cache = cacheFor(ctx, width, height, variant);
  const pointer = safePointer(options.pointer);

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if (cache.atmosphere) ctx.drawImage(cache.atmosphere, 0, 0, width, height);
  else paintAtmosphere(ctx, width, height, palette);

  paintGel(ctx, width, height, turn, palette, intensity, pointer);
  if (pointer && pointer.strength > .001) {
    const presence = clamp(pointer.strength);
    pool(ctx, clamp(pointer.x) * width, clamp(pointer.y) * height,
      Math.max(110, width * .2), Math.max(110, height * .3), palette.steel, presence * (palette.light ? .07 : .075));
  }
  ctx.fillStyle = `rgb(${palette.particle})`;
  // Far rows first; every dot remains attached to its surface coordinate throughout the loop.
  const groups: ParticleFieldPoint[][] = Array.from({ length: 33 }, () => []);
  forEachPoint(width, height, turn, intensity, palette, point => groups[Math.round(point.alpha * 32)].push(point), pointer);
  for (let level = 1; level < groups.length; level++) {
    if (!groups[level].length) continue;
    ctx.globalAlpha = level / 32;
    ctx.beginPath();
    for (const point of groups[level]) {
      ctx.moveTo(point.x + point.radius, point.y);
      ctx.arc(point.x, point.y, point.radius, 0, TAU);
    }
    ctx.fill();
  }

  // Restrained amber belongs to the joining layer, not to a randomly lit point or logo.
  ctx.fillStyle = palette.light ? 'rgb(180, 71, 0)' : 'rgb(255, 145, 69)';
  const warmGroups: ParticleFieldPoint[][] = Array.from({ length: 9 }, () => []);
  for (const group of groups) for (const point of group) {
    const level = Math.round(point.warmth * point.alpha * 8);
    if (level > 0) warmGroups[Math.min(8, level)].push(point);
  }
  for (let level = 1; level < warmGroups.length; level++) {
    if (!warmGroups[level].length) continue;
    ctx.globalAlpha = level / 8 * .8;
    ctx.beginPath();
    for (const point of warmGroups[level]) {
      ctx.moveTo(point.x + point.radius, point.y);
      ctx.arc(point.x, point.y, point.radius, 0, TAU);
    }
    ctx.fill();
  }

  // Grain stays fixed while the material travels; its cached texture never flickers or reallocates per frame.
  if (cache.grain) {
    ctx.globalAlpha = palette.light ? 0.024 : 0.037;
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = cache.grain;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}
