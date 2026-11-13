'use client';

import {
  forwardRef, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type ButtonHTMLAttributes, type ChangeEventHandler, type InputHTMLAttributes,
  type KeyboardEventHandler, type ReactElement, type ReactNode, type RefObject,
  type TextareaHTMLAttributes,
} from 'react';
import type { IconName } from '@easm-ui/icons';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as SelectPrimitive from '@radix-ui/react-select';
import { assignRef, cx, iconSizeFor, reportContentProblem, UIIcon, useNativeFormReset, useOpenerLocale } from './shared';
import { useOverlayLayer } from './overlay-layer';
import { useFlip } from './motion-hooks';

export type InputSize = 'sm' | 'md' | 'lg';
export type FieldLabel = Exclude<ReactNode, null | undefined | boolean>;
export interface FieldCommonProps {
  label: FieldLabel;
  /** Supporting text under the control. Description, error and success render in a div, so block content
   * (a short list) is valid HTML. */
  description?: ReactNode;
  error?: ReactNode;
  success?: ReactNode;
  size?: InputSize;
  /** Keep the label for assistive technology but do not show it, when something visible beside the control
   * already names it (a table column heading, a toolbar, a SettingRow heading). */
  hideLabel?: boolean;
  /** Applied to the field wrapper. Use controlClassName for the visible input or selection trigger. */
  className?: string;
  controlClassName?: string;
}
export interface InputOption { value: string; label: string; disabled?: boolean }

const present = (value: ReactNode): boolean => typeof value === 'string' ? !!value.trim()
  : value == null || typeof value === 'boolean' ? false : Array.isArray(value) ? value.some(present) : true;
const controlIconSize = (size: InputSize) => iconSizeFor(size);
const joinIds = (...ids: (string | undefined)[]) => ids.filter(Boolean).join(' ') || undefined;
/** A caller's error wins only when it has content: an empty string or false never hides the component's own. */
const resolveFieldError = (supplied: ReactNode, automatic: ReactNode) => present(supplied) ? supplied : automatic;
const UNAVAILABLE_SELECTION = 'The selected option is no longer available. Choose another option.';
const CHOOSE_FROM_LIST = 'Choose an option from the list.';
function checkLabel(label: FieldLabel) {
  if (!present(label)) reportContentProblem('An EASM field requires a meaningful label.');
}
/** Options usually come from data. A blank or repeated value, or a blank label, is a content problem: it throws in
 * development and tests; in production the option is dropped (a blank label falls back to its value), so one bad
 * record leaves the rest of the list usable. An unchanged list keeps its identity. */
function checkOptions(options: readonly InputOption[]): readonly InputOption[] {
  const seen = new Set<string>(), clean: InputOption[] = [];
  let changed = false;
  for (const option of options) {
    const value = typeof option.value === 'string' ? option.value : '', label = typeof option.label === 'string' ? option.label : '';
    if (!value.trim() || !label.trim()) reportContentProblem('EASM options require non-empty values and labels.');
    if (!value.trim()) { changed = true; continue; }
    if (seen.has(value)) { reportContentProblem(`Duplicate EASM option value: ${value}`); changed = true; continue; }
    seen.add(value);
    if (label.trim()) clean.push(option); else { clean.push({ ...option, label: value }); changed = true; }
  }
  return changed ? clean : options;
}
const useCheckedOptions = (options: readonly InputOption[]) => useMemo(() => checkOptions(options), [options]);
/** The committed option for a value: available only while it exists and is enabled. A value without an
 * available option is shown as unavailable and never submitted. */
function availableSelection(options: readonly InputOption[], value: string) {
  const selectedOption = options.find(option => option.value === value);
  const available = selectedOption && !selectedOption.disabled ? selectedOption : undefined;
  return { selectedOption, available, unavailable: !!value && !available };
}
/** Native validation fires invalid on every invalid control, in tree order, before it reports any. One claim per
 * form per task means only the first invalid EASM selection control takes focus; a native control that the
 * browser reports afterwards still wins, as it should. */
const invalidFocusClaims = new WeakSet<object>();
function claimInvalidFocus(owner: object) {
  if (invalidFocusClaims.has(owner)) return false;
  invalidFocusClaims.add(owner);
  setTimeout(() => invalidFocusClaims.delete(owner), 0);
  return true;
}
/** The visual required marker; the control itself carries `required`. */
function RequiredMark() {
  return <span className="easm-ui-required" aria-hidden="true"> *</span>;
}
function useField(props: FieldCommonProps & { id?: string; required?: boolean; 'aria-describedby'?: string }) {
  const generated = useId();
  const id = props.id || `easm-field-${generated}`;
  checkLabel(props.label);
  return {
    id, labelId: `${id}-label`, descriptionId: `${id}-description`, errorId: `${id}-error`, successId: `${id}-success`,
    invalid: present(props.error),
    describedBy: joinIds(props['aria-describedby'], present(props.description) ? `${id}-description` : undefined,
      present(props.error) ? `${id}-error` : present(props.success) ? `${id}-success` : undefined),
  };
}
type FieldMetadata = ReturnType<typeof useField>;
function FieldMessages({ field, description, error, success }: { field: FieldMetadata } & Pick<FieldCommonProps, 'description' | 'error' | 'success'>) {
  return <>
    {present(description) && <div className="easm-ui-field-description" id={field.descriptionId}>{description}</div>}
    {present(error) ? <div className="easm-ui-field-message" data-status="error" id={field.errorId}><UIIcon name="error-circle" size={16} /><div className="easm-ui-field-message-text">{error}</div></div>
      : present(success) && <div className="easm-ui-field-message" data-status="success" id={field.successId}><UIIcon name="check-circle" size={16} /><div className="easm-ui-field-message-text">{success}</div></div>}
  </>;
}
function Field({ field, label, description, error, success, required, size = 'md', className, labelHidden = false, hideLabel = false, children }: FieldCommonProps & { field: FieldMetadata; required?: boolean; labelHidden?: boolean; children: ReactNode }) {
  const shown = !(labelHidden || hideLabel);
  // The control and its messages are one body below the label: in a row of fields side by side the labels share a
  // line and the controls the next one (inputs.css), so a label that wraps never pushes its control down.
  return <div className={cx('easm-ui', 'easm-ui-field', className)} data-size={size} data-labelled={shown || undefined} data-status={field.invalid ? 'error' : present(success) ? 'success' : undefined}>
    <label className={cx('easm-ui-field-label', !shown && 'easm-ui-sr-only')} id={field.labelId} htmlFor={field.id}>{label}{required && <RequiredMark />}</label>
    <div className="easm-ui-field-body">{children}<FieldMessages field={field} description={description} error={error} success={success} /></div>
  </div>;
}

