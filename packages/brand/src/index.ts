// @easm-ui/brand: the EASM brand kit. Logo v6 (EasmLogo, EasmMark and the artwork builders), the brand data,
// and the app motion kit (EasmIcon in twelve states, EasmWaveform, EasmDots and their engines), the backgrounds, and the mascot.
export * from './motion/index';
export { EasmLogo, EasmMark } from './logo/react';
export type { EasmLogoProps, EasmMarkProps } from './logo/react';
export { logoArt, markArt, tileArt, markShapes, svgFile, FULL_NAME } from './logo/svg';
export type { LogoTheme, LogoVariant, ProductName, LogoArt } from './logo/svg';
export { PRODUCT_NAMES, WORDMARK, CROSSBAR } from './logo/artwork';
export { BRAND, PRODUCTS, BRAND_COLOURS, LOGO_RULES } from './brand';
export { EasmDotField } from './EasmDotField';
export type { EasmDotFieldProps } from './EasmDotField';
export { EasmParticleField } from './EasmParticleField';
export type { EasmParticleFieldProps } from './EasmParticleField';
export { EASM_BACKGROUND_PALETTES, EASM_PARTICLE_LOOP_MS } from './background/palettes';
export type { EasmBackgroundVariant } from './background/palettes';
export * from './mascot/index';
