// The public form's pictures drawn from this library (2026-11-11): each kind of question wears the same question-*
// drawing the Forms dashboard shows for it, and each welcome topic (forms-core WELCOME_TOPICS) names the drawing of
// what the form is about. lightbulb, briefcase and heart were drawn for this. Keys are forms-core's stored values.
import type { IconName } from './registry';

export const FORM_FIELD_ICON_NAMES = {
  short_text: 'question-short-text',
  long_text: 'question-long-text',
  full_name: 'question-full-name',
  email: 'question-email',
  phone: 'question-phone',
  number: 'question-number',
  date: 'question-date',
  time: 'question-time',
  consent: 'question-consent',
  file_upload: 'question-file',
  single_choice: 'question-single-choice',
  multi_choice: 'question-multi-choice',
  dropdown: 'question-dropdown',
  yes_no: 'question-yes-no',
  ranking: 'question-ranking',
  rating: 'question-rating',
  scale: 'question-scale',
  nps: 'question-nps',
  likert: 'question-likert',
  programme: 'question-programme',
  cnic: 'question-cnic',
  hidden: 'question-hidden',
  statement: 'question-statement',
} as const satisfies Record<string, IconName>;
export type FormFieldKind = keyof typeof FORM_FIELD_ICON_NAMES;

export const FORM_TOPIC_ICON_NAMES = {
  admissions: 'graduation-cap',
  visit: 'institution-building',
  booking: 'calendar-schedule',
  event: 'ticket',
  feedback: 'chat',
  scholarship: 'scholarship',
  quiz: 'lightbulb',
  job: 'briefcase',
  wellbeing: 'heart',
  application: 'document-text',
  contact: 'mail',
} as const satisfies Record<string, IconName>;
export type FormTopic = keyof typeof FORM_TOPIC_ICON_NAMES;

/** The drawing for a question kind; an unknown kind reads as a short answer, as the public form did. */
export function formFieldIconName(kind: string): IconName {
  return (FORM_FIELD_ICON_NAMES as Record<string, IconName>)[kind] ?? FORM_FIELD_ICON_NAMES.short_text;
}