type NativeInputProps = FieldCommonProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'children' | 'type'> & {
  type: string; leadingIcon?: IconName; trailingIcon?: IconName; pickerIcon?: IconName;
  /** One or two compact IconButton controls. Their actions and disabled state belong to the caller. */
  trailingControls?: ReactElement[];
};
const NativeInput = forwardRef<HTMLInputElement, NativeInputProps>(function NativeInput({
  label, description, error, success, size = 'md', hideLabel, className, controlClassName, leadingIcon, trailingIcon: suppliedTrailingIcon, pickerIcon: suppliedPickerIcon,
  trailingControls: suppliedControls, id, required, type, 'aria-describedby': describedBy, ...native
}, ref) {
  let trailingControls = suppliedControls, trailingIcon = suppliedTrailingIcon, pickerIcon = suppliedPickerIcon;
  if (suppliedControls && (suppliedControls.length > 2 || suppliedControls.length > 0 && (suppliedTrailingIcon || suppliedPickerIcon))) {
    reportContentProblem('TextField supports at most two trailing controls and cannot combine them with a trailing or picker icon.');
    // Production: the controls are the interactive part, so the first two stay and the decorative icons give way.
    trailingControls = suppliedControls.slice(0, 2); trailingIcon = undefined; pickerIcon = undefined;
  }
  const field = useField({ id, label, description, error, success, required, 'aria-describedby': describedBy });
  return <Field {...{ field, label, description, error, success, required, size, hideLabel, className }}>
    <div className="easm-ui-input-wrap" data-leading={leadingIcon ? true : undefined} data-trailing={trailingIcon ? true : undefined} data-picker={pickerIcon ? true : undefined} data-count={trailingControls?.length || undefined}>
      {leadingIcon && <span className="easm-ui-input-icon" data-position="leading"><UIIcon name={leadingIcon} size={controlIconSize(size)} /></span>}
      <input {...native} ref={ref} type={type} id={field.id} required={required} className={cx('easm-ui-input', controlClassName)}
        aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} aria-errormessage={field.invalid ? field.errorId : undefined} />
      {trailingIcon && <span className="easm-ui-input-icon" data-position="trailing"><UIIcon name={trailingIcon} size={controlIconSize(size)} /></span>}
      {pickerIcon && <span className="easm-ui-input-icon easm-ui-picker-icon" data-position="trailing"><UIIcon name={pickerIcon} size={controlIconSize(size)} /></span>}
      {!!trailingControls?.length && <div className="easm-ui-input-controls">{trailingControls.map((control, index) => <span className="easm-ui-input-control-slot" key={control.key ?? index}>{control}</span>)}</div>}
    </div>
  </Field>;
});

export type TextFieldType = 'text' | 'email' | 'password' | 'tel' | 'url' | 'number';
export interface TextFieldProps extends Omit<NativeInputProps, 'type' | 'pickerIcon'> { type?: TextFieldType }
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField({ type = 'text', ...props }, ref) {
  return <NativeInput {...props} type={type} ref={ref} />;
});

export interface TextAreaProps extends FieldCommonProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size' | 'children'> {}
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea({
  label, description, error, success, size = 'md', hideLabel, className, controlClassName, rows = 4, id, required, 'aria-describedby': describedBy, ...native
}, ref) {
  const field = useField({ id, label, description, error, success, required, 'aria-describedby': describedBy });
  return <Field {...{ field, label, description, error, success, required, size, hideLabel, className }}>
    <textarea {...native} ref={ref} id={field.id} rows={rows} required={required} className={cx('easm-ui-input', 'easm-ui-textarea', controlClassName)}
      aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} aria-errormessage={field.invalid ? field.errorId : undefined} />
  </Field>;
});

export interface SearchFieldProps extends Omit<FieldCommonProps, 'label'>, Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'children' | 'type' | 'value' | 'defaultValue'> {
  label?: FieldLabel; value?: string; defaultValue?: string; onValueChange?: (value: string) => void; onSearch?: (value: string) => void; clearable?: boolean;
  /** Keep the label for screen readers but not on screen, where the placeholder and icon already say it. */
  hideLabel?: boolean;
}
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField({
  label = 'Search', description, error, success, size = 'md', className, controlClassName, id, required,
  value, defaultValue = '', onValueChange, onChange, onSearch, onKeyDown, clearable = true, disabled, readOnly, hideLabel = false,
  'aria-describedby': describedBy, ...native
}, forwardedRef) {
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const inputRef = useRef<HTMLInputElement>(null);
  const field = useField({ id, label, description, error, success, required, 'aria-describedby': describedBy });
  const update = (next: string) => { if (value === undefined) setInternal(next); onValueChange?.(next); };
  const handleChange: ChangeEventHandler<HTMLInputElement> = event => { update(event.currentTarget.value); onChange?.(event); };
  useNativeFormReset(inputRef, () => { if (value === undefined) setInternal(defaultValue); });
  return <Field {...{ field, label, description, error, success, required, size, className }} labelHidden={hideLabel}>
    <div className="easm-ui-input-wrap" data-leading data-trailing={clearable ? true : undefined}>
      <span className="easm-ui-input-icon" data-position="leading"><UIIcon name="search" size={controlIconSize(size)} /></span>
      <input {...native} ref={node => { inputRef.current = node; assignRef(forwardedRef, node); }} id={field.id} type="search" value={current} required={required} disabled={disabled} readOnly={readOnly}
        enterKeyHint={native.enterKeyHint ?? 'search'}
        className={cx('easm-ui-input', 'easm-ui-search-input', controlClassName)} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined}
        aria-errormessage={field.invalid ? field.errorId : undefined} onChange={handleChange} onKeyDown={event => { onKeyDown?.(event); if (!event.defaultPrevented && !event.nativeEvent.isComposing && event.key === 'Enter') onSearch?.(current); }} />
      {clearable && current && !disabled && !readOnly && <button type="button" className="easm-ui-input-action" aria-label="Clear search" onClick={() => { update(''); inputRef.current?.focus(); }}><UIIcon name="close" size={16} /></button>}
    </div>
  </Field>;
});

/** Default finite selection uses the same branded, keyboard-accessible popup
 * as DropdownSelect. The native select is a hidden form bridge only. */
