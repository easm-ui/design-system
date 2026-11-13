/**
 * GLSL for the character. Coordinates are body-local radius units with +y up
 * and +z toward the visitor. Every part goes through the same chain:
 * local → head rotation → soft-body deformation about a pivot → screen.
 *
 * The coat is drawn the way real-time fur usually is: concentric shells
 * (Lengyel et al., "Real-Time Fur over Arbitrary Surfaces", 2001) give the
 * dense, soft body of fur seen face-on, and strand ribbons ("fins") give the
 * wispy silhouette and the crown tuft. Both bend with the same simulated
 * guide hairs, so shells and strands move as one coat.
 */
export const SEGMENTS = 5;

const COMMON = `
uniform vec2 uSize;
uniform vec3 uOrigin;
uniform mat3 uRotation;
uniform mat3 uDeform;
uniform mat3 uDeformN;
uniform vec3 uPivot;
uniform float uJaw;
uniform float uMouthShift;
vec3 jaw(vec3 p) {
  float face = smoothstep(.5, .85, p.z);
  float influence = exp(-pow(p.x / .38, 2.) - pow((p.y + .42) / .26, 2.)) * face;
  p.y -= uJaw * .085 * influence * (1. - smoothstep(-.44, -.12, p.y));
  return p;
}
vec3 toWorld(vec3 p) { return uPivot + uDeform * (uRotation * p - uPivot); }
vec3 toWorldNormal(vec3 n) { return normalize(uDeformN * (uRotation * n)); }
vec4 project(vec3 w) {
  vec2 pixel = uOrigin.xy + vec2(w.x, -w.y) * uOrigin.z;
  return vec4(pixel.x / uSize.x * 2. - 1., 1. - pixel.y / uSize.y * 2., -w.z * .1, 1.);
}
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}
float hash13(vec3 p3) {
  p3 = fract(p3 * .1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
/* Where the coat is long. The library's identity: long shaggy fur around
   the body and a beard below, short smooth pile on the face disk where the
   eyes and mouth sit, soft clearings right at the eyes and the mouth. */
const vec2 EYE_L = vec2(-.42, 0.);
const vec2 EYE_R = vec2(.42, .01);
const vec2 EYE_SIZE = vec2(.34, .35);
const float MOUTH_Y = -.45;
float faceDisk(vec3 r) {
  float front = smoothstep(.5, .78, r.z);
  return front * (1. - smoothstep(.72, 1.12, length((r.xy - vec2(0., -.1)) / vec2(.92, .66))));
}
float furLength(vec3 r) {
  float face = faceDisk(r);
  float len = mix(1.7, .3, face);
  len *= 1. + .18 * smoothstep(.5, .95, r.y) + .14 * smoothstep(.3, .95, -r.y) + .16 * smoothstep(.55, .95, abs(r.x));
  float front = smoothstep(.45, .8, r.z);
  float dl = length((r.xy - EYE_L) / EYE_SIZE), dr = length((r.xy - EYE_R) / EYE_SIZE);
  len *= mix(1., mix(.4, 1., smoothstep(.95, 1.3, min(dl, dr))), front);
  vec2 mc = vec2(uMouthShift * .06, MOUTH_Y - uJaw * .05);
  float dm = length((r.xy - mc) / vec2(.2 + .06 * uJaw, .08 + .16 * uJaw));
  len *= mix(1., mix(.35, 1., smoothstep(.9, 1.5, dm)), front);
  return len;
}
`;

/* Rest + motion of the nearest two guides (the tuft). Needs GROOM's uMotion. */
const GUIDE_CURVE = `
uniform highp sampler2D uRest;
vec3 guideNode(int n, vec3 g) {
  vec3 a = texelFetch(uRest, ivec2(n, int(g.x)), 0).xyz + texelFetch(uMotion, ivec2(n, int(g.x)), 0).xyz;
  vec3 b = texelFetch(uRest, ivec2(n, int(g.y)), 0).xyz + texelFetch(uMotion, ivec2(n, int(g.y)), 0).xyz;
  return mix(a, b, g.z);
}
vec3 guideCurve(float h, vec3 g) {
  float f = clamp(h, 0., 1.) * ${SEGMENTS}.;
  int n0 = int(floor(f)); int n1 = min(n0 + 1, ${SEGMENTS});
  return mix(guideNode(n0, g), guideNode(n1, g), f - float(n0));
}
`;

/* The coat's groom is a smooth field, so neighbouring strands never part
   into flaps: fur leaves the skin, then lies down the body (straight down
   at the poles, where "down the surface" vanishes), with a slow swirl that
   makes locks. On the face disk the short pile radiates from the centre.
   The simulated guides add only motion, blended from the three nearest. */
