# EASM One Core — foundations

The component library uses Enterprise Blue on the white theme, with the approved EASM icon geometry. It exports typed React components from `@easm-ui/ui`. Import `@easm-ui/ui/styles.css` once at the application boundary. The stylesheet owns `--easm-ui-*`; it does not replace existing `--easm-*`, tenant/widget or master-portal variables.

Every value on this page comes from `tokens/easm.tokens.json`. The tables between the `generated` markers are written by `pnpm tokens` and checked by `pnpm tokens:check`; edit the JSON, never the tables.

The library is a reusable package and review catalog. Existing screens need a separate component-by-component migration and acceptance check; publishing this library does not recolor or replace those screens automatically.

## Product colors

All names below are actual CSS variables. The `tokens` export uses the corresponding camelCase keys (`tokens.color.primaryFill`). A value marked `(= name)` follows that token: in CSS it is emitted as `var(--easm-ui-name)`.

<!-- generated:colors (pnpm tokens) -->
| Variable | Value | Use |
| --- | --- | --- |
| `--easm-ui-primary` | #2563EB | Enterprise Blue for text and lines: links, selected text, checked controls. Text-safe on white and tints; on the grey float panel use primary-hover (primary is under 4.5:1 there). |
| `--easm-ui-primary-hover` | #1D4FD8 | Hover fill for primary controls, and blue text on the grey float panel. |
| `--easm-ui-primary-pressed` | #1E40AF | Pressed fill for primary-coloured controls. Components use primary-fill-pressed; kept for applications. |
| `--easm-ui-primary-surface` | #EEF4FF | Light blue tint for selected rows, chips and tags. Text on it is primary or text. |
| `--easm-ui-range-fill` | rgb(47 107 235 / 12%) | Days between the two ends of a selected date range: primary-fill at 12%. |
| `--easm-ui-primary-border` | #C9D9FD | Soft blue for icon fills and selected tints. |
| `--easm-ui-primary-fill` | #2F6BEB | Bright Enterprise Blue for filled actions: primary buttons, the active navigation item, the selected date. White text on it. |
| `--easm-ui-primary-fill-hover` | #2563EB | Hover fill for primary-fill. |
| `--easm-ui-primary-fill-pressed` | #1D4FD8 | Pressed fill for primary-fill. |
| `--easm-ui-on-primary-fill` | #FFFFFF | Text and icons on primary-fill in every state (primary buttons, the active navigation item, the selected date). |
| `--easm-ui-on-primary-fill-muted` | rgb(255 255 255 / 22%) | Translucent white for counts and small chips on primary-fill. |
| `--easm-ui-halo` | rgb(47 107 235 / 20%) | Soft focus glow around the solid focus edge: primary-fill at 20%, so it follows primary-fill. |
| `--easm-ui-text` | #101318 | Headings and body text: near-black cool ink. |
| `--easm-ui-text-secondary` | #5E6470 | Helper text, captions and metadata: warm grey. |
| `--easm-ui-text-disabled` | #9AA1AD | Disabled labels only; not for content people must read. |
| `--easm-ui-placeholder` | #69707E | Placeholder text inside inputs. |
| `--easm-ui-background` | #FFFFFF | The page: clean white. |
| `--easm-ui-surface` | #FFFFFF | Cards, inputs, menus and dialogs. |
| `--easm-ui-surface-hover` | #F6F7F9 | Hover state of surface controls; disabled fill. |
| `--easm-ui-surface-pressed` | #ECEEF2 | Pressed state of surface controls. |
| `--easm-ui-surface-disabled` | #F3F4F6 | Fill for disabled controls. |
| `--easm-ui-row-hover` | #F5F7FA | Hovered row in a table on a white card. |
| `--easm-ui-track` | #F1F3F6 | Grey track: tab and segmented-control rails, chips, filled secondary buttons, sidebar cards. |
| `--easm-ui-track-hover` | #E8EBF0 | Hover on a track or grey fill. |
| `--easm-ui-track-pressed` | #DEE2E8 | Pressed on a track; switch track when off. |
| `--easm-ui-switch-hover` | #CDD3DC | Switch track, off, on hover. |
| `--easm-ui-tint-hover` | rgb(16 19 24 / 7%) | Hover wash on a white or grey panel: text at 7%. Rows and options in pickers and lists. |
| `--easm-ui-tint-subtle` | rgb(16 19 24 / 4%) | Faint wash for inactive or outside-range cells: text at 4%. |
| `--easm-ui-float` | #F3F5F8 | Grey panel for menus, dropdowns and popovers that open over white cards. |
| `--easm-ui-float-hover` | #E8ECF2 | Highlighted option inside a grey panel. |
| `--easm-ui-ink-panel` | #121826 | Dark ink panel for toasts and menus opened from a primary action. |
| `--easm-ui-ink-panel-hover` | #232C40 | Highlighted option inside a dark ink panel. |
| `--easm-ui-on-ink` | #F6F7F9 | Text on ink-panel. |
| `--easm-ui-on-ink-muted` | #C4CAD6 | Icons and secondary text on ink-panel. |
| `--easm-ui-on-ink-strong` | #FFFFFF | Strongest text and icons on ink-panel: a hovered control. |
| `--easm-ui-on-ink-brand` | #9DBBFF | Brand status icon on ink-panel (toasts). |
| `--easm-ui-on-ink-success` | #6FD49B | Success status icon on ink-panel (toasts). |
| `--easm-ui-on-ink-warning` | #F5C451 | Warning status icon on ink-panel (toasts). |
| `--easm-ui-on-ink-danger` | #FF8F85 | Danger status icon on ink-panel (toasts). |
| `--easm-ui-border` | #858D9B | Grey outline for fields, dropdowns, checkboxes and chart axes. Meets 3:1 on white and the page. |
| `--easm-ui-border-subtle` | #E8EAEE | Inner dividers and table lines. Decorative only. |
| `--easm-ui-border-hover` | #6F7888 | Field outline on hover. |
| `--easm-ui-success` | #0C8138 | Success text and icons on success-surface or surface. Pair with a word or icon. |
| `--easm-ui-success-surface` | #E6F8EC | Success badge and alert fill. |
| `--easm-ui-danger` | #D92644 | Errors and destructive buttons (white text on it). On the grey float panel, red text uses danger-hover. |
| `--easm-ui-danger-hover` | #B81D38 | Hover fill for destructive buttons, and red text on the grey float panel. |
| `--easm-ui-danger-surface` | #FFF5F6 | Error badge and alert fill. |
| `--easm-ui-on-danger` | #FFFFFF (= on-primary-fill) | Text and icons on danger and danger-hover fills (destructive buttons). |
| `--easm-ui-danger-highlight` | #FFD3DA | Highlighted destructive row in a grey panel. Text on it is danger-hover. |
| `--easm-ui-danger-halo` | rgb(217 38 68 / 16%) | Soft glow around a focused field in error: danger at 14%. |
| `--easm-ui-warning` | #94530A | Warning text and icons on warning-surface or surface. |
| `--easm-ui-warning-surface` | #FFF3C6 | Warning badge and alert fill. |
| `--easm-ui-badge-neutral` | #EEF0F3 | Neutral badge fill. |
| `--easm-ui-badge-brand` | #CFE0FF | Brand badge fill (pastel blue). |
| `--easm-ui-badge-success` | #BFF0D2 | Success badge fill (pastel green). |
| `--easm-ui-badge-warning` | #FFE07A | Warning badge fill (butter). |
| `--easm-ui-badge-danger` | #FFD3DA | Danger badge fill (blush). |
| `--easm-ui-icon-success` | #11964A | Status icon on a success badge (3:1 on badge-success). |
| `--easm-ui-icon-warning` | #B27300 | Status icon on a warning badge (3:1 on badge-warning). |
| `--easm-ui-icon-danger` | #E0474B | Status icon on a danger badge (3:1 on badge-danger). |
| `--easm-ui-avatar` | #DCE7FD | Avatar and initials tile fill. |
| `--easm-ui-avatar-ink` | #1D4FD8 | Initials on an avatar. |
| `--easm-ui-presence-online` | #0C8138 (= success) | Presence: online. A filled dot; pair with the status in the accessible name. |
| `--easm-ui-presence-away` | #94530A (= warning) | Presence: away. A half-filled dot. |
| `--easm-ui-presence-offline` | #858D9B (= border) | Presence: offline. A hollow ring (3:1 on white and on the faint grey fill). |
| `--easm-ui-presence-idle` | #0C8138 (= success) | Presence: idle (tab open, no input). A ring in the online colour: there but not at the keys. |
| `--easm-ui-presence-call` | #2F6BEB | Presence: on a call. A filled dot with a white phone sign, beside any presence. |
| `--easm-ui-scrim` | rgb(35 33 30 / 34%) | Warm backdrop behind dialogs and drawers. |
| `--easm-ui-chart-blue` | #2F6BEB | Blue data colour: bars, lines, segments and dots (3:1 on card and page). |
| `--easm-ui-chart-blue-tint` | #DCE7FD | Blue tint: legend chips, metric tiles and icon squares. |
| `--easm-ui-chart-blue-ink` | #1D4FD8 | Blue text on its tint or on white (4.5:1). |
| `--easm-ui-chart-violet` | #7C5CF0 | Violet data colour: bars, lines, segments and dots (3:1 on card and page). |
| `--easm-ui-chart-violet-tint` | #E8E2FF | Violet tint: legend chips, metric tiles and icon squares. |
| `--easm-ui-chart-violet-ink` | #5B3CC4 | Violet text on its tint or on white (4.5:1). |
| `--easm-ui-chart-teal` | #0EA698 | Teal data colour: bars, lines, segments and dots (3:1 on card and page). |
| `--easm-ui-chart-teal-tint` | #CCF2EC | Teal tint: legend chips, metric tiles and icon squares. |
| `--easm-ui-chart-teal-ink` | #0B6F66 | Teal text on its tint or on white (4.5:1). |
| `--easm-ui-chart-green` | #17A34A | Green data colour: bars, lines, segments and dots (3:1 on card and page). |
| `--easm-ui-chart-green-tint` | #CDF2DA | Green tint: legend chips, metric tiles and icon squares. |
| `--easm-ui-chart-green-ink` | #0D7335 | Green text on its tint or on white (4.5:1). |
| `--easm-ui-chart-amber` | #CB8500 | Amber data colour: bars, lines, segments and dots (3:1 on card and page). |
| `--easm-ui-chart-amber-tint` | #FFEBB5 | Amber tint: legend chips, metric tiles and icon squares. |
| `--easm-ui-chart-amber-ink` | #8A5200 | Amber text on its tint or on white (4.5:1). |
| `--easm-ui-chart-coral` | #E5484D | Coral data colour: bars, lines, segments and dots (3:1 on card and page). |
| `--easm-ui-chart-coral-tint` | #FFDDE0 | Coral tint: legend chips, metric tiles and icon squares. |
| `--easm-ui-chart-coral-ink` | #B4213A | Coral text on its tint or on white (4.5:1). |
| `--easm-ui-chart-sky` | #1E96E8 | Sky data colour: bars, lines, segments and dots (3:1 on card and page). |
| `--easm-ui-chart-sky-tint` | #D2EBFC | Sky tint: legend chips, metric tiles and icon squares. |
| `--easm-ui-chart-sky-ink` | #1A6797 | Sky text on its tint or on white (4.5:1). |
| `--easm-ui-chart-honey` | #8B93A1 | Slate grey data colour (the tone keeps its old id, honey): bars, lines, segments and dots (3:1 on card and page). |
| `--easm-ui-chart-honey-tint` | #EEF0F3 | Slate grey tint: legend chips, metric tiles and icon squares. |
| `--easm-ui-chart-honey-ink` | #5E6470 | Slate grey text on its tint or on white (4.5:1). |
| `--easm-ui-chart-indigo` | #6366F1 | Indigo accent (between blue and violet): small marks, icons and dots (3:1 on card and page). |
| `--easm-ui-chart-indigo-tint` | #E3E4FF | Indigo tint: avatars, tags and icon squares. |
| `--easm-ui-chart-indigo-ink` | #3B3FC2 | Indigo text on its tint or on white (4.5:1). |
| `--easm-ui-chart-rose` | #DB3F86 | Rose accent (coral turned towards violet): small marks, icons and dots (3:1 on card and page). |
| `--easm-ui-chart-rose-tint` | #FFDDEC | Rose tint: avatars, tags and icon squares. |
| `--easm-ui-chart-rose-ink` | #A81F5E | Rose text on its tint or on white (4.5:1). |
| `--easm-ui-chart-orange` | #E5620A | Orange accent (the signature orange, deepened for marks): small marks, icons and dots (3:1 on card and page). |
| `--easm-ui-chart-orange-tint` | #FFE5D1 | Orange tint: avatars, tags and icon squares. |
| `--easm-ui-chart-orange-ink` | #A04300 | Orange text on its tint or on white (4.5:1). |
| `--easm-ui-chart-lime` | #5C9A0A | Lime accent (green turned towards yellow): small marks, icons and dots (3:1 on card and page). |
| `--easm-ui-chart-lime-tint` | #E2F4C6 | Lime tint: avatars, tags and icon squares. |
| `--easm-ui-chart-lime-ink` | #3D6A05 | Lime text on its tint or on white (4.5:1). |
| `--easm-ui-chart-plum` | #A43FBF | Plum accent (violet turned towards rose): small marks, icons and dots (3:1 on card and page). The Marketing dashboard's accent. |
| `--easm-ui-chart-plum-tint` | #F4E2F9 | Plum tint: avatars, tags and icon squares. |
| `--easm-ui-chart-plum-ink` | #7A2B91 | Plum text on its tint or on white (4.5:1). |
| `--easm-ui-orange` | #FF6A00 | The second brand colour (#FF6A00 in the logo), for attention: what is new or waiting. Never a control colour; controls stay blue. Too light for text on white: use orange-ink. |
| `--easm-ui-orange-hover` | #E65F00 | Orange, hovered. |
| `--easm-ui-orange-surface` | #FFF1E6 | Orange tint behind an attention count or highlight. |
| `--easm-ui-orange-border` | #FFC9A3 | Orange edge for a highlighted item. |
| `--easm-ui-orange-fill` | #C24E00 | Solid orange behind white text (the notification count): the step where white passes 4.5:1. |
| `--easm-ui-on-orange-fill` | #FFFFFF | Text on orange-fill. |
| `--easm-ui-signature` | #FF6A00 | Brand orange. Marketing surfaces and the Junction mark only; use dark text on it, never white. Working controls stay blue. |
| `--easm-ui-signature-surface` | #FFF0E5 | Orange tint for marketing highlights. |
| `--easm-ui-dark` | #0F0F0E | Marketing home background only; no component reads it. Text on it is white; accents are signature. |
| `--easm-ui-orange-ink` | #B84700 | Orange as text on white or on orange-surface (4.5:1): a count, a highlight, what is new. |
| `--easm-ui-ai` | #7C5CF0 | AI role: marks what the assistant made or did (AI messages, insights, assistant calls, collected responses). A role, not a chart colour; 3:1 on card and page. |
| `--easm-ui-ai-surface` | #EFEBFF | AI role fill: chips, tiles and the background of AI-authored content. |
| `--easm-ui-ai-ink` | #5B3CC4 | AI role text on its fill or on white (4.5:1). |
| `--easm-ui-stage-1` | #EAF0FD | Lead stage 1, Inquiry: the lightest step of one blue ramp. Text is the body text. |
| `--easm-ui-stage-2` | #D3E0FB | Lead stage 2, Qualified. |
| `--easm-ui-stage-3` | #B3CBF8 | Lead stage 3, Applied. |
| `--easm-ui-stage-4` | #2F6BEB | Lead stage 4, Admitted. Text on it is white. |
| `--easm-ui-stage-5` | #1E46B8 | Lead stage 5, Enrolled: the deepest step. Text on it is white. |
| `--easm-ui-stage-closed` | #EEF0F3 | Lead stage, closed (lost, withdrawn): muted, off the ramp. Text is secondary. |
| `--easm-ui-stage-stopped` | #FFF5F6 | Lead stage, do not contact: the danger fill, text in danger-hover. |
| `--easm-ui-product-support` | #2F6BEB (= chart-blue) | Support dashboard accent (demand list CLR-01): the switcher tile, home hero, breadcrumb and origin chips. Never a status colour. |
| `--easm-ui-product-support-tint` | #DCE7FD (= chart-blue-tint) | Support accent fill. |
| `--easm-ui-product-support-ink` | #1D4FD8 (= chart-blue-ink) | Support accent text on its fill or on white (4.5:1). |
| `--easm-ui-product-knowledge` | #0EA698 (= chart-teal) | Knowledge dashboard accent (demand list CLR-01): the switcher tile, home hero, breadcrumb and origin chips. Never a status colour. |
| `--easm-ui-product-knowledge-tint` | #CCF2EC (= chart-teal-tint) | Knowledge accent fill. |
| `--easm-ui-product-knowledge-ink` | #0B6F66 (= chart-teal-ink) | Knowledge accent text on its fill or on white (4.5:1). |
| `--easm-ui-product-marketing` | #A43FBF (= chart-plum) | Marketing dashboard accent (demand list CLR-01): the switcher tile, home hero, breadcrumb and origin chips. Never a status colour. |
| `--easm-ui-product-marketing-tint` | #F4E2F9 (= chart-plum-tint) | Marketing accent fill. |
| `--easm-ui-product-marketing-ink` | #7A2B91 (= chart-plum-ink) | Marketing accent text on its fill or on white (4.5:1). |
| `--easm-ui-product-automation` | #6366F1 (= chart-indigo) | Automation dashboard accent (demand list CLR-01): the switcher tile, home hero, breadcrumb and origin chips. Never a status colour. |
| `--easm-ui-product-automation-tint` | #E3E4FF (= chart-indigo-tint) | Automation accent fill. |
| `--easm-ui-product-automation-ink` | #3B3FC2 (= chart-indigo-ink) | Automation accent text on its fill or on white (4.5:1). |
| `--easm-ui-product-forms` | #DB3F86 (= chart-rose) | Forms dashboard accent (demand list CLR-01): the switcher tile, home hero, breadcrumb and origin chips. Never a status colour. |
| `--easm-ui-product-forms-tint` | #FFDDEC (= chart-rose-tint) | Forms accent fill. |
| `--easm-ui-product-forms-ink` | #A81F5E (= chart-rose-ink) | Forms accent text on its fill or on white (4.5:1). |
| `--easm-ui-temperature-hot` | #DB3F86 (= chart-rose) | Hot: likely to apply soon. Never coral (danger) or the signature orange. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-temperature-hot-tint` | #FFDDEC (= chart-rose-tint) | Temperature hot: fill. |
| `--easm-ui-temperature-hot-ink` | #A81F5E (= chart-rose-ink) | Temperature hot: text on its fill or on white (4.5:1). |
| `--easm-ui-temperature-warm` | #CB8500 (= chart-amber) | Warm: interested, not yet moving. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-temperature-warm-tint` | #FFEBB5 (= chart-amber-tint) | Temperature warm: fill. |
| `--easm-ui-temperature-warm-ink` | #8A5200 (= chart-amber-ink) | Temperature warm: text on its fill or on white (4.5:1). |
| `--easm-ui-temperature-cold` | #1E96E8 (= chart-sky) | Cold: no recent interest. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-temperature-cold-tint` | #D2EBFC (= chart-sky-tint) | Temperature cold: fill. |
| `--easm-ui-temperature-cold-ink` | #1A6797 (= chart-sky-ink) | Temperature cold: text on its fill or on white (4.5:1). |
| `--easm-ui-sentiment-positive` | #0EA698 (= chart-teal) | Positive: how a conversation felt. Not green: a feeling is not a success. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-sentiment-positive-tint` | #CCF2EC (= chart-teal-tint) | Sentiment positive: fill. |
| `--easm-ui-sentiment-positive-ink` | #0B6F66 (= chart-teal-ink) | Sentiment positive: text on its fill or on white (4.5:1). |
| `--easm-ui-sentiment-neutral` | #8B93A1 (= chart-honey) | Neutral. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-sentiment-neutral-tint` | #EEF0F3 (= chart-honey-tint) | Sentiment neutral: fill. |
| `--easm-ui-sentiment-neutral-ink` | #5E6470 (= chart-honey-ink) | Sentiment neutral: text on its fill or on white (4.5:1). |
| `--easm-ui-sentiment-negative` | #A43FBF (= chart-plum) | Negative: a caller’s mood, not an error, so never red. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-sentiment-negative-tint` | #F4E2F9 (= chart-plum-tint) | Sentiment negative: fill. |
| `--easm-ui-sentiment-negative-ink` | #7A2B91 (= chart-plum-ink) | Sentiment negative: text on its fill or on white (4.5:1). |
| `--easm-ui-sentiment-mixed` | #6366F1 (= chart-indigo) | Mixed. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-sentiment-mixed-tint` | #E3E4FF (= chart-indigo-tint) | Sentiment mixed: fill. |
| `--easm-ui-sentiment-mixed-ink` | #3B3FC2 (= chart-indigo-ink) | Sentiment mixed: text on its fill or on white (4.5:1). |
| `--easm-ui-sensitivity-public` | #8B93A1 (= chart-honey) | Public answer: fine to show. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-sensitivity-public-tint` | #EEF0F3 (= chart-honey-tint) | Sensitivity public: fill. |
| `--easm-ui-sensitivity-public-ink` | #5E6470 (= chart-honey-ink) | Sensitivity public: text on its fill or on white (4.5:1). |
| `--easm-ui-sensitivity-personal` | #1E96E8 (= chart-sky) | Personal answer: about a person. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-sensitivity-personal-tint` | #D2EBFC (= chart-sky-tint) | Sensitivity personal: fill. |
| `--easm-ui-sensitivity-personal-ink` | #1A6797 (= chart-sky-ink) | Sensitivity personal: text on its fill or on white (4.5:1). |
| `--easm-ui-sensitivity-restricted` | #6366F1 (= chart-indigo) | Restricted answer: sealed, read only through Reveal. Guarded, not an error. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-sensitivity-restricted-tint` | #E3E4FF (= chart-indigo-tint) | Sensitivity restricted: fill. |
| `--easm-ui-sensitivity-restricted-ink` | #3B3FC2 (= chart-indigo-ink) | Sensitivity restricted: text on its fill or on white (4.5:1). |
| `--easm-ui-consent-granted` | #0EA698 (= chart-teal) | Consent given. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-consent-granted-tint` | #CCF2EC (= chart-teal-tint) | Consent granted: fill. |
| `--easm-ui-consent-granted-ink` | #0B6F66 (= chart-teal-ink) | Consent granted: text on its fill or on white (4.5:1). |
| `--easm-ui-consent-withdrawn` | #A43FBF (= chart-plum) | Consent withdrawn: honoured, not an error. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-consent-withdrawn-tint` | #F4E2F9 (= chart-plum-tint) | Consent withdrawn: fill. |
| `--easm-ui-consent-withdrawn-ink` | #7A2B91 (= chart-plum-ink) | Consent withdrawn: text on its fill or on white (4.5:1). |
| `--easm-ui-consent-unknown` | #8B93A1 (= chart-honey) | Consent not known. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-consent-unknown-tint` | #EEF0F3 (= chart-honey-tint) | Consent unknown: fill. |
| `--easm-ui-consent-unknown-ink` | #5E6470 (= chart-honey-ink) | Consent unknown: text on its fill or on white (4.5:1). |
| `--easm-ui-consent-erased` | #8B93A1 (= chart-honey) | The person was erased; the record of it remains. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-consent-erased-tint` | #EEF0F3 (= chart-honey-tint) | Consent erased: fill. |
| `--easm-ui-consent-erased-ink` | #5E6470 (= chart-honey-ink) | Consent erased: text on its fill or on white (4.5:1). |
| `--easm-ui-priority-low` | #8B93A1 (= chart-honey) | Priority low. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-priority-low-tint` | #EEF0F3 (= chart-honey-tint) | Priority low: fill. |
| `--easm-ui-priority-low-ink` | #5E6470 (= chart-honey-ink) | Priority low: text on its fill or on white (4.5:1). |
| `--easm-ui-priority-normal` | #1E96E8 (= chart-sky) | Priority normal. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-priority-normal-tint` | #D2EBFC (= chart-sky-tint) | Priority normal: fill. |
| `--easm-ui-priority-normal-ink` | #1A6797 (= chart-sky-ink) | Priority normal: text on its fill or on white (4.5:1). |
| `--easm-ui-priority-high` | #CB8500 (= chart-amber) | Priority high. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-priority-high-tint` | #FFEBB5 (= chart-amber-tint) | Priority high: fill. |
| `--easm-ui-priority-high-ink` | #8A5200 (= chart-amber-ink) | Priority high: text on its fill or on white (4.5:1). |
| `--easm-ui-priority-urgent` | #DB3F86 (= chart-rose) | Priority urgent: still not the SLA’s breached red. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-priority-urgent-tint` | #FFDDEC (= chart-rose-tint) | Priority urgent: fill. |
| `--easm-ui-priority-urgent-ink` | #A81F5E (= chart-rose-ink) | Priority urgent: text on its fill or on white (4.5:1). |
| `--easm-ui-consent-suppressed` | #6366F1 (= chart-indigo) | Consent suppressed: held back on purpose, guarded rather than an error. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-consent-suppressed-tint` | #E3E4FF (= chart-indigo-tint) | Consent suppressed: fill. |
| `--easm-ui-consent-suppressed-ink` | #3B3FC2 (= chart-indigo-ink) | Consent suppressed: text on its fill or on white (4.5:1). |
| `--easm-ui-delivery-queued` | #8B93A1 (= chart-honey) | Delivery queued: waiting its turn. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-delivery-queued-tint` | #EEF0F3 (= chart-honey-tint) | Delivery queued: fill. |
| `--easm-ui-delivery-queued-ink` | #5E6470 (= chart-honey-ink) | Delivery queued: text on its fill or on white (4.5:1). |
| `--easm-ui-delivery-accepted` | #1E96E8 (= chart-sky) | Delivery accepted: the provider took the request, nothing more. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-delivery-accepted-tint` | #D2EBFC (= chart-sky-tint) | Delivery accepted: fill. |
| `--easm-ui-delivery-accepted-ink` | #1A6797 (= chart-sky-ink) | Delivery accepted: text on its fill or on white (4.5:1). |
| `--easm-ui-delivery-matched` | #0EA698 (= chart-teal) | Delivery matched: the provider tied it to a person. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-delivery-matched-tint` | #CCF2EC (= chart-teal-tint) | Delivery matched: fill. |
| `--easm-ui-delivery-matched-ink` | #0B6F66 (= chart-teal-ink) | Delivery matched: text on its fill or on white (4.5:1). |
| `--easm-ui-delivery-suppressed` | #6366F1 (= chart-indigo) | Delivery suppressed: held back because consent was missing. Guarded, not failed. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-delivery-suppressed-tint` | #E3E4FF (= chart-indigo-tint) | Delivery suppressed: fill. |
| `--easm-ui-delivery-suppressed-ink` | #3B3FC2 (= chart-indigo-ink) | Delivery suppressed: text on its fill or on white (4.5:1). |
| `--easm-ui-delivery-failed` | #E5484D (= chart-coral) | Delivery dead-lettered: it will not be retried and needs a person. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-delivery-failed-tint` | #FFDDE0 (= chart-coral-tint) | Delivery failed: fill. |
| `--easm-ui-delivery-failed-ink` | #B4213A (= chart-coral-ink) | Delivery failed: text on its fill or on white (4.5:1). |
| `--easm-ui-freshness-fresh` | #0EA698 (= chart-teal) | Fresh: reviewed within its schedule. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-freshness-fresh-tint` | #CCF2EC (= chart-teal-tint) | Freshness fresh: fill. |
| `--easm-ui-freshness-fresh-ink` | #0B6F66 (= chart-teal-ink) | Freshness fresh: text on its fill or on white (4.5:1). |
| `--easm-ui-freshness-due` | #CB8500 (= chart-amber) | Due soon: its review falls due shortly. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-freshness-due-tint` | #FFEBB5 (= chart-amber-tint) | Freshness due: fill. |
| `--easm-ui-freshness-due-ink` | #8A5200 (= chart-amber-ink) | Freshness due: text on its fill or on white (4.5:1). |
| `--easm-ui-freshness-stale` | #8B93A1 (= chart-honey) | Stale: past its review. A stale page is not an error, so never red. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-freshness-stale-tint` | #EEF0F3 (= chart-honey-tint) | Freshness stale: fill. |
| `--easm-ui-freshness-stale-ink` | #5E6470 (= chart-honey-ink) | Freshness stale: text on its fill or on white (4.5:1). |
| `--easm-ui-effect-read` | #1E96E8 (= chart-sky) | Reads data only. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-effect-read-tint` | #D2EBFC (= chart-sky-tint) | Effect read: fill. |
| `--easm-ui-effect-read-ink` | #1A6797 (= chart-sky-ink) | Effect read: text on its fill or on white (4.5:1). |
| `--easm-ui-effect-write` | #CB8500 (= chart-amber) | Changes data: calm but unmistakable, never danger red. (demand list colour role). Mark: glyphs and dots. |
| `--easm-ui-effect-write-tint` | #FFEBB5 (= chart-amber-tint) | Effect write: fill. |
| `--easm-ui-effect-write-ink` | #8A5200 (= chart-amber-ink) | Effect write: text on its fill or on white (4.5:1). |
| `--easm-ui-attention` | #FF6A00 (= orange) | Attention (CLR-14): "Needs you" on every dashboard. The signature orange as a mark, never a control. |
| `--easm-ui-attention-tint` | #FFF1E6 (= orange-surface) | Attention: fill of a "Needs you" chip. |
| `--easm-ui-attention-ink` | #B84700 (= orange-ink) | Attention: text and glyph on its fill (4.5:1, checked as orange-ink on orange-surface). |
<!-- /generated:colors -->

