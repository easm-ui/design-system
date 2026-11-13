'use client';

import { useEffect, useRef } from 'react';

/**
 * EasmDotField: the background of a product's home page, a fine, dense field of tiny dots drawn on the GPU.
 *
 * - At rest the field is a quiet ink texture, densest at the top of the page and fading downward, with a soft
 *   blue area and a smaller orange one drifting through it very slowly.
 * - The cursor is a soft lens that follows with a little lag: blue at its heart, warming to orange at its rim.
 * - A click sends a slow, damped wave across the field: a soft orange ring leading and blue rings settling behind it,
 *   whose dots settle back gradually over five seconds.
 * - The living EASM mark, made of the same dots, is drawn where the page puts an element with
 *   `data-easm-mark-anchor` (its box gives the centre and size; the element only measures, so wrap it in an
 *   `overflow: hidden` layer if it reaches past the page's edge). Hover or tap wakes it. No anchor, no mark.
 *
 * Mount it once, on the pages that should read as a home: it sits behind everything (a fixed canvas, no pointer
 * events, z-index -1) and listens to the window. Colours are read from the EASM UI tokens when it mounts
 * (--easm-ui-text, --easm-ui-primary-fill, --easm-ui-orange). Under reduced motion it paints one still frame;
 * without WebGL it paints nothing. Moved here from the EASM One web app on 2026-10-18.
 *
 * `contained` draws it inside its parent instead of behind the page (a card, a panel, a preview): the canvas fills
 * the nearest positioned ancestor (`position: absolute; inset: 0`, under the parent's content), its size follows that
 * box, and the cursor, ripples and mark anchor are read relative to it.
 */
const GAP = 3; // px between dots
const MAX_RIPPLES = 4;
const RIPPLE_LIFE = 5; // seconds a ripple takes to settle
const RIPPLE_SPEED = 140; // px per second

const VERT = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uSize;       // css px
uniform float uDpr;
uniform float uTime;
uniform vec3 uInk;
uniform vec3 uBlue;
uniform vec3 uOrange;
uniform vec3 uCursor;     // x, y, strength
uniform vec4 uRipple[${MAX_RIPPLES}]; // x, y, age, alive
uniform vec3 uMark;       // centre x, y and half-size in px; z = 0 draws no mark
uniform float uVoice;     // 0..1, the core's speaking swell
uniform float uFlow;      // runs up: light along the rails
uniform float uAwake;     // 0..1, hover or tap
uniform float uCoreTurn;  // radians
uniform vec2 uHot;        // a rail the page points at (index 0..5, 0 = right, clockwise) and how lit it is

const float GAP = ${GAP.toFixed(1)};
const float TAU = 6.2831853;