export interface SelectProps extends DropdownSelectProps {}
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(props, ref) {
  return <DropdownSelect {...props} ref={ref} />;
});

/** A portaled menu must retain the disabled state of its trigger's fieldsets,
 * including the browser's exception for descendants of the first legend. */
function useFieldsetDisabled(triggerRef: RefObject<HTMLButtonElement | null>) {
  const [inherited, setInherited] = useState(false);
  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const fieldsets: HTMLFieldSetElement[] = [];
    for (let parent = trigger.parentElement; parent; parent = parent.parentElement) {
      if (parent.tagName === 'FIELDSET') fieldsets.push(parent as HTMLFieldSetElement);
    }
    const sync = () => setInherited(fieldsets.some(fieldset => {
      const legend = Array.from(fieldset.children).find(child => child.tagName === 'LEGEND');
      return fieldset.disabled && !legend?.contains(trigger);
    }));
    sync();
    const observer = new MutationObserver(sync);
    fieldsets.forEach(fieldset => observer.observe(fieldset, { attributes: true, attributeFilter: ['disabled'], childList: true }));
    return () => observer.disconnect();
    // A mounted trigger keeps its ancestors; the observer follows their disabled state and legends.
  }, [triggerRef]);
  return inherited;
}

export interface DropdownSelectProps extends FieldCommonProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'type' | 'value' | 'defaultValue' | 'onChange' | 'dir'> {
  options: readonly InputOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  dir?: 'ltr' | 'rtl';
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onValueChange?: (value: string, option?: InputOption) => void;
  autoComplete?: string;
  /** inline: a compact filter pill that shows its label inside the trigger ("Dept · All"). */
  appearance?: 'field' | 'inline';
  /** A leading icon inside the trigger. */
  icon?: IconName;
  /** Keep the label for assistive technology but do not show it, when a visible heading beside the
   * control already names it (as in a SettingRow). */
  hideLabel?: boolean;
}

/** Branded finite selection. Radix owns the popup, keyboard/focus behavior and
 * native form select. The public ref and trigger events always target a button. */
