// WCAG 2.2 AA contrast checks for every foreground/background pairing the components use. `ratio` is the one
// implementation of the WCAG formula; other checkers should import it rather than copy it.
// Text needs 4.5:1 (1.4.3). Control borders, icons and the focus ring need 3:1 (1.4.11, 2.4.13).
// Disabled text is exempt under WCAG and is deliberately not listed.

const TEXT = 4.5;
const NON_TEXT = 3;

export const pairs = [
  // Primary actions in every state (filled with the bright primary-fill)
  ['on-primary-fill', 'primary-fill', TEXT, 'Primary button label'],
  ['on-primary-fill', 'primary-fill-hover', TEXT, 'Primary button label, hover'],
  ['on-primary-fill', 'primary-fill-pressed', TEXT, 'Primary button label, pressed'],
  ['on-primary-fill', 'primary', TEXT, 'Checked control and selected-state label'],
  // Destructive actions
  ['on-danger', 'danger', TEXT, 'Destructive button label'],
  ['on-danger', 'danger-hover', TEXT, 'Destructive button label, hover'],
  // Orange, for attention: a count or a highlight (never a control)
  ['on-orange-fill', 'orange-fill', TEXT, 'Notification count'],
  ['orange-ink', 'orange-surface', TEXT, 'Sidebar count on its orange tint'],
  ['orange-ink', 'surface', TEXT, 'Orange text on a card'],
  // Body text on every surface it sits on
  ['text', 'background', TEXT, 'Body text on page'],
  ['text', 'surface', TEXT, 'Body text on card'],
  ['text', 'surface-hover', TEXT, 'Text on hovered control'],
  ['text', 'surface-pressed', TEXT, 'Text on pressed control'],
  ['text', 'primary-surface', TEXT, 'Text on selected row'],
  ['text-secondary', 'background', TEXT, 'Helper text on page'],
  ['text-secondary', 'surface', TEXT, 'Helper text on card'],
  ['text-secondary', 'surface-hover', TEXT, 'Helper text on hovered row'],
  ['placeholder', 'surface', TEXT, 'Placeholder in input'],
  ['text', 'track', TEXT, 'Text on a honey track or chip'],
  ['text-secondary', 'track', TEXT, 'Unselected tab on its track'],
  ['text', 'float', TEXT, 'Option in a grey panel'],
  ['text', 'float-hover', TEXT, 'Highlighted option in a grey panel'],
  ['text-secondary', 'float', TEXT, 'Secondary text in a grey panel'],
  ['text-secondary', 'float-hover', TEXT, 'Secondary text on a highlighted option'],
  ['placeholder', 'float', TEXT, 'Placeholder in a field inside a grey panel'],
  // Coloured text in a grey panel: primary and danger are under 4.5:1 on float, so these use the hover shades.
  ['primary-hover', 'float', TEXT, 'Blue text and subtle actions in a grey panel'],
  ['primary-hover', 'float-hover', TEXT, 'Blue text on a highlighted option'],
  ['danger-hover', 'float', TEXT, 'Destructive menu row in a grey panel'],
  ['danger-hover', 'danger-highlight', TEXT, 'Highlighted destructive menu row'],
  ['text', 'row-hover', TEXT, 'Text in a hovered table row'],
  ['text-secondary', 'row-hover', TEXT, 'Secondary text in a hovered table row'],
  ['on-ink', 'ink-panel', TEXT, 'Toast and primary menu text'],
  ['on-ink', 'ink-panel-hover', TEXT, 'Highlighted primary menu item'],
  ['on-ink-muted', 'ink-panel', TEXT, 'Toast description'],
  ['on-ink-strong', 'ink-panel-hover', TEXT, 'Hovered control on a dark panel'],
  ['on-ink-brand', 'ink-panel', NON_TEXT, 'Brand toast icon'],
  ['on-ink-success', 'ink-panel', NON_TEXT, 'Success toast icon'],
  ['on-ink-warning', 'ink-panel', NON_TEXT, 'Warning toast icon'],
  ['on-ink-danger', 'ink-panel', NON_TEXT, 'Danger toast icon'],
  // Workflow roles (2026-10-28): the AI role, the lead-stage ramp and presence marks.
  ['ai-ink', 'ai-surface', TEXT, 'AI role text on its fill'],
  ['ai-ink', 'surface', TEXT, 'AI role text on a card'],
  ['ai', 'surface', NON_TEXT, 'AI role mark on a card'],
  ['text', 'stage-1', TEXT, 'Lead stage 1 chip'],
  ['text', 'stage-2', TEXT, 'Lead stage 2 chip'],
  ['text', 'stage-3', TEXT, 'Lead stage 3 chip'],
  ['surface', 'stage-4', TEXT, 'Lead stage 4 chip (white text)'],
  ['surface', 'stage-5', TEXT, 'Lead stage 5 chip (white text)'],
  ['text-secondary', 'stage-closed', TEXT, 'Closed lead stage chip'],
  ['danger-hover', 'stage-stopped', TEXT, 'Do-not-contact stage chip'],
  ['presence-idle', 'surface', NON_TEXT, 'Idle presence ring'],
  ['presence-call', 'surface', NON_TEXT, 'On-a-call presence dot'],
  ['text', 'badge-neutral', TEXT, 'Neutral badge'],
  ['text', 'badge-brand', TEXT, 'Brand badge'],
  ['text', 'badge-success', TEXT, 'Success badge'],
  ['text', 'badge-warning', TEXT, 'Warning badge'],
  ['text', 'badge-danger', TEXT, 'Danger badge'],
  ['icon-success', 'badge-success', NON_TEXT, 'Status icon on a success badge'],
  ['icon-warning', 'badge-warning', NON_TEXT, 'Status icon on a warning badge'],
  ['icon-danger', 'badge-danger', NON_TEXT, 'Status icon on a danger badge'],
  ['avatar-ink', 'avatar', TEXT, 'Avatar initials'],
  // Presence dots sit on a ring of the surface around the avatar: white, or the faint grey of a UserChip.
  ['presence-online', 'surface', NON_TEXT, 'Online dot on white'],
  ['presence-online', 'surface-hover', NON_TEXT, 'Online dot in a user chip'],
  ['presence-away', 'surface', NON_TEXT, 'Away dot on white'],
  ['presence-away', 'surface-hover', NON_TEXT, 'Away dot in a user chip'],
  ['presence-offline', 'surface', NON_TEXT, 'Offline ring on white'],
  ['presence-offline', 'surface-hover', NON_TEXT, 'Offline ring in a user chip'],
  // Links and selected states
  ['primary', 'surface', TEXT, 'Link on card'],
  ['primary', 'background', TEXT, 'Link on page'],
  ['primary', 'primary-surface', TEXT, 'Selected label on tint'],
  // Status text on its own tint and on plain surface
  ['success', 'success-surface', TEXT, 'Success alert text'],
  ['success', 'surface', TEXT, 'Success text'],
  ['warning', 'warning-surface', TEXT, 'Warning alert text'],
  ['warning', 'surface', TEXT, 'Warning text'],
  ['danger', 'danger-surface', TEXT, 'Error alert text'],
  ['danger', 'surface', TEXT, 'Error text'],
  // Brand
  ['text', 'signature', TEXT, 'Dark text on orange'],
  ['surface', 'dark', TEXT, 'White text on marketing dark'],
  ['orange-ink', 'surface', TEXT, 'Orange text on white'],
  ['orange-ink', 'paper', TEXT, 'Orange text on paper'],
  // Chart palette: data marks on card and page, text on its tint and on card
  ['chart-plum', 'surface', NON_TEXT, 'Plum mark on card'],
  ['chart-plum', 'background', NON_TEXT, 'Plum mark on page'],
  ['chart-plum-ink', 'chart-plum-tint', TEXT, 'Plum text on its tint'],
  ['chart-plum-ink', 'surface', TEXT, 'Plum text on card'],
  ['chart-blue', 'surface', NON_TEXT, 'Blue data mark on card'],
  ['chart-blue', 'background', NON_TEXT, 'Blue data mark on page'],
  ['chart-blue-ink', 'chart-blue-tint', TEXT, 'Blue text on its tint'],
  ['chart-blue-ink', 'surface', TEXT, 'Blue text on card'],
  ['chart-violet', 'surface', NON_TEXT, 'Violet data mark on card'],
  ['chart-violet', 'background', NON_TEXT, 'Violet data mark on page'],
  ['chart-violet-ink', 'chart-violet-tint', TEXT, 'Violet text on its tint'],
  ['chart-violet-ink', 'surface', TEXT, 'Violet text on card'],
  ['chart-teal', 'surface', NON_TEXT, 'Teal data mark on card'],
  ['chart-teal', 'background', NON_TEXT, 'Teal data mark on page'],
  ['chart-teal-ink', 'chart-teal-tint', TEXT, 'Teal text on its tint'],
  ['chart-teal-ink', 'surface', TEXT, 'Teal text on card'],
  ['chart-green', 'surface', NON_TEXT, 'Green data mark on card'],
  ['chart-green', 'background', NON_TEXT, 'Green data mark on page'],
  ['chart-green-ink', 'chart-green-tint', TEXT, 'Green text on its tint'],
  ['chart-green-ink', 'surface', TEXT, 'Green text on card'],
  ['chart-amber', 'surface', NON_TEXT, 'Amber data mark on card'],
  ['chart-amber', 'background', NON_TEXT, 'Amber data mark on page'],
  ['chart-amber-ink', 'chart-amber-tint', TEXT, 'Amber text on its tint'],
  ['chart-amber-ink', 'surface', TEXT, 'Amber text on card'],
  ['chart-coral', 'surface', NON_TEXT, 'Coral data mark on card'],
  ['chart-coral', 'background', NON_TEXT, 'Coral data mark on page'],
  ['chart-coral-ink', 'chart-coral-tint', TEXT, 'Coral text on its tint'],
  ['chart-coral-ink', 'surface', TEXT, 'Coral text on card'],
  ['chart-sky', 'surface', NON_TEXT, 'Sky data mark on card'],
  ['chart-sky', 'background', NON_TEXT, 'Sky data mark on page'],
  ['chart-sky-ink', 'chart-sky-tint', TEXT, 'Sky text on its tint'],
  ['chart-sky-ink', 'surface', TEXT, 'Sky text on card'],
  ['chart-honey', 'surface', NON_TEXT, 'Grey data mark on card'],
  ['chart-honey', 'background', NON_TEXT, 'Grey data mark on page'],
  ['chart-honey-ink', 'chart-honey-tint', TEXT, 'Grey text on its tint'],
  ['chart-honey-ink', 'surface', TEXT, 'Grey text on card'],
  ['chart-indigo', 'surface', NON_TEXT, 'Indigo mark on card'],
  ['chart-indigo', 'background', NON_TEXT, 'Indigo mark on page'],
  ['chart-indigo-ink', 'chart-indigo-tint', TEXT, 'Indigo text on its tint'],
  ['chart-indigo-ink', 'surface', TEXT, 'Indigo text on card'],
  ['chart-rose', 'surface', NON_TEXT, 'Rose mark on card'],
  ['chart-rose', 'background', NON_TEXT, 'Rose mark on page'],
  ['chart-rose-ink', 'chart-rose-tint', TEXT, 'Rose text on its tint'],
  ['chart-rose-ink', 'surface', TEXT, 'Rose text on card'],
  ['chart-orange', 'surface', NON_TEXT, 'Orange mark on card'],
  ['chart-orange', 'background', NON_TEXT, 'Orange mark on page'],
  ['chart-orange-ink', 'chart-orange-tint', TEXT, 'Orange text on its tint'],
  ['chart-orange-ink', 'surface', TEXT, 'Orange text on card'],
  ['chart-lime', 'surface', NON_TEXT, 'Lime mark on card'],
  ['chart-lime', 'background', NON_TEXT, 'Lime mark on page'],
  ['chart-lime-ink', 'chart-lime-tint', TEXT, 'Lime text on its tint'],
  ['chart-lime-ink', 'surface', TEXT, 'Lime text on card'],
  // Non-text: control boundaries and focus
  ['border', 'surface', NON_TEXT, 'Input border on card'],
  ['border', 'background', NON_TEXT, 'Input border on page'],
  ['border-hover', 'surface', NON_TEXT, 'Input border, hover'],
  ['primary-fill', 'surface', NON_TEXT, 'Focus edge on card'],
  ['primary-fill', 'background', NON_TEXT, 'Focus edge on page'],
  ['border', 'track', NON_TEXT, 'Field outline on a honey surface'],
  ['border-hover', 'float', NON_TEXT, 'Checkbox and field outline in a grey panel'],
  ['primary-fill', 'float', NON_TEXT, 'Focus edge in a grey panel'],
];