const GROOM = `
vec3 groomDir(vec3 n, float h) {
  vec3 down = vec3(0., -1., 0.) + n * n.y;
  vec3 swirl = vec3(noise3(n * 1.8 + 1.7), noise3(n * 1.8 + 7.1), noise3(n * 1.8 + 3.3)) - .5;
  swirl -= n * dot(swirl, n);
  vec3 outward = vec3(n.xy - vec2(0., -.1), 0.);
  outward -= n * dot(outward, n);
  // On top, the coat is combed the way the crown tuft sweeps (up, then over
  // to her right), so the crown never stands in bare spikes.
  vec3 part = vec3(.62, .05, -.3) - n * dot(vec3(.62, .05, -.3), n);
  vec3 body = down * (.35 + .8 * h) + part * smoothstep(.25, .9, n.y) * (.5 + .7 * h) + swirl * (.25 + .25 * h);
  vec3 lay = mix(body, outward * (.6 + .7 * h), faceDisk(n));
  return normalize(n * (1. - .5 * h) + lay + vec3(1e-5));
}
vec3 groomOffset(vec3 n, float h) { return groomDir(n, h * .5) * h; }
uniform highp sampler2D uMotion;
vec3 motionNode(int n, vec3 g, vec3 w) {
  return texelFetch(uMotion, ivec2(n, int(g.x)), 0).xyz * w.x + texelFetch(uMotion, ivec2(n, int(g.y)), 0).xyz * w.y + texelFetch(uMotion, ivec2(n, int(g.z)), 0).xyz * w.z;
}
vec3 guideMotion(float h, vec3 g, vec3 w) {
  float f = clamp(h, 0., 1.) * ${SEGMENTS}.;
  int n0 = int(floor(f)); int n1 = min(n0 + 1, ${SEGMENTS});
  return mix(motionNode(n0, g, w), motionNode(n1, g, w), f - float(n0));
}
`;

const FUR_LIGHT = `
vec3 furShade(vec3 base, vec3 T, vec3 N, float h, float variation) {
  vec3 L = normalize(vec3(-.45, .78, 1.05));
  float TL = dot(T, L), TV = T.z;
  float sinTL = sqrt(max(0., 1. - TL * TL)), sinTV = sqrt(max(0., 1. - TV * TV));
  float lambert = max(dot(N, L), 0.);
  float diffuse = mix(lambert, sinTL, .45) * .5 + .58;
  float ao = mix(.5, 1., pow(h, .6));
  float spec = pow(max(0., sinTL * sinTV - TL * TV), 28.) * .2;
  float rim = pow(1. - max(N.z, 0.), 2.2) * .32;
  float top = smoothstep(-.2, .9, N.y) * .08;
  vec3 c = base * (.88 + .24 * variation);
  // Tips catch the light: a touch brighter and warmer than the roots.
  c = mix(c, c * 1.22 + vec3(.05, .015, 0.), h * h);
  return c * (diffuse + top) * ao + rim * mix(base, vec3(1., .7, .6), .3) * h + vec3(1., .9, .86) * spec * h;
}
`;

