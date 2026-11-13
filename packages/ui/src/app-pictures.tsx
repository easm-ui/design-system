// The pictures the apps drew themselves until 2026-11-11 (owner: "what about our all icons, our action icons… that
// we are currently using in the software?"), so every picture the software shows comes from EASM UI:
// - FileKindArt: a document, a picture, a recording or a video, on Knowledge → Add knowledge's drop areas and on a
//   file that has no preview of its own (it was apps/web KindArt). Drawn in the kind's chart tone over its tint.
// - FormQuestionIcon and FormTopicPicture: the public form's picture of each kind of question and of what a form is
//   about (they were apps/web FriendlyArt). The drawings are the icon library's (FORM_FIELD_ICON_NAMES,
//   FORM_TOPIC_ICON_NAMES), the same question-* glyphs the Forms dashboard shows, in the form's own colour.
// - ThanksBurst: the thank-you confetti flying out from the tick, once.
// All of them are decoration (aria-hidden) unless given a label: the words beside them say the same thing.
import { useId, type CSSProperties, type SVGAttributes } from 'react';
import { Icon } from '@easm-ui/icons/icon';
import { formFieldIconName, FORM_TOPIC_ICON_NAMES, type FormTopic } from '@easm-ui/icons/form-icons';
import type { ChartTone } from './palette';
import { cx } from './shared';

// ── FileKindArt ─────────────────────────────────────────────────────────────────────────────────────────────────

export const fileKindNames = ['document', 'picture', 'audio', 'video'] as const;
export type FileKindName = (typeof fileKindNames)[number];
/** Each kind's own chart tone: a document coral, a picture amber, a recording indigo, a video teal. */
export const fileKindTones: Record<FileKindName, ChartTone> = { document: 'coral', picture: 'amber', audio: 'indigo', video: 'teal' };

export interface FileKindArtProps extends Omit<SVGAttributes<SVGSVGElement>, 'children'> {
  kind: FileKindName;
  /** Width in px; the drawing is 10:7. Omitted, it fills its box (set the size with CSS). */
  size?: number;
  /** Another chart tone than the kind's own. */
  tone?: ChartTone;
  /** The tag on the document's corner (its type: PDF, DOCX…); at most four letters are shown. */
  badge?: string;
  /** An accessible name, for a drawing that stands for the file; omitted, it is decorative and hidden. */
  label?: string;
}

type Brush = { main: string; tint: string; ink: string; paper: string };
const brush = (t: ChartTone): Brush => ({
  main: `var(--easm-ui-chart-${t})`,
  tint: `var(--easm-ui-chart-${t}-tint)`,
  ink: `var(--easm-ui-chart-${t}-ink)`,
  paper: 'var(--easm-ui-surface)',
});

function DocumentArt({ c, badge }: { c: Brush; badge: string }) {
  return <g>
    {/* A page behind, a page in front with its corner folded. */}
    <rect x="62" y="18" width="78" height="104" rx="8" fill={c.tint} transform="rotate(-7 101 70)" />
    <path d="M70 14h50l22 22v86a8 8 0 0 1-8 8H70a8 8 0 0 1-8-8V22a8 8 0 0 1 8-8z" fill={c.paper} stroke={c.main} strokeWidth="2.5" />
    <path d="M120 14v14a8 8 0 0 0 8 8h14" fill={c.tint} stroke={c.main} strokeWidth="2.5" strokeLinejoin="round" />
    <rect x="74" y="46" width="40" height="5" rx="2.5" fill={c.main} />
    {[60, 70, 80].map((y) => <rect key={y} x="74" y={y} width="56" height="4" rx="2" fill={c.tint} />)}
    <rect x="74" y="90" width="38" height="4" rx="2" fill={c.tint} />
    <rect x="102" y="102" width="34" height="18" rx="5" fill={c.main} />
    <text x="119" y="115" textAnchor="middle" fontSize="10" fontWeight="700" fill={c.paper} fontFamily="inherit">{badge.slice(0, 4).toUpperCase()}</text>
  </g>;
}

function PictureArt({ c }: { c: Brush }) {
  const clip = `easm-ui-kind-photo-${useId().replace(/:/g, '')}`;
  return <g>
    {/* Two photos, one tilted behind the other: hills, a sun, a frame. */}
    <rect x="46" y="24" width="96" height="76" rx="8" fill={c.tint} transform="rotate(-8 94 62)" />
    <rect x="58" y="32" width="100" height="80" rx="8" fill={c.paper} stroke={c.main} strokeWidth="2.5" />
    <clipPath id={clip}><rect x="64" y="38" width="88" height="68" rx="5" /></clipPath>
    <g clipPath={`url(#${clip})`}>
      <rect x="64" y="38" width="88" height="68" fill={c.tint} />
      <circle cx="132" cy="56" r="8" fill={c.main} />
      <path d="M60 106l28-34 18 20 12-12 30 26z" fill={c.main} />
      <path d="M60 106l28-34 10 12-14 22z" fill={c.ink} opacity=".35" />
    </g>
  </g>;
}

const AUDIO_BARS = [10, 22, 34, 18, 40, 28, 14, 30, 44, 24, 12, 26, 36, 16, 8];
function AudioArt({ c }: { c: Brush }) {
  return <g>
    {/* A player: the play button, a waveform played a third of the way, a note above. */}
    <rect x="26" y="34" width="148" height="72" rx="36" fill={c.tint} />
    <circle cx="62" cy="70" r="22" fill={c.main} />
    <path d="M56 59v22l18-11z" fill={c.paper} />
    {AUDIO_BARS.map((h, i) => <rect key={i} x={94 + i * 5} y={70 - h / 2} width="3" height={h} rx="1.5" fill={i < 6 ? c.main : c.ink} opacity={i < 6 ? 1 : 0.35} />)}
    <path d="M156 24v-12l14-3v12" fill="none" stroke={c.main} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="153" cy="25" r="4" fill={c.main} />
    <circle cx="167" cy="22" r="4" fill={c.main} />
  </g>;
}