export const DropdownSelect = forwardRef<HTMLButtonElement, DropdownSelectProps>(function DropdownSelect({
  label, description, error: suppliedError, success, size = 'md', className, controlClassName, id,
  value, defaultValue = '', placeholder = 'Select an option', required, disabled, readOnly, dir, name, form, autoComplete,
  open, defaultOpen = false, onOpenChange, onValueChange, onKeyDown, onPointerDown, appearance = 'field', icon, hideLabel = false,
  'aria-describedby': describedBy, options: suppliedOptions, ...triggerProps
}, forwardedRef) {
  const options = useCheckedOptions(suppliedOptions);
  const inline = appearance === 'inline';
  if (!placeholder.trim()) reportContentProblem('DropdownSelect requires a meaningful placeholder.');
  const shownPlaceholder = placeholder.trim() ? placeholder : 'Select an option';
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const { selectedOption, available, unavailable } = availableSelection(options, current);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const requestedOpen = open ?? internalOpen;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inheritedDisabled = useFieldsetDisabled(triggerRef);
  const blocked = !!disabled || inheritedDisabled;
  const popupOpen = requestedOpen && !blocked && !readOnly;
  // Radix stamps the trigger and the list with the root's direction (left-to-right unless told), so without this a
  // select in a right-to-left page reads and moves left-to-right. Read from the trigger's parent, not the trigger.
  const locale = useOpenerLocale(popupOpen, () => triggerRef.current?.parentElement, dir);
  const [constraintError, setConstraintError] = useState(false);
  const error = resolveFieldError(suppliedError, unavailable ? UNAVAILABLE_SELECTION : constraintError && required && !available ? CHOOSE_FROM_LIST : undefined);
  const field = useField({ id, label, description, error, success, required, 'aria-describedby': describedBy });
  const rootRef = useRef<HTMLDivElement>(null);
  const resetting = useRef(false);
  const committedValue = useRef(available?.value ?? '');
  committedValue.current = available?.value ?? '';
  const layer = useOverlayLayer('anchor');
  const changeOpen = (next: boolean) => {
    if (next && (blocked || readOnly || triggerRef.current?.matches(':disabled')) || next === requestedOpen) return;
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const changeValue = (next: string) => {
    // The primitive's native select also reflects programmatic changes. Report
    // only a new user proposal, never its own reflection or native reset callback.
    const unavailableControl = blocked || readOnly || triggerRef.current?.matches(':disabled');
    if (value !== undefined || resetting.current || unavailableControl) {
      const nativeSelect = rootRef.current?.querySelector('select');
      if (nativeSelect && nativeSelect.value !== (available?.value ?? '')) nativeSelect.value = available?.value ?? '';
    }
    if (resetting.current || unavailableControl || next === (available?.value ?? '')) return;
    const option = options.find(item => item.value === next && !item.disabled);
    if (!option) {
      const nativeSelect = rootRef.current?.querySelector('select');
      if (nativeSelect) nativeSelect.value = available?.value ?? '';
      return;
    }
    if (value === undefined) setInternal(next);
    if (value === undefined) setConstraintError(false);
    onValueChange?.(next, option);
  };
  useEffect(() => { if (available || !required || blocked || readOnly) setConstraintError(false); }, [available?.value, required, blocked, readOnly]);
  useEffect(() => {
    if (blocked || readOnly) {
      if (requestedOpen) onOpenChange?.(false);
      setInternalOpen(false);
    }
    // A blocked state transition requests closure once. Controlled parents own open.
  }, [blocked, readOnly]);
  useEffect(() => {
    const control = triggerRef.current, associatedForm = control?.form;
    if (!control || !associatedForm) return;
    const reset = (event: Event) => {
      resetting.current = true;
      queueMicrotask(() => {
        resetting.current = false;
        if (event.defaultPrevented || !control.isConnected) return;
        if (value === undefined) setInternal(defaultValue);
        else {
          // Native reset restores the primitive select's original default even
          // when its controlled owner keeps a later value. Reconcile the real
          // form control after that default action, without emitting a change.
          const nativeSelect = rootRef.current?.querySelector('select');
          if (nativeSelect) nativeSelect.value = committedValue.current;
        }
        setConstraintError(false);
        if (open === undefined) setInternalOpen(false);
      });
    };
    // Capture precedes Radix's reset listener, which otherwise proposes a value
    // before other form handlers have had the opportunity to cancel the reset.
    associatedForm.addEventListener('reset', reset, true);
    return () => associatedForm.removeEventListener('reset', reset, true);
  }, [value, defaultValue, form, open]);
  useLayoutEffect(() => {
    const wrapper = rootRef.current;
    if (!wrapper) return;
    const applyConstraint = () => wrapper.querySelector('select')?.setCustomValidity(!blocked && !readOnly && unavailable ? 'Choose an available option from the list.' : '');
    applyConstraint();
    // Radix replaces its native select when the finite option set changes. This
    // internal validation hook does not bridge its ref or manufacture events.
    const observer = new MutationObserver(applyConstraint);
    observer.observe(wrapper, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [blocked, readOnly, unavailable, options]);
  return <Field {...{ field, label, description, error, success, required, size }} className={cx(className, inline && 'easm-ui-field-inline')} labelHidden={inline || hideLabel}>
    <div ref={rootRef} className="easm-ui-dropdown-select-root" onInvalidCapture={event => {
      // The native select is hidden, so its own bubble is suppressed and the visible trigger is focused instead,
      // scrolled into view, and only when it is the first invalid EASM selection control in its form.
      event.preventDefault(); setConstraintError(true);
      if (claimInvalidFocus((event.target as HTMLSelectElement).form ?? document)) triggerRef.current?.focus();
    }}>
      <SelectPrimitive.Root value={available?.value ?? ''} onValueChange={changeValue} open={popupOpen} onOpenChange={changeOpen}
        name={name} form={form} autoComplete={autoComplete} dir={locale.dir} disabled={blocked} required={required && !readOnly}>
        <SelectPrimitive.Trigger {...triggerProps} id={field.id} form={form}
          ref={node => { triggerRef.current = node; assignRef(forwardedRef, node); }}
          className={cx('easm-ui-input', 'easm-ui-dropdown-select-trigger', controlClassName)}
          aria-labelledby={joinIds(field.labelId, triggerProps['aria-labelledby'])} aria-describedby={field.describedBy}
          aria-invalid={field.invalid || undefined} aria-errormessage={field.invalid ? field.errorId : undefined}
          aria-readonly={readOnly || undefined} data-readonly={readOnly || undefined} data-unavailable={unavailable || undefined}
          onPointerDown={event => { onPointerDown?.(event); if (readOnly) event.preventDefault(); }}
          onKeyDown={event => { onKeyDown?.(event); if (readOnly && event.key !== 'Tab' && !event.ctrlKey && !event.metaKey) event.preventDefault(); }}>
          {icon ? <UIIcon name={icon} size={16} className="easm-ui-dropdown-select-icon" /> : null}
          {inline ? <span className="easm-ui-dropdown-select-inline-label" aria-hidden="true">{label}</span> : null}
          {/* The primitive's value span takes no class, so a wrapper carries the truncation. */}
          <span className="easm-ui-dropdown-select-value"><SelectPrimitive.Value placeholder={unavailable ? selectedOption?.label ?? 'Unavailable selection' : shownPlaceholder}>{available?.label}</SelectPrimitive.Value></span>
          <SelectPrimitive.Icon asChild><span className="easm-ui-dropdown-select-chevron"><UIIcon name="chevron-down" size={controlIconSize(size)} /></span></SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content position="popper" side="bottom" align="start" sideOffset={6} collisionPadding={12} hideWhenDetached
            style={layer.style} className="easm-ui easm-ui-dropdown-select-popup" data-size={size} data-appearance={appearance} aria-labelledby={field.labelId} lang={locale.lang}>
            <SelectPrimitive.ScrollUpButton className="easm-ui-dropdown-select-scroll" aria-hidden="true"><UIIcon name="chevron-up" size={16} /></SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport className="easm-ui-dropdown-select-viewport">
              {options.map(option => <SelectPrimitive.Item key={option.value} value={option.value} disabled={option.disabled} textValue={option.label} className="easm-ui-dropdown-select-option easm-ui-listbox-option">
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <span className="easm-ui-dropdown-select-check"><SelectPrimitive.ItemIndicator><UIIcon name="checkmark" size={16} /></SelectPrimitive.ItemIndicator></span>
              </SelectPrimitive.Item>)}
              {!options.length && <p className="easm-ui-dropdown-select-empty">No options are available.</p>}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className="easm-ui-dropdown-select-scroll" aria-hidden="true"><UIIcon name="chevron-down" size={16} /></SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  </Field>;
});

export interface ComboboxProps extends FieldCommonProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'children' | 'value' | 'defaultValue' | 'onChange' | 'type' | 'role' | 'list'> {
  options: readonly InputOption[]; value?: string; defaultValue?: string;
  onValueChange?: (value: string, option?: InputOption) => void;
  onQueryChange?: (query: string) => void;
  clearable?: boolean;
  /** Open the list when the field receives focus (default). Set false to open only on typing, ArrowDown or a
   * click, so tabbing through a form does not pop every list open. */
  openOnFocus?: boolean;
}
export const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(function Combobox({
  label, description, error: suppliedError, success, size = 'md', hideLabel, className, controlClassName, id, required,
  options: suppliedOptions, value, defaultValue = '', onValueChange, onQueryChange, clearable = true, openOnFocus = true, disabled, readOnly, name, form,
  onKeyDown, onFocus, onClick, onBlur, onInvalid, 'aria-describedby': describedBy, ...native
}, forwardedRef) {
  const options = useCheckedOptions(suppliedOptions);
  const [internal, setInternal] = useState(defaultValue);
  const selected = value ?? internal;
  const { selectedOption, available: availableOption, unavailable } = availableSelection(options, selected);
  const [query, setQuery] = useState(selectedOption?.label ?? '');
  const [open, setOpen] = useState(false);
  const layer = useOverlayLayer('anchor');
  const popupOpen = open && !disabled && !readOnly;
  const [dirty, setDirty] = useState(false);
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const [constraintError, setConstraintError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const locale = useOpenerLocale(popupOpen, () => rootRef.current);
  const popupRef = useRef<HTMLDivElement>(null);
  const suppressFocusOpen = useRef(false);
  const listRef = useRef<HTMLUListElement>(null);
  // While typing narrows the options, the ones that stay glide up instead of jumping (new ones rise in from CSS).
  useFlip(listRef, ':scope > *', { enter: false });
  const error = resolveFieldError(suppliedError, unavailable ? UNAVAILABLE_SELECTION : constraintError && required && !availableOption ? CHOOSE_FROM_LIST : undefined);
  const field = useField({ id, label, description, error, success, required, 'aria-describedby': describedBy });
  const listId = `${field.id}-listbox`;
  const filtered = options.filter(option => !dirty || option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const enabled = filtered.filter(option => !option.disabled);
  const active = enabled.find(option => option.value === activeValue);
  const activeIndex = active ? filtered.findIndex(option => option.value === active.value) : -1;
  const visibleValue = popupOpen ? query : selectedOption?.label ?? '';

  useEffect(() => { if (!dirty || !open) setQuery(selectedOption?.label ?? ''); }, [selectedOption?.label, selected, dirty, open]);
  useEffect(() => { if (disabled || readOnly) { setOpen(false); setDirty(false); setActiveValue(null); } }, [disabled, readOnly]);
  useEffect(() => { if (activeValue && !enabled.some(option => option.value === activeValue)) setActiveValue(null); }, [activeValue, enabled]);
  useEffect(() => {
    inputRef.current?.setCustomValidity(!disabled && !readOnly && (unavailable || required && !availableOption) ? 'Choose an available option from the list.' : '');
  }, [availableOption, required, disabled, readOnly, unavailable]);
  useEffect(() => { if (availableOption || !required || disabled || readOnly) setConstraintError(false); }, [availableOption?.value, required, disabled, readOnly]);
  useEffect(() => {
    if (!popupOpen || activeIndex < 0) return;
    const element = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    if (!element || !listRef.current) return;
    const top = element.offsetTop, bottom = top + element.offsetHeight;
    if (top < listRef.current.scrollTop) listRef.current.scrollTop = top;
    else if (bottom > listRef.current.scrollTop + listRef.current.clientHeight) listRef.current.scrollTop = bottom - listRef.current.clientHeight;
  }, [popupOpen, activeIndex]);
  useNativeFormReset(inputRef, () => {
    if (value === undefined) setInternal(defaultValue);
    setQuery(options.find(option => option.value === (value ?? defaultValue))?.label ?? '');
    setOpen(false); setDirty(false); setActiveValue(null); setConstraintError(false);
  });
  const close = () => { setOpen(false); setDirty(false); setActiveValue(null); setQuery(selectedOption?.label ?? ''); };
  const commit = (option?: InputOption) => {
    if (disabled || readOnly || option?.disabled) return;
    const next = option?.value ?? '';
    if (value === undefined) setInternal(next);
    onValueChange?.(next, option);
    setQuery(option?.label ?? ''); setDirty(false); setOpen(false); setActiveValue(null); if (value === undefined) setConstraintError(false);
    suppressFocusOpen.current = true; inputRef.current?.focus(); suppressFocusOpen.current = false;
  };
  const handleKey: KeyboardEventHandler<HTMLInputElement> = event => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || disabled || readOnly) return;
    if (event.altKey) {
      if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); }
      else if (event.key === 'ArrowUp' && open) { event.preventDefault(); close(); }
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true);
      const currentIndex = enabled.findIndex(option => option.value === activeValue);
      const next = currentIndex < 0 ? event.key === 'ArrowDown' ? 0 : enabled.length - 1
        : Math.max(0, Math.min(enabled.length - 1, currentIndex + (event.key === 'ArrowDown' ? 1 : -1)));
      setActiveValue(enabled[next]?.value ?? null);
    } else if ((event.key === 'Home' || event.key === 'End') && open) {
      event.preventDefault(); setActiveValue((event.key === 'Home' ? enabled[0] : enabled[enabled.length - 1])?.value ?? null);
    } else if (event.key === 'Enter' && open) {
      event.preventDefault(); if (active) commit(active); else close();
    } else if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); close();
    } else if (event.key === 'Tab') close();
  };
  return <PopoverPrimitive.Root open={popupOpen} onOpenChange={next => { if (!next) close(); else if (!disabled && !readOnly) setOpen(true); }}>
    <div ref={rootRef} className="easm-ui-combobox-root" onBlur={event => { const target = event.relatedTarget as Node | null; if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) close(); }}>
    <Field {...{ field, label, description, error, success, required, size, hideLabel, className }}>
      <PopoverPrimitive.Anchor asChild><div className="easm-ui-input-wrap" data-trailing data-expanded={popupOpen || undefined} data-clearable={clearable && selected && !disabled && !readOnly ? true : undefined}>
        <input {...native} ref={node => { inputRef.current = node; assignRef(forwardedRef, node); }} id={field.id} type="text" role="combobox" autoComplete="off"
          aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={popupOpen} aria-controls={popupOpen ? listId : undefined}
          aria-activedescendant={popupOpen && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined} aria-describedby={field.describedBy}
          aria-invalid={field.invalid || undefined} aria-errormessage={field.invalid ? field.errorId : undefined}
          required={required && !readOnly} disabled={disabled} readOnly={readOnly} value={visibleValue} form={form}
          className={cx('easm-ui-input', controlClassName)} onKeyDown={handleKey}
          onFocus={event => { onFocus?.(event); if (openOnFocus && !disabled && !readOnly && !suppressFocusOpen.current) { setQuery(selectedOption?.label ?? ''); setOpen(true); } }}
          onClick={event => { onClick?.(event); if (!event.defaultPrevented && !disabled && !readOnly) setOpen(true); }}
          onBlur={onBlur} onInvalid={event => { claimInvalidFocus(event.currentTarget.form ?? document); setConstraintError(true); onInvalid?.(event); }}
          onChange={event => { if (disabled || readOnly) return; setQuery(event.currentTarget.value); onQueryChange?.(event.currentTarget.value); setDirty(true); setOpen(true); setActiveValue(null); }} />
        <input type="hidden" name={name} form={form} value={availableOption?.value ?? ''} disabled={disabled} />
        <span className="easm-ui-input-icon easm-ui-combobox-chevron" data-position="trailing"><UIIcon name="chevron-down" size={controlIconSize(size)} /></span>
        {clearable && selected && !disabled && !readOnly && <button type="button" className="easm-ui-input-action" data-offset aria-label="Clear selection" onMouseDown={event => event.preventDefault()} onClick={() => commit()}><UIIcon name="close" size={16} /></button>}
      </div></PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content ref={popupRef} role="presentation" side="bottom" align="start" sideOffset={6} collisionPadding={12}
          className="easm-ui easm-ui-combobox-popup" data-size={size} style={layer.style} {...locale}
          onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}
          onInteractOutside={event => { if (rootRef.current?.contains(event.target as Node)) event.preventDefault(); }}>
        <ul ref={listRef} id={listId} role="listbox" aria-labelledby={field.labelId} className="easm-ui-combobox-list">
          {filtered.map((option, index) => <li key={option.value} id={`${listId}-${index}`} role="option" tabIndex={-1} className="easm-ui-listbox-option"
            aria-selected={selected === option.value} aria-disabled={option.disabled || undefined} data-active={active?.value === option.value || undefined}
            onPointerDown={event => event.preventDefault()} onMouseDown={event => event.preventDefault()} onClick={() => commit(option)}>
            <span>{option.label}</span>{selected === option.value && <UIIcon name="checkmark" size={16} />}
          </li>)}
        </ul>
        {/* Mounted while the list is open, so the change to "no matches" is announced. */}
        <p className="easm-ui-combobox-empty" role="status">{filtered.length ? '' : 'No matching options.'}</p>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </Field>
    </div>
  </PopoverPrimitive.Root>;
});