export const shellVertex = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aGuides;
layout(location=2) in vec3 aWeights;
${COMMON}
${GROOM}
uniform float uShell;
uniform float uFurScale;
out vec3 vRoot;
out float vH;
out vec3 vT;
out vec3 vN;
vec3 shellPoint(vec3 root, float h, float len) {
  return jaw(root) + groomOffset(root, h) * len + guideMotion(h, aGuides, aWeights) * len * 5.5;
}
void main() {
  vec3 root = normalize(aPosition);
  float len = furLength(root) * uFurScale * .2 * (.85 + .3 * noise3(root * 5.));
  vec3 p = shellPoint(root, uShell, len);
  float q = length(p); if (q < 1.004) p *= 1.004 / q;
  vec3 t = shellPoint(root, min(1., uShell + .12), len) - shellPoint(root, max(0., uShell - .12), len);
  vRoot = root; vH = uShell;
  vT = normalize(uDeform * (uRotation * t) + vec3(1e-5));
  vN = toWorldNormal(root);
  gl_Position = project(toWorld(p));
}`;

export const shellFragment = `#version 300 es
precision highp float;
precision highp int;
${COMMON}
${FUR_LIGHT}
uniform vec3 uColor;
uniform float uDensity;
uniform float uClumpFreq;
uniform float uBlush;
in vec3 vRoot;
in float vH;
in vec3 vT;
in vec3 vN;
out vec4 outColor;
void main() {
  // Shells wrap a little past the silhouette so the hanging coat stays one mass.
  if (vN.z < -.32) discard;
  vec3 n = normalize(vRoot);
  // Nearest clump centre among the 8 surrounding cells.
  vec3 cp = n * uClumpFreq, base = floor(cp - .5), best = cp;
  float bestD = 1e9;
  for (int i = 0; i < 8; i++) {
    vec3 c = base + vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1));
    vec3 centre = c + .5 + (hash33(c) - .5) * .8;
    float d = dot(cp - centre, cp - centre);
    if (d < bestD) { bestD = d; best = centre; }
  }
  // Strands lean into their clump toward the tips: soft locks, not bristles.
  vec3 clump = best / uClumpFreq;
  vec3 q = (n + (clump - n) * .72 * vH * vH) * uDensity;
  vec3 cell = floor(q), rnd = hash33(cell);
  vec3 off = fract(q) - .5 - (rnd - .5) * .5;
  off -= n * dot(off, n);
  float d = length(off);
  float along = vH / (.5 + .5 * rnd.z);
  float radius = .46 * pow(max(0., 1. - along), .55);
  float aa = max(fwidth(d), .03);
  float coverage = (1. - smoothstep(radius - aa, radius + aa, d)) * step(along, 1.);
  // Dense undercoat; on the face disk the short pile reads as smooth velvet.
  float face = faceDisk(n);
  coverage = max(coverage, 1. - smoothstep(mix(.05, .55, face), mix(.22, .92, face), vH));
  if (coverage < .02) discard;
  vec3 colour = furShade(uColor * (.93 + .14 * hash13(best)), normalize(vT), normalize(vN), vH, rnd.x);
  float cheek = 0.;
  for (int s = -1; s <= 1; s += 2) cheek = max(cheek, 1. - smoothstep(0., 1., length((n.xy - vec2(float(s) * .56, -.36)) / vec2(.32, .22))));
  colour = mix(colour, vec3(1., .5, .62), cheek * uBlush * .7 * smoothstep(.35, .65, n.z));
  outColor = vec4(colour, coverage);
}`;

export const strandVertex = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 aRoot;
layout(location=2) in vec4 aParams;
layout(location=3) in vec3 aGuides;
layout(location=4) in vec3 aWeights;
${COMMON}
${GROOM}
${GUIDE_CURVE}
uniform float uDpr;
uniform float uFurScale;
uniform float uTuft;
uniform float uTuftLift;
out float vSide;
out float vCoverage;
out float vAlong;
out vec3 vN;
out vec3 vT;
out float vVariation;
vec3 strand(float t, float len) {
  vec3 p;
  if (uTuft > .5) {
    p = jaw(aRoot) + guideCurve(t, aGuides) * len;
    // The crown tuft lifts with a bright idea and droops when tired or ignored.
    p += vec3(.1 * uTuftLift, uTuftLift, .05 * uTuftLift) * t * t * len * .7;
  } else {
    vec3 seed = aRoot + (vec3(fract(aParams.z * 1.3), fract(aParams.z * 2.1), fract(aParams.z * 3.7)) - .5) * .42;
    p = jaw(aRoot) + groomOffset(normalize(seed), t) * len + guideMotion(t, aGuides, aWeights) * len * 5.5;
  }
  vec3 across = normalize(cross(aRoot, vec3(.12, 1., .05)));
  p += across * sin(t * 5.8 + aParams.z) * sin(t * 3.14159) * .1 * len;
  float q = length(p); if (q < 1.004 && t > .001) p *= 1.004 / q;
  return p;
}
void main() {
  float t = aCorner.x;
  float flyaway = aParams.w > .93 ? 1.28 : 1.;
  float len = (uTuft > .5 ? 1. : furLength(aRoot) * flyaway * .2) * aParams.x * uFurScale;
  vec3 p = strand(t, len);
  vec3 next = strand(clamp(t + (t > .95 ? -.2 : .2), 0., 1.), len);
  vec3 tangent = normalize((t > .95 ? p - next : next - p) + vec3(1e-5));
  vec3 worldT = normalize(uDeform * (uRotation * tangent) + vec3(1e-5));
  vec3 side = normalize(cross(worldT, vec3(0, 0, 1)) + vec3(1e-5));
  float physical = aParams.y * pow(max(.001, 1. - t), uTuft > .5 ? .7 : .9) + .0003;
  float antialias = .6 / (uOrigin.z * uDpr);
  float ribbon = max(physical, antialias);
  vec3 world = toWorld(p) + side * ribbon * aCorner.y;
  gl_Position = project(world);
  vN = toWorldNormal(aRoot);
  vT = worldT; vSide = aCorner.y; vAlong = t; vVariation = aParams.w;
  // Fins only where the coat turns away: face-on, the shells already show it.
  float silhouette = uTuft > .5 ? 1. : (1. - smoothstep(.25, .68, vN.z) * (1. - .55 * (1. - faceDisk(aRoot)))) * smoothstep(-.7, -.15, vN.z);
  vCoverage = (physical / ribbon) * smoothstep(.0, .12, t) * (1. - smoothstep(.88, 1., t)) * silhouette * step(.012, len);
}`;

export const strandFragment = `#version 300 es
precision highp float;
precision highp int;
${FUR_LIGHT}
uniform vec3 uColor;
in float vSide;
in float vCoverage;
in float vAlong;
in vec3 vN;
in vec3 vT;
in float vVariation;
out vec4 outColor;
void main() {
  float alpha = pow(max(0., 1. - vSide * vSide), .7) * vCoverage * .82;
  if (alpha < .015) discard;
  outColor = vec4(furShade(uColor, normalize(vT), normalize(vN), .35 + .65 * vAlong, vVariation), alpha);
}`;