Filled primary and destructive buttons use `on-primary-fill` and `on-danger` (white) text. Signature orange uses dark `text` on it, never white. Orange is not the enterprise default action color, a generic warning color or a substitute for a selected state. Color never carries operational meaning by itself: error/status text and distinct symbols remain visible, and presence dots differ in shape as well as colour (online filled, away half-filled, offline a hollow ring).

Grey float panels (menus and popovers opened inside a card) are darker than white: coloured text on them uses `primary-hover` and `danger-hover`, and outlines use `border-hover`, because `primary`, `danger` and `border` fall under their minimum contrast there. `tokens/contrast.mjs` checks every pairing the components use and fails the build below 4.5:1 for text and 3:1 for marks, outlines and focus.

## Geometry and density

| Family | Contract |
| --- | --- |
| Buttons and compact action targets | sm 32 / md 40 / lg 48 px minimum height; md default |
| Fields | md 40 default / lg 48 spacious / sm 32 explicitly compact |
| Choice rows | sm 32 / md 40 / lg 48 minimum; mark stays compact |
| SegmentedControl | Outer 32/40/48; inner 24/32/40 with 3 px inset and 1 px border |
| Chip/Tag/Badge | Visual sm 24 / md 32; interactive Chip children remain at least 32 |
| Coarse pointers | Interactive targets minimum 44 px; visual-only marks do not enlarge |
| TextArea/FileUpload | Content/rows-driven height with standard density and full action targets |
| Avatar/ModuleIcon | Visual 32/40/48 preset sizes; parent action owns the target |
| UserChip | Visual sm 40 / md 48 px row with 32/40 px avatar; removable coarse row 56 px around a 44 px action |
| Containers/overlays | Content-driven dimensions using named padding/width presets |
| Skeleton | Width/height may match the eventual content layout |

