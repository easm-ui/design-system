// Empty-state illustrations (demand list C-X-18, wave 4d, 2026-10-29): one small scene per reason a place is empty,
// so the 123 empty states say why at a glance. Calm and two-tone: a line in the scene's colour over its tint, on a
// white ground, at the icons' line weight. Nothing moves. The first-run scenes wear their dashboard's accent.
import type { ReactElement, SVGAttributes } from 'react';
import { cx } from './shared';

export const emptyIllustrationNames = [
  'nothing-yet', 'all-done', 'no-results', 'no-access', 'not-set-up', 'offline', 'error', 'coming-soon',
  'no-conversations', 'no-data', 'no-files', 'start-support', 'start-knowledge', 'start-marketing', 'start-automation', 'start-forms',
] as const;
export type EmptyIllustrationName = (typeof emptyIllustrationNames)[number];

const T = 'var(--_ill-tint)', S = 'var(--easm-ui-surface)', G = 'var(--easm-ui-track)';
const ground = <ellipse cx="80" cy="106" rx="54" ry="6" fill={G} stroke="none" />;
const spark = (x: number, y: number, r = 6) => <path d={`M${x} ${y - r}Q${x + r * .15} ${y - r * .15} ${x + r} ${y}Q${x + r * .15} ${y + r * .15} ${x} ${y + r}Q${x - r * .15} ${y + r * .15} ${x - r} ${y}Q${x - r * .15} ${y - r * .15} ${x} ${y - r}Z`} fill="var(--_ill-line)" stroke="none" />;

