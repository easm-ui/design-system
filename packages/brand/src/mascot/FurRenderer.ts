import { FurDynamics } from './FurDynamics';
import type { FurVector } from './FurDynamics';
import {
  SEGMENTS, emoteFragment, emoteVertex, faceFragment, faceVertex, meshFragment, meshVertex,
  shadowFragment, shadowVertex, shellFragment, shellVertex, strandFragment, strandVertex,
} from './FurShaders';
import { EMOTE_INDEX } from './Emotes';
import type { EmoteSprite } from './Emotes';

/** Gravity in body radii per second², shared by the body and its coat. */
export const GRAVITY_RADII = 15.5;
/** @deprecated The stage-size gravity of the first prototype, in px/s². */
export const SCENE_GRAVITY = 1850;

export type EyeFrame = { yaw: number; pitch: number; lidUp: number; lidLow: number; slant: number };
export type MouthFrame = {
  jaw: number; wide: number; round: number; press: number; smileL: number; smileR: number; shift: number;
  wobble: number; tongue: number; teeth: number; zip: number; tongueWiggle: number;
};
/** Angles in radians; positive pitch looks up, positive roll turns anticlockwise. */
export type RenderFrame = {
  width: number; height: number; dpr: number;
  /** Body origin in canvas CSS pixels, and the skin radius in pixels. */
  x: number; y: number; radius: number;
  pivot: [number, number, number]; deform: Float32Array;
  yaw: number; pitch: number; roll: number;
  groundX: number; groundY: number; lift: number; shadow: number;
  eyes: [EyeFrame, EyeFrame]; pupil: number; wide: number; wet: number; shape: number; shapeMix: number;
  browIn: [number, number]; browOut: [number, number];
  mouth: MouthFrame; blush: number;
  /** Tear streak length 0..1, plus falling drops in body-local coordinates. */
  tearStreak: number;
  tears: { x: number; y: number; z: number; size: number }[];
  /** Crown tuft: −1 droops, +1 lifts. */
  tuftLift: number;
  emotes: EmoteSprite[];
  color: [number, number, number];
  time: number; dt: number; vx: number; vy: number;
  pet?: { point: FurVector; strength: number };
  reducedMotion: boolean;
};

type Program = { program: WebGLProgram; uniforms: Map<string, WebGLUniformLocation | null> };
const COAT_GUIDES = 240;
const TUFT_GUIDES = 26;
// The coat's share of a frame (ms): past it the coat waits for the next frame (FurDynamics.update).
const COAT_BUDGET_MS = 6;
const MAX_FINS = 9000;
const TUFT_STRANDS = 900;
const FUR_SCALE = 1;
/**
 * Eye centres on the face and the eyes' size, matching EYE_L/EYE_R/EYE_SIZE in
 * the shaders. Apart enough that two wide-open eyes never touch at widget size
 * (2026-10-23: at ±0.385 and 0.36 they met in most faces and overlapped when
 * she looked aside).
 */
const EYES: [number, number][] = [[-0.42, 0], [0.42, 0.01]];
const EYE_SIZE: [number, number] = [0.34, 0.35];
const SPHERE_U = 64, SPHERE_V = 40;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

