// Small, dependency-free motion maths shared by every EASM app animation.

export const clamp = (x: number, a = 0, b = 1): number => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
export const frac = (x: number): number => x - Math.floor(x);
export const smooth = (u: number): number => { u = clamp(u); return u * u * (3 - 2 * u); };

/** CSS cubic-bezier as a function (bisection, so it is robust for overshooting curves too). */
export function bez(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const X = (t: number) => ((1 - 3 * x2 + 3 * x1) * t + (3 * x2 - 6 * x1)) * t * t + 3 * x1 * t;
  const Y = (t: number) => ((1 - 3 * y2 + 3 * y1) * t + (3 * y2 - 6 * y1)) * t * t + 3 * y1 * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 22; i++) { t = (lo + hi) / 2; if (X(t) < x) lo = t; else hi = t; }
    return Y(t);
  };
}

/** easm.co's eases; every one starts from rest, so nothing jumps to full speed. */
export const ease = {
  io: /* @__PURE__ */ bez(0.65, 0, 0.35, 1),
  soft: /* @__PURE__ */ bez(0.45, 0, 0.2, 1),
  snap: /* @__PURE__ */ bez(0.5, 0, 0.2, 1),
};

/** Smooth keyframes: cosine between keys, so the speed is zero at every key. */
export function keys(t: number, k: ReadonlyArray<readonly [number, number]>): number {
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i][0]) {
      const [a, va] = k[i - 1], [b, vb] = k[i];
      const u = (t - a) / (b - a);
      return va + (vb - va) * (1 - Math.cos(Math.PI * u)) / 2;
    }
  }
  return k[k.length - 1][1];
}

/** A smooth bump on a circle (phase x in turns), width w in turns; 1 at the centre, 0 beyond w. */
export function bump(x: number, w: number): number {
  const f = frac(x), d = Math.min(f, 1 - f) / w;
  return d >= 1 ? 0 : Math.cos((d * Math.PI) / 2) ** 2;
}

export function mixHex(a: string, b: string, u: number): string {
  const p = (h: string, i: number) => parseInt(h.substr(i, 2), 16);
  const c = [1, 3, 5].map(i => Math.round(lerp(p(a, i), p(b, i), clamp(u))));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

/** Exponential approach with separate attack and release times (seconds). */
export function follow(cur: number, target: number, dt: number, attack: number, release: number): number {
  const tau = target > cur ? attack : release;
  return cur + (target - cur) * (1 - Math.exp(-dt / Math.max(1e-4, tau)));
}

/** A critically damped spring toward `target` (exact for one step of dt): it never overshoots and its speed never
 *  jumps, so even a sudden change of level arrives as a smooth S. omega sets how quickly (rad/s; ~40 = 25 ms). */
export function spring(x: number, v: number, target: number, dt: number, omega: number): [number, number] {
  const d = x - target, k = v + omega * d, e = Math.exp(-omega * dt);
  return [target + (d + k * dt) * e, (v - omega * k * dt) * e];
}

export const hash = (n: number): number => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