These are minimum sizes: translations, zoom and multiline content may require more height. Do not override controls with arbitrary per-screen pixel dimensions. Use named density presets; only Skeleton exposes content-layout dimensions. Every visible edge, inset, seam and optical alignment must be checked at 100% and 200% zoom.

<!-- generated:scales (pnpm tokens) -->
- Type: font `'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`; sizes (`--easm-ui-text-*`) xs: 12, sm: 13, md: 14, lg: 16, xl: 20 px; line height 1.5; label weight 600.
- Spacing (`--easm-ui-space-*`, `tokens.spacing`): 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 px.
- Control heights (`--easm-ui-size-*`): sm: 32, md: 40, lg: 48, touch: 44 px. Icons (`--easm-ui-icon-size-*`): sm: 16, md: 20, lg: 24 px; stroke 1.6.
- Radius (`--easm-ui-radius-*`): mark: 4, inner: 6, control: 8, float: 8, card: 12, overlay: 16, pill: 999 px.
- Motion (`--easm-ui-motion-*`): fast: 140, medium: 200, slow: 280, enter: 320, stagger: 36, press: 90, release: 460, arrive: 380, exit: 150 ms; easing `cubic-bezier(0.2, 0, 0, 1)`.
- Focus: ring `0 0 0 2px {color.primary-fill}, 0 0 0 6px {color.halo}`; field `0 0 0 4px {color.halo}`; inset `inset 0 0 0 2px {color.primary-fill}`; field in error `0 0 0 4px {color.danger-halo}`.
- Layers (`--easm-ui-z-*`, `tokens.z`): dialog: 1000, popover: 1100, tooltip: 1200. Screen size classes (`tokens.breakpoint`, Tailwind `easm-*:`): medium: 600, expanded: 1024, large: 1440, wide: 1920 px (compact below medium; the Tailwind variants carry the same values in rem, px / 16, so they sort with sm:, md: and lg:).
<!-- /generated:scales -->

