import type { IconName } from './registry';
import { getIconMotion } from './motion-recipes';

const duration = (name: IconName, fallback: number) => getIconMotion(name)?.durationMs ?? fallback;

/** Motion communicates an active process or an acknowledged event; it is opt-in.
 * `label` is a suggested accessible name for the icon (pass it as AnimatedIcon's `label` when nothing else
 * names the event); AnimatedIcon does not apply it on its own. `durationMs` matches the rendered sequence. */
export const motionPresets = {
  loading: { icon: 'spinner', effect: 'spin', durationMs: 900, loopAllowed: true, label: 'Loading', use: 'While work is pending.' },
  sync: { icon: 'sync', effect: 'sync', durationMs: duration('sync', 900), loopAllowed: false, label: 'Synchronize', use: 'Once when synchronization starts or completes.' },
  confirm: { icon: 'check-circle', effect: 'confirm', durationMs: duration('check-circle', 760), loopAllowed: false, label: 'Confirmed', use: 'Once after successful completion.' },
  send: { icon: 'send', effect: 'send', durationMs: duration('send', 680), loopAllowed: false, label: 'Send', use: 'Once when a send action is acknowledged.' },
  notify: { icon: 'notification', effect: 'notify', durationMs: duration('notification', 900), loopAllowed: false, label: 'Notification', use: 'Once when a new notification arrives.' },
  listen: { icon: 'voice', effect: 'listen', durationMs: duration('voice', 1500), loopAllowed: true, label: 'Listening', use: 'While the microphone is actively listening; illustrative movement is not an audio level meter.' },
  wave: { icon: 'audio-waveform', effect: 'wave', durationMs: duration('audio-waveform', 1500), loopAllowed: true, label: 'Audio activity', use: 'While audio is active; use real amplitude data for measured levels.' },
  settle: { icon: 'save', effect: 'settle', durationMs: duration('save', 740), loopAllowed: false, label: 'Saved', use: 'Once after saving is acknowledged.' },
} as const satisfies Record<string, { icon: IconName; effect: string; durationMs: number; loopAllowed: boolean; label: string; use: string }>;

export type MotionPreset = keyof typeof motionPresets;