/** The text beside a checkbox, radio or switch: the same required mark as every field, and hideLabel keeps it for
 * assistive technology only (a row-selection checkbox under a column heading). */
function ChoiceLabel({ label, required, hidden }: { label: FieldLabel; required?: boolean; hidden?: boolean }) {
  return <span className={cx('easm-ui-choice-label', hidden && 'easm-ui-sr-only')}>{label}{required && <RequiredMark />}</span>;
}

export interface CheckboxProps extends FieldCommonProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'children' | 'type'> {
  indeterminate?: boolean; onCheckedChange?: (checked: boolean) => void;
}
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({
  label, description, error, success, size = 'md', hideLabel, className, controlClassName, id, required, indeterminate = false,
  checked, defaultChecked = false, onCheckedChange, onChange, onClick, disabled, readOnly, 'aria-describedby': describedBy, ...native
}, forwardedRef) {
  const [internal, setInternal] = useState(defaultChecked);
  const current = checked ?? internal;
  const inputRef = useRef<HTMLInputElement>(null);
  const field = useField({ id, label, description, error, success, required, 'aria-describedby': describedBy });
  useLayoutEffect(() => { if (inputRef.current) inputRef.current.indeterminate = indeterminate; });
  useNativeFormReset(inputRef, () => { if (checked === undefined) setInternal(defaultChecked); });
  return <div className={cx('easm-ui', 'easm-ui-field', 'easm-ui-choice-field', className)} data-size={size} data-status={field.invalid ? 'error' : undefined}>
    <label className="easm-ui-choice" htmlFor={field.id} id={field.labelId}>
      <span className="easm-ui-checkbox-wrap">
        <input {...native} ref={node => { inputRef.current = node; assignRef(forwardedRef, node); }} type="checkbox" id={field.id} required={required && !readOnly} disabled={disabled} readOnly={readOnly}
          checked={current} className={cx('easm-ui-checkbox', controlClassName)} aria-checked={indeterminate ? 'mixed' : undefined} aria-readonly={readOnly || undefined}
          aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} aria-errormessage={field.invalid ? field.errorId : undefined}
          data-indeterminate={indeterminate || undefined} onClick={onClick}
          onChange={event => { if (readOnly || disabled) { event.currentTarget.indeterminate = indeterminate; return; }
            if (checked === undefined) setInternal(event.currentTarget.checked); onCheckedChange?.(event.currentTarget.checked); onChange?.(event); event.currentTarget.indeterminate = indeterminate; }} />
        <span className="easm-ui-checkbox-mark" aria-hidden="true"><UIIcon name={indeterminate ? 'menu' : 'checkmark'} size={16} /></span>
      </span><ChoiceLabel label={label} required={required} hidden={hideLabel} />
    </label><FieldMessages field={field} description={description} error={error} success={success} />
  </div>;
});