Floating panels (menus, popovers, pickers, select lists, tooltips) use the float radius, the same corner as the control they open from, so their corners line up when one opens over a button. Nested corners are concentric (outer radius minus inset); icon tiles keep a corner about a quarter of their size; consumers do not invent new per-screen radii. Standard icons use the EASM library (`@easm-ui/icons`), the token stroke and approved 16/20/24/32 px glyph sizes. The shared registry includes the functional `more-horizontal` three-dot glyph; UIIconName directly uses that registry. There are no local replacement glyphs in @easm-ui/ui. Authored icon geometry keeps the 1.6-unit main silhouette while using lighter 1.1–1.35-unit secondary details where needed to preserve counters; use the supplied drawing rather than overriding individual strokes.

## Typography and hierarchy

The font stack, sizes, line height and label weight are listed above. The package does not download a font; applications load Inter. Container titles use `text-lg` (16 px); dialog and drawer titles `text-xl` (20 px). Compact descriptive labels remain readable; do not squeeze copy to fit arbitrary card widths.

Choose semantic heading levels for the page outline. Panel/Accordion/Collapsible allow an explicit heading level. Card’s optional title is h3; use an intentional surrounding hierarchy or Panel when a different region level is required.

## State ownership

| State | Owner and rule |
| --- | --- |
| Hover/pressed/focus | Component/browser; keyboard focus is independent of hover |
| Disabled | Native disabled controls suppress activation and sequential focus |
| Loading/busy action | Application supplies loading; Button preserves focus, blocks repeated execution and exposes busy/disabled semantics |
| Selected/checked | Caller value or stable default value; controlled mode must update through callback |
| Validation | Application supplies domain error/success; native constraints are retained |
| Query versus selection | Combobox keeps query separate from the committed finite value |
| Local file selection | FileUpload validates declared browser metadata and reports files; application owns transport/server acceptance |
| Progress | Actual measured value; omit value for indeterminate work |
| Confirmation | Caller owns pending/error/success and closes only after the operation succeeds |
| Copy outcome | Clipboard write resolution determines success; changing text invalidates stale completion |