function VideoArt({ c }: { c: Brush }) {
  return <g>
    {/* A screen with a play button, a timeline and a clapper behind it. */}
    <rect x="44" y="20" width="86" height="22" rx="5" fill={c.tint} transform="rotate(-10 87 31)" />
    <rect x="40" y="34" width="120" height="80" rx="10" fill={c.paper} stroke={c.main} strokeWidth="2.5" />
    <rect x="48" y="42" width="104" height="54" rx="6" fill={c.tint} />
    <circle cx="100" cy="69" r="15" fill={c.main} />
    <path d="M95 61v16l13-8z" fill={c.paper} />
    <rect x="48" y="102" width="104" height="4" rx="2" fill={c.tint} />
    <rect x="48" y="102" width="42" height="4" rx="2" fill={c.main} />
    <circle cx="90" cy="104" r="4.5" fill={c.main} />
  </g>;
}

/** A drawing of a kind of file: a document, a picture, a recording or a video. For an empty drop area and for a
 *  file that has no preview of its own. In the kind's chart tone over its tint, on the surface. */
export function FileKindArt({ kind, size, tone, badge = 'PDF', label, className, style, ...props }: FileKindArtProps) {
  const c = brush(tone ?? fileKindTones[kind]);
  const named = label?.trim();
  return <svg {...props} viewBox="0 0 200 140" width={size} height={size ? size * 0.7 : undefined}
    className={cx('easm-ui easm-ui-file-kind-art', className)} style={style} data-kind={kind}
    role={named ? 'img' : undefined} aria-label={named || undefined} aria-hidden={named ? undefined : true} focusable="false">
    {kind === 'document' && <DocumentArt c={c} badge={badge} />}
    {kind === 'picture' && <PictureArt c={c} />}
    {kind === 'audio' && <AudioArt c={c} />}
    {kind === 'video' && <VideoArt c={c} />}
  </svg>;
}

// ── The public form's pictures ──────────────────────────────────────────────────────────────────────────────────

export interface FormQuestionIconProps {
  /** A forms-core question type (short_text, email, cnic…); an unknown one reads as a short answer. */
  kind: string;
  /** In px. */
  size?: number;
  className?: string;
}
/** The picture beside a question: its kind, as the library's question-* glyph, in the current colour. */
export function FormQuestionIcon({ kind, size = 22, className }: FormQuestionIconProps) {
  return <Icon name={formFieldIconName(kind)} tone="inherit" aria-hidden="true"
    className={cx('easm-ui-form-question-icon', className)} style={{ width: size, height: size }} />;
}

export const formTopicNames = Object.keys(FORM_TOPIC_ICON_NAMES) as FormTopic[];
export interface FormTopicPictureProps {
  /** What the form is about (forms-core WELCOME_TOPICS). */
  topic: FormTopic;
  /** The tile's side in px; the drawing inside is about half of it. */
  size?: number;
  /** The form's accent colour; omitted, the primary blue. */
  accent?: string;
  className?: string;
}
/** The welcome screen's picture: what the form is about, in the form's own colour on a pale tint of it. */
export function FormTopicPicture({ topic, size = 76, accent, className }: FormTopicPictureProps) {
  const glyph = Math.round(size * 0.47);
  return <span aria-hidden="true" className={cx('easm-ui easm-ui-form-topic', className)} data-topic={topic}
    style={{ width: size, height: size, borderRadius: Math.round(size * 0.32), ...(accent ? { '--_topic-accent': accent } : {}) } as CSSProperties}>
    <Icon name={FORM_TOPIC_ICON_NAMES[topic] ?? 'document-text'} tone="inherit" aria-hidden="true" style={{ width: glyph, height: glyph }} />
  </span>;
}

export interface ThanksBurstProps {
  /** The colours the pieces take in turn (the form's palette). */
  hues: readonly string[];
  /** How many pieces fly out. */
  pieces?: number;
  className?: string;
}
/** Confetti flying out from the centre of its parent, once (place it inside a position: relative box around the
 *  tick). Up and out to the sides, barely down, so the heading under the tick stays clear. Hidden under reduced
 *  motion. */
export function ThanksBurst({ hues, pieces = 18, className }: ThanksBurstProps) {
  const colours = hues.length ? hues : ['var(--easm-ui-primary-fill)'];
  return <span aria-hidden="true" className={cx('easm-ui-thanks-burst', className)}>
    {Array.from({ length: pieces }, (_, i) => {
      const angle = (i / pieces) * Math.PI * 2;
      const dist = 64 + (i % 3) * 18;
      const down = Math.sin(angle) > 0;
      const style = {
        '--x': `${(Math.cos(angle) * dist * (down ? 1.25 : 1)).toFixed(1)}px`,
        '--y': `${(Math.sin(angle) * dist * (down ? 0.3 : 1)).toFixed(1)}px`,
        '--r': `${(i * 47) % 180}deg`,
        background: colours[i % colours.length],
        animationDelay: `${(i % 6) * 30}ms`,
      } as CSSProperties;
      return <span key={i} className="easm-ui-thanks-burst-piece" data-shape={i % 3} style={style} />;
    })}
  </span>;
}