export interface RadioProps extends FieldCommonProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'children' | 'type'> { onCheckedChange?: (checked: boolean) => void }
export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio({
  label, description, error, success, size = 'md', hideLabel, className, controlClassName, id, required, onCheckedChange, onChange, onClick, disabled, readOnly,
  'aria-describedby': describedBy, ...native
}, ref) {
  const field = useField({ id, label, description, error, success, required, 'aria-describedby': describedBy });
  return <div className={cx('easm-ui', 'easm-ui-field', 'easm-ui-choice-field', className)} data-size={size} data-status={field.invalid ? 'error' : undefined}>
    <label className="easm-ui-choice" htmlFor={field.id} id={field.labelId}>
      <input {...native} ref={ref} type="radio" id={field.id} required={required && !readOnly} disabled={disabled} readOnly={readOnly}
        className={cx('easm-ui-radio', controlClassName)} aria-readonly={readOnly || undefined} aria-describedby={field.describedBy}
        aria-invalid={field.invalid || undefined} aria-errormessage={field.invalid ? field.errorId : undefined}
        onClick={event => { onClick?.(event); if (readOnly) event.preventDefault(); }} onChange={event => { if (!readOnly && !disabled) { onCheckedChange?.(event.currentTarget.checked); onChange?.(event); } }} />
      <ChoiceLabel label={label} required={required} hidden={hideLabel} />
    </label><FieldMessages field={field} description={description} error={error} success={success} />
  </div>;
});

export interface SwitchProps extends RadioProps {}
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch({
  label, description, error, success, size = 'md', hideLabel, className, controlClassName, id, required, checked, defaultChecked = false, onCheckedChange, onChange, onClick, disabled, readOnly,
  'aria-describedby': describedBy, ...native
}, forwardedRef) {
  const [internal, setInternal] = useState(defaultChecked);
  const current = checked ?? internal;
  const inputRef = useRef<HTMLInputElement>(null);
  useNativeFormReset(inputRef, () => { if (checked === undefined) setInternal(defaultChecked); });
  const field = useField({ id, label, description, error, success, required, 'aria-describedby': describedBy });
  return <div className={cx('easm-ui', 'easm-ui-field', 'easm-ui-choice-field', className)} data-size={size} data-status={field.invalid ? 'error' : undefined}>
    <label className="easm-ui-choice" htmlFor={field.id} id={field.labelId}>
      <input {...native} ref={node => { inputRef.current = node; assignRef(forwardedRef, node); }} checked={current} type="checkbox" role="switch" id={field.id} required={required && !readOnly} disabled={disabled} readOnly={readOnly}
        className={cx('easm-ui-switch', controlClassName)} aria-readonly={readOnly || undefined} aria-describedby={field.describedBy}
        aria-invalid={field.invalid || undefined} aria-errormessage={field.invalid ? field.errorId : undefined}
        onClick={onClick} onChange={event => { if (!readOnly && !disabled) { if (checked === undefined) setInternal(event.currentTarget.checked); onCheckedChange?.(event.currentTarget.checked); onChange?.(event); } }} />
      <ChoiceLabel label={label} required={required} hidden={hideLabel} />
    </label><FieldMessages field={field} description={description} error={error} success={success} />
  </div>;
});