Controlled components accept `value`/`open`/`checked` and a change callback; uncontrolled mode accepts the corresponding `default*`. Do not switch modes during a component’s lifetime. Prevent duplicate application work independently where appropriate; visual disabled state is not an authorization or persistence boundary.

## Stable layout across states

Anchor related controls at the start of their container. Keep the same border width, icon slots and button labels through hover, focus, selected, disabled and loading; change appearance without changing geometry. Loading indicators overlay retained button content. CopyControl measures its original and confirmation labels so the target does not shrink or grow.

Reserve practical space for validation and action results in the composing form or panel. Empty reserved areas must not announce invented feedback; actual messages retain their existing accessible descriptions or live-region behavior. Use minimum block size, not a fixed clipped height, so translated or multiline messages can grow downward. Left-start rows expand rightward within the available width and wrap at narrow widths. Accordion and Collapsible reveal real content downward from their unchanged header, with the established disclosure motion; never animate the entire page to hide a layout jump.

The review catalog applies persistent result slots and per-component preview reserves. Those preview dimensions are presentation rules rather than arbitrary component sizing APIs. Consumers must reserve supporting slots for their own expected content and process states.

## Focus, motion and announcements

Focus contract: one treatment, from `styles.css`. Every focusable element shows the focus ring (`--easm-ui-focus-ring`): a solid 2 px `primary-fill` edge on the control plus a soft `halo` glow, never an offset double ring. Text fields, Select, DropdownSelect and TextArea turn their outline `primary-fill` and add the field halo (`--easm-ui-field-focus-ring`; `--easm-ui-field-error-focus-ring` while in error). Rows inside a clipped shell (menu rows, options, accordion headers) use the inset ring (`--easm-ui-focus-ring-inset`); destructive menu rows keep a danger-coloured edge. Components may draw their ring differently but never cancel it: focus stays visible on selected, invalid, busy, disabled-but-focusable and destructive controls, across portal surfaces and clipped containers. Modal bodies reserve 6 px for the halo and rounding allowance. In forced-colours mode box-shadow is not painted, so focus is a solid 2 px system outline (Highlight) outside the control, selection an inset outline, and a selected item with focus a double outline. Containers focused by a click inside them show no ring (`quietPointerFocus`); Tab focus still does. Interactive targets grow to 44 px (`--easm-ui-size-touch`) under coarse pointers.

