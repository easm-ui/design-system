'use client';

// A week of opening hours (demand list C-X-16, wave 4b, 2026-10-29): seven days, each closed or open in one or more
// ranges (the gap between two ranges is a break), copied from one day to the weekdays or the whole week, holidays
// below, and a department's copy drawn against the default it may only narrow. Replaces the Switch and TimePicker
// rows on Support's office hours, the desk-policy calendars and the outbound calling hours.
import { useId, useState, type ReactNode } from 'react';
import { Button, IconButton } from './actions';
import { DateField, Switch, TextField, TimeField } from './inputs';
import { DropdownMenu } from './overlays';
import { cx, reportContentProblem, UIIcon, useControllableState } from './shared';

export const scheduleComponentNames = ['WeeklyScheduleGrid'] as const;

export type WeekDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
/** One stretch of open time, in 24-hour "HH:MM". */
export interface TimeRange { from: string; to: string }
/** A day with no ranges (or missing) is closed. */
export type WeeklySchedule = Partial<Record<WeekDay, readonly TimeRange[]>>;
export interface ScheduleHoliday { id: string; /** YYYY-MM-DD */ date: string; label: string }

const order: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const dayNames: Record<WeekDay, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
const weekdays: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
const minutes = (hm: string) => { const [h, m] = hm.split(':').map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN; };
const hhmm = (total: number) => `${String(Math.floor(Math.min(total, 1439) / 60)).padStart(2, '0')}:${String(Math.min(total, 1439) % 60).padStart(2, '0')}`;
const duration = (ranges: readonly TimeRange[]) => ranges.reduce((sum, r) => sum + Math.max(0, minutes(r.to) - minutes(r.from)), 0);
const hours = (mins: number) => mins % 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins / 60} h`;

/** What is wrong with a day's ranges, in words; empty when nothing is. Exported so a page can refuse a save. */
export function scheduleProblems(ranges: readonly TimeRange[], bounds?: readonly TimeRange[], boundsLabel = 'the default hours'): string[] {
  const problems: string[] = [];
  const sorted = [...ranges].sort((a, b) => minutes(a.from) - minutes(b.from));
  for (const [i, r] of sorted.entries()) {
    if (!(minutes(r.from) < minutes(r.to))) problems.push(`${r.from}–${r.to} ends before it starts.`);
    else if (i > 0 && minutes(r.from) < minutes(sorted[i - 1].to)) problems.push(`${r.from}–${r.to} overlaps ${sorted[i - 1].from}–${sorted[i - 1].to}.`);
    if (bounds && minutes(r.from) < minutes(r.to) && !bounds.some(b => minutes(r.from) >= minutes(b.from) && minutes(r.to) <= minutes(b.to)))
      problems.push(`${r.from}–${r.to} is outside ${boundsLabel} (${bounds.length ? bounds.map(b => `${b.from}–${b.to}`).join(', ') : 'closed'}).`);
  }
  return problems;
}

export interface WeeklyScheduleGridProps {
  label: string;
  description?: ReactNode;
  value?: WeeklySchedule;
  defaultValue?: WeeklySchedule;
  onValueChange?: (value: WeeklySchedule) => void;
  /** The schedule this one may only narrow (a department's copy of the desk's hours). It is drawn behind each day
   *  and a range outside it is refused; a day it closes cannot be opened. */
  bounds?: WeeklySchedule;
  /** What the bounds are called in the words of a refusal ("the desk's hours"). */
  boundsLabel?: string;
  holidays?: readonly ScheduleHoliday[];
  /** Holidays are listed when given; with this they can be added and removed. */
  onHolidaysChange?: (holidays: ScheduleHoliday[]) => void;
  firstDay?: 'mon' | 'sat' | 'sun';
  /** The hours each day's strip covers. Defaults to the earliest and latest hour in use, at least 08–20. */
  window?: readonly [number, number];
  /** The most ranges in a day (two ranges = one break). */
  maxRanges?: number;
  readOnly?: boolean;
  className?: string;
}

/** A week of opening hours. Each day is a switch, its ranges and a strip that draws them (with the bounds behind
 *  and the breaks as gaps); a day's menu copies it to the weekdays or to every day. Problems are said under the day
 *  in words, never only in colour. */
export function WeeklyScheduleGrid({ label, description, value, defaultValue = {}, onValueChange, bounds, boundsLabel = 'the default hours', holidays, onHolidaysChange,
  firstDay = 'mon', window: shown, maxRanges = 3, readOnly = false, className }: WeeklyScheduleGridProps) {
  if (!label.trim()) reportContentProblem('WeeklyScheduleGrid requires a meaningful label.');
  const id = useId();
  const [week, setWeek] = useControllableState<WeeklySchedule>(value, defaultValue, onValueChange);
  const [remembered, setRemembered] = useState<WeeklySchedule>({});
  const days = [...order.slice(order.indexOf(firstDay === 'sat' ? 'sat' : firstDay)), ...order.slice(0, order.indexOf(firstDay === 'sat' ? 'sat' : firstDay))];
  const used = [...Object.values(week), ...Object.values(bounds ?? {})].flat().filter(Boolean) as TimeRange[];
  const [start, end] = shown ?? [
    Math.min(8, ...used.map(r => Math.floor(minutes(r.from) / 60)).filter(Number.isFinite)),
    Math.max(20, ...used.map(r => Math.ceil(minutes(r.to) / 60)).filter(Number.isFinite)),
  ];
  const span = Math.max(1, end - start) * 60;
  const at = (hm: string) => `${Math.max(0, Math.min(100, ((minutes(hm) - start * 60) / span) * 100))}%`;
  const ticks = Array.from({ length: Math.floor((end - start) / 3) + 1 }, (_, i) => start + i * 3).filter(h => h <= end);

  const setDay = (day: WeekDay, ranges: readonly TimeRange[]) => setWeek({ ...week, [day]: ranges });
  const toggle = (day: WeekDay, open: boolean) => {
    if (!open) { setRemembered({ ...remembered, [day]: week[day] }); setDay(day, []); return; }
    const back = remembered[day]?.length ? remembered[day]! : bounds?.[day]?.length ? [bounds[day]![0]] : [{ from: '09:00', to: '17:00' }];
    setDay(day, back);
  };
  const copy = (from: WeekDay, to: readonly WeekDay[]) => {
    const next = { ...week };
    for (const day of to) if (day !== from && !(bounds && !bounds[day]?.length)) next[day] = (week[from] ?? []).map(r => ({ ...r }));
    setWeek(next);
  };

  return <div className={cx('easm-ui easm-ui-schedule', className)} role="group" aria-labelledby={`${id}-label`} aria-describedby={description ? `${id}-description` : undefined} data-readonly={readOnly || undefined}>
    <div className="easm-ui-schedule-head">
      <div><div className="easm-ui-field-label" id={`${id}-label`}>{label}</div>
        {description ? <div className="easm-ui-field-description" id={`${id}-description`}>{description}</div> : null}</div>
      {bounds ? <span className="easm-ui-schedule-key"><i aria-hidden="true" />{boundsLabel.replace(/^the /, '').replace(/^./, c => c.toUpperCase())}</span> : null}
    </div>
    <ol className="easm-ui-schedule-days">
      <li className="easm-ui-schedule-axis" aria-hidden="true"><span className="easm-ui-schedule-ticks">
        {ticks.map(h => <span key={h} style={{ insetInlineStart: `${((h - start) / (end - start)) * 100}%` }}>{String(h).padStart(2, '0')}</span>)}</span></li>
      {days.map(day => {
        const ranges = week[day] ?? [];
        const open = ranges.length > 0;
        const limit = bounds?.[day];
        const lockedShut = !!bounds && !limit?.length;
        const problems = scheduleProblems(ranges, bounds ? limit ?? [] : undefined, boundsLabel);
        const sorted = [...ranges].sort((a, b) => minutes(a.from) - minutes(b.from));
        const breaks = sorted.slice(1).map((r, i) => ({ from: sorted[i].to, to: r.from })).filter(b => minutes(b.from) < minutes(b.to));
        return <li key={day} className="easm-ui-schedule-day" data-open={open || undefined} data-problem={problems.length ? true : undefined}>
          <div className="easm-ui-schedule-day-name">
            {readOnly ? <span className="easm-ui-schedule-day-title">{dayNames[day]}</span>
              : <Switch label={dayNames[day]} size="sm" checked={open} disabled={lockedShut} onCheckedChange={checked => toggle(day, checked)}
                description={lockedShut ? `Closed in ${boundsLabel}` : undefined} />}
          </div>
          <div className="easm-ui-schedule-day-ranges">
            {!open ? <span className="easm-ui-schedule-closed">Closed</span>
              : readOnly ? <span className="easm-ui-schedule-summary">{sorted.map(r => `${r.from}–${r.to}`).join(', ')}{breaks.length ? <span> · break {breaks.map(b => `${b.from}–${b.to}`).join(', ')}</span> : null}</span>
              : ranges.map((range, i) => <div key={i} className="easm-ui-schedule-range">
                <TimeField label={`${dayNames[day]}, ${i ? `range ${i + 1} ` : ''}opens`} hideLabel size="sm" value={range.from} step={300}
                  onChange={event => setDay(day, ranges.map((r, j) => j === i ? { ...r, from: event.target.value } : r))} />
                <span className="easm-ui-schedule-dash" aria-hidden="true">–</span>
                <TimeField label={`${dayNames[day]}, ${i ? `range ${i + 1} ` : ''}closes`} hideLabel size="sm" value={range.to} step={300}
                  onChange={event => setDay(day, ranges.map((r, j) => j === i ? { ...r, to: event.target.value } : r))} />
                {ranges.length > 1 ? <IconButton icon="dismiss" size="sm" label={`Remove ${range.from}–${range.to} on ${dayNames[day]}`} onClick={() => setDay(day, ranges.filter((_, j) => j !== i))} /> : null}
                {i === ranges.length - 1 && ranges.length < maxRanges ? <IconButton icon="add" size="sm" label={`Add hours on ${dayNames[day]}`} onClick={() => {
                  const last = sorted[sorted.length - 1];
                  const from = Math.min(minutes(last.to) + 60, 22 * 60), to = Math.min(from + 120, 23 * 60 + 55);
                  setDay(day, [...ranges, { from: hhmm(from), to: hhmm(to) }]);
                }} /> : null}
              </div>)}
          </div>
          <div className="easm-ui-schedule-strip" aria-hidden="true">
            {limit?.map((b, i) => <i key={`b${i}`} className="easm-ui-schedule-bound" style={{ insetInlineStart: at(b.from), insetInlineEnd: `calc(100% - ${at(b.to)})` }} />)}
            {sorted.filter(r => minutes(r.from) < minutes(r.to)).map((r, i) => <i key={i} className="easm-ui-schedule-open" style={{ insetInlineStart: at(r.from), insetInlineEnd: `calc(100% - ${at(r.to)})` }} />)}
          </div>
          <div className="easm-ui-schedule-day-end">
            <span className="easm-ui-schedule-total">{open ? hours(duration(ranges)) : ''}</span>
            {!readOnly && open ? <DropdownMenu label={`Copy ${dayNames[day]}`} trigger={<IconButton icon="copy" size="sm" label={`Copy ${dayNames[day]}'s hours`} />} items={[
              { id: 'weekdays', label: 'Copy to weekdays', description: 'Monday to Friday', onSelect: () => copy(day, weekdays) },
              { id: 'all', label: 'Copy to every day', description: bounds ? `Days ${boundsLabel} close stay closed` : 'All seven days', onSelect: () => copy(day, order) },
            ]} /> : null}
          </div>
          {problems.length ? <div className="easm-ui-field-message easm-ui-schedule-problem" data-status="error" role="note"><UIIcon name="error-circle" size={16} /><div className="easm-ui-field-message-text">{problems.join(' ')}</div></div> : null}
        </li>;
      })}
    </ol>
    {holidays ? <Holidays holidays={holidays} onChange={onHolidaysChange} readOnly={readOnly} /> : null}
  </div>;
}

