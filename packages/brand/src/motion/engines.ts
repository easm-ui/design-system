// @easm-ui/brand/engines: the animations without React (plain pages, other frameworks, web views, exports).
export { IconEngine, iconMarkup, collectIconParts, railColor, ICON_TIMING, ICON_STATES, ONE_SHOT, CORE_RING } from './core/icon';
export type { IconState, Theme, IconParts, IconEngineOptions } from './core/icon';
export { WaveEngine, waveMarkup, waveViewBox, collectWaveParts, waveMode, loadingWave, loadingLag, WAVE } from './core/wave';
export type { WaveMode, WaveModeInput, WaveParts, WaveEngineOptions } from './core/wave';
export { DOTS_CSS, DOTS_VIEWBOX, DOTS_HEIGHT, DOTS_PERIOD, dotsMarkup, injectDotsCss } from './core/dots';
export type { DotsVariant } from './core/dots';
export { LevelMeter, levelReader, audioContext, primeEasmAudio } from './core/audio';
export type { AudioSource, LevelInput, LevelMeterOptions } from './core/audio';
export { voiceAt, VOICE_LOOP_SECONDS } from './core/voice';
export { V6, ORANGE, INK, PAPER, motionOff } from './core/brand';
export { mountIcon, mountWaveform, mountDots } from './vanilla';
export { ICON_META, WAVE_META, DOTS_META, ICON_LABELS, WAVE_LABELS, DOTS_LABELS } from './core/meta';
export type { MotionMeta } from './core/meta';

export { renderParticleField, getParticleFieldPoints } from '../background/particle-field';
export type { ParticleFieldOptions, ParticleFieldPoint, ParticleFieldPointer } from '../background/particle-field';
export { EASM_BACKGROUND_PALETTES, EASM_PARTICLE_LOOP_MS } from '../background/palettes';
export type { EasmBackgroundVariant } from '../background/palettes';
