import { DARK, PAPER, ORANGE } from '../motion/core/brand';

/** Atmospheric surfaces, not replacement UI or logo colours. Orange remains a local signal. */
export const EASM_BACKGROUND_PALETTES = {
  charcoal: {
    name: 'Charcoal',
    ground: DARK,
    far: '#172126',
    rust: '#813D27',
    orange: ORANGE,
    steel: '#628695',
    particle: '249, 248, 243',
    highlight: '255, 232, 202',
    shadow: '8, 10, 11',
    light: false,
  },
  light: {
    name: 'Paper',
    ground: PAPER,
    far: '#E4E9E8',
    rust: '#CB9F8B',
    orange: ORANGE,
    steel: '#9CAFB8',
    particle: '67, 88, 98',
    highlight: '255, 255, 255',
    shadow: '204, 212, 214',
    light: true,
  },
  steel: {
    name: 'Steel',
    ground: '#121A1F',
    far: '#263A44',
    rust: '#7C4632',
    orange: ORANGE,
    steel: '#6E98A8',
    particle: '235, 246, 249',
    highlight: '255, 231, 203',
    shadow: '8, 15, 20',
    light: false,
  },
} as const;

export type EasmBackgroundVariant = keyof typeof EASM_BACKGROUND_PALETTES;
export type EasmBackgroundPalette = (typeof EASM_BACKGROUND_PALETTES)[EasmBackgroundVariant];

/** One analytic travelling wave; phase zero and one are the same position and velocity. */
export const EASM_PARTICLE_LOOP_MS = 32_000;