Motion presets are listed above. Color transitions use 140 ms, anchored overlays 200 ms, modal/drawer/disclosure geometry 280 ms. Reduced motion removes nonessential transition/animation; functional loading retains text/static symbols. Application work starts immediately, with no animation delay or forced cycle completion.

Toast announces its message using status or danger alert semantics. Alert announces only when `live=true`. Field error/success uses linked descriptions; application validation summaries/focus own announcements. Static StatusBadge and decorative Skeleton do not create competing live regions. Avoid wrapping these in a second announcing parent.

## Intuitive naming tree

The core component names are listed in [COMPONENT-SPECS.md](COMPONENT-SPECS.md). Variant paths below are documentation/catalog labels backed by actual typed props, not additional export names.

| Catalog path | Actual API |
| --- | --- |
| Button / Primary / Medium | `<Button variant="primary" size="md">Save</Button>` |
| Button / Secondary / Small | `<Button variant="secondary" size="sm">Cancel</Button>` |
| Input / Default / Error | `<TextField label="Email" error="Enter a valid email address." />` |
| Input / Search | `<SearchField label="Search conversations" />` |
| Input / Multiline | `<TextArea label="Instructions" />` |
| Dialog / Confirmation | `<ConfirmationDialog title="Archive agent?" onConfirm={archiveAgent} />` |
| Status / Processing | `<StatusBadge status="processing">Indexing</StatusBadge>` |
| Feedback / Loading | `<Spinner label="Loading conversations" />` |

