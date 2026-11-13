'use client';

import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { IconButton } from './actions';
import { TextField, type TextFieldProps } from './inputs';
import { assignRef, reportContentProblem, useNativeFormReset } from './shared';

export interface PasswordFieldProps extends Omit<TextFieldProps, 'type' | 'trailingIcon' | 'trailingControls'> {
  revealable?: boolean;
}

/** A password input with an explicitly named, reversible visibility control. The control is a toggle button
 * with one fixed name, "Show password", whose pressed state says whether the password is shown (a toggle's
 * name never changes with its state, or "Hide password, pressed" would read as hiding being on). */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField({
  id: suppliedId, revealable = true, disabled, ...props
}, forwardedRef) {
  const generated = useId();
  const id = suppliedId ?? `easm-password-${generated}`;
  const [visible, setVisible] = useState(false);
  useEffect(() => { if (!revealable || disabled) setVisible(false); }, [revealable, disabled]);
  const input = useRef<HTMLInputElement>(null);
  useNativeFormReset(input, useCallback(() => setVisible(false), []));
  // Some browsers reset the selection when an input's type changes, so it is put back after the new type renders.
  const selection = useRef<[number, number] | null>(null);
  useLayoutEffect(() => {
    const control = input.current, range = selection.current;
    selection.current = null;
    if (control && range && control.ownerDocument.activeElement === control) control.setSelectionRange(range[0], range[1]);
  }, [visible]);
  const toggle = () => {
    const control = input.current;
    if (!control || disabled) return;
    const start = control.selectionStart, end = control.selectionEnd;
    selection.current = start !== null && end !== null ? [start, end] : null;
    setVisible(previous => !previous);
    control.focus({ preventScroll: true });
    if (start !== null && end !== null) control.setSelectionRange(start, end);
  };
  return <TextField {...props} id={id} disabled={disabled} type={visible && revealable ? 'text' : 'password'}
    ref={node => { input.current = node; assignRef(forwardedRef, node); }}
    trailingControls={revealable ? [<IconButton key="visibility" size="sm" icon={visible ? 'eye-off' : 'eye'}
      label="Show password" selected={visible} aria-controls={id} disabled={disabled}
      onMouseDown={event => event.preventDefault()} onClick={toggle} />] : undefined} />;
});

export interface NumberFieldProps extends Omit<TextFieldProps, 'type' | 'value' | 'defaultValue' | 'onChange' | 'trailingIcon' | 'trailingControls' | 'min' | 'max' | 'step'> {
  value?: number | null;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number | 'any';
  onValueChange?: (value: number | null) => void;
  steppers?: boolean;
}

/** A finite number, or the fallback when the value is a content problem (production only; development throws). */
function finite<T extends number | null | undefined>(name: string, candidate: T, fallback: T): T {
  if (candidate == null || Number.isFinite(candidate)) return candidate;
  reportContentProblem(`NumberField ${name} must be finite.`);
  return fallback;
}

/** Uses native numeric constraints/stepping; no floating-point addition is performed here. The steppers are
 * out of the tab order: arrow keys step the field itself, and the buttons stay named for pointer and touch. */
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField({
  value: suppliedValue, defaultValue: suppliedDefault, min: suppliedMin, max: suppliedMax, step: suppliedStep = 1, onValueChange, steppers = true,
  disabled, readOnly, inputMode, ...props
}, forwardedRef) {
  const value = finite('value', suppliedValue, null), defaultValue = finite('defaultValue', suppliedDefault, undefined);
  let min = finite('min', suppliedMin, undefined), max = finite('max', suppliedMax, undefined), step = suppliedStep;
  if (min != null && max != null && min > max) {
    reportContentProblem('NumberField min cannot exceed max.');
    min = undefined; max = undefined;
  }
  if (step !== 'any' && (!Number.isFinite(step) || step <= 0)) {
    reportContentProblem('NumberField step must be positive or any.');
    step = 1;
  }
  const controlled = value !== undefined;
  const [internal, setInternal] = useState<number | null>(defaultValue ?? null);
  const current = controlled ? value : internal;
  const input = useRef<HTMLInputElement>(null);
  useNativeFormReset(input, () => { if (!controlled) setInternal(defaultValue ?? null); });
  const blocked = disabled || readOnly || step === 'any';
  const update = (next: number | null) => { if (!controlled) setInternal(next); onValueChange?.(next); };
  const move = (direction: -1 | 1) => {
    const control = input.current;
    if (!control || blocked) return;
    const before = control.value;
    control.stepUp(direction);
    if (before !== control.value) {
      const next = Number.isFinite(control.valueAsNumber) ? control.valueAsNumber : null;
      // A controlled proposal is not a committed value until its owner accepts it.
      if (controlled) control.value = value == null ? '' : String(value);
      update(next);
    }
    control.focus({ preventScroll: true });
  };
  // The phone keypads that inputMode opens have no minus key, so a field that accepts negatives keeps the
  // number keyboard type="number" brings up. A caller's inputMode always wins.
  const keypad = min != null && min >= 0 ? step === 'any' || step % 1 !== 0 ? 'decimal' : 'numeric' : undefined;
  const fieldName = typeof props.label === 'string' ? props.label : 'value';
  return <TextField {...props} type="number" inputMode={inputMode ?? keypad}
    disabled={disabled} readOnly={readOnly} min={min} max={max} step={step}
    value={controlled ? value ?? '' : undefined} defaultValue={controlled ? undefined : defaultValue}
    controlClassName={['easm-ui-number-input', props.controlClassName].filter(Boolean).join(' ')}
    ref={node => { input.current = node; assignRef(forwardedRef, node); }}
    onChange={event => update(Number.isFinite(event.currentTarget.valueAsNumber) ? event.currentTarget.valueAsNumber : null)}
    trailingControls={steppers ? [
      <IconButton key="decrease" size="sm" icon="subtract" label={`Decrease ${fieldName}`} tabIndex={-1} disabled={blocked || current != null && min != null && current <= min} onMouseDown={event => event.preventDefault()} onClick={() => move(-1)} />,
      <IconButton key="increase" size="sm" icon="add" label={`Increase ${fieldName}`} tabIndex={-1} disabled={blocked || current != null && max != null && current >= max} onMouseDown={event => event.preventDefault()} onClick={() => move(1)} />,
    ] : undefined} />;
});