/** Solid parts: 0 skin, 1 eye socket, 2 eyeball, 7 tear. */
export const meshVertex = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec3 aPosition;
${COMMON}
uniform vec3 uCenter;
uniform vec3 uScale;
uniform mat3 uEyeRotation;
uniform int uKind;
out vec3 vNormal;
out vec3 vUnit;
out vec3 vLid;
void main() {
  vec3 unit = aPosition;
  vec3 p = unit * uScale;
  vec3 normal = normalize(unit / uScale);
  vLid = unit;
  // The globe stays put in its socket; the iris and pupil slide across it,
  // so the eye never turns its own edge toward the visitor.
  vUnit = uKind == 2 ? transpose(uEyeRotation) * unit : unit;
  if (uKind == 0) {
    vec3 world = toWorld(jaw(p));
    vNormal = toWorldNormal(normal);
    gl_Position = project(world);
    return;
  }
  // Rigid parts ride on the deforming body but keep their own shape.
  vec3 world = toWorld(uCenter) + uRotation * p;
  vNormal = normalize(uRotation * normal);
  gl_Position = project(world);
  // An eye sits on the face even where its flattened globe dips into the
  // curved skin (head tilted up); a far eye on a turned head stays hidden.
  if (uKind == 2) gl_Position.z -= .03;
}`;

export const meshFragment = `#version 300 es
precision highp float;
precision highp int;
${COMMON}
uniform int uKind;
uniform vec3 uColor;
uniform vec4 uLids;
uniform mat3 uEyeRotation;
uniform vec4 uIrisInfo;
uniform vec3 uIris;
uniform float uGazePitch;
uniform float uTime;
in vec3 vNormal;
in vec3 vUnit;
in vec3 vLid;
out vec4 outColor;
float sdHeart(vec2 p) {
  p.x = abs(p.x);
  if (p.y + p.x > 1.) return sqrt(dot(p - vec2(.25, .75), p - vec2(.25, .75))) - sqrt(2.) / 4.;
  vec2 a = p - vec2(0., 1.), b = p - .5 * max(p.x + p.y, 0.);
  return sqrt(min(dot(a, a), dot(b, b))) * sign(p.x - p.y);
}
float sdStar(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(.809016994375, -.587785252292);
  const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2. * max(dot(k1, p), 0.) * k1;
  p -= 2. * max(dot(k2, p), 0.) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0, 1);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0., r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}