void main() {
    vec2 p = vec2(gl_FragCoord.x, uSize.y * uDpr - gl_FragCoord.y) / uDpr;

    vec2 disp = vec2(0.0);
    float lift = 0.0;     // how far a dot rises out of the texture
    float tone = 0.0;     // 0 = blue, 1 = orange, for the lifted part
    float toneW = 0.0;

    // Cursor: a soft lens, blue at its heart and warming to orange at its rim.
    if (uCursor.z > 0.001) {
        vec2 d = uCursor.xy - p;
        float r = length(d);
        float g = exp(-(r * r) / (170.0 * 170.0)) * uCursor.z;
        disp += (r > 0.5 ? d / r : vec2(0.0)) * g * 1.0;
        lift = max(lift, g * 0.75);
        tone += smoothstep(40.0, 190.0, r) * g;
        toneW += g;
    }

    // Ripples: a slow, damped wave, a few soft rings travelling out and fading, alternating blue and orange.
    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
        vec4 rp = uRipple[i];
        if (rp.w < 0.5) continue;
        vec2 d = p - rp.xy;
        float r = length(d);
        float age = rp.z;
        float front = age * ${RIPPLE_SPEED.toFixed(1)};
        float s = r - front;
        // Leading edge short, trailing tail long: the water behind settles slowly.
        float env = s > 0.0 ? exp(-(s * s) / (70.0 * 70.0)) : exp(-(s * s) / (210.0 * 210.0));
        float life = 1.0 - age / ${RIPPLE_LIFE.toFixed(1)};
        float fade = life * life * smoothstep(0.0, 0.25, age);
        float phase = TAU * s / 84.0;
        float ring = 0.5 + 0.5 * cos(phase);
        float a = env * fade;
        float w = a * ring * ring;
        disp -= (r > 0.5 ? d / r : vec2(0.0)) * sin(phase) * a * 1.4;
        lift = max(lift, w);
        // The leading ring is orange; the rings settling behind it turn to blue.
        tone += smoothstep(-150.0, 10.0, s) * w;
        toneW += w;
    }
    tone = toneW > 0.0001 ? tone / toneW : 0.0;

    vec2 q = p + disp;
    // The EASM mark, drawn in the dots where the page puts its anchor ([data-easm-mark-anchor], uMark = centre
    // and half-size in px; 0 = no mark): six rails around the orange core, the icon pack's "easm-one" geometry
    // (rails from 5.4 to 10 units of 12, core 6 units square, corner 1.6). It is alive the way EasmIcon is:
    //   speaking   the core swells, brightens and glows in bursts of a voice (uVoice: the rhythm of EasmIcon's
    //              speaking state, four bursts in 7.15 s), and light runs out along the rails in turn (uFlow);
    //   awake      on hover or a tap (uAwake), the rails breathe outward in turn like EasmIcon's thinking state,
    //              the core turns (uCoreTurn) and everything runs brighter and faster.
    float rail = 0.0, core = 0.0, flowLight = 0.0, glow = 0.0, hot = 0.0;
    if (uMark.z > 0.5) {
        vec2 v = (q - uMark.xy) / uMark.z * 12.0;
        float r12 = length(v);
        float ang = atan(v.y, v.x);
        float k = floor(ang / (TAU / 6.0) + 0.5);
        float ca = cos(k * TAU / 6.0), sa = sin(k * TAU / 6.0);
        vec2 u = vec2(v.x * ca + v.y * sa, -v.x * sa + v.y * ca);
        float idx = mod(k + 6.0, 6.0);
        float reach = uAwake * 0.9 * (0.5 + 0.5 * sin(uFlow * TAU * 0.5 - idx * 1.047));
        float railD = length(u - vec2(clamp(u.x, 5.4 + reach, 10.0 + reach), 0.0)) - 0.95;
        // The core: turned and swollen with the voice.
        float cs = 1.0 + uVoice * 0.10 + uAwake * 0.04;
        float ct = cos(uCoreTurn), st = sin(uCoreTurn);
        vec2 cv = vec2(v.x * ct + v.y * st, -v.x * st + v.y * ct) / cs;
        vec2 b = abs(cv) - vec2(3.0 - 1.6);
        float coreD = length(max(b, 0.0)) + min(max(b.x, b.y), 0.0) - 1.6;
        float edge = GAP / uMark.z * 12.0;
        rail = 1.0 - smoothstep(-edge, edge, railD);
        // The rail the person points at (Home's map): fuller and brighter, and its light runs faster.
        hot = (abs(idx - uHot.x) < 0.5 ? uHot.y : 0.0) * rail;
        core = 1.0 - smoothstep(-edge, edge, coreD);
        // Light running outward along each rail in turn.
        float along = fract(uFlow - idx / 6.0);
        float pos = 5.4 + reach + along * 5.0;
        // While a rail is pointed at, its light runs and the others' quiet down: one place speaks at a time.
        float isHot = abs(idx - uHot.x) < 0.5 ? 1.0 : 0.0;
        float focus = mix(1.0, mix(0.15, 2.4, isHot), uHot.y);
        flowLight = rail * focus * exp(-pow((u.x - pos) / 1.1, 2.0)) * (0.35 + 0.65 * uAwake) * smoothstep(0.0, 0.15, along) * (1.0 - smoothstep(0.85, 1.0, along));
        // The core speaks: a warm glow around it that swells and settles with each burst of the voice, the way
        // EasmIcon's core glows in its speaking state. Inside the core the dots brighten; around it they warm.
        glow = exp(-max(coreD, 0.0) / (1.6 + uVoice * 2.2)) * (0.22 + 0.78 * uVoice) * (1.0 - core * 0.5);
    }

    vec2 cell = mod(q, GAP) - GAP * 0.5;
    float dist = length(cell);
    float radius = 0.5 + lift * 0.38 + (rail + core) * 0.12 + hot * 0.25 + flowLight * 0.3 + glow * 0.35;
    float aa = 0.6 / uDpr + 0.15;
    float dotMask = 1.0 - smoothstep(radius - aa, radius + aa, dist);

    // Resting texture: densest at the top, fading down; soft at the far edges.
    float vy = clamp(p.y / uSize.y, 0.0, 1.0);
    float rest = 0.15 * (1.0 - 0.7 * vy);
    rest *= smoothstep(0.0, 0.08, p.x / uSize.x) * smoothstep(1.0, 0.92, p.x / uSize.x);

    // Ambient light: a soft blue area and a smaller orange one, drifting very slowly.
    vec2 cb = uSize * vec2(0.28 + 0.10 * cos(uTime * 0.03), 0.30 + 0.08 * sin(uTime * 0.025));
    vec2 co = uSize * vec2(0.80 + 0.06 * sin(uTime * 0.035), 0.16 + 0.06 * cos(uTime * 0.03));
    float blueArea = exp(-dot(p - cb, p - cb) / (uSize.x * uSize.x * 0.06));
    float orangeArea = exp(-dot(p - co, p - co) / (uSize.x * uSize.x * 0.025));

    vec3 colour = uInk;
    colour = mix(colour, uBlue, blueArea * 0.55);
    colour = mix(colour, uOrange, orangeArea * 0.6);
    colour = mix(colour, uBlue, rail * 0.92);
    colour = mix(colour, uOrange, clamp(glow * 1.4, 0.0, 1.0));
    colour = mix(colour, uOrange, max(core, flowLight * 0.85));
    colour = mix(colour, vec3(1.0, 0.56, 0.2), core * uVoice * 0.55);
    vec3 lit = mix(uBlue, uOrange, tone);
    colour = mix(colour, lit, smoothstep(0.0, 0.35, lift));

    float alpha = rest + blueArea * 0.05 + orangeArea * 0.06 + rail * (0.34 + hot * 0.4) + core * (0.42 + uVoice * 0.3) + flowLight * 0.45 + glow * 0.42 + lift * 0.62;
    alpha = clamp(alpha, 0.0, 0.85) * dotMask;

    gl_FragColor = vec4(colour * alpha, alpha);
}
`;

/**
 * The voice of the mark, 0..1 over time (s): EasmIcon's speaking state, four bursts in a 7.15 s phrase (its core
 * keyframes swell at 0, 33, 48 and 76 % of the cycle), each a quick rise and a slow settle, with a light flutter
 * of syllables on top.
 */
const SPEAK_CYCLE = 7.15;
const SPEAK_BURSTS = [0, 0.335, 0.48, 0.755];
function speaking(t: number): number {
    const x = (t % SPEAK_CYCLE) / SPEAK_CYCLE;
    let v = 0;
    for (const b of SPEAK_BURSTS) {
        let d = (x - b) * SPEAK_CYCLE;
        if (d < 0) d += SPEAK_CYCLE;
        v = Math.max(v, (1 - Math.exp(-d / 0.09)) * Math.exp(-d / 0.9));
    }
    const flutter = 0.85 + 0.15 * Math.sin(t * 11.0) * Math.sin(t * 3.7);
    return Math.min(1, v * 1.15 * flutter);
}

function rgb(value: string, fallback: [number, number, number]): [number, number, number] {
    const m = value.trim().match(/^#([0-9a-f]{6})$/i);
    if (!m) return fallback;
    const n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export interface EasmDotFieldProps {
    /** Draw inside the nearest positioned ancestor instead of as a fixed page background. Default false. */
    contained?: boolean;
}

export function EasmDotField({ contained = false }: EasmDotFieldProps = {}) {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = ref.current;
        const gl = canvas?.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true });
        if (!canvas || !gl) return;

        const compile = (type: number, src: string) => {
            const s = gl.createShader(type);
            if (!s) return null;
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
            return s;
        };
        const vs = compile(gl.VERTEX_SHADER, VERT);
        const fs = compile(gl.FRAGMENT_SHADER, FRAG);
        const prog = gl.createProgram();
        if (!vs || !fs || !prog) return;
        gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
        gl.useProgram(prog);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'a');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        const u = (n: string) => gl.getUniformLocation(prog, n);
        const uSize = u('uSize'), uDpr = u('uDpr'), uTime = u('uTime'), uCursor = u('uCursor'), uRipple = u('uRipple');
        const uHot = u('uHot'), uMark = u('uMark'), uVoice = u('uVoice'), uFlow = u('uFlow'), uAwake = u('uAwake'), uCoreTurn = u('uCoreTurn');
        const css = getComputedStyle(document.documentElement);
        gl.uniform3fv(u('uInk'), rgb(css.getPropertyValue('--easm-ui-text'), [0.063, 0.075, 0.094]));
        gl.uniform3fv(u('uBlue'), rgb(css.getPropertyValue('--easm-ui-primary-fill'), [0.184, 0.42, 0.922]));
        gl.uniform3fv(u('uOrange'), rgb(css.getPropertyValue('--easm-ui-orange'), [1, 0.416, 0]));

        const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const hover = window.matchMedia('(hover: hover)').matches;
        const target = { x: 0, y: 0, on: false };
        const cursor = { x: 0, y: 0, k: 0 };
        const ripples: { x: number; y: number; t0: number }[] = [];
        const rippleData = new Float32Array(MAX_RIPPLES * 4);
        const start = performance.now();
        let raf = 0;
        // The living mark: where the page anchors it, and its clocks.
        const mark = { hot: -1, hotK: 0, phase: 0, flow: 0, awake: 0, turn: 0, tapUntil: 0, last: performance.now() };
        // Contained, every client position is read from the canvas's own corner.
        const origin = { x: 0, y: 0 };
        const place = () => {
            if (!contained) return;
            const r = canvas.getBoundingClientRect();
            origin.x = r.left; origin.y = r.top;
        };
        const anchorRect = () => {
            const scope = contained ? canvas.parentElement ?? document : document;
            for (const el of scope.querySelectorAll<HTMLElement>('[data-easm-mark-anchor]')) {
                const b = el.getBoundingClientRect();
                if (b.width > 0 && b.height > 0) {
                    const r = { left: b.left - origin.x, top: b.top - origin.y, right: b.right - origin.x, bottom: b.bottom - origin.y, width: b.width, height: b.height };
                    return { el, r };
                }
            }
            return null;
        };

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const box = contained ? canvas.parentElement : null;
            const w = box ? Math.max(1, box.clientWidth) : window.innerWidth, h = box ? Math.max(1, box.clientHeight) : window.innerHeight;
            place();
            canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
            canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.uniform2f(uSize, w, h);
            gl.uniform1f(uDpr, dpr);
            draw(performance.now());
        };

        const draw = (now: number) => {
            const t = (now - start) / 1000;
            place();
            cursor.x += (target.x - cursor.x) * 0.07;
            cursor.y += (target.y - cursor.y) * 0.07;
            cursor.k += ((target.on ? 1 : 0) - cursor.k) * 0.04;
            rippleData.fill(0);
            for (let i = ripples.length - 1; i >= 0; i--) if ((now - ripples[i].t0) / 1000 > RIPPLE_LIFE) ripples.splice(i, 1);
            ripples.forEach((r, i) => rippleData.set([r.x, r.y, (now - r.t0) / 1000, 1], i * 4));
            gl.uniform1f(uTime, still ? 0 : t);

            const anchor = anchorRect();
            const dt = Math.min(0.05, Math.max(0, (now - mark.last) / 1000));
            mark.last = now;
            // Awake while the cursor is over the mark (a hit test: the page's content sits above the anchor) or
            // for a moment after a tap.
            const over = !!anchor && target.on
                && Math.hypot(target.x - (anchor.r.left + anchor.r.width / 2), target.y - (anchor.r.top + anchor.r.height / 2)) < Math.min(anchor.r.width, anchor.r.height) / 2;
            const awake = anchor && !still && (over || now < mark.tapUntil || !!anchor.el.dataset.hot) ? 1 : 0;
            mark.awake += (awake - mark.awake) * Math.min(1, dt * 3);
            if (!still) {
                mark.phase += dt * (1 + 1.2 * mark.awake);
                mark.flow += dt * (0.35 + 0.55 * mark.awake);
                // Awake, the core turns; at rest it settles on the nearest quarter turn, as EasmIcon's core does.
                const rest = Math.round(mark.turn / (Math.PI / 2)) * (Math.PI / 2);
                mark.turn += dt * mark.awake * 0.9 + (rest - mark.turn) * Math.min(1, dt * 2) * (1 - mark.awake);
            }
            const voice = still ? 0 : speaking(mark.phase) * (0.6 + 0.4 * mark.awake);
            gl.uniform3f(uMark, anchor ? anchor.r.left + anchor.r.width / 2 : 0, anchor ? anchor.r.top + anchor.r.height / 2 : 0, anchor ? Math.min(anchor.r.width, anchor.r.height) / 2 : 0);
            gl.uniform1f(uVoice, voice);
            gl.uniform1f(uFlow, mark.flow);
            gl.uniform1f(uAwake, mark.awake);
            gl.uniform1f(uCoreTurn, mark.turn);
            // The page names the rail it points at on the anchor (data-hot="0".."5"); it brightens in and out.
            const hotAttr = anchor?.el.dataset.hot;
            const hotNow = hotAttr !== undefined && hotAttr !== '' ? Number(hotAttr) : -1;
            if (hotNow >= 0) mark.hot = hotNow;
            mark.hotK += ((hotNow >= 0 ? 1 : 0) - mark.hotK) * Math.min(1, dt * 6);
            gl.uniform2f(uHot, mark.hot, still ? (hotNow >= 0 ? 1 : 0) : mark.hotK);
            gl.uniform3f(uCursor, cursor.x, cursor.y, cursor.k);
            gl.uniform4fv(uRipple, rippleData);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        };

        const frame = (now: number) => {
            draw(now);
            raf = document.hidden ? 0 : requestAnimationFrame(frame);
        };
        const run = () => { if (!raf && !still && !document.hidden) raf = requestAnimationFrame(frame); };

        const onMove = (e: PointerEvent) => {
            if (e.pointerType === 'touch') return;
            const x = e.clientX - origin.x, y = e.clientY - origin.y;
            if (!target.on && cursor.k < 0.02) { cursor.x = x; cursor.y = y; }
            target.x = x; target.y = y; target.on = true;
        };
        const onLeave = () => { target.on = false; };
        const onDown = (e: PointerEvent) => {
            // A tap on the mark wakes it for a moment (a touch screen has no hover).
            place();
            const x = e.clientX - origin.x, y = e.clientY - origin.y;
            if (contained && (x < 0 || y < 0 || x > canvas.clientWidth || y > canvas.clientHeight)) return;
            const a = anchorRect();
            if (a && x >= a.r.left && x <= a.r.right && y >= a.r.top && y <= a.r.bottom) mark.tapUntil = performance.now() + 2600;
            ripples.push({ x, y, t0: performance.now() });
            if (ripples.length > MAX_RIPPLES) ripples.shift();
        };
        const onVisible = () => { if (!document.hidden) run(); };

        // Still (reduced motion): one frame, redrawn when the page scrolls so the mark stays on its anchor.
        const onScroll = () => { if (still) draw(performance.now()); };

        resize();
        window.addEventListener('resize', resize);
        const observer = contained && canvas.parentElement && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
        if (observer && canvas.parentElement) observer.observe(canvas.parentElement);
        window.addEventListener('scroll', onScroll, { passive: true, capture: true });
        document.addEventListener('visibilitychange', onVisible);
        if (!still) {
            if (hover) {
                window.addEventListener('pointermove', onMove, { passive: true });
                document.documentElement.addEventListener('pointerleave', onLeave);
                window.addEventListener('blur', onLeave);
            }
            window.addEventListener('pointerdown', onDown, { passive: true, capture: true });
            run();
        }
        return () => {
            cancelAnimationFrame(raf);
            observer?.disconnect();
            window.removeEventListener('resize', resize);
            window.removeEventListener('scroll', onScroll, { capture: true });
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('pointermove', onMove);
            document.documentElement.removeEventListener('pointerleave', onLeave);
            window.removeEventListener('blur', onLeave);
            window.removeEventListener('pointerdown', onDown, { capture: true });
            // Free what this run made; never lose the context itself, which a remount (React's development double
            // mount, a route coming back) would then find dead on the same canvas.
            gl.deleteBuffer(buf);
            gl.deleteProgram(prog);
            gl.deleteShader(vs);
            gl.deleteShader(fs);
        };
    }, [contained]);

    if (contained) return <canvas ref={ref} aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, zIndex: 0, pointerEvents: 'none', display: 'block' }} />;
    return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed left-0 top-0 -z-10" />;
}