function rotation(yaw: number, pitch: number, roll = 0) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch), cz = Math.cos(roll), sz = Math.sin(roll);
  // Column-major Rz * Rx * Ry.
  return new Float32Array([
    cz * cy - sz * sx * sy, sz * cy + cz * sx * sy, -cx * sy,
    -sz * cx, cz * cx, sx,
    cz * sy + sz * sx * cy, sz * sy - cz * sx * cy, cx * cy,
  ]);
}
const multiply = (m: Float32Array, v: FurVector): FurVector =>
  [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
const toLocal = (m: Float32Array, v: FurVector): FurVector =>
  [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
function angularRate(now: Float32Array, before: Float32Array, dt: number): FurVector {
  // vee(skew(Rdot * Rᵀ)): angular velocity in the fixed world frame.
  const entry = (row: number, column: number) => {
    let n = 0; for (let k = 0; k < 3; k++) n += (now[k * 3 + row] - before[k * 3 + row]) / dt * now[k * 3 + column]; return n;
  };
  return [(entry(2, 1) - entry(1, 2)) * 0.5, (entry(0, 2) - entry(2, 0)) * 0.5, (entry(1, 0) - entry(0, 1)) * 0.5];
}
function inverseTranspose(d: Float32Array) {
  const a = d[0], c = d[1], b = d[3], e = d[4], det = a * e - b * c || 1;
  return new Float32Array([e / det, -b / det, 0, -c / det, a / det, 0, 0, 0, 1 / (d[8] || 1)]);
}
/** Three nearest guide roots with smooth inverse-distance weights. */
function nearestGuides3(point: FurVector, roots: FurVector[]): { index: [number, number, number]; weight: [number, number, number] } {
  const best: { g: number; d: number }[] = [];
  for (let g = 0; g < roots.length; g++) {
    const n = roots[g], d = 1 - (point[0] * n[0] + point[1] * n[1] + point[2] * n[2]);
    if (best.length < 3) { best.push({ g, d }); best.sort((a, b) => a.d - b.d); }
    else if (d < best[2].d) { best[2] = { g, d }; best.sort((a, b) => a.d - b.d); }
  }
  const w = best.map(b => 1 / (b.d + 0.002) ** 2), total = w[0] + w[1] + w[2];
  return { index: [best[0].g, best[1].g, best[2].g], weight: [w[0] / total, w[1] / total, w[2] / total] };
}

/**
 * WebGL 2 drawing of the character: skin, eyes, shell fur, strand fins, the
 * crown tuft, painted face parts, tears, a contact shadow and comic symbols.
 * It owns the coat simulation, driven by the body motion in each frame.
 */
export class FurRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly coat = new FurDynamics({ guideCount: COAT_GUIDES, segments: SEGMENTS });
  private readonly tuft = new FurDynamics({ guideCount: TUFT_GUIDES, segments: SEGMENTS, layout: 'tuft', seed: 2711 });
  private readonly coatMotion = new Float32Array(COAT_GUIDES * (SEGMENTS + 1) * 4);
  /** The coat's sag when sitting still: shells and fins only draw motion beyond it. */
  private readonly coatSettled: Float32Array;
  private readonly tuftMotion = new Float32Array(TUFT_GUIDES * (SEGMENTS + 1) * 4);
  private readonly buffers: WebGLBuffer[] = [];
  private readonly vaos: WebGLVertexArrayObject[] = [];
  private readonly textures: WebGLTexture[] = [];
  private mesh!: Program; private shell!: Program; private strand!: Program; private face!: Program; private shadow!: Program; private emote!: Program;
  private sphere!: WebGLVertexArrayObject; private shellVao!: WebGLVertexArrayObject; private quad!: WebGLVertexArrayObject;
  private patch!: WebGLVertexArrayObject; private fins!: WebGLVertexArrayObject; private tuftVao!: WebGLVertexArrayObject;
  private coatRest!: WebGLTexture; private coatTexture!: WebGLTexture; private tuftRest!: WebGLTexture; private tuftTexture!: WebGLTexture;
  private sphereIndices = 0;
  private patchCount = 0;
  private software = false;
  /** A phone or tablet: a lighter coat (fewer shells and strands, half the coat's time budget). */
  private light = false;
  private acceleration: FurVector = [0, 0, 0];
  private previousVX = 0;
  private previousVY = 0;
  private previousRotation: Float32Array | null = null;
  private previousAngular: FurVector = [0, 0, 0];
  private lost = false;
  private destroyed = false;
  private lastFrame: RenderFrame | null = null;
  private quality = { shells: 18, density: 50, fins: 2600, tuft: TUFT_STRANDS };

  constructor(canvas: HTMLCanvasElement, options: { preserveDrawingBuffer?: boolean } = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: !!options.preserveDrawingBuffer });
    if (!gl) throw new Error('This mascot needs WebGL 2.');
    this.gl = gl;
    try {
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      const device = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
      this.software = /swiftshader|llvmpipe|software/i.test(device);
    } catch { /* Renderer names are optional. */ }
    canvas.addEventListener('webglcontextlost', this.contextLost);
    canvas.addEventListener('webglcontextrestored', this.contextRestored);
    // Let the coat settle under gravity once, and remember that pose.
    for (let i = 0; i < 180; i++) this.coat.update(1 / 60, { acceleration: [0, 0, 0], gravity: [0, -GRAVITY_RADII, 0] });
    this.coatSettled = new Float32Array(this.coatMotion.length);
    this.coat.guides.forEach((g, i) => {
      for (let node = 0; node <= SEGMENTS; node++) for (let axis = 0; axis < 3; axis++) {
        this.coatSettled[(i * (SEGMENTS + 1) + node) * 4 + axis] = g.positions[node * 3 + axis] - g.rest[node * 3 + axis];
      }
    });
    this.createResources();
  }

  private program(vertex: string, fragment: string): Program {
    const gl = this.gl;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!; gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(`Mascot shader: ${log}`); }
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
    const program = gl.createProgram()!; gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Mascot program: ${gl.getProgramInfoLog(program)}`);
    return { program, uniforms: new Map() };
  }
  private u(p: Program, name: string) {
    if (!p.uniforms.has(name)) p.uniforms.set(name, this.gl.getUniformLocation(p.program, name));
    return p.uniforms.get(name)!;
  }
  private vao() { const vao = this.gl.createVertexArray()!; this.vaos.push(vao); this.gl.bindVertexArray(vao); return vao; }
  private attribute(data: Float32Array, location: number, size: number, divisor = 0) {
    const gl = this.gl, buffer = gl.createBuffer()!; this.buffers.push(buffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(location, divisor);
  }
  private indices(data: Uint16Array) {
    const gl = this.gl, buffer = gl.createBuffer()!; this.buffers.push(buffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
  }
  private texture(data: Float32Array, rows: number) {
    const gl = this.gl, texture = gl.createTexture()!; this.textures.push(texture);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, SEGMENTS + 1, rows, 0, gl.RGBA, gl.FLOAT, data);
    return texture;
  }
  private restData(dynamics: FurDynamics) {
    const rest = new Float32Array(dynamics.guides.length * (SEGMENTS + 1) * 4);
    dynamics.guides.forEach((g, i) => {
      for (let node = 0; node <= SEGMENTS; node++) for (let axis = 0; axis < 3; axis++) rest[(i * (SEGMENTS + 1) + node) * 4 + axis] = g.rest[node * 3 + axis] - g.root[axis];
    });
    return rest;
  }

  private createResources() {
    const gl = this.gl;
    this.mesh = this.program(meshVertex, meshFragment);
    this.shell = this.program(shellVertex, shellFragment);
    this.strand = this.program(strandVertex, strandFragment);
    this.face = this.program(faceVertex, faceFragment);
    this.shadow = this.program(shadowVertex, shadowFragment);
    this.emote = this.program(emoteVertex, emoteFragment);

    // One indexed UV sphere for the skin, eyes, tears and every fur shell.
    const positions: number[] = [];
    for (let v = 0; v <= SPHERE_V; v++) for (let u = 0; u <= SPHERE_U; u++) {
      const theta = v / SPHERE_V * Math.PI, phi = u / SPHERE_U * Math.PI * 2;
      positions.push(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi));
    }
    const index: number[] = [];
    for (let v = 0; v < SPHERE_V; v++) for (let u = 0; u < SPHERE_U; u++) {
      const a = v * (SPHERE_U + 1) + u, b = a + SPHERE_U + 1;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
    this.sphereIndices = index.length;
    const sphereData = new Float32Array(positions), indexData = new Uint16Array(index);
    const coatRoots = this.coat.guides.map(g => g.root);
    const tuftRoots = this.tuft.guides.map(g => g.root);
    const shellGuides = new Float32Array(positions.length), shellWeights = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      const near = nearestGuides3([positions[i], positions[i + 1], positions[i + 2]], coatRoots);
      shellGuides.set(near.index, i); shellWeights.set(near.weight, i);
    }
    this.sphere = this.vao(); this.attribute(sphereData, 0, 3); this.indices(indexData);
    this.shellVao = this.vao(); this.attribute(sphereData, 0, 3); this.attribute(shellGuides, 1, 3); this.attribute(shellWeights, 2, 3); this.indices(indexData);
    this.quad = this.vao(); this.attribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0]), 0, 3);
    const patch: number[] = [];
    for (let y = 0; y < 20; y++) for (let x = 0; x < 24; x++) {
      const a = x / 12 - 1, b = y / 10 - 1, an = (x + 1) / 12 - 1, bn = (y + 1) / 10 - 1;
      patch.push(a, b, 0, an, b, 0, an, bn, 0, a, b, 0, an, bn, 0, a, bn, 0);
    }
    this.patch = this.vao(); this.attribute(new Float32Array(patch), 0, 3); this.patchCount = patch.length / 3;

    const corners: number[] = [];
    for (let s = 0; s < SEGMENTS; s++) { const a = s / SEGMENTS, b = (s + 1) / SEGMENTS; corners.push(a, -1, b, -1, b, 1, a, -1, b, 1, a, 1); }
    const cornerData = new Float32Array(corners);
    // Fins: the R2 low-discrepancy sequence (two independent irrationals,
    // from the plastic number), so any prefix covers the sphere evenly and
    // quality can draw fewer without bald patches.
    const finRoots = new Float32Array(MAX_FINS * 3), finParams = new Float32Array(MAX_FINS * 4), finGuides = new Float32Array(MAX_FINS * 3), finWeights = new Float32Array(MAX_FINS * 3);
    for (let i = 0; i < MAX_FINS; i++) {
      const y = 1 - 2 * ((i * 0.7548776662 + 0.31) % 1), rho = Math.sqrt(1 - y * y), angle = Math.PI * 2 * ((i * 0.5698402910 + 0.17) % 1);
      const root: FurVector = [Math.cos(angle) * rho, y, Math.sin(angle) * rho];
      const n = Math.sin(i * 127.123) * 43758.5453, random = n - Math.floor(n);
      finRoots.set(root, i * 3);
      finParams.set([0.6 + ((i * 0.4142135624) % 1) * 0.7, 0.004 + random * 0.0035, random * 40, (i * 0.7320508076 + random) % 1], i * 4);
      const near = nearestGuides3(root, coatRoots);
      finGuides.set(near.index, i * 3); finWeights.set(near.weight, i * 3);
    }
    this.fins = this.vao();
    this.attribute(cornerData, 0, 2); this.attribute(finRoots, 1, 3, 1); this.attribute(finParams, 2, 4, 1); this.attribute(finGuides, 3, 3, 1); this.attribute(finWeights, 4, 3, 1);
    const tuftStrandRoots = new Float32Array(TUFT_STRANDS * 3), tuftParams = new Float32Array(TUFT_STRANDS * 4), tuftGuides = new Float32Array(TUFT_STRANDS * 3);
    for (let i = 0; i < TUFT_STRANDS; i++) {
      // Each strand belongs to one lock (guide) and sits close to its root,
      // so the tuft reads as a few thick swept locks, not a fan of hairs.
      const lock = i % tuftRoots.length, g = tuftRoots[lock];
      const a = ((i * 0.7548776662) % 1) * Math.PI * 2, d = Math.sqrt((i * 0.5698402910) % 1) * 0.07;
      const ux = Math.cos(a) * d, uz = Math.sin(a) * d;
      const root: FurVector = [g[0] + ux, g[1], g[2] + uz];
      const length = Math.hypot(...root);
      const unit: FurVector = [root[0] / length, root[1] / length, root[2] / length];
      const n = Math.sin(i * 91.7) * 43758.5453, random = n - Math.floor(n);
      tuftStrandRoots.set(unit, i * 3);
      tuftParams.set([0.8 + random * 0.35, 0.009 + random * 0.008, i * 1.7, random], i * 4);
      tuftGuides.set([lock, lock, 0], i * 3);
    }
    this.tuftVao = this.vao();
    this.attribute(cornerData, 0, 2); this.attribute(tuftStrandRoots, 1, 3, 1); this.attribute(tuftParams, 2, 4, 1); this.attribute(tuftGuides, 3, 3, 1);

    this.coatRest = this.texture(this.restData(this.coat), COAT_GUIDES); this.coatTexture = this.texture(this.coatMotion, COAT_GUIDES);
    this.tuftRest = this.texture(this.restData(this.tuft), TUFT_GUIDES); this.tuftTexture = this.texture(this.tuftMotion, TUFT_GUIDES);
    gl.bindVertexArray(null); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0, 0, 0, 0);
  }

  /** A lighter coat on a touch device, where her full coat made the page stutter (2026-10-23). */
  setLight(on: boolean) { this.light = on; }

  /** Fur detail follows her size on screen: fewer shells and fins when small, and fewer again on a phone. */
  private chooseQuality(pixels: number) {
    if (this.software) { this.quality = { shells: 12, density: clamp(pixels / 2.4, 26, 90), fins: 1400, tuft: 420 }; return; }
    if (this.light) {
      this.quality = {
        shells: Math.round(clamp(8 + pixels / 10, 10, 14)),
        density: clamp(pixels / 2.2, 30, 120),
        fins: Math.round(clamp(pixels * 20, 1200, 1800)),
        tuft: Math.round(clamp(pixels * 4, 260, 360)),
      };
      return;
    }
    this.quality = {
      shells: Math.round(clamp(12 + pixels / 9, 16, 36)),
      density: clamp(pixels / 2, 34, 170),
      fins: Math.round(clamp(pixels * 32, 2400, MAX_FINS)),
      tuft: Math.round(clamp(pixels * 5, 420, TUFT_STRANDS)),
    };
  }

  private simulate(f: RenderFrame, matrix: Float32Array) {
    const dt = f.dt;
    if (dt <= 0) return;
    const ax = clamp((f.vx - this.previousVX) / dt / f.radius, -65, 65), ay = clamp(-(f.vy - this.previousVY) / dt / f.radius, -65, 65);
    const filtered = 1 - Math.exp(-24 * dt);
    this.acceleration[0] += (ax - this.acceleration[0]) * filtered; this.acceleration[1] += (ay - this.acceleration[1]) * filtered;
    const omega = angularRate(matrix, this.previousRotation ?? matrix, dt);
    const alpha = omega.map((v, i) => (v - this.previousAngular[i]) / dt) as FurVector;
    // Air drag: moving through the air combs the fur back (it trails on take-
    // off and stands up while falling).
    const drag = 1.1, windX = clamp(-f.vx / f.radius * drag, -40, 40), windY = clamp(f.vy / f.radius * drag, -40, 40);
    const forces = {
      acceleration: toLocal(matrix, this.acceleration), gravity: toLocal(matrix, [0, -GRAVITY_RADII, 0]), wind: toLocal(matrix, [windX, windY, 0]),
      angularVelocity: toLocal(matrix, omega), angularAcceleration: toLocal(matrix, alpha), reducedMotion: f.reducedMotion,
    };
    this.coat.update(dt, { ...forces, ...(f.pet && f.pet.strength > 0.1 ? { pet: f.pet } : {}) }, this.light ? COAT_BUDGET_MS / 2 : COAT_BUDGET_MS);
    this.tuft.update(dt, forces);
    this.previousVX = f.vx; this.previousVY = f.vy; this.previousRotation = matrix; this.previousAngular = omega;
  }

  private upload(dynamics: FurDynamics, data: Float32Array, texture: WebGLTexture, baseline?: Float32Array) {
    dynamics.guides.forEach((g, i) => {
      for (let node = 0; node <= SEGMENTS; node++) for (let axis = 0; axis < 3; axis++) {
        const k = (i * (SEGMENTS + 1) + node) * 4 + axis;
        data[k] = g.positions[node * 3 + axis] - g.rest[node * 3 + axis] - (baseline ? baseline[k] : 0);
      }
    });
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, SEGMENTS + 1, dynamics.guides.length, gl.RGBA, gl.FLOAT, data);
  }

  private common(p: Program, f: RenderFrame, matrix: Float32Array, deformN: Float32Array) {
    const gl = this.gl;
    gl.useProgram(p.program);
    gl.uniform2f(this.u(p, 'uSize'), f.width, f.height);
    gl.uniform3f(this.u(p, 'uOrigin'), f.x, f.y, f.radius);
    gl.uniformMatrix3fv(this.u(p, 'uRotation'), false, matrix);
    gl.uniformMatrix3fv(this.u(p, 'uDeform'), false, f.deform);
    gl.uniformMatrix3fv(this.u(p, 'uDeformN'), false, deformN);
    gl.uniform3fv(this.u(p, 'uPivot'), f.pivot);
    gl.uniform1f(this.u(p, 'uJaw'), f.mouth.jaw);
    gl.uniform1f(this.u(p, 'uMouthShift'), f.mouth.shift);
    gl.uniform3fv(this.u(p, 'uColor'), f.color);
    gl.uniform1f(this.u(p, 'uTime'), f.time);
  }

  render(f: RenderFrame) {
    if (this.destroyed || this.lost || !f.width || !f.height) return;
    this.lastFrame = f;
    const gl = this.gl;
    const matrix = rotation(f.yaw, -f.pitch, f.roll);
    const deformN = inverseTranspose(f.deform);
    this.chooseQuality(f.radius * f.dpr);
    this.simulate(f, matrix);
    this.upload(this.coat, this.coatMotion, this.coatTexture, this.coatSettled);
    this.upload(this.tuft, this.tuftMotion, this.tuftTexture);

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);

    if (f.shadow > 0.01) {
      gl.useProgram(this.shadow.program); gl.bindVertexArray(this.quad);
      const spread = clamp(1 - f.lift / (f.radius * 3), 0.55, 1) * Math.sqrt(Math.abs(f.deform[0]));
      gl.uniform2f(this.u(this.shadow, 'uSize'), f.width, f.height);
      gl.uniform4f(this.u(this.shadow, 'uShadow'), f.groundX, f.groundY - f.radius * 0.04, f.radius * 1.25 * spread, f.radius * 0.17 * spread);
      gl.uniform1f(this.u(this.shadow, 'uOpacity'), Math.max(0, 0.26 - f.lift / (f.radius * 10)) * f.shadow);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    const centre = this.projectLocal(f, matrix, [0, 0, 0]);
    this.drawEmotes(f, centre, true);

    gl.enable(gl.DEPTH_TEST);
    this.common(this.mesh, f, matrix, deformN);
    gl.bindVertexArray(this.sphere);
    const sphere = (kind: number, centreLocal: number[], scale: number[], eye?: Float32Array) => {
      gl.uniform1i(this.u(this.mesh, 'uKind'), kind);
      gl.uniform3fv(this.u(this.mesh, 'uCenter'), centreLocal); gl.uniform3fv(this.u(this.mesh, 'uScale'), scale);
      gl.uniformMatrix3fv(this.u(this.mesh, 'uEyeRotation'), false, eye ?? rotation(0, 0));
      gl.drawElements(gl.TRIANGLES, this.sphereIndices, gl.UNSIGNED_SHORT, 0);
    };
    sphere(0, [0, 0, 0], [1, 1, 1]);

    gl.depthMask(false);
    this.common(this.shell, f, matrix, deformN);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.coatRest);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.coatTexture);
    gl.uniform1f(this.u(this.shell, 'uFurScale'), FUR_SCALE);
    gl.uniform1i(this.u(this.shell, 'uMotion'), 1);
    gl.uniform1f(this.u(this.shell, 'uDensity'), this.quality.density);
    gl.uniform1f(this.u(this.shell, 'uClumpFreq'), 10);
    gl.uniform1f(this.u(this.shell, 'uBlush'), f.blush);
    gl.bindVertexArray(this.shellVao);
    for (let i = 0; i < this.quality.shells; i++) {
      gl.uniform1f(this.u(this.shell, 'uShell'), (i + 1) / this.quality.shells);
      gl.drawElements(gl.TRIANGLES, this.sphereIndices, gl.UNSIGNED_SHORT, 0);
    }

    this.common(this.strand, f, matrix, deformN);
    gl.uniform1f(this.u(this.strand, 'uDpr'), f.dpr);
    gl.uniform1f(this.u(this.strand, 'uFurScale'), FUR_SCALE);
    gl.uniform1f(this.u(this.strand, 'uTuft'), 0);
    gl.uniform1i(this.u(this.strand, 'uRest'), 0); gl.uniform1i(this.u(this.strand, 'uMotion'), 1);
    gl.bindVertexArray(this.fins);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, SEGMENTS * 6, this.quality.fins);

    // Eyes go over the fur (tested only against the skin) with a fur fringe
    // of their own, so the coat never films over them.
    gl.depthMask(true);
    this.common(this.mesh, f, matrix, deformN);
    gl.bindVertexArray(this.sphere);
    // Warm brown irises, as in the library, with a hint of the coat colour.
    gl.uniform3f(this.u(this.mesh, 'uIris'), 0.23 + f.color[0] * 0.05, 0.085 + f.color[1] * 0.05, 0.045 + f.color[2] * 0.05);
    gl.uniform4f(this.u(this.mesh, 'uIrisInfo'), f.pupil, f.wet, f.shape, f.shapeMix);
    const grow = 1 + f.wide * 0.07;
    // A head turned aside brings the eyes together on screen (by its cosine);
    // a cartoon face keeps them apart, so they move out on the face as it turns.
    const apart = 1 + 0.9 * (1 - Math.cos(clamp(f.yaw, -0.7, 0.7)));
    for (const [index, side] of [-1, 1].entries()) {
      const eye = f.eyes[index];
      const ex = clamp(EYES[index][0] * apart, -0.5, 0.5), ey = EYES[index][1];
      gl.uniform4f(this.u(this.mesh, 'uLids'), clamp(eye.lidUp, 0, 1), clamp(eye.lidLow, 0, 1), eye.slant, side);
      gl.uniform1f(this.u(this.mesh, 'uGazePitch'), eye.pitch);
      // Closed eyes flatten into the face, so a happy ∩ is not a bulging lid.
      const depth = 0.26 * (0.45 + 0.55 * clamp(eye.lidUp * 1.4, 0, 1));
      sphere(2, [ex, ey, Math.sqrt(1 - ex * ex - ey * ey) - 0.03], [EYE_SIZE[0] * grow, EYE_SIZE[1] * grow, depth], rotation(clamp(eye.yaw, -0.5, 0.5), -clamp(eye.pitch, -0.42, 0.42)));
    }

    gl.depthMask(false);

    // Painted face parts sit on top of the fur.
    gl.disable(gl.DEPTH_TEST);
    this.common(this.face, f, matrix, deformN);
    gl.bindVertexArray(this.patch);
    const m = f.mouth;
    gl.uniform4f(this.u(this.face, 'uMouthA'), m.jaw, m.wide, m.round, m.press);
    gl.uniform4f(this.u(this.face, 'uMouthB'), m.smileL, m.smileR, m.shift, m.wobble);
    gl.uniform4f(this.u(this.face, 'uMouthC'), m.tongue, m.teeth, m.zip, m.tongueWiggle);
    gl.uniform1f(this.u(this.face, 'uBlush'), f.blush);
    gl.uniform1f(this.u(this.face, 'uTears'), f.tearStreak);
    const patch = (kind: number, cx: number, cy: number, ex: number, ey: number, lift: number) => {
      gl.uniform1i(this.u(this.face, 'uKind'), kind);
      gl.uniform4f(this.u(this.face, 'uPatch'), cx, cy, ex, ey);
      gl.uniform1f(this.u(this.face, 'uLift'), lift);
      gl.drawArrays(gl.TRIANGLES, 0, this.patchCount);
    };
    if (f.blush > 0.02) patch(6, 0, -0.36, 0.9, 0.23, 0.06);
    patch(3, m.shift * 0.06, -0.56, 0.36, 0.34, 0.04);
    if (m.zip > 0.003) patch(5, m.shift * 0.06, -0.52, 0.52, 0.2, 0.05);
    if (f.tearStreak > 0.02) patch(8, 0, -0.52, 0.72, 0.3, 0.05);
    for (const [index, side] of [-1, 1].entries()) {
      gl.uniform4f(this.u(this.face, 'uBrow'), f.browIn[index], f.browOut[index], side, 0.47);
      patch(4, side * 0.43 * apart, 0.5, 0.42, 0.22, 0.07);
    }

    gl.enable(gl.DEPTH_TEST);
    this.common(this.strand, f, matrix, deformN);
    gl.uniform1f(this.u(this.strand, 'uDpr'), f.dpr);
    gl.uniform1f(this.u(this.strand, 'uFurScale'), 1);
    gl.uniform1f(this.u(this.strand, 'uTuft'), 1);
    gl.uniform1f(this.u(this.strand, 'uTuftLift'), f.tuftLift);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tuftRest);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tuftTexture);
    gl.bindVertexArray(this.tuftVao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, SEGMENTS * 6, this.quality.tuft);

    if (f.tears.length) {
      this.common(this.mesh, f, matrix, deformN);
      gl.bindVertexArray(this.sphere);
      for (const tear of f.tears) sphere(7, [tear.x, tear.y, tear.z], [tear.size * 0.8, tear.size, tear.size * 0.8]);
    }
    gl.disable(gl.DEPTH_TEST);
    this.drawEmotes(f, centre, false);
    gl.depthMask(true); gl.bindVertexArray(null);
  }

  private drawEmotes(f: RenderFrame, centre: { x: number; y: number }, behind: boolean) {
    const sprites = f.emotes.filter(e => e.behind === behind && e.alpha > 0.01);
    if (!sprites.length) return;
    const gl = this.gl;
    gl.useProgram(this.emote.program); gl.bindVertexArray(this.quad);
    gl.uniform2f(this.u(this.emote, 'uSize'), f.width, f.height);
    for (const s of sprites) {
      gl.uniform4f(this.u(this.emote, 'uSprite'), centre.x + s.x * f.radius, centre.y - s.y * f.radius, s.size * f.radius, s.rot);
      gl.uniform1i(this.u(this.emote, 'uShape'), EMOTE_INDEX[s.shape]);
      gl.uniform1f(this.u(this.emote, 'uAlpha'), s.alpha);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  /** Canvas pixel of a body-local point, through rotation and deformation. */
  private projectLocal(f: RenderFrame, matrix: Float32Array, p: FurVector) {
    const r = multiply(matrix, p);
    const d = f.deform, q: FurVector = [r[0] - f.pivot[0], r[1] - f.pivot[1], r[2] - f.pivot[2]];
    const wx = f.pivot[0] + d[0] * q[0] + d[3] * q[1], wy = f.pivot[1] + d[1] * q[0] + d[4] * q[1];
    return { x: f.x + wx * f.radius, y: f.y - wy * f.radius };
  }

  getSnapshot() {
    return {
      renderer: 'webgl2-shell-fur', strands: this.quality.fins + this.quality.tuft, shells: this.quality.shells,
      renderQuality: this.software ? 'software' : 'full', referenceStrands: MAX_FINS, contextLost: this.lost,
      headYaw: this.lastFrame?.yaw ?? 0, headPitch: this.lastFrame?.pitch ?? 0, ...this.coat.getSnapshot(),
    };
  }

  /** The mouth's screen ellipse (centre and half axes), for click-to-talk. */
  getMouthHitTarget() {
    const f = this.lastFrame;
    if (!f) return null;
    const matrix = rotation(f.yaw, -f.pitch, f.roll);
    const cx = f.mouth.shift * 0.06, cy = -0.45, cz = Math.sqrt(1 - cx * cx - cy * cy) + 0.04;
    const centre = this.projectLocal(f, matrix, [cx, cy, cz]);
    const horizontal = this.projectLocal(f, matrix, [cx + 0.24, cy, cz]);
    const vertical = this.projectLocal(f, matrix, [cx, cy + 0.16, cz + 0.07]);
    return { ...centre, axisX: { x: horizontal.x - centre.x, y: horizontal.y - centre.y }, axisY: { x: vertical.x - centre.x, y: vertical.y - centre.y } };
  }

  hitTestMouth(x: number, y: number) {
    const target = this.getMouthHitTarget();
    if (!target) return false;
    const { axisX: a, axisY: b } = target, dx = x - target.x, dy = y - target.y, det = a.x * b.y - a.y * b.x;
    if (Math.abs(det) < 0.001) return false;
    const u = (dx * b.y - dy * b.x) / det, v = (a.x * dy - a.y * dx) / det;
    return u * u + v * v <= 1;
  }

  /** Development readback: redraws the last frame and reads it in the same task. */
  getPixelSummary() {
    if (this.lastFrame) this.render({ ...this.lastFrame, dt: 0 });
    const gl = this.gl, pixels = new Uint8Array(this.canvas.width * this.canvas.height * 4);
    gl.readPixels(0, 0, this.canvas.width, this.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let opaquePixels = 0, whitePixels = 0, hash = 2166136261;
    const colours = new Set<number>();
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] > 100) { opaquePixels++; colours.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]); if (pixels[i] > 180 && pixels[i + 1] > 180 && pixels[i + 2] > 180) whitePixels++; }
      hash = Math.imul(hash ^ pixels[i], 16777619); hash = Math.imul(hash ^ pixels[i + 3], 16777619);
    }
    return { opaquePixels, whitePixels, distinctColors: colours.size, hash: hash >>> 0 };
  }

  private contextLost = (event: Event) => { event.preventDefault(); this.lost = true; };
  private contextRestored = () => {
    if (this.destroyed) return;
    this.buffers.length = 0; this.vaos.length = 0; this.textures.length = 0;
    this.createResources(); this.lost = false;
    if (this.lastFrame) this.render({ ...this.lastFrame, dt: 0 });
  };

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    const gl = this.gl;
    gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.buffers.forEach(b => gl.deleteBuffer(b)); this.vaos.forEach(v => gl.deleteVertexArray(v)); this.textures.forEach(t => gl.deleteTexture(t));
    [this.mesh, this.shell, this.strand, this.face, this.shadow, this.emote].forEach(p => gl.deleteProgram(p.program));
    this.canvas.removeEventListener('webglcontextlost', this.contextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.contextRestored);
  }
}
