// What every state, mode and variant means: the accessible name, the real event that starts it, and what moves. One
// source for the components' labels, the spec page, the README tables and the design-system manifest (tools/tokens.mjs).

import type { IconState } from './icon';
import type { WaveMode } from './wave';
import type { DotsVariant } from './dots';

/** Accessible names: all the components need at runtime (the descriptions below are for docs and design tools, and
 *  drop out of an app's bundle unless it imports them). */
export const ICON_LABELS: Record<IconState, string> = {
  idle: 'EASM', connecting: 'EASM is connecting', listening: 'EASM is listening', thinking: 'EASM is thinking',
  searching: 'EASM is searching', toolCalling: 'EASM is using a connected system', writing: 'EASM is writing',
  speaking: 'EASM is speaking', awaiting: 'EASM is waiting for you', done: 'Done', error: 'EASM could not complete this', offline: 'EASM is offline',
};
export const WAVE_LABELS: Record<WaveMode, string> = { idle: 'Voice', loading: 'Loading', listening: 'Listening', speaking: 'EASM is speaking' };
export const DOTS_LABELS: Record<DotsVariant, string> = { typing: 'EASM is writing', searching: 'EASM is searching', thinking: 'EASM is thinking' };

/** Adds each entry's label (kept as a call, so a bundle that never reads the descriptions drops them). */
function withLabels<K extends string, V extends object>(labels: Record<K, string>, m: Record<K, V>): Record<K, V & { label: string }> {
  const out = {} as Record<K, V & { label: string }>;
  (Object.keys(m) as K[]).forEach(k => { out[k] = { label: labels[k], ...m[k] }; });
  return out;
}

export interface MotionMeta {
  /** Accessible name (aria-label / <title>). */
  label: string;
  /** The real event that starts it: switch to it when this happens, never on a timer. */
  use: string;
  /** What moves, in the kit's grammar. */
  motion: string;
}

export const ICON_META: Record<IconState, MotionMeta & { group: 'presence' | 'voice' | 'work' | 'reply' | 'outcome' }> = /* @__PURE__ */ withLabels(ICON_LABELS, {
  idle: { group: 'presence', use: 'Nothing is pending', motion: 'The still mark. The engine stops.' },
  connecting: { group: 'presence', use: 'A voice call, kiosk or chat session is opening', motion: 'The rails plug into the core one by one, clockwise, while the core’s empty centre swells and settles.' },
  listening: { group: 'voice', use: 'The microphone is open (pass the MediaStream as level)', motion: 'The user’s voice pours in along their rail (left) from its tip toward the core, as far as it is loud. The core never glows.' },
  thinking: { group: 'work', use: 'The model is reasoning, before any tool or search', motion: 'The core turns without stopping, quickening and easing on each quarter; each corner brushes the rail it passes.' },
  searching: { group: 'work', use: 'Retrieval: knowledge base, documents, policies, catalogue', motion: 'A sweep: each rail in turn sends light out of the core to its tip and reaches out with it.' },
  toolCalling: { group: 'work', use: 'An integration is called (SIS, CRM, ERP, LMS, PBX…)', motion: 'A system’s rail docks; the request fills it; it holds; the reply drains back into the core, which takes it in. A different system each call.' },
  writing: { group: 'reply', use: 'A text answer is streaming into the chat', motion: 'Strokes of light leave the core along the answer rail (right) at the uneven cadence of writing.' },
  speaking: { group: 'reply', use: 'EASM’s speech is playing (pass the audio as level)', motion: 'The core glows with the real voice; the voice runs out along the answer rail as far as it is loud.' },
  awaiting: { group: 'reply', use: 'EASM has asked for a confirmation, a choice or a missing detail', motion: 'The user’s rail stays lit and the whole mark breathes slowly: over to you.' },
  done: { group: 'outcome', use: 'A task finished (booked, sent, updated)', motion: 'Plays once: light fills every rail round the circle, drains into the core, one beat, then the still mark.' },
  error: { group: 'outcome', use: 'A task failed or a system did not answer', motion: 'Plays once: a request falls back halfway, its rail comes away, the core empties and fills again, then the still mark.' },
  offline: { group: 'presence', use: 'There is no connection to EASM', motion: 'Still: the core is empty and the rails fall back.' },
});

export const WAVE_META: Record<WaveMode, MotionMeta> = /* @__PURE__ */ withLabels(WAVE_LABELS, {
  idle: { use: 'The voice channel exists but nothing is moving (mic closed, nothing playing)', motion: 'A still row of dots.' },
  loading: { use: 'A voice session or audio is being prepared', motion: 'One crest crosses the dots left to right, each swelling into a short pill as it passes; then the row rests.' },
  listening: { use: 'The microphone is open (pass the MediaStream as level)', motion: 'The user’s voice, tallest in the middle and rippling outward; in silence the dots breathe.' },
  speaking: { use: 'EASM’s speech is playing (pass the audio as level)', motion: 'EASM’s voice in the same shape; without a level, the EASM voice’s own rhythm.' },
});

export const DOTS_META: Record<DotsVariant, MotionMeta> = /* @__PURE__ */ withLabels(DOTS_LABELS, {
  typing: { use: 'EASM is writing an answer', motion: 'A wave runs left to right: each dot rises and swells in turn, then all rest.' },
  searching: { use: 'EASM is looking through sources', motion: 'A highlight scans 1 → 2 → 3 → 2 → 1, lingering at the ends as it turns.' },
  thinking: { use: 'EASM is reasoning', motion: 'Slow swells, one dot after another; nothing moves position.' },
});