Use PascalCase for React component names; lowercase values for variants and sizes. Use `TextArea`, not `Textarea`; `TextField`, not an ambiguous exported `Input`; `ConfirmationDialog`, not `ConfirmDialog`. Existing legacy names remain consumer migration inputs; this phase does not silently rewrite them.

## Migration sequence and acceptance

1. Use [migration-map.json](../audit/migration-map.json) to find exact named definitions, related legacy compositions, usage sites and native candidates. References are review candidates, not promises of drop-in equivalence.
2. Preserve business behavior, form names/values, permissions, routing, network state and domain copy. Replace the underlying leaf/foundation only after choosing its actual semantics.
3. Verify default/hover/pressed/focus/disabled and applicable selected/loading/error/success/open states. Test keyboard interaction, focus return, long text, 200% zoom, forced colors, reduced motion and 44 px coarse targets on the destination screen.
4. Check existing tenant, embedded widget, Ask Engine, master-portal and WordPress styling with their own owners. Do not bulk-recolor source, chart colors, identity marks or provider labels.
5. Remove redundant old providers only after consumer migration is complete. Publish/release acceptance and deployment are separate from local library construction.

All 47 component examples are type-checked against current source by [verify-examples.cjs](verify-examples.cjs). Source audit limitations and open consumer work are in [CODEBASE-AUDIT.md](../audit/CODEBASE-AUDIT.md).

