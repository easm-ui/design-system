// Colour roles (demand list CLR-04, 05, 08, 09, 10, 13, 14 and the freshness and write-effect asks, 2026-10-29).
// A role is a meaning that recurs across dashboards (a hot lead, a withdrawn consent, a stale page) and gets one
// colour everywhere. Each is a mark/tint/ink triple in the tokens (--easm-ui-temperature-hot, -tint, -ink) pointing
// at a palette hue, so its contrast is the hue's, already checked. None of them is the success green or the danger
// red: a cold lead, a negative call or a withdrawn consent is a fact to read, not a fault to fix.
import type { CSSProperties } from 'react';
import type { ChartTone } from './palette';
import { defineStatuses } from './workflow';

/** Which hue each role takes. tokens/easm.tokens.json says the same; test/palette.cjs keeps the two equal. */
export const colourRoles = {
  temperature: { hot: 'rose', warm: 'amber', cold: 'sky' },
  sentiment: { positive: 'teal', neutral: 'honey', negative: 'plum', mixed: 'indigo' },
  sensitivity: { public: 'honey', personal: 'sky', restricted: 'indigo' },
  consent: { granted: 'teal', withdrawn: 'plum', unknown: 'honey', suppressed: 'indigo', erased: 'honey' },
  priority: { low: 'honey', normal: 'sky', high: 'amber', urgent: 'rose' },
  delivery: { queued: 'honey', accepted: 'sky', matched: 'teal', suppressed: 'indigo', failed: 'coral' },
  freshness: { fresh: 'teal', due: 'amber', stale: 'honey' },
  effect: { read: 'sky', write: 'amber' },
} as const satisfies Record<string, Record<string, ChartTone>>;

export type ColourRoleFamily = keyof typeof colourRoles;
type RolesOf<F extends ColourRoleFamily> = `${F}-${Extract<keyof (typeof colourRoles)[F], string>}`;
/** A role by name (`temperature-hot`), or `attention`, the one "Needs you" accent (CLR-14, the signature orange). */
export type ColourRole = { [F in ColourRoleFamily]: RolesOf<F> }[ColourRoleFamily] | 'attention';

export const colourRoleNames: readonly ColourRole[] = [
  ...(Object.keys(colourRoles) as ColourRoleFamily[]).flatMap(family => Object.keys(colourRoles[family]).map(name => `${family}-${name}` as ColourRole)),
  'attention',
];

/** The hue behind a role, for parts that take a palette tone (a chart series, a Tag, a ToneIcon). */
export function roleTone(role: ColourRole): ChartTone {
  if (role === 'attention') return 'orange';
  const [family, ...rest] = role.split('-') as [ColourRoleFamily, ...string[]];
  return (colourRoles[family] as Record<string, ChartTone>)[rest.join('-')];
}

/** The role's mark, tint and ink as the local properties chart parts and toned elements read. */
export const roleStyle = (role: ColourRole) => ({
  '--easm-chart-tone': `var(--easm-ui-${role})`,
  '--easm-chart-tone-tint': `var(--easm-ui-${role}-tint)`,
  '--easm-chart-tone-ink': `var(--easm-ui-${role}-ink)`,
}) as CSSProperties;

/* ------------------------------------------------------------------ Vocabularies for StatusChip and Timeline */

/** How close a lead is to applying (CLR-04). A thermometer at three levels, so hot and cold differ by sign too. */
export const temperatureStatuses = defineStatuses({
  hot: { label: 'Hot', glyph: 'temperature-hot', tone: 'temperature-hot', description: 'Likely to apply soon' },
  warm: { label: 'Warm', glyph: 'temperature-warm', tone: 'temperature-warm', description: 'Interested, not yet moving' },
  cold: { label: 'Cold', glyph: 'temperature-cold', tone: 'temperature-cold', description: 'No recent interest' },
});

/** How a conversation or call felt (CLR-05). Never green for good and red for bad: a mood is not a result. */
export const sentimentStatuses = defineStatuses({
  positive: { label: 'Positive', glyph: 'sentiment-positive', tone: 'sentiment-positive' },
  neutral: { label: 'Neutral', glyph: 'sentiment-neutral', tone: 'sentiment-neutral' },
  negative: { label: 'Negative', glyph: 'sentiment-negative', tone: 'sentiment-negative' },
  mixed: { label: 'Mixed', glyph: 'sentiment-mixed', tone: 'sentiment-mixed', description: 'Moved between moods' },
});

