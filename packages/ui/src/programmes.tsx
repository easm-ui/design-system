'use client';

// A programme as it is taught (demand list C-CIMS-08, wave 4c, 2026-10-29): its schemes of study, each scheme's
// semesters with their credit hours, and each semester's courses with their kind, level and prerequisites. The scheme
// applicants are told about is marked. Replaces the separate programme, scheme and course tables of the Academic
// Advisor.
import { useId, useState, type HTMLAttributes } from 'react';
import type { IconName } from '@easm-ui/icons';
import { cx, UIIcon } from './shared';

export const programmeComponentNames = ['ProgrammeTree'] as const;

export type CourseKind = 'core' | 'elective' | 'lab' | 'shared';
const courseKinds: Record<CourseKind, { label: string; icon: IconName }> = {
  core: { label: 'Core', icon: 'course-core' }, elective: { label: 'Elective', icon: 'course-elective' },
  lab: { label: 'Lab', icon: 'course-lab' }, shared: { label: 'Shared', icon: 'course-shared' },
};
export interface ProgrammeCourse { id: string; code: string; title: string; credits: number; kind?: CourseKind; level?: string; prerequisites?: readonly string[] }
export interface ProgrammeSemester { id: string; label: string; courses: readonly ProgrammeCourse[] }
export interface ProgrammeScheme {
  id: string;
  /** The scheme by who it is for ("Fall 2024 intake, Pre-Engineering"). */
  label: string;
  /** The scheme applicants are told about. */
  forNewStudents?: boolean;
  semesters: readonly ProgrammeSemester[];
}
export interface ProgrammeTreeProps extends HTMLAttributes<HTMLElement> {
  programme: string;
  schemes: readonly ProgrammeScheme[];
  /** Open schemes and semesters at first; defaults to the scheme for new students and its first semester. */
  defaultOpen?: readonly string[];
  /** A course's code opens it. */
  onCourseSelect?: (id: string) => void;
}
const credits = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} credit ${n === 1 ? 'hour' : 'hours'}`;
const sum = (courses: readonly ProgrammeCourse[]) => courses.reduce((t, c) => t + c.credits, 0);

/** A programme's schemes, semesters and courses in one place: open a scheme to see its semesters with their credit
 *  hours, open a semester to see its courses (kind, level, prerequisites, credits). The scheme for new students is
 *  marked and opens first. */
export function ProgrammeTree({ programme, schemes, defaultOpen, onCourseSelect, className, ...props }: ProgrammeTreeProps) {
  const id = useId();
  const chosen = schemes.find(s => s.forNewStudents) ?? schemes[0];
  const [open, setOpen] = useState<Set<string>>(() => new Set(defaultOpen ?? (chosen ? [chosen.id, chosen.semesters[0]?.id].filter(Boolean) as string[] : [])));
  const toggle = (key: string) => setOpen(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  return <section {...props} aria-labelledby={`${id}-title`} className={cx('easm-ui easm-ui-programme', className)}>
    <h3 id={`${id}-title`} className="easm-ui-programme-title"><UIIcon name="scheme-of-study" size={20} /><span className="easm-ui-programme-title-text">{programme}<span>{schemes.length} {schemes.length === 1 ? 'scheme' : 'schemes'}</span></span></h3>
    <ul className="easm-ui-programme-schemes">
      {schemes.map(scheme => {
        const total = scheme.semesters.reduce((t, s) => t + sum(s.courses), 0);
        const isOpen = open.has(scheme.id);
        return <li key={scheme.id} className="easm-ui-programme-scheme" data-chosen={scheme.forNewStudents || undefined}>
          <button type="button" className="easm-ui-programme-toggle" aria-expanded={isOpen} aria-controls={`${id}-${scheme.id}`} onClick={() => toggle(scheme.id)}>
            <UIIcon name="chevron-right" size={16} className="easm-ui-programme-chevron" />
            <span className="easm-ui-programme-toggle-text"><span className="easm-ui-programme-scheme-name">{scheme.label}</span>
            {scheme.forNewStudents ? <span className="easm-ui-programme-chosen"><UIIcon name="who-students" size={16} />For new students</span> : null}
            <span className="easm-ui-programme-total">{scheme.semesters.length} {scheme.semesters.length === 1 ? 'semester' : 'semesters'} · {credits(total)}</span></span>
          </button>
          {isOpen ? <ul id={`${id}-${scheme.id}`} className="easm-ui-programme-semesters">
            {scheme.semesters.map(semester => {
              const semesterOpen = open.has(semester.id);
              return <li key={semester.id}>
                <button type="button" className="easm-ui-programme-toggle" data-level="semester" aria-expanded={semesterOpen} aria-controls={`${id}-${semester.id}`} onClick={() => toggle(semester.id)}>
                  <UIIcon name="chevron-right" size={16} className="easm-ui-programme-chevron" />
                  <span className="easm-ui-programme-toggle-text"><span className="easm-ui-programme-scheme-name">{semester.label}</span>
                  <span className="easm-ui-programme-total">{semester.courses.length} {semester.courses.length === 1 ? 'course' : 'courses'} · {credits(sum(semester.courses))}</span></span>
                </button>
                {semesterOpen ? <table id={`${id}-${semester.id}`} className="easm-ui-programme-courses">
                  <caption className="easm-ui-sr-only">{`${scheme.label}, ${semester.label}`}</caption>
                  <thead><tr><th scope="col">Code</th><th scope="col">Course</th><th scope="col">Kind</th><th scope="col">Needs first</th><th scope="col">Credits</th></tr></thead>
                  <tbody>{semester.courses.map(course => {
                    const kind = course.kind ? courseKinds[course.kind] : undefined;
                    return <tr key={course.id}>
                      <td data-label="Code" className="easm-ui-programme-code">{onCourseSelect ? <button type="button" onClick={() => onCourseSelect(course.id)}>{course.code}</button> : course.code}</td>
                      <td data-label="Course" className="easm-ui-programme-course">{course.title}{course.level ? <span className="easm-ui-programme-level">{course.level}</span> : null}</td>
                      <td data-label="Kind">{kind ? <span className="easm-ui-programme-kind"><UIIcon name={kind.icon} size={16} />{kind.label}</span> : null}</td>
                      <td data-label="Needs first">{course.prerequisites?.length ? <span className="easm-ui-programme-prereqs">{course.prerequisites.map(p => <span key={p}>{p}</span>)}</span> : <span className="easm-ui-programme-none">None</span>}</td>
                      <td data-label="Credits" className="easm-ui-programme-credits">{course.credits}</td>
                    </tr>;
                  })}</tbody>
                </table> : null}
              </li>;
            })}
          </ul> : null}
        </li>;
      })}
    </ul>
  </section>;
}