void main() {
  vec3 N = normalize(vNormal), L = normalize(vec3(-.45, .78, 1.05));
  float diffuse = max(dot(N, L), 0.);
  if (uKind == 0) { outColor = vec4(uColor * (.3 + .12 * diffuse), 1.); return; }
  if (uKind == 7) {
    float fresnel = pow(1. - max(N.z, 0.), 2.);
    vec3 c = mix(vec3(.62, .82, 1.), vec3(1.), fresnel * .6 + smoothstep(.96, .985, dot(N, normalize(vec3(-.3, .5, 1.)))));
    outColor = vec4(c, .78 + fresnel * .2); return;
  }
  // Eyeball. Lids are painted in socket coordinates; the iris and pupil turn
  // with the globe; highlights come from the world normal so they stay put.
  float side = uLids.w, up = uLids.x, low = uLids.y, slant = uLids.z;
  float xs = -side * vLid.x;
  float closure = low * .24 - (.1 + low * .34) * xs * xs - .03;
  float yu = mix(closure, 1.08, up) - slant * xs * .42 * up - .13 * xs * xs * up
    - max(0., -uGazePitch) * .22 * up + max(0., uGazePitch) * .05 * up;
  yu = max(yu, closure);
  float yl = min(mix(-1.16, closure, low) + .06 * low * (1. - xs * xs), closure);
  float eU = yu - vLid.y, eL = vLid.y - yl;
  float aa = fwidth(vLid.y) * 1.3 + .004;
  float open = smoothstep(-aa, aa, eU) * smoothstep(-aa, aa, eL);
  vec3 lid = uColor * (.9 + .14 * noise3(vLid * 44.)) * (.92 + .1 * diffuse);

  vec2 m = vUnit.xy; float r = length(m);
  vec3 eye = vec3(1., .99, .965) * (.96 + .04 * diffuse);
  eye *= .9 + .1 * smoothstep(0., .22, eU);
  eye = mix(eye, vec3(.95, .9, .87), smoothstep(.74, .93, length(vLid.xy)) * .14);
  float pupil = uIrisInfo.x, wet = uIrisInfo.y, shape = uIrisInfo.z, shapeMix = uIrisInfo.w;
  float ra = fwidth(r) * 1.3 + .003;
  if (vUnit.z > 0.) {
    float RI = .62, RP = clamp(.37 * pupil, .2, .52);
    float theta = atan(m.y, m.x);
    // Warm brown iris: radial fibres, a dark limbal ring, light pooling low.
    vec3 iris = uIris * (.7 + .55 * noise3(vec3(cos(theta) * 8., sin(theta) * 8., r * 9.)));
    iris = mix(iris, uIris * 2.1 + vec3(.06, .02, 0.), smoothstep(.0, .65, -m.y) * smoothstep(RP, RI, r) * .6);
    iris *= mix(.35, 1., 1. - smoothstep(RI - .16, RI, r));
    eye = mix(eye, iris, 1. - smoothstep(RI - ra, RI + ra, r));
    eye = mix(eye, vec3(.015, .01, .02), 1. - smoothstep(RP - ra, RP + ra, r));
    if (shapeMix > .001) {
      vec3 special = eye; float mask = 0.;
      if (shape < 1.5) {
        float d = sdHeart(m * 1.5 + vec2(0., .6));
        mask = 1. - smoothstep(-.02, .02, d);
        special = mix(vec3(.93, .16, .3), vec3(1., .55, .62), smoothstep(.1, .55, m.y + .2));
      } else if (shape < 2.5) {
        float a = atan(m.y, m.x) / 6.2832;
        float band = fract(a + r * 3.1 - uTime * 1.7);
        special = mix(vec3(1., .975, .94), vec3(.1, .04, .04), smoothstep(.42, .48, band) * (1. - smoothstep(.9, .96, band)));
        mask = 1. - smoothstep(.74, .78, r);
      } else {
        float d = sdStar(m, .34, .45);
        special = mix(eye, vec3(1., .97, .82), 1. - smoothstep(-.02, .02, d));
        mask = 1. - smoothstep(RI - ra, RI + ra, r);
      }
      eye = mix(eye, special, mask * shapeMix);
    }
  }
  // The library's catchlights: crisp round reflections on the cornea, which
  // bulges over the iris, so they ride along with it (mostly), a large one
  // up and to the right of the pupil, a small one low left.
  vec2 e = vLid.xy;
  vec2 iris = (uEyeRotation * vec3(0., 0., 1.)).xy * .8;
  float la = fwidth(e.x) * 1.2 + .002;
  float highlight = 1. - smoothstep(.15 - la, .15 + la, length(e - iris - vec2(.19, .24)));
  float glint = 1. - smoothstep(.065 - la, .065 + la, length(e - iris - vec2(-.2, -.22)));
  float tearShine = wet * (1. - smoothstep(.05 - la, .05 + la, length(e - vec2(.42, .02)))) * .8;
  eye = mix(eye, vec3(1.), max(highlight * .97, max(glint * .9, tearShine)));
  // A brimming tear sits along the lower lid.
  eye += vec3(.5, .62, .75) * wet * .5 * (1. - smoothstep(0., .1, eL)) * smoothstep(0., .015, eL);
  vec3 colour = mix(lid, eye, open);
  // A thin dark lid outline, strongest along the top, then fur from the
  // face overlapping the rim a little.
  float rim = length(vLid.xy);
  float angle = atan(vLid.y, vLid.x);
  float visible = smoothstep(.0, .35, up);
  float outline = smoothstep(.87, .92, rim) * (.5 + .5 * smoothstep(-.3, .6, vLid.y)) * visible;
  colour = mix(colour, uColor * .3, outline * .8);
  float fringe = smoothstep(mix(.55, .93, visible), mix(.8, .99, visible), rim + (noise3(vec3(cos(angle) * 11., sin(angle) * 11., 2.)) - .5) * .05);
  colour = mix(colour, uColor * (.9 + .2 * noise3(vec3(angle * 30., rim * 40., 1.))), fringe);
  // A thin dark lid line; closed, it becomes the arc of a happy or sleepy eye.
  // (Edges are kept in order: GLSL leaves smoothstep undefined otherwise,
  // and at small sizes the anti-alias width outgrows a thin line.)
  float seamWidth = .022 + .045 * (1. - up);
  float seam = 1. - smoothstep(max(seamWidth - aa, 0.), seamWidth + aa, abs(eU));
  colour = mix(colour, uColor * .2, seam * .92);
  float lowerLine = 1. - smoothstep(max(.01 - aa, 0.), .01 + aa, abs(eL));
  colour = mix(colour, uColor * .45, lowerLine * .35 * (1. - low));
  // Closed, the lids melt into the face fur and only the line remains. An
  // upper lid all the way down closes the whole eye: what a low lower lid
  // left open under the line takes the lid's colour, or the white showed
  // through as a pale grey oval under each line (asleep, 2026-10-23).
  float gone = 1. - smoothstep(.02, .12, up);
  colour = mix(colour, mix(lid, colour, seam), gone);
  float shut = 1. - smoothstep(.04, .3, up);
  outColor = vec4(colour, mix(1., max(seam * .95, .25 * (1. - smoothstep(.4, .9, rim))), shut));
}`;

/**
 * Painted face parts on a patch that wraps the front of the sphere:
 * 3 mouth, 4 brow, 5 zipper, 6 blush.
 */
export const faceVertex = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec3 aPosition;
${COMMON}
uniform vec4 uPatch;
uniform float uLift;
out vec2 vPatch;
void main() {
  vec2 p = uPatch.xy + aPosition.xy * uPatch.zw;
  vec3 local = vec3(p, sqrt(max(.04, 1. - dot(p, p))) + uLift);
  vPatch = p;
  gl_Position = project(toWorld(local));
}`;