export type DateFieldProps = Omit<TextFieldProps, 'type' | 'leadingIcon' | 'trailingIcon' | 'trailingControls'>;
export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(function DateField(props, ref) {
  return <NativeInput {...props} type="date" pickerIcon="calendar" ref={ref} />;
});
export type TimeFieldProps = DateFieldProps;
export const TimeField = forwardRef<HTMLInputElement, TimeFieldProps>(function TimeField(props, ref) {
  return <NativeInput {...props} type="time" pickerIcon="clock" ref={ref} />;
});
export type DateTimeFieldProps = DateFieldProps;
/** A local date and time in one native control (datetime-local); the browser owns the picker, as in DateField. */
export const DateTimeField = forwardRef<HTMLInputElement, DateTimeFieldProps>(function DateTimeField(props, ref) {
  return <NativeInput {...props} type="datetime-local" pickerIcon="calendar" ref={ref} />;
});

export type FileRejectionCode = 'accept' | 'size' | 'multiple' | 'unsupported-browser';
export interface FileRejectionReason { code: FileRejectionCode; message: string }
export interface FileRejection { file: File; reasons: FileRejectionReason[] }
export interface FileUploadProps extends FieldCommonProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'children' | 'type' | 'value' | 'defaultValue' | 'onChange'> {
  maxBytes?: number;
  allowRemove?: boolean;
  onFiles: (accepted: File[], rejected: FileRejection[]) => void;
  /** Native cancel event from the browser's file picker. */
  onCancel?: (event: Event) => void;
}
function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
const ACCEPT_TOKEN = /^(\.[a-z0-9][a-z0-9._+\-]*|[a-z0-9!#$&^_.+\-]+\/(?:\*|[a-z0-9!#$&^_.+\-]+))$/i;
/** Invalid tokens are a content problem. In production they are ignored, as the browser's own picker ignores them. */
function parseAccept(accept: string | undefined) {
  const tokens = (accept ?? '').split(',').map(token => token.trim().toLowerCase()).filter(Boolean);
  const valid = tokens.filter(token => ACCEPT_TOKEN.test(token));
  if (valid.length !== tokens.length) reportContentProblem('FileUpload accept must use file extensions or MIME types, separated by commas.');
  return valid;
}
function acceptsFile(file: File, tokens: string[]) {
  return !tokens.length || tokens.some(token => token.startsWith('.') ? file.name.toLowerCase().endsWith(token)
    : token.endsWith('/*') ? file.type.toLowerCase().startsWith(token.slice(0, -1)) : file.type.toLowerCase() === token);
}
function synchronizeFiles(input: HTMLInputElement | null, files: File[]) {
  if (!input) return false;
  if (!files.length) { input.value = ''; return true; }
  const current = Array.from(input.files ?? []);
  if (current.length === files.length && current.every((file, index) => file === files[index])) return true;
  try {
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
    return input.files.length === files.length;
  } catch { return false; }
}
export const FileUpload = forwardRef<HTMLInputElement, FileUploadProps>(function FileUpload({
  label, description, error: suppliedError, success, size = 'md', hideLabel, className, controlClassName, id, required, maxBytes: suppliedMaxBytes, accept, multiple = false,
  allowRemove = true, onFiles, onClick, onCancel, onInvalid, disabled, readOnly, 'aria-describedby': describedBy, ...native
}, forwardedRef) {
  let maxBytes = suppliedMaxBytes;
  if (maxBytes !== undefined && (!Number.isFinite(maxBytes) || maxBytes < 0)) {
    reportContentProblem('FileUpload maxBytes must be a finite non-negative number.');
    maxBytes = undefined;
  }
  const acceptedTypes = parseAccept(accept);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // A file added or removed: the others glide to their new places.
  useFlip(listRef);
  const previousFiles = useRef<File[]>([]);
  const dragDepth = useRef(0);
  const constraintRef = useRef({ accept, maxBytes, multiple });
  // Row keys follow the File object, so removing one row never remounts the rows after it.
  const fileKeys = useRef(new WeakMap<File, number>());
  const nextFileKey = useRef(0);
  const keyFor = (file: File) => {
    let key = fileKeys.current.get(file);
    if (key === undefined) { key = ++nextFileKey.current; fileKeys.current.set(file, key); }
    return key;
  };
  // Where focus goes after a remove button's row disappears: the row that takes its place, else the one
  // before it, else the file input.
  const focusAfterRemoval = useRef<number | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [rejected, setRejected] = useState<FileRejection[]>([]);
  const [pickerError, setPickerError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const error = resolveFieldError(suppliedError, pickerError ?? (rejected.length ? `${rejected.length} ${rejected.length === 1 ? 'file was' : 'files were'} not added. Review the reasons below.` : undefined));
  const field = useField({ id, label, description, error, success, required, 'aria-describedby': describedBy });
  const requirementsId = `${field.id}-requirements`;
  const rejectionId = `${field.id}-rejections`;
  const readonlyGuard = !!disabled || !!readOnly;
  // Callback arrays are consumer-owned; native File objects keep their identity.
  const emitFiles = (accepted: File[], failures: FileRejection[]) => onFiles([...accepted], failures.map(item => ({
    file: item.file, reasons: item.reasons.map(reason => ({ ...reason })),
  })));
  /** pick: the picker's new selection replaces the old one. drop: the same, except a drop where every file is
   * rejected keeps the earlier selection and only reports the rejections. revalidate: the constraints changed. */
  const process = (incoming: File[], mode: 'pick' | 'drop' | 'revalidate' = 'pick') => {
    const revalidate = mode === 'revalidate';
    if (readonlyGuard && !revalidate) return;
    const accepted: File[] = [], failures: FileRejection[] = [];
    for (const file of incoming) {
      const reasons: FileRejectionReason[] = [];
      if (!multiple && incoming.length > 1) reasons.push({ code: 'multiple', message: 'Choose one file at a time.' });
      if (!acceptsFile(file, acceptedTypes)) reasons.push({ code: 'accept', message: 'This file type is not accepted.' });
      if (maxBytes !== undefined && file.size > maxBytes) reasons.push({ code: 'size', message: `File exceeds the ${formatBytes(maxBytes)} limit.` });
      if (reasons.length) failures.push({ file, reasons }); else accepted.push(file);
    }
    if (revalidate && !failures.length) return;
    if (mode === 'drop' && !accepted.length && failures.length && previousFiles.current.length) {
      setRejected(failures); setPickerError(undefined); emitFiles(previousFiles.current, failures);
      return;
    }
    if (!synchronizeFiles(inputRef.current, accepted)) {
      for (const file of accepted) failures.push({ file, reasons: [{ code: 'unsupported-browser', message: 'This browser cannot attach these files. Choose files with the picker.' }] });
      accepted.length = 0; synchronizeFiles(inputRef.current, []);
    }
    previousFiles.current = accepted; setFiles(accepted); setRejected(failures); setPickerError(undefined); emitFiles(accepted, failures);
  };
  useEffect(() => { if (readonlyGuard) { setDragging(false); dragDepth.current = 0; } }, [readonlyGuard]);
  useEffect(() => {
    const previous = constraintRef.current;
    if (previous.accept === accept && previous.maxBytes === maxBytes && previous.multiple === multiple) return;
    constraintRef.current = { accept, maxBytes, multiple };
    setRejected([]); setPickerError(undefined);
    if (files.length) process(files, 'revalidate');
  });
  useNativeFormReset(inputRef, () => {
    const hadFiles = files.length > 0;
    previousFiles.current = []; setFiles([]); setRejected([]); setPickerError(undefined); setDragging(false); dragDepth.current = 0;
    if (hadFiles) emitFiles([], []);
  });
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const cancel = (event: Event) => {
      if (!synchronizeFiles(input, previousFiles.current)) {
        previousFiles.current = []; setFiles([]); setPickerError('Selection was cleared. Choose the file again.'); emitFiles([], []);
      }
      onCancel?.(event);
    };
    input.addEventListener('cancel', cancel);
    return () => input.removeEventListener('cancel', cancel);
  }, [onCancel, onFiles]);
  useLayoutEffect(() => {
    const index = focusAfterRemoval.current;
    if (index === null) return;
    focusAfterRemoval.current = null;
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('.easm-ui-file-remove:not(:disabled)');
    const target = buttons?.length ? buttons[Math.min(index, buttons.length - 1)] : inputRef.current;
    target?.focus();
  }, [files]);
  return <Field {...{ field, label, description, error, success, required, size, hideLabel, className }}>
    <div className="easm-ui-upload-zone" data-dragging={dragging || undefined} data-disabled={disabled || undefined} data-readonly={readOnly || undefined}
      onDragEnter={event => { if (!Array.from(event.dataTransfer.types).includes('Files')) return; event.preventDefault(); if (!readonlyGuard) { dragDepth.current++; setDragging(true); } }}
      onDragOver={event => { if (!Array.from(event.dataTransfer.types).includes('Files')) return; event.preventDefault(); event.dataTransfer.dropEffect = readonlyGuard ? 'none' : 'copy'; }}
      onDragLeave={event => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }}
      onDrop={event => { event.preventDefault(); dragDepth.current = 0; setDragging(false); if (!readonlyGuard) process(Array.from(event.dataTransfer.files), 'drop'); }}>
      <span className="easm-ui-upload-illustration"><UIIcon name="upload" size={controlIconSize(size)} /></span>
      <strong>{readOnly ? 'File selection is read only' : multiple ? 'Choose files or drag them here' : 'Choose a file or drag it here'}</strong>
      <span>Select files that meet the requirements below.</span>
      <input {...native} ref={node => { inputRef.current = node; assignRef(forwardedRef, node); }} type="file" id={field.id} accept={accept} multiple={multiple} disabled={disabled}
        required={required && !readOnly} className={cx('easm-ui-file-input', controlClassName)} aria-disabled={readOnly || undefined}
        aria-describedby={joinIds(field.describedBy, requirementsId, rejected.length ? rejectionId : undefined)} aria-invalid={field.invalid || undefined}
        aria-errormessage={field.invalid ? field.errorId : undefined}
        onClick={event => { onClick?.(event); if (readonlyGuard) { event.preventDefault(); return; } if (!event.defaultPrevented) { previousFiles.current = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ''; } }}
        onKeyDown={event => { native.onKeyDown?.(event); if (readOnly && ['Enter', ' '].includes(event.key)) event.preventDefault(); }}
        onChange={event => process(Array.from(event.currentTarget.files ?? []))}
        onInvalid={event => { setPickerError('Choose at least one file.'); onInvalid?.(event); }} />
    </div>
    <p className="easm-ui-file-requirements" id={requirementsId}>{accept ? `Accepted: ${accept}. ` : 'Any file type. '}{maxBytes !== undefined ? `Maximum ${formatBytes(maxBytes)} per file. ` : ''}{multiple ? 'Multiple files allowed.' : 'One file at a time.'}</p>
    {!!files.length && <ul ref={listRef} className="easm-ui-file-list" aria-label="Selected files">{files.map((file, index) => <li key={files.indexOf(file) === index ? keyFor(file) : `${keyFor(file)}-${index}`}>
      <UIIcon name="document" size={controlIconSize(size)} /><span><strong>{file.name}</strong><small>{formatBytes(file.size)}</small></span>
      {allowRemove && <button type="button" className="easm-ui-file-remove" disabled={readonlyGuard} aria-label={`Remove ${file.name}`} onClick={() => {
        const next = files.filter((_, position) => position !== index);
        focusAfterRemoval.current = index;
        if (synchronizeFiles(inputRef.current, next)) { previousFiles.current = next; setFiles(next); setRejected([]); setPickerError(undefined); emitFiles(next, []); }
        else { synchronizeFiles(inputRef.current, []); previousFiles.current = []; setFiles([]); setPickerError('Selection was cleared. Choose the remaining files again.'); emitFiles([], []); }
      }}><UIIcon name="close" size={16} /></button>}
    </li>)}</ul>}
    {!!rejected.length && <ul className="easm-ui-file-rejections" id={rejectionId}>{rejected.map((item, index) => <li key={`${item.file.name}-${index}`}><strong>{item.file.name}:</strong> {item.reasons.map(reason => reason.message).join(' ')}</li>)}</ul>}
  </Field>;
});