/** How sensitive an answer is (CLR-09, forms-core's classification). Restricted reads as guarded, not as an error. */
export const sensitivityStatuses = defineStatuses({
  public: { label: 'Public', glyph: 'sensitivity-public', tone: 'sensitivity-public', description: 'Fine to show' },
  personal: { label: 'Personal', glyph: 'sensitivity-personal', tone: 'sensitivity-personal', description: 'About a person' },
  restricted: { label: 'Restricted', glyph: 'sensitivity-restricted', tone: 'sensitivity-restricted', description: 'Sealed; read only through Reveal' },
});

/** Where a person's consent stands (CLR-10): the shield and its outcome. */
export const consentStatuses = defineStatuses({
  granted: { label: 'Consent given', glyph: 'consent-granted', tone: 'consent-granted' },
  withdrawn: { label: 'Withdrawn', glyph: 'consent-withdrawn', tone: 'consent-withdrawn', description: 'Honoured from the moment it was withdrawn' },
  unknown: { label: 'Not known', glyph: 'consent-unknown', tone: 'consent-unknown', description: 'Never asked or never answered' },
  suppressed: { label: 'Suppressed', glyph: 'consent-suppressed', tone: 'consent-suppressed', description: 'Held back on purpose' },
  erased: { label: 'Erased', glyph: 'consent-erased', tone: 'consent-erased', description: 'The person was erased; the record of it remains' },
});

/** How urgent a piece of work is (CLR-13). Signal bars, as many lit as it is urgent; never the SLA's red. */
export const priorityStatuses = defineStatuses({
  low: { label: 'Low', glyph: 'priority-low', tone: 'priority-low' },
  normal: { label: 'Normal', glyph: 'priority-normal', tone: 'priority-normal' },
  high: { label: 'High', glyph: 'priority-high', tone: 'priority-high' },
  urgent: { label: 'Urgent', glyph: 'priority-urgent', tone: 'priority-urgent' },
});

/** A conversion, receipt or webhook on its way to another system (CLR-08): one state machine everywhere. */
export const deliveryStatuses = defineStatuses({
  queued: { label: 'Queued', glyph: 'delivery-queued', tone: 'delivery-queued', description: 'Waiting its turn' },
  accepted: { label: 'Accepted', glyph: 'delivery-accepted', tone: 'delivery-accepted', description: 'The provider took the request, nothing more' },
  matched: { label: 'Matched', glyph: 'delivery-matched', tone: 'delivery-matched', description: 'The provider tied it to a person' },
  suppressed: { label: 'Held back', glyph: 'delivery-suppressed', tone: 'delivery-suppressed', description: 'No consent at the moment of sending' },
  'dead-letter': { label: 'Not delivered', glyph: 'delivery-dead-letter', tone: 'delivery-failed', description: 'Will not be retried; needs a person' },
});

/** How current a page is against its review schedule. A stale page asks for a review, it is not an error. */
export const freshnessStatuses = defineStatuses({
  fresh: { label: 'Fresh', glyph: 'freshness-fresh', tone: 'freshness-fresh', description: 'Reviewed on schedule' },
  due: { label: 'Review due', glyph: 'freshness-due', tone: 'freshness-due', description: 'Its review falls due soon' },
  stale: { label: 'Stale', glyph: 'freshness-stale', tone: 'freshness-stale', description: 'Past its review' },
});

/** Whether a tool only reads or changes data: writing is calm but unmistakable, never danger red. */
export const toolEffectStatuses = defineStatuses({
  read: { label: 'Reads only', glyph: 'effect-read', tone: 'effect-read' },
  write: { label: 'Changes data', glyph: 'effect-write', tone: 'effect-write', description: 'Runs as an action: verified people only, recorded' },
});

/** "Needs you" (CLR-14): the one attention chip the inbox, Forms Home and the CIMS review queue share. */
export const attentionStatuses = defineStatuses({
  'needs-you': { label: 'Needs you', glyph: 'alert-circle', tone: 'attention' },
});