export const faceFragment = `#version 300 es
precision highp float;
precision highp int;
uniform int uKind;
uniform vec3 uColor;
uniform vec4 uMouthA;
uniform vec4 uMouthB;
uniform vec4 uMouthC;
uniform vec4 uBrow;
uniform float uBlush;
uniform float uTears;
uniform float uTime;
in vec2 vPatch;
out vec4 outColor;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float sdSegment(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
float roundedBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
void main() {
  float aa = fwidth(vPatch.y) * 1.25 + .0015;
  if (uKind == 3) {
    float jawOpen = uMouthA.x, wide = uMouthA.y, round_ = uMouthA.z, press = uMouthA.w;
    float smileL = uMouthB.x, smileR = uMouthB.y, shift = uMouthB.z, wobble = uMouthB.w;
    float tongue = uMouthC.x, teeth = uMouthC.y, zip = uMouthC.z, wiggle = uMouthC.w;
    float W = (.15 + .1 * wide - .055 * round_ - .025 * press) * (1. + .4 * jawOpen * (1. - round_));
    vec2 q = vPatch - vec2(shift * .06, -.45);
    float xn = q.x / W;
    float s = mix(smileL, smileR, clamp(xn * .5 + .5, 0., 1.));
    float avg = (smileL + smileR) * .5;
    float line = s * .055 * xn * xn - .012 * avg + wobble * .008 * sin(xn * 9.4 + uTime * 13.);
    float H = jawOpen * (.34 + .04 * round_);
    float k = clamp(.16 + .45 * round_ + .42 * max(0., -avg) - .08 * max(0., avg), .08, .85);
    float S = pow(sqrt(max(0., 1. - xn * xn)), 1. - .45 * round_);
    float yU = line + H * k * S, yL = line - H * (1. - k) * S;
    float inside = smoothstep(-aa, aa, yU - q.y) * smoothstep(-aa, aa, q.y - yL) * (1. - smoothstep(.97, 1.03, abs(xn))) * step(.006, H);
    float lip = max(.009 - .003 * press, aa * .9) * (1. - .55 * pow(abs(xn), 4.));
    float lineCover = (1. - smoothstep(lip - aa, lip + aa, abs(q.y - line))) * (1. - smoothstep(.9, 1.06, abs(xn)));
    vec3 dark = vec3(.2, .02, .05);
    vec3 colour = dark;
    if (inside > 0.) {
      colour = mix(vec3(.09, .018, .035), vec3(.33, .05, .09), clamp((yU - q.y) / max(H, 1e-3), 0., 1.));
      float tongueIn = 1. - smoothstep(.85, 1.05, length(vec2((q.x - .01) / (W * .58), (q.y - yL - H * (1. - k) * .25) / max(H * .42, 1e-3))));
      colour = mix(colour, vec3(.92, .38, .47), tongueIn * smoothstep(.03, .08, H));
      float teethBand = smoothstep(-aa, aa, q.y - (yU - .034 * teeth * (1. - .5 * xn * xn))) * step(.02, teeth);
      colour = mix(colour, vec3(.98, .96, .92), teethBand);
      float rim = 1. - smoothstep(0., .012, min(abs(q.y - yU), abs(q.y - yL)));
      colour = mix(colour, dark, rim * .7);
    }
    float alpha = max(inside, lineCover);
    if (tongue > .01) {
      // Tongue out: a soft U below the lip line, vibrating for a raspberry.
      float tx = q.x - .03 - wiggle * .012 * sin(uTime * 48.);
      vec2 tq = vec2(tx / .08, (q.y - (line - .01)) / (.16 * tongue));
      float out_ = (1. - smoothstep(.9, 1.06, length(tq))) * step(tq.y, 0.);
      vec3 pink = mix(vec3(.95, .42, .52), vec3(.8, .26, .36), 1. - smoothstep(0., .012, abs(tx)));
      pink = mix(pink, dark, (1. - smoothstep(.0, .12, abs(length(tq) - .96))) * .55);
      colour = mix(colour, pink, out_);
      alpha = max(alpha, out_);
    }
    alpha *= 1. - smoothstep(.38, .9, zip);
    if (alpha < .01) discard;
    outColor = vec4(colour, alpha); return;
  }
  if (uKind == 4) {
    // Not a drawn line: a ridge of darker fur over the eye that only shows
    // when the brow moves, with a lighter crest catching the light.
    float inner = uBrow.x, outer = uBrow.y, side = uBrow.z, base = uBrow.w;
    float x = vPatch.x * side;
    float u = clamp((x - .1) / .58, 0., 1.);
    float yi = base + inner * .11, yo = base - .03 + outer * .1;
    float yb = mix(yi, yo, u) + .03 * 4. * u * (1. - u);
    float along = smoothstep(.02, .12, x) * (1. - smoothstep(.62, .76, x));
    float d = vPatch.y - yb;
    float ridge = exp(-d * d / (2. * .034 * .034)) * along;
    float crest = exp(-(d - .05) * (d - .05) / (2. * .022 * .022)) * along;
    // A raised brow barely shows on fur; a lowered or pinched one does.
    float lowered = max(max(-inner, -outer), 0.), pinched = max(inner - outer, 0.);
    float show = smoothstep(.25, .7, max(max(lowered, pinched * .8), max(inner, outer) * .35));
    float alpha = max(ridge * .95, crest * .4) * show;
    if (alpha < .01) discard;
    vec3 colour = mix(uColor * 1.25 + .04, uColor * (.36 + .08 * hash12(floor(vPatch * 180.))), ridge / max(ridge + crest * .4, 1e-3));
    outColor = vec4(colour, alpha); return;
  }
  if (uKind == 5) {
    float zip = uMouthC.z;
    if (zip < .003) discard;
    vec2 p = vPatch - vec2(uMouthB.z * .06, -.45);
    float halfLength = .44;
    float closedTo = mix(-halfLength, halfLength, zip);
    float span = smoothstep(-halfLength - .012, -halfLength, p.x) * (1. - smoothstep(closedTo - .004, closedTo + .006, p.x));
    float tape = (1. - smoothstep(.032, .042, abs(p.y))) * span;
    vec3 gold = vec3(.98, .78, .36), dark = vec3(.42, .26, .1);
    vec3 colour = mix(vec3(.55, .2, .14), dark, .4);
    float alpha = tape * .9;
    float row = p.y > 0. ? 0. : .5;
    float cell = mod(p.x + .44 + row * .032, .032) - .016;
    float tooth = roundedBox(vec2(cell, abs(p.y) - .013), vec2(.011, .017), .004);
    float teeth = (1. - smoothstep(-.001, .002, tooth)) * span;
    colour = mix(colour, mix(gold, vec3(1., .95, .75), smoothstep(.0, .02, p.y)), teeth);
    alpha = max(alpha, teeth);
    // Slider at the closing end with its pull tab hanging below.
    vec2 slider = p - vec2(closedTo + .016, 0.);
    float body = roundedBox(slider, vec2(.03, .04), .012);
    vec2 tab = slider - vec2(.003, -.095);
    float pull = min(body, roundedBox(tab, vec2(.027, .066), .02));
    float hole = roundedBox(tab - vec2(0., -.016), vec2(.011, .03), .009);
    float pullAlpha = 1. - smoothstep(-.001, .003, pull);
    vec3 metal = mix(vec3(.82, .56, .2), vec3(1., .9, .58), smoothstep(-.06, .04, slider.y + slider.x));
    metal = mix(metal, vec3(.3, .16, .06), 1. - smoothstep(-.001, .002, hole));
    metal = mix(metal, dark, 1. - smoothstep(.0, .004, abs(pull + .002)));
    colour = mix(colour, metal, pullAlpha);
    alpha = max(alpha, pullAlpha) * smoothstep(.005, .1, zip);
    if (alpha < .01) discard;
    outColor = vec4(colour, alpha); return;
  }
  if (uKind == 8) {
    // Tears: brimming at the outer corner, then a glossy streak down the cheek.
    vec2 p = vPatch;
    float side = sign(p.x);
    float sx = abs(p.x);
    float t = clamp((-.3 - p.y) / .45, 0., 1.);
    float centre = .55 + .06 * t + .015 * sin(t * 7.);
    float width = mix(.03, .022, t);
    float length_ = uTears;
    float streak = (1. - smoothstep(width - aa, width + aa, abs(sx - centre))) * step(-.3 - .45 * length_, p.y) * step(p.y, -.26);
    float drop = 1. - smoothstep(.036 - aa, .036 + aa, length(vec2(sx - (.55 + .06 * length_), p.y - (-.3 - .45 * length_))));
    float shape = max(streak, drop) * smoothstep(.02, .2, uTears);
    if (shape < .01) discard;
    float shine = 1. - smoothstep(.0, .012, abs(sx - centre + width * .45));
    vec3 colour = mix(vec3(.66, .84, 1.), vec3(1.), shine * .8);
    outColor = vec4(colour, shape * .8); return;
  }
  // Blush: a warm pink glow over the lower cheeks.
  vec2 p = vPatch;
  vec2 c = vec2(abs(p.x) - .56, p.y + .36);
  float glow = 1. - smoothstep(0., 1., length(c / vec2(.3, .19)));
  float alpha = glow * glow * .75 * uBlush;
  if (alpha < .01) discard;
  outColor = vec4(1., .45, .58, alpha);
}`;