## Expanded content and overlay layers

Accordions and collapsible regions use opaque white surfaces,56 px minimum triggers,16 px side insets,12 px contextual-icon spacing and20 px content bottom space. Only the chevron rotates. Nested closed sections retain their own hidden/inert state. Container and overlay content normalize first/last prose margins and use16 px sibling spacing.

Popup lists are anchored portals with viewport collision handling, available-height scrolling and explicit margins from the viewport. Each modal activation reserves a fresh document-wide layer band and passes it through its portal context: parent popovers, menus and tooltips stay below a deeper modal; child lists stay above their owning modal. The combobox retains input focus while its list is open, uses a 6 px anchor gap and 12 px collision margin, and caps its scrollable list at the smaller of 240 px or available height. Menu rows are at least 40 px on wider fine-pointer layouts and 44 px for coarse pointers or layouts 600 px wide and below. Dialog titles, close controls and footers remain fixed while long descriptions and content scroll together.

## Added core fields and polished geometry

PasswordField adds a named visibility action to the native credential field; NumberField supplies native bounded stepping without floating-point addition; DropdownSelect supplies the branded persistent-value popup while Select keeps the device picker; InlineValidation provides concise linked local feedback. All47 components retain the fifteen-part contract.

Fields use a single rounded blue halo (`--easm-ui-field-focus-ring`), with no white separation. Modal body scroll gutters are6px while visible panel insets remain24px desktop/20px narrow. Dialog panels stay opaque during movement; only the warm backdrop (`--easm-ui-scrim`) and its entrance fade intentionally reveal background content. Subtle buttons, plain inline validation and decorative icon backgrounds intentionally inherit their containing surface.

UserChip uses an opaque radius12px frame and radius8px avatar separated by a4px border-inclusive inset: sm40/32px and md48/40px row/avatar. Image masks subtract the1px avatar border. Longer identity text wraps without reducing glyphs or targets.

Busy buttons retain their content dimensions, show a centered branded16/20/24px spinner, and keep their label accessible while the original content is visually hidden with opacity. CopyControl reserves the larger label width. Catalog disclosures anchor to the top rather than recentering on expansion. Natural following-content reflow remains expected as disclosed content becomes available.

Persistent modal workflow state must be owned outside dismissible Popover content, or stay inside the same owning React tree. An independent sibling can dismiss a nonmodal Popover when its focus moves outside that tree; no z-index can preserve an unmounted owner. Point restoreFocusRef to a surviving launcher.
