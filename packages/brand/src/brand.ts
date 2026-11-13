// The EASM brand in data: names, the product family, colours and the logo rules (brand guidelines, logo v6).
import { INK, DARK, ORANGE, ORANGE_INK, PAPER, WHITE, ENTERPRISE_BLUE } from './motion/core/brand';

/** The full name, with the ampersand (BRAND.fullName, FULL_NAME). */
export const FULL_NAME_TEXT = 'Enterprise Applications & Systems Management';

export const BRAND = {
  name: 'EASM',
  fullName: FULL_NAME_TEXT,
  platform: 'EASM One',
  platformDescription: 'The AI layer for universities, and every product built on it.',
  tagline: 'Connect · Check · Act',
  site: 'easm.co',
} as const;

/** The product family. EASM One is the platform (core only); every product lights the right-hand rail.
 * New products need no new artwork: the name is set in Geist Regular beside the same lockup. */
export const PRODUCTS = [
  { id: 'one', name: 'EASM One', product: 'One', platform: true, description: 'The platform: the AI layer for universities. Core only, never a lit rail.' },
  { id: 'forms', name: 'EASM Forms', product: 'Forms', platform: false, description: 'Instant forms for any event or office, also inside the chat.' },
  { id: 'calling', name: 'EASM Calling', product: 'Calling', platform: false, description: 'AI on the university’s phone lines, with handover to staff.' },
  { id: 'ask', name: 'EASM Ask', product: 'Ask', platform: false, description: 'The portal where students and faculty ask and get answers.' },
  { id: 'kiosk', name: 'EASM Kiosk', product: 'Kiosk', platform: false, description: 'Reception, visitors and campus tours at the front desk.' },
  { id: 'library', name: 'EASM Library', product: 'Library', platform: false, description: 'Answers from the library’s own catalogue, tied to courses.' },
  { id: 'clouds', name: 'EASM Clouds', product: 'Clouds', platform: false, description: 'Hosting for the institution’s sites and services.' },
  // The five dashboards of EASM One, named as easm.co names them (2026-10-28). Forms above is both.
  { id: 'support', name: 'EASM Support', product: 'Support', platform: false, description: 'Conversations, calls and the desk where the assistant and staff answer together.' },
  { id: 'knowledge', name: 'EASM Knowledge', product: 'Knowledge', platform: false, description: 'What the institution knows and has verified, ready for every answer.' },
  { id: 'marketing', name: 'EASM Marketing', product: 'Marketing', platform: false, description: 'Where prospects come from and what they become.' },
  { id: 'automation', name: 'EASM Automation', product: 'Automation', platform: false, description: 'The tools, connections and rules the assistants work with.' },
] as const;

/** Brand colours. Ink and paper carry the brand (about 88% together); orange is the signal and never more
 * than a small accent; Enterprise Blue appears only in product interfaces and never behind the logo.
 * Enterprise Blue here is the brand guidelines sheet's value; the components draw controls with the
 * `--easm-ui-primary` token (tokens/easm.tokens.json), which is the value to use in product code. */
export const BRAND_COLOURS = [
  { name: 'Ink', hex: INK, role: 'Wordmark, rails, body text.', contrast: '18.1:1 on white' },
  { name: 'Dark', hex: DARK, role: 'Ground for the reversed logo, slides, the home page.', contrast: '18.4:1 with paper' },
  { name: 'Signature orange', hex: ORANGE, role: 'Core, crossbar and lit rail. Dark text on it, never white.', contrast: '6.3:1 with ink' },
  { name: 'Orange ink', hex: ORANGE_INK, role: 'Orange when it has to be readable text.', contrast: '5.5:1 on white' },
  { name: 'Paper', hex: PAPER, role: 'Default brand ground: documents, web, print.', contrast: '17.3:1 with ink' },
  { name: 'White', hex: WHITE, role: 'Cards and surfaces in EASM One; the logo sits here.', contrast: '18.1:1 with ink' },
  { name: 'Enterprise Blue', hex: ENTERPRISE_BLUE, role: 'Buttons, links and selection in the app. Never behind the logo.', contrast: '6.5:1 with white' },
] as const;

/** Logo rules: sizes in px on screen (print minimum in mm), proportions in cap heights (1 cap = the E's height). */
export const LOGO_RULES = {
  minimum: { icon: '16 px (5 mm)', lockup: '20 px tall (6 mm)', productLockup: '24 px tall (7 mm)', wordmark: '48 px wide (15 mm)' },
  proportions: { iconHeight: 1.55, iconToWordmark: 0.42, wordmarkToProduct: 0.42, stackedGap: 0.37, clearSpace: 0.5 },
  sidebar: 'Lockup 24 px tall, 16 px inset, in the 64 px header row, on white; collapsed: the icon alone at 32 px.',
  favicon: 'Tile 64 units, corner radius 14, ink fill; the icon at 80% with white rails; products light the right-hand rail.',
  watermarks: {
    documents: 'Icon only, ink at 7%, four across in offset rows.',
    media: 'White lockup at 80%, bottom right, one cap height from the edges. Never orange on photos.',
    slides: 'Icon at 8%, oversized and cropped by the edge, clear of body text.',
  },
  never: [
    'Stretch, squash or skew it.',
    'Recolour it outside the four approved versions (full colour, reversed, ink, white).',
    'Type the name in any font instead of placing the artwork.',
    'Place it on Enterprise Blue or a busy colour (orange on blue is 2.3:1).',
    'Use retired versions, like the heavier A with the square core.',
    'Light more than one rail, or any rail but the right-hand one.',
    'Add shadows, glows, gradients, outlines or 3D.',
    'Pair the full name with a product lockup.',
  ],
  typography: { wordmark: 'Geist SemiBold (outlined artwork)', productNames: 'Geist Regular', headlines: 'Geist Medium, -3% tracking', labels: 'Geist Mono', productInterface: 'Inter' },
} as const;