export const shadowVertex = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
uniform vec2 uSize;
uniform vec4 uShadow;
out vec2 vUV;
void main() {
  vUV = aPosition.xy;
  vec2 p = uShadow.xy + aPosition.xy * uShadow.zw;
  gl_Position = vec4(p.x / uSize.x * 2. - 1., 1. - p.y / uSize.y * 2., .9, 1.);
}`;

export const shadowFragment = `#version 300 es
precision highp float;
uniform float uOpacity;
in vec2 vUV;
out vec4 outColor;
void main() { float a = exp(-dot(vUV, vUV) * 3.8) * (1. - smoothstep(.7, 1., length(vUV))); outColor = vec4(.16, .1, .11, a * uOpacity); }`;

/** Comic symbols, drawn flat as signed-distance shapes with a sticker outline. */
export const emoteVertex = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
uniform vec2 uSize;
uniform vec4 uSprite;
out vec2 vUV;
void main() {
  float c = cos(uSprite.w), s = sin(uSprite.w);
  vUV = vec2(aPosition.x, aPosition.y);
  vec2 corner = vec2(c * aPosition.x - s * aPosition.y, s * aPosition.x + c * aPosition.y) * uSprite.z;
  vec2 p = uSprite.xy + vec2(corner.x, -corner.y);
  gl_Position = vec4(p.x / uSize.x * 2. - 1., 1. - p.y / uSize.y * 2., 0., 1.);
}`;