function Holidays({ holidays, onChange, readOnly }: { holidays: readonly ScheduleHoliday[]; onChange?: (next: ScheduleHoliday[]) => void; readOnly: boolean }) {
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
  const format = (iso: string) => { const d = new Date(`${iso}T12:00:00`); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); };
  const editable = !readOnly && !!onChange;
  return <div className="easm-ui-schedule-holidays">
    <div className="easm-ui-schedule-holidays-title"><UIIcon name="calendar" size={16} /><span className="easm-ui-schedule-holidays-text">Holidays<span>{holidays.length ? `${holidays.length} closed ${holidays.length === 1 ? 'day' : 'days'}` : 'None set'}</span></span></div>
    {sorted.length ? <ul>{sorted.map(h => <li key={h.id}><span className="easm-ui-schedule-holiday-date">{format(h.date)}</span><span className="easm-ui-schedule-holiday-name">{h.label}</span>
      {editable ? <IconButton icon="dismiss" size="sm" label={`Remove ${h.label}`} onClick={() => onChange!(holidays.filter(x => x.id !== h.id))} /> : null}</li>)}</ul> : null}
    {editable ? <form className="easm-ui-schedule-holiday-add" onSubmit={event => {
      event.preventDefault();
      if (!date || !name.trim()) return;
      onChange!([...holidays, { id: `${date}-${name.trim().toLowerCase().replace(/\W+/g, '-')}`, date, label: name.trim() }]);
      setDate(''); setName('');
    }}>
      <DateField label="Holiday date" size="sm" value={date} onChange={event => setDate(event.target.value)} />
      <TextField label="Name" size="sm" value={name} placeholder="Eid ul-Fitr" onChange={event => setName(event.target.value)} />
      <Button type="submit" size="sm" variant="secondary" leadingIcon="add" disabled={!date || !name.trim()}>Add holiday</Button>
    </form> : null}
  </div>;
}