const scenes: Record<EmptyIllustrationName, ReactElement> = {
  'nothing-yet': <>{ground}
    <path d="M50 58l10-16h40l10 16" />
    <path d="M42 58h76l-8 34a6 6 0 0 1-6 5H56a6 6 0 0 1-6-5Z" fill={T} />
    <path d="M42 58h22a16 6 0 0 0 32 0h22" fill={S} />
    {spark(108, 30, 5)}</>,
  'all-done': <>{ground}
    <path d="M42 66h76l-8 26a6 6 0 0 1-6 5H56a6 6 0 0 1-6-5Z" fill={T} />
    <path d="M42 66h22a16 6 0 0 0 32 0h22" fill={S} />
    <circle cx="80" cy="38" r="16" fill={T} />
    <path d="m72 38 6 6 11-12" /></>,
  'no-results': <>{ground}
    <rect x="34" y="28" width="72" height="62" rx="8" fill={S} />
    <path d="M46 44h40M46 56h28M46 68h34" stroke={G} />
    <circle cx="96" cy="66" r="18" fill={T} />
    <path d="m109 79 14 14" strokeWidth="4" />
    <path d="M90 66h12" /></>,
  'no-access': <>{ground}
    <path d="M66 54V42a14 14 0 0 1 28 0v12" />
    <rect x="54" y="54" width="52" height="42" rx="10" fill={T} />
    <circle cx="80" cy="71" r="5" fill="var(--_ill-line)" stroke="none" />
    <path d="M80 75v9" strokeWidth="4" /></>,
  'not-set-up': <>{ground}
    <rect x="94" y="46" width="32" height="44" rx="9" fill={T} />
    <path d="M104 62v8M116 62v8" strokeWidth="3.5" />
    <rect x="44" y="56" width="28" height="24" rx="7" fill={S} />
    <path d="M72 62h9M72 74h9" />
    <path d="M44 68H30a6 6 0 0 0-6 6v10" />
    <path d="M85 50l3-6M88 58h6M85 66l3 6" stroke="var(--easm-ui-text-secondary)" /></>,
  offline: <>{ground}
    <path d="M52 86a18 18 0 0 1-1-36 26 26 0 0 1 50-6 20 20 0 0 1 9 39 13 13 0 0 1-3 .3Z" fill={T} />
    <path d="m48 36 64 60" strokeWidth="3" />
    <path d="m52 34 64 60" stroke={S} strokeWidth="3" /></>,
  error: <>{ground}
    <path d="M56 24h34l18 18v50a6 6 0 0 1-6 6H56a6 6 0 0 1-6-6V30a6 6 0 0 1 6-6Z" fill={S} />
    <path d="M90 24v18h18" />
    <path d="M60 50h24M60 62h32M60 74h18" stroke={G} />
    <circle cx="104" cy="84" r="15" fill={T} />
    <path d="M104 77v8" strokeWidth="3" /><circle cx="104" cy="91" r="1.8" fill="var(--_ill-line)" stroke="none" /></>,
  'coming-soon': <>{ground}
    <path d="M60 78h40l-5 22H65Z" fill={T} />
    <path d="M58 78h44" />
    <path d="M80 78V54" />
    <path d="M80 64c-12 0-19-7-19-17 12 0 19 7 19 17Z" fill={T} />
    <path d="M80 58c0-11 7-18 19-18 0 11-7 18-19 18Z" fill={T} />
    {spark(110, 32, 5)}</>,
  'no-conversations': <>{ground}
    <path d="M40 36h48a8 8 0 0 1 8 8v24a8 8 0 0 1-8 8H60l-12 10v-10h-8a8 8 0 0 1-8-8V44a8 8 0 0 1 8-8Z" fill={T} />
    <path d="M46 50h32M46 60h20" stroke={S} strokeWidth="3" />
    <path d="M100 56h18a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8h-4v8l-10-8h-4a8 8 0 0 1-8-8" fill={S} /></>,
  'no-data': <>{ground}
    <path d="M38 26v66h88" />
    <path d="M50 80h66" strokeDasharray="0 9" strokeWidth="4" opacity=".35" />
    <rect x="96" y="30" width="26" height="18" rx="5" fill={T} />
    <path d="M102 39h14" /></>,
  'no-files': <>{ground}
    <path d="M38 40h24l8 8h48a6 6 0 0 1 6 6v36a6 6 0 0 1-6 6H38a6 6 0 0 1-6-6V46a6 6 0 0 1 6-6Z" fill={T} />
    <path d="M32 58h92" stroke={S} strokeWidth="3" />
    {spark(110, 30, 5)}</>,
  'start-support': <>{ground}
    <path d="M66 28h46a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8h-4v10l-12-10H66a8 8 0 0 1-8-8V36a8 8 0 0 1 8-8Z" fill={S} />
    {spark(89, 46, 7)}
    <path d="M40 54h40a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8H58l-12 10V90h-6a8 8 0 0 1-8-8V62a8 8 0 0 1 8-8Z" fill={T} />
    <path d="M44 68h28M44 78h18" stroke={S} strokeWidth="3" /></>,
  'start-knowledge': <>{ground}
    <path d="M80 50c-12-8-28-9-42-5v46c14-4 30-3 42 5 12-8 28-9 42-5V45c-14-4-30-3-42 5Z" fill={T} />
    <path d="M80 50v46" />
    <path d="M48 60h20M48 70h16M92 60h20M92 70h14" stroke={S} strokeWidth="3" />
    {spark(80, 28, 7)}</>,
  'start-marketing': <>{ground}
    <circle cx="80" cy="62" r="32" fill={T} />
    <circle cx="80" cy="62" r="20" fill={S} />
    <circle cx="80" cy="62" r="8" fill={T} />
    <path d="M80 62l30-30M104 30h8v8" strokeWidth="3" /></>,
  'start-automation': <>{ground}
    <path d="M80 34v12M80 78v12M52 62h12M96 62h12" />
    <circle cx="80" cy="28" r="7" fill={S} /><circle cx="80" cy="96" r="7" fill={S} />
    <circle cx="44" cy="62" r="7" fill={S} /><circle cx="116" cy="62" r="7" fill={S} />
    <rect x="64" y="46" width="32" height="32" rx="9" fill={T} />
    <circle cx="80" cy="62" r="5" fill="var(--_ill-line)" stroke="none" /></>,
  'start-forms': <>{ground}
    <rect x="50" y="22" width="60" height="78" rx="9" fill={S} />
    <circle cx="64" cy="42" r="5" /><path d="M76 42h22" stroke={G} strokeWidth="3" />
    <circle cx="64" cy="58" r="5" fill="var(--_ill-line)" /><path d="M76 58h22" stroke={G} strokeWidth="3" />
    <rect x="58" y="74" width="44" height="12" rx="6" fill={T} /></>,
};
const tones: Partial<Record<EmptyIllustrationName, string>> = {
  error: 'error', 'start-support': 'support', 'start-knowledge': 'knowledge', 'start-marketing': 'marketing', 'start-automation': 'automation', 'start-forms': 'forms',
};

export interface EmptyIllustrationProps extends Omit<SVGAttributes<SVGSVGElement>, 'name'> {
  name: EmptyIllustrationName;
  /** Width in px; the scene is 4:3. */
  size?: number;
}
/** A small scene for an empty place: why it is empty (nothing yet, all done, no results, no access, not set up,
 *  offline, an error, coming soon) or what a dashboard is for on its first run. Decorative: the words beside it
 *  carry the meaning, so it is hidden from screen readers. */
export function EmptyIllustration({ name, size = 160, className, ...props }: EmptyIllustrationProps) {
  return <svg {...props} viewBox="0 0 160 120" width={size} height={size * .75} aria-hidden="true" focusable="false"
    className={cx('easm-ui easm-ui-illustration', className)} data-scene={name} data-tone={tones[name]}
    fill="none" stroke="var(--_ill-line)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    {scenes[name]}
  </svg>;
}
