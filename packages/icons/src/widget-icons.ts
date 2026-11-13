// The Ask board's widget icons (EASM One widgets-core WIDGET_ICONS) drawn from this library (2026-11-11). The ids are
// the widget's stored values and never change; each names the library drawing that means the same thing. bus, flask,
// trophy and heart were drawn for this; the rest were already here.
import type { IconName } from './registry';

export const WIDGET_ICON_NAMES = {
  calendar: 'calendar',
  clock: 'clock',
  book: 'book',
  cap: 'graduation-cap',
  money: 'wallet',
  chart: 'analytics',
  list: 'text-list',
  bell: 'notification',
  people: 'users',
  pin: 'location',
  check: 'check-circle',
  star: 'rating-star',
  library: 'library',
  bus: 'bus',
  flask: 'flask',
  trophy: 'trophy',
  link: 'link',
  chat: 'chat',
  heart: 'heart',
  spark: 'sparkle',
} as const satisfies Record<string, IconName>;

export type WidgetIconId = keyof typeof WIDGET_ICON_NAMES;

/** The library drawing for a widget icon id; an unknown id (an older stored value) falls back to the chart, as the board did. */
export function widgetIconName(id: string): IconName {
  return (WIDGET_ICON_NAMES as Record<string, IconName>)[id] ?? WIDGET_ICON_NAMES.chart;
}
