// The EASM mascot: the character (framework-free engine) and its React component.
export { EasmMascot } from './EasmMascot';
export type { EasmMascotProps, EasmMascotAct, EasmMascotActivity, EasmMascotCorner, EasmMascotExpression, EasmMascotMood, EasmMascotPerch, EasmMascotViseme } from './EasmMascot';
export {
  FurCompanion as EasmMascotEngine,
  EXPRESSIONS as MASCOT_EXPRESSIONS,
  EXPRESSION_SHEETS as MASCOT_EXPRESSION_SHEETS,
  EXTRA_EXPRESSIONS as MASCOT_EXTRA_EXPRESSIONS,
  ACTS as MASCOT_ACTS,
  FEELINGS as MASCOT_FEELINGS,
  expressionLabel as mascotExpressionLabel,
} from './FurCompanion';
export type { FrameAt as EasmMascotFrame, Feeling as EasmMascotFeeling } from './FurCompanion';