export const emoteFragment = `#version 300 es
precision highp float;
uniform int uShape;
uniform float uAlpha;
in vec2 vUV;
out vec4 outColor;
float sdSegment(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
float sdHeart(vec2 p) {
  p.x = abs(p.x);
  if (p.y + p.x > 1.) return sqrt(dot(p - vec2(.25, .75), p - vec2(.25, .75))) - sqrt(2.) / 4.;
  vec2 a = p - vec2(0., 1.), b = p - .5 * max(p.x + p.y, 0.);
  return sqrt(min(dot(a, a), dot(b, b))) * sign(p.x - p.y);
}
float sdStar(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(.809016994375, -.587785252292);
  const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2. * max(dot(k1, p), 0.) * k1;
  p -= 2. * max(dot(k2, p), 0.) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0, 1);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0., r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}
float roundedBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
vec2 rotate(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
void main() {
  vec2 p = vUV;
  float d = 1.; vec3 fill = vec3(1.);
  if (uShape == 0) { // z
    d = min(min(sdSegment(p, vec2(-.38, .38), vec2(.38, .38)), sdSegment(p, vec2(.38, .38), vec2(-.38, -.38))), sdSegment(p, vec2(-.38, -.38), vec2(.38, -.38))) - .1;
    fill = vec3(.36, .4, .74);
  } else if (uShape == 1) { // heart
    d = sdHeart(p * 1.15 + vec2(0., .55)) / 1.15; fill = vec3(.95, .26, .4);
  } else if (uShape == 2) { // !
    d = min(sdSegment(p, vec2(0., .45), vec2(0., -.05)) - mix(.07, .13, smoothstep(-.05, .45, p.y)), length(p - vec2(0., -.34)) - .12);
    fill = vec3(1., .66, .12);
  } else if (uShape == 3) { // ?
    float arc = abs(length(p - vec2(0., .2)) - .24) - .09;
    arc = max(arc, -(p.y - .2 + .9 * (p.x + .02)) * step(p.x, 0.) * step(p.y, .2));
    d = min(min(arc, sdSegment(p, vec2(.14, .02), vec2(0., -.1)) - .09), length(p - vec2(0., -.38)) - .1);
    fill = vec3(.15, .62, .66);
  } else if (uShape == 4) { // sparkle
    vec2 a = abs(p);
    d = (pow(a.x, .5) + pow(a.y, .5) - .78) * .4; fill = vec3(1., .84, .32);
  } else if (uShape == 5) { // anger mark
    vec2 a = abs(p);
    d = min(sdSegment(a, vec2(.12, .46), vec2(.12, .2)), sdSegment(a, vec2(.12, .2), vec2(.46, .12))) - .08;
    fill = vec3(.92, .16, .22);
  } else if (uShape == 6) { // sweat
    d = length(vec2(p.x * (1. + max(p.y + .1, 0.) * 2.), p.y + .12)) - .3; fill = vec3(.56, .8, 1.);
  } else if (uShape == 7) { // star
    d = sdStar(p, .48, .45); fill = vec3(1., .82, .24);
  } else if (uShape == 8) { // note
    d = min(min(length(p - vec2(-.16, -.26)) - .17, sdSegment(p, vec2(0., -.24), vec2(0., .42)) - .05), sdSegment(p, vec2(0., .42), vec2(.24, .24)) - .06);
    fill = vec3(.42, .36, .76);
  } else if (uShape == 9) { // idea: three bright strokes
    d = min(min(sdSegment(p, vec2(-.32, -.12), vec2(-.5, .28)), sdSegment(p, vec2(0., -.04), vec2(0., .44))), sdSegment(p, vec2(.32, -.12), vec2(.5, .28))) - .075;
    fill = vec3(1., .82, .2);
  } else if (uShape == 10) { // open book
    vec2 l = rotate(p - vec2(-.27, 0.), -.14), r = rotate(p - vec2(.27, 0.), .14);
    d = min(roundedBox(l, vec2(.27, .2), .04), roundedBox(r, vec2(.27, .2), .04));
    float lines = step(.6, fract((p.y + .3) * 9.)) * step(abs(abs(p.x) - .27), .17) * step(abs(p.y), .14);
    fill = mix(vec3(.97, .91, .78), vec3(.78, .68, .55), lines * .7);
    fill = mix(fill, vec3(.6, .45, .32), 1. - smoothstep(.0, .02, abs(p.x)));
  } else { // pencil
    vec2 q = rotate(p, -.62);
    d = max(roundedBox(q - vec2(-.05, 0.), vec2(.42, .1), .03), dot(vec2(q.x, abs(q.y)), normalize(vec2(1., 2.4))) - .3);
    fill = q.x > .27 ? (q.x > .38 ? vec3(.25, .22, .22) : vec3(.96, .84, .64)) : q.x < -.36 ? vec3(.96, .5, .58) : vec3(1., .76, .16);
  }
  float aa = fwidth(d) * 1.2 + .004;
  float body = 1. - smoothstep(-aa, aa, d);
  float outline = 1. - smoothstep(.09 - aa, .09 + aa, d);
  float shadow = 1. - smoothstep(.11, .17, d);
  vec3 colour = mix(vec3(1.), fill, body);
  float alpha = max(outline, shadow * .18);
  colour = mix(vec3(.2, .15, .17), colour, outline);
  if (alpha * uAlpha < .01) discard;
  outColor = vec4(colour, alpha * uAlpha);
}`;