// Pairs that fail today and are awaiting a palette decision. They print as warnings instead of
// failing the build. Remove an entry once the colour is fixed; never add one to silence a new failure.
export const known = new Map([]);

const channel = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = hex => {
  const [r, g, b] = hex.slice(1).match(/../g).map(c => channel(parseInt(c, 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/** Returns failing pairs as messages: `failures` break the build, `warnings` are known and pending. */
export function checkContrast(tokens) {
  const color = name => {
    const value = tokens.color?.[name]?.$value;
    if (!/^#[0-9a-f]{6}$/i.test(value ?? '')) throw new Error(`Contrast check: color.${name} is not a 6-digit hex value`);
    return value;
  };
  const failing = pairs
    .map(([fg, bg, min, role]) => ({ fg, bg, min, role, value: ratio(color(fg), color(bg)) }))
    .filter(pair => pair.value < pair.min);
  const message = ({ fg, bg, min, role, value }) => `${role}: ${fg} on ${bg} is ${value.toFixed(2)}:1, needs ${min}:1`;
  const isKnown = pair => known.has(`${pair.fg}|${pair.bg}`);
  const fixed = [...known.keys()].filter(key => !failing.some(pair => `${pair.fg}|${pair.bg}` === key));
  return {
    failures: [
      ...failing.filter(pair => !isKnown(pair)).map(message),
      ...fixed.map(key => `${key.replace('|', ' on ')} now passes; remove it from the known list in tokens/contrast.mjs`),
    ],
    warnings: failing.filter(isKnown).map(pair => `${message(pair)} (known: ${known.get(`${pair.fg}|${pair.bg}`)})`),
  };
}
