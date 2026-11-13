const assert = require('node:assert/strict');

/** Input/selection-specific SSR and virtual-DOM regressions. Real native file selection,
 * FileList/drop assignment, picker rendering and browser layout have separate QA. */
exports.run = async function run({ UI, React, render, unmount, act, document, click, key, ssr }) {
  const window = document.defaultView;
  const h = React.createElement;
  const checks = [];
  const check = (condition, message) => { assert.ok(condition, message); checks.push(message); };
  const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks.push(message); };
  const press = async (node, name, extra = {}) => act(async () => node.dispatchEvent(new window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: name, ...extra })));
  const type = async (node, value) => act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(node, value); node.dispatchEvent(new window.Event('input', { bubbles: true })); });
  const opts = [{ value: 'a', label: 'Admissions' }, { value: 'b', label: 'Billing', disabled: true }, { value: 'c', label: 'Courses' }];

  const markup = ssr(h(UI.TextField, { label: 'Email', description: 'Use your work email', error: 'Invalid email', required: true }));
  const ssrHost = document.createElement('div'); ssrHost.innerHTML = markup;
  const ssrInput = ssrHost.querySelector('input');
  equal(ssrHost.querySelector('label').htmlFor, ssrInput.id, 'explicit label associates with generated input');
  for (const id of ssrInput.getAttribute('aria-describedby').split(' ')) check(ssrHost.querySelector(`[id="${id}"]`), `description target exists: ${id}`);
  equal(ssrInput.getAttribute('aria-invalid'), 'true', 'provided error marks invalid');
  check(!ssrHost.querySelector('[role="alert"]'), 'initial error does not interrupt with alert');
  check(ssrHost.querySelector('.easm-ui'), 'standalone field includes base namespace');
  assert.throws(() => ssr(h(UI.TextField, { label: ' ' }))); checks.push('Blank field label is rejected');
  assert.throws(() => ssr(h(UI.TextField, { label: ['', false, ' '] }))); checks.push('A field label made only of blank array items is rejected');
  const blankMetadata = ssr(h(UI.TextField, { label: 'Email', description: [' ', false], error: ' ', success: [] }));
  check(!blankMetadata.includes('easm-ui-field-description') && !blankMetadata.includes('easm-ui-field-message'), 'Blank supporting content creates no empty validation or layout gaps');
  assert.throws(() => ssr(h(UI.Select, { label: 'A', options: [{ value: 'x', label: 'One' }, { value: 'x', label: 'Two' }] }))); checks.push('Duplicate option values are rejected');

  let searchChanges = [];
  await render(h('form', null, h(UI.SearchField, { defaultValue: 'initial', onValueChange: value => searchChanges.push(value), name: 'query' })));
  let input = document.querySelector('input[type="search"]');
  await type(input, 'new'); equal(input.value, 'new', 'search typing updates internal state');
  await click(document.querySelector('[aria-label="Clear search"]')); equal(input.value, '', 'search clear updates native value');
  equal(searchChanges.at(-1), '', 'search clear sends value callback');
  await act(async () => document.querySelector('form').reset()); equal(input.value, 'initial', 'uncontrolled search resets to original default');
  let searched = 0;
  await render(h(UI.SearchField, { onSearch: () => searched++ })); input = document.querySelector('input[type="search"]');
  await press(input, 'Enter', { isComposing: true }); equal(searched, 0, 'IME Enter does not trigger search');
  await press(input, 'Enter'); equal(searched, 1, 'ordinary Enter triggers search');

  let selected = [];
  await render(h('form', null, h(UI.Combobox, { label: 'Department', options: opts, defaultValue: 'a', name: 'department', required: true, onValueChange: value => selected.push(value) })));
  input = document.querySelector('[role="combobox"]');
  await act(async () => input.focus()); equal(document.querySelectorAll('[role="option"]').length, 3, 'focus after a selection exposes all options');
  await press(input, 'ArrowDown'); let activeId = input.getAttribute('aria-activedescendant'); equal(document.getElementById(activeId).textContent, 'Admissions', 'first ArrowDown activates first enabled option');
  await press(input, 'ArrowDown'); activeId = input.getAttribute('aria-activedescendant'); equal(document.getElementById(activeId).textContent, 'Courses', 'ArrowDown skips disabled option');
  await press(input, 'Enter', { isComposing: true }); equal(selected.length, 0, 'IME Enter does not select');
  await press(input, 'Enter'); equal(input.value, 'Courses', 'Enter commits explicitly active option');
  equal(input.getAttribute('aria-expanded'), 'false', 'commit closes popup');
  equal(new window.FormData(document.querySelector('form')).get('department'), 'c', 'form serializes option value rather than search label');
  await type(input, 'unknown text'); await press(input, 'Enter'); equal(input.value, 'Courses', 'Enter without active item retains committed value');
  equal(selected.length, 1, 'typing does not commit freeform data');
  await press(input, 'ArrowDown'); await press(input, 'End'); activeId = input.getAttribute('aria-activedescendant'); equal(document.getElementById(activeId).textContent, 'Courses', 'End activates last enabled option');
  await press(input, 'Home'); activeId = input.getAttribute('aria-activedescendant'); equal(document.getElementById(activeId).textContent, 'Admissions', 'Home activates first enabled option');
  await press(input, 'Escape'); check(!input.hasAttribute('aria-activedescendant'), 'closed popup has no stale active descendant');
  const clear = document.querySelector('[aria-label="Clear selection"]'); await act(async () => clear.focus()); await click(clear);
  equal(input.getAttribute('aria-expanded'), 'false', 'keyboard-focused clear does not reopen popup'); equal(input.value, '', 'combo clear empties displayed value'); await act(async () => check(!input.checkValidity(), 'required empty combobox cannot submit'));
  await act(async () => document.querySelector('form').reset()); equal(input.value, 'Admissions', 'uncontrolled combobox resets to original selection');
  await render(h(UI.Combobox, { label: 'Department', options: opts.slice(0, 2), value: 'c', required: true })); input = document.querySelector('[role="combobox"]');
  await act(async () => check(!input.checkValidity(), 'removed selected option invalidates selection')); equal(input.getAttribute('aria-invalid'), 'true', 'removed selection has associated visible error');
  await render(h(UI.Combobox, { label: 'Department', options: opts, value: 'b', required: true })); input = document.querySelector('[role="combobox"]');
  await act(async () => check(!input.checkValidity(), 'disabled selected option cannot be submitted as available'));

  const selectRef = React.createRef();
  let selectChanges = [];
  await render(h('form', null, h(UI.Select, { ref: selectRef, label: 'Department', options: opts, defaultValue: 'a', name: 'department', onValueChange: value => selectChanges.push(value) })));
  const triggerSelect = document.querySelector('[role="combobox"]');
  const select = document.querySelector('select');
  equal(selectRef.current, triggerSelect, 'Select public ref points to branded trigger');
  equal(select.tagName, 'SELECT', 'Select preserves a real form bridge');
  equal(select.getAttribute('aria-hidden'), 'true', 'Select never exposes an operating-system menu');
  await act(async () => { select.value = 'c'; select.dispatchEvent(new window.Event('change', { bubbles: true })); });
  equal(triggerSelect.textContent, 'Courses', 'Select visible trigger follows actual form change');
  equal(selectChanges.join(','), 'c', 'Select reports one committed value change');
  equal(new window.FormData(document.querySelector('form')).get('department'), 'c', 'Select submits actual option value');
  await act(async () => document.querySelector('form').reset());
  equal(triggerSelect.textContent, 'Admissions', 'uncontrolled Select reset restores visible default');
  equal(select.value, 'a', 'uncontrolled Select resets form value to default');
  equal(selectChanges.join(','), 'c', 'Select reset does not report a user selection');
  for (const current of ['missing', 'b']) {
    await render(h('form', null, h(UI.Select, { label: 'Department', options: opts, value: current, required: true })));
    const unavailableSelect = document.querySelector('select');
    await act(async () => check(!unavailableSelect.checkValidity(), `unavailable Select value cannot pass required: ${current}`));
    equal(document.querySelector('[role="combobox"]').getAttribute('aria-invalid'), 'true', `unavailable Select value has visible associated error: ${current}`);
  }
  for (const name of ['Checkbox', 'Radio', 'Switch']) {
    const Control = UI[name];
    await render(h(Control, { label: 'Locked setting', readOnly: true, required: true })); input = document.querySelector('input');
    await click(input); check(!input.checked, 'read-only choice retains false state: ' + name); check(input.checkValidity(), 'read-only required choice does not trap form: ' + name);
  }
  for (const name of ['Checkbox', 'Radio', 'Switch']) for (const checked of [false, true]) {
    const Control = UI[name];
    await render(h(Control, { label: 'Controlled locked setting', readOnly: true, checked })); input = document.querySelector('input');
    await click(input); equal(input.checked, checked, 'controlled read-only choice retains value: ' + name + ' ' + checked);
  }
  await render(h('form', null, h(UI.Checkbox, { label: 'Selected', defaultChecked: true, indeterminate: true })));
  input = document.querySelector('input'); check(input.indeterminate, 'mixed state applies native property'); equal(input.getAttribute('aria-checked'), 'mixed', 'mixed state has accessible value');
  await click(input); equal(input.checked, false, 'checkbox native click updates selection');
  await act(async () => document.querySelector('form').reset()); check(input.checked && input.indeterminate, 'checkbox reset restores default and preserves controlled mixed status');

  let fileUpdates = [];
  const valid = new window.File(['content'], 'brief.pdf', { type: 'application/pdf' });
  await render(h('form', null, h(UI.FileUpload, { label: 'Attachment', accept: '.pdf', maxBytes: 10, onFiles: (...args) => fileUpdates.push(args) })));
  input = document.querySelector('input[type="file"]');
  Object.defineProperty(input, 'files', { configurable: true, get: () => [valid] });
  await act(async () => input.dispatchEvent(new window.Event('change', { bubbles: true })));
  equal(fileUpdates.at(-1)[0][0], valid, 'file callback sends original File object'); check(document.querySelector('.easm-ui-file-list').textContent.includes('brief.pdf'), 'accepted file appears in list');
  await act(async () => document.querySelector('form').reset()); equal(fileUpdates.at(-1)[0].length, 0, 'file form reset reports empty accepted selection'); check(!document.querySelector('.easm-ui-file-list'), 'file list clears on native reset');
  const wrong = new window.File(['long contents'], 'notes.exe', { type: 'application/octet-stream' });
  await render(h(UI.FileUpload, { label: 'Attachment', accept: '.pdf', maxBytes: 3, multiple: false, onFiles: (...args) => fileUpdates.push(args) })); input = document.querySelector('input[type="file"]');
  Object.defineProperty(input, 'files', { configurable: true, get: () => [valid, wrong] });
  await act(async () => input.dispatchEvent(new window.Event('change', { bubbles: true })));
  const rejection = fileUpdates.at(-1)[1].find(item => item.file === wrong); equal(rejection.reasons.map(reason => reason.code).join(','), 'multiple,accept,size', 'file rejection preserves every actual violated requirement');
  equal(fileUpdates.at(-1)[0].length, 0, 'invalid multi-file batch yields no accepted file in single mode');

  let dynamicFiles = [];
  function DynamicFileHarness() {
    const [maxBytes, setMaxBytes] = React.useState(10);
    return h(React.Fragment, null,
      h(UI.FileUpload, { label: 'Dynamic attachment', accept: '.pdf', maxBytes, onFiles: (...args) => dynamicFiles.push(args) }),
      h('button', { onClick: () => setMaxBytes(20), type: 'button', 'data-qa': 'loosen' }, 'Loosen limit'),
      h('button', { onClick: () => setMaxBytes(3), type: 'button', 'data-qa': 'tighten' }, 'Tighten limit'));
  }
  await render(h(DynamicFileHarness)); input = document.querySelector('input[type="file"]');
  Object.defineProperty(input, 'files', { configurable: true, get: () => [valid] });
  await act(async () => input.dispatchEvent(new window.Event('change', { bubbles: true })));
  equal(dynamicFiles.length, 1, 'initial valid file selection sends one callback');
  await click(document.querySelector('[data-qa="loosen"]'));
  equal(dynamicFiles.length, 1, 'relaxing constraints does not report a duplicate selection');
  await click(document.querySelector('[data-qa="tighten"]'));
  equal(dynamicFiles.at(-1)[0].length, 0, 'tightening constraints removes a now-invalid selected file');
  equal(dynamicFiles.at(-1)[1][0].reasons[0].code, 'size', 'constraint-change rejection retains the actual reason');
  check(document.querySelector('.easm-ui-file-rejections').textContent.includes('3 B'), 'constraint-change rejection shows the current limit');
  await click(document.querySelector('[data-qa="loosen"]'));
  equal(dynamicFiles.length, 2, 'relaxing limits does not resurrect a previously rejected file');
  let cancelEvent;
  await render(h(UI.FileUpload, { label: 'Attachment', onFiles() {}, onCancel: event => { cancelEvent = event; } }));
  input = document.querySelector('input[type="file"]');
  await act(async () => input.dispatchEvent(new window.Event('cancel')));
  check(cancelEvent instanceof window.Event && cancelEvent.type === 'cancel', 'native picker cancel forwards the actual DOM event');
  // Portals must retain editable-combobox focus and current controlled validity.
  let proposals = 0;
  await render(h(UI.Combobox, { label: 'Controlled department', options: opts, value: '', required: true, onValueChange: () => proposals++ }));
  input = document.querySelector('[role="combobox"]');
  await act(async () => input.focus());
  equal(document.activeElement, input, 'combobox portal opening does not grab input focus');
  check(!input.closest('.easm-ui-combobox-root').contains(document.querySelector('[role="listbox"]')), 'combobox listbox portals outside clipping field ancestors');
  equal(document.querySelector('.easm-ui-combobox-popup').getAttribute('role'), 'presentation', 'editable combobox popup does not introduce a dialog role');
  await press(input, 'ArrowDown'); await press(input, 'Enter');
  equal(proposals, 1, 'controlled combobox reports a selection proposal once');
  equal(input.value, '', 'controlled combobox display remains with parent-owned selection');
  await act(async () => check(!input.checkValidity(), 'declined controlled selection cannot make required combobox valid'));
  await press(input, 'ArrowDown'); await press(input, 'Enter');
  equal(input.getAttribute('aria-invalid'), 'true', 'Declined controlled combobox proposal retains the current required error');
  await render(h(UI.Combobox, { label: 'Controlled department', options: opts, value: 'a', required: true }));
  input = document.querySelector('[role="combobox"]');
  await click(document.querySelector('[aria-label="Clear selection"]'));
  equal(input.value, 'Admissions', 'declined controlled clear retains the committed label');
  check(input.checkValidity(), 'declined controlled clear retains valid committed selection');
  await act(async () => input.focus());
  let modified = new window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Home', ctrlKey: true });
  await act(async () => input.dispatchEvent(modified));
  check(!modified.defaultPrevented && !input.hasAttribute('aria-activedescendant'), 'combobox modified Home preserves native text editing');
  await press(input, 'ArrowUp', { altKey: true }); equal(input.getAttribute('aria-expanded'), 'false', 'Alt Up closes combobox without a selection');
  await press(input, 'ArrowDown', { altKey: true });
  equal(input.getAttribute('aria-expanded'), 'true', 'Alt Down opens combobox without grabbing an option');
  check(!input.hasAttribute('aria-activedescendant'), 'Alt Down does not force the first active option');
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  await act(async () => { document.body.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true, cancelable: true })); document.body.dispatchEvent(new window.MouseEvent('pointerup', { bubbles: true, cancelable: true })); document.body.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); });
  equal(input.getAttribute('aria-expanded'), 'false', 'outside pointer dismisses combobox portal');
  let toggleOptions;
  function DynamicComboHarness() {
    const [options, setOptions] = React.useState(opts); toggleOptions = setOptions;
    return h(UI.Combobox, { label: 'Department', options });
  }
  await render(h(DynamicComboHarness)); input = document.querySelector('[role="combobox"]');
  await act(async () => input.focus()); await press(input, 'ArrowDown');
  await act(async () => toggleOptions(opts.slice(1)));
  check(!input.hasAttribute('aria-activedescendant'), 'removed active option never leaves a dangling popup reference');

  // Consumer callbacks cannot mutate internal native-file selection or reasons.
  await render(h(UI.FileUpload, { label: 'Immutable selection', onFiles: accepted => { accepted.length = 0; } }));
  input = document.querySelector('input[type="file"]');
  Object.defineProperty(input, 'files', { configurable: true, get: () => [valid] });
  await act(async () => input.dispatchEvent(new window.Event('change', { bubbles: true })));
  check(document.querySelector('.easm-ui-file-list')?.textContent.includes('brief.pdf'), 'consumer mutation of callback array cannot erase internal file selection');
  await render(h(UI.FileUpload, { label: 'Immutable rejection', maxBytes: 3, onFiles: (accepted, failures) => { failures[0].reasons[0].message = 'Changed externally'; failures.length = 0; } }));
  input = document.querySelector('input[type="file"]');
  Object.defineProperty(input, 'files', { configurable: true, get: () => [valid] });
  await act(async () => input.dispatchEvent(new window.Event('change', { bubbles: true })));
  check(document.querySelector('.easm-ui-file-rejections')?.textContent.includes('3 B'), 'consumer mutation of callback rejection cannot change internal validation copy');

  // Manual tabs move the one sequential tab stop independently of selection.
  const tabItems = opts.map(option => ({ id: option.value, label: option.label, disabled: option.disabled, icon: 'inbox', content: h('p', null, option.label + ' records') }));
  await render(h(React.Fragment, null, h(UI.Tabs, { label: 'Records', items: tabItems }), h('button', { id: 'after-tabs' }, 'Next')));
  let tabs = document.querySelectorAll('[role="tab"]');
  await act(async () => tabs[0].focus()); await press(tabs[0], 'ArrowRight');
  equal(document.activeElement, tabs[2], 'manual tab arrows focus the next enabled tab');
  equal(tabs[2].tabIndex, 0, 'manual arrow focus becomes the single tab stop');
  equal(tabs[0].tabIndex, -1, 'previous selected tab leaves sequential order during manual focus');
  equal(tabs[0].getAttribute('aria-selected'), 'true', 'manual arrow focus does not change selected panel');
  await act(async () => document.getElementById('after-tabs').focus());
  equal(tabs[0].tabIndex, 0, 'tab-group exit restores sequential entry to selected tab');
  equal(tabs[2].tabIndex, -1, 'tab-group exit removes unselected manual focus from tab order');
  const largeTabs = document.createElement('div'); largeTabs.innerHTML = ssr(h(UI.Tabs, { label: 'Records', items: tabItems, size: 'lg' }));
  equal(largeTabs.querySelector('svg').getAttribute('width'), '24', 'large tab glyph uses standard24px geometry');
  await render(h(UI.Tabs, { label: 'Records', items: tabItems, orientation: 'vertical' })); tabs = document.querySelectorAll('[role="tab"]');
  await act(async () => tabs[0].focus()); await press(tabs[0], 'ArrowDown'); equal(document.activeElement, tabs[2], 'vertical tabs navigate down and skip disabled tabs');
  await render(h(UI.Tabs, { label: 'Records', items: tabItems, activation: 'automatic' })); tabs = document.querySelectorAll('[role="tab"]');
  await act(async () => tabs[0].focus()); await press(tabs[0], 'ArrowRight'); equal(tabs[2].getAttribute('aria-selected'), 'true', 'automatic tab mode commits arrow selection');
  await render(h(UI.Tabs, { label: 'Records', items: tabItems })); tabs = document.querySelectorAll('[role="tab"]');
  tabs[0].style.direction = 'rtl'; await act(async () => tabs[0].focus()); await press(tabs[0], 'ArrowLeft'); equal(document.activeElement, tabs[2], 'RTL tab arrows follow the computed direction');

  await render(h('form', null, h(UI.SegmentedControl, { label: 'Department', options: tabItems, name: 'department', defaultValue: 'a' })));
  let segments = document.querySelectorAll('[role="radio"]');
  await press(segments[0], 'ArrowDown'); equal(segments[2].getAttribute('aria-checked'), 'true', 'segmented Down arrow follows radio-group selection');
  equal(new window.FormData(document.querySelector('form')).get('department'), 'c', 'segmented arrow selection serializes the real value');
  await act(async () => document.querySelector('form').reset());
  equal(segments[0].getAttribute('aria-checked'), 'true', 'uncontrolled segmented form reset restores original default');
  equal(new window.FormData(document.querySelector('form')).get('department'), 'a', 'segmented reset synchronizes the submitted value');
  await press(segments[0], 'ArrowDown');
  document.querySelector('form').addEventListener('reset', event => event.preventDefault());
  await act(async () => document.querySelector('form').reset());
  equal(segments[2].getAttribute('aria-checked'), 'true', 'canceled form reset preserves segmented selection');
  let disabledSelection = 0;
  await render(h(UI.SegmentedControl, { label: 'Department', options: tabItems, disabled: true, onValueChange: () => disabledSelection++ }));
  segments = document.querySelectorAll('[role="radio"]'); await press(segments[0], 'ArrowRight'); equal(disabledSelection, 0, 'disabled segmented control ignores even dispatched key proposals');

  for (const [name, props] of [['Chip', { children: '', onSelectedChange() {} }], ['Tag', { children: ' ' }], ['Chip', { children: 'Student', onRemove() {}, removeLabel: '' }]]) {
    assert.throws(() => ssr(h(UI[name], props))); checks.push(`${name}: empty semantic content is rejected`);
  }
  let filterDisabled;
  function FilterHarness() {
    const [disabled, setDisabled] = React.useState(false); filterDisabled = setDisabled;
    return h(UI.FilterControl, { label: 'Department filters', options: [{ id: 'a', label: 'Admissions', icon: 'inbox' }], size: 'lg', disabled });
  }
  await render(h(FilterHarness)); await click(document.querySelector('.easm-ui-filter-control > button'));
  const filterOption = document.querySelector('.easm-ui-filter-option-label');
  check(filterOption?.textContent === 'Admissions', 'filter choice retains readable text alongside its decorative icon');
  equal(filterOption.querySelector('svg').getAttribute('width'), '24', 'filter option icon follows large density');
  await act(async () => filterDisabled(true));
  check(!document.querySelector('.easm-ui-filter-options'), 'disabled filter change closes its expanded popup');
  await render(h(UI.FilterControl, { label: 'Empty filters', options: [] })); await click(document.querySelector('.easm-ui-filter-control > button'));
  check(document.querySelector('.easm-ui-filter-empty')?.textContent.includes('No filter options'), 'empty filter popup explains the absence of choices');
  await unmount();

  // Radix Select calls browser-only scroll/pointer-capture APIs. These no-op
  // jsdom adapters establish event semantics, not rendered scroll geometry.
  const oldFormElement = globalThis.HTMLFormElement;
  globalThis.HTMLFormElement = window.HTMLFormElement;
  const adapters = ['scrollIntoView', 'hasPointerCapture', 'setPointerCapture', 'releasePointerCapture'];
  const oldAdapters = adapters.map(name => Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, name));
  for (const name of adapters) if (!window.HTMLElement.prototype[name]) Object.defineProperty(window.HTMLElement.prototype, name, { configurable: true, value: name === 'hasPointerCapture' ? () => false : () => {} });
  const settleSelect = () => act(async () => new Promise(resolve => setTimeout(resolve, 30)));
  try {
    assert.throws(() => ssr(h(UI.TextField, { label: 'Password', trailingControls: [h(UI.IconButton, { icon: 'close', label: 'One', size: 'sm' }), h(UI.IconButton, { icon: 'close', label: 'Two', size: 'sm' }), h(UI.IconButton, { icon: 'close', label: 'Three', size: 'sm' })] })));
    checks.push('TextField rejects a third trailing action');
    assert.throws(() => ssr(h(UI.TextField, { label: 'Password', trailingIcon: 'close', trailingControls: [h(UI.IconButton, { icon: 'close', label: 'Clear', size: 'sm' })] })));
    checks.push('TextField rejects overlapping trailing icon and controls');
    let slotAction = 0;
    const fieldRef = React.createRef();
    await render(h(UI.TextField, { label: 'Password', ref: fieldRef, trailingControls: [h(UI.IconButton, { icon: 'eye', label: 'Show password', size: 'sm', onClick: () => slotAction++ })] }));
    equal(fieldRef.current.tagName, 'INPUT', 'TextField trailing controls preserve its native input ref');
    equal(document.querySelector('.easm-ui-input-wrap').dataset.count, '1', 'TextField action slots declare their preset count');
    await click(document.querySelector('[aria-label="Show password"]')); equal(slotAction, 1, 'TextField action slot invokes its actual control callback');

    const dropdownRef = React.createRef();
    let dropdownChanges = [];
    await render(h('form', { id: 'dropdown-form' }, h(UI.DropdownSelect, { label: 'Assigned agent', name: 'agent', options: opts, defaultValue: 'a', required: true, ref: dropdownRef, onValueChange: next => dropdownChanges.push(next) })));
    let trigger = document.querySelector('.easm-ui-dropdown-select-trigger');
    equal(dropdownRef.current, trigger, 'DropdownSelect ref exposes its real trigger button');
    equal(document.querySelector('label').htmlFor, trigger.id, 'DropdownSelect visible label associates with trigger');
    equal(new window.FormData(document.querySelector('form')).get('agent'), 'a', 'DropdownSelect serializes committed ID through real native form control');
    await act(async () => trigger.focus()); await press(trigger, 'ArrowDown'); await settleSelect();
    let listbox = document.querySelector('[role="listbox"]');
    check(listbox && !document.querySelector('.easm-ui-dropdown-select-root').contains(listbox), 'DropdownSelect listbox portals outside clipped field ancestors');
    equal(trigger.getAttribute('aria-expanded'), 'true', 'DropdownSelect trigger exposes real expanded state');
    equal(document.querySelectorAll('[role="option"]').length, 3, 'DropdownSelect exposes actual finite options');
    check(document.activeElement?.textContent.includes('Admissions'), 'DropdownSelect keyboard opening focuses its selected item');
    await press(document.activeElement, 'ArrowDown'); await settleSelect();
    check(document.activeElement?.textContent.includes('Courses'), 'DropdownSelect arrow navigation skips disabled options');
    await press(document.activeElement, 'Enter'); await settleSelect();
    equal(dropdownChanges.join(','), 'c', 'DropdownSelect selection reports one genuine committed proposal');
    equal(trigger.textContent, 'Courses', 'DropdownSelect renders the committed label');
    equal(new window.FormData(document.querySelector('form')).get('agent'), 'c', 'DropdownSelect native form value follows visible selection');
    equal(trigger.getAttribute('aria-expanded'), 'false', 'DropdownSelect selection closes its popup');
    equal(document.activeElement, trigger, 'DropdownSelect selection restores focus to its visible trigger');
    await act(async () => document.querySelector('form').reset()); await settleSelect();
    equal(trigger.textContent, 'Admissions', 'DropdownSelect native form reset restores uncontrolled default');
    equal(new window.FormData(document.querySelector('form')).get('agent'), 'a', 'DropdownSelect reset updates real submitted value');
    equal(dropdownChanges.length, 1, 'DropdownSelect reset does not masquerade as user selection');
    let nativeDropdown = document.querySelector('.easm-ui-dropdown-select-root select');
    await act(async () => { nativeDropdown.value = 'c'; nativeDropdown.dispatchEvent(new window.Event('change', { bubbles: true })); });
    document.querySelector('form').addEventListener('reset', event => event.preventDefault(), { once: true });
    await act(async () => document.querySelector('form').reset()); await settleSelect();
    equal(trigger.textContent, 'Courses', 'DropdownSelect canceled reset preserves visible value');
    equal(new window.FormData(document.querySelector('form')).get('agent'), 'c', 'DropdownSelect canceled reset preserves submitted value');

    await render(h('form', null, h(UI.DropdownSelect, { label: 'Required agent', options: opts, name: 'agent', required: true })));
    trigger = document.querySelector('.easm-ui-dropdown-select-trigger');
    await act(async () => check(!document.querySelector('form').checkValidity(), 'DropdownSelect empty required selection blocks native form validation'));
    equal(document.activeElement, trigger, 'DropdownSelect invalid native control focuses its visible trigger');
    equal(trigger.getAttribute('aria-invalid'), 'true', 'DropdownSelect required constraint exposes associated invalid state');
    check(document.getElementById(trigger.getAttribute('aria-errormessage'))?.textContent.includes('Choose an option'), 'DropdownSelect required error has a real associated message');
    await render(h('form', null, h(UI.DropdownSelect, { label: 'Controlled required agent', options: opts, value: '', name: 'agent', required: true, onValueChange() {} })));
    await act(async () => document.querySelector('form').checkValidity());
    nativeDropdown = document.querySelector('select');
    await act(async () => { nativeDropdown.value = 'a'; nativeDropdown.dispatchEvent(new window.Event('change', { bubbles: true })); });
    equal(document.querySelector('.easm-ui-dropdown-select-trigger').getAttribute('aria-invalid'), 'true', 'DropdownSelect declined required proposal retains its linked error');
    equal(new window.FormData(document.querySelector('form')).get('agent'), '', 'DropdownSelect declined required proposal cannot replace its empty submitted value');
    for (const stale of ['missing', 'b']) {
      await render(h('form', null, h(UI.DropdownSelect, { label: 'Unavailable agent', options: opts, name: 'agent', value: stale })));
      await act(async () => check(!document.querySelector('form').checkValidity(), `DropdownSelect unavailable optional value is invalid: ${stale}`));
      equal(new window.FormData(document.querySelector('form')).get('agent'), '', `DropdownSelect unavailable value never submits stale ID: ${stale}`);
    }
    for (const name of ['Select', 'Combobox', 'DropdownSelect']) {
      const suppressedError = ssr(h(UI[name], { label: 'Unavailable agent', options: opts, value: 'missing', error: false }));
      check(suppressedError.includes('aria-invalid="true"') && suppressedError.includes('no longer available'), `${name}: empty caller error cannot hide unavailable-selection validation`);
    }
    let updateOptions;
    function DynamicDropdown() {
      const [options, setOptions] = React.useState(opts); updateOptions = setOptions;
      return h('form', null, h(UI.DropdownSelect, { label: 'Dynamic agent', name: 'agent', options, value: 'c' }));
    }
    await render(h(DynamicDropdown));
    await act(async () => updateOptions(opts.slice(0, 2))); await settleSelect();
    await act(async () => check(!document.querySelector('form').checkValidity(), 'DropdownSelect removed option reapplies native validity after primitive replacement'));
    equal(new window.FormData(document.querySelector('form')).get('agent'), '', 'DropdownSelect removed option leaves no stale form serialization');
    let declined = [];
    await render(h('form', null, h(UI.DropdownSelect, { label: 'Controlled agent', options: opts, name: 'agent', value: 'a', onValueChange: next => declined.push(next) })));
    nativeDropdown = document.querySelector('select');
    await act(async () => { nativeDropdown.value = 'c'; nativeDropdown.dispatchEvent(new window.Event('change', { bubbles: true })); });
    equal(declined.join(','), 'c', 'DropdownSelect controlled native change reports actual proposal');
    equal(document.querySelector('.easm-ui-dropdown-select-trigger').textContent, 'Admissions', 'DropdownSelect declined proposal retains parent-owned label');
    equal(new window.FormData(document.querySelector('form')).get('agent'), 'a', 'DropdownSelect declined proposal retains committed native form value');
    let blockedChanges = 0;
    await render(h('form', null, h(UI.DropdownSelect, { label: 'Read-only agent', options: opts, name: 'agent', defaultValue: 'a', readOnly: true, required: true, defaultOpen: true, onValueChange: () => blockedChanges++ })));
    trigger = document.querySelector('.easm-ui-dropdown-select-trigger');
    check(!trigger.disabled, 'DropdownSelect read-only value stays keyboard reviewable');
    await press(trigger, 'ArrowDown'); equal(trigger.getAttribute('aria-expanded'), 'false', 'DropdownSelect read-only state blocks opening');
    nativeDropdown = document.querySelector('select');
    await act(async () => { nativeDropdown.value = 'c'; nativeDropdown.dispatchEvent(new window.Event('change', { bubbles: true })); });
    equal(blockedChanges, 0, 'DropdownSelect read-only state blocks genuine native change callbacks');
    equal(new window.FormData(document.querySelector('form')).get('agent'), 'a', 'DropdownSelect read-only state retains actual submitted value');
    check(document.querySelector('form').checkValidity(), 'DropdownSelect read-only required intent does not trap submission');
    await render(h(UI.DropdownSelect, { label: 'Disabled agent', options: opts, disabled: true, defaultOpen: true }));
    trigger = document.querySelector('.easm-ui-dropdown-select-trigger');
    check(trigger.disabled && trigger.getAttribute('aria-expanded') === 'false', 'DropdownSelect disabled state suppresses trigger and popup');
    for (const componentName of ['Select', 'DropdownSelect']) {
      let busyChanges = 0;
      await render(h(UI.FormPattern, { label: 'Busy form', busy: true, onSubmit() {} }, h(UI[componentName], { label: 'Busy agent', name: 'agent', options: opts, defaultValue: 'a', defaultOpen: true, onValueChange: () => busyChanges++ })));
      trigger = document.querySelector('.easm-ui-dropdown-select-trigger');
      check(trigger.matches(':disabled') && trigger.getAttribute('aria-expanded') === 'false' && !document.querySelector('[role="listbox"]'), `${componentName}: initially busy form suppresses portaled popup`);
      nativeDropdown = document.querySelector('select');
      await act(async () => { nativeDropdown.value = 'c'; nativeDropdown.dispatchEvent(new window.Event('change', { bubbles: true })); });
      equal(busyChanges, 0, `${componentName}: busy fieldset blocks native change proposals`);
      equal(trigger.textContent, 'Admissions', `${componentName}: busy fieldset retains committed label`);
      equal(new window.FormData(document.querySelector('form')).get('agent'), null, `${componentName}: disabled fieldset excludes the form value`);
      let changeBusy;
      function BusyTransition() {
        const [busy, setBusy] = React.useState(false); changeBusy = setBusy;
        return h(UI.FormPattern, { label: 'Pending form', busy, onSubmit() {} }, h(UI[componentName], { label: 'Pending agent', name: 'agent', options: opts, defaultValue: 'a', onValueChange: () => busyChanges++ }));
      }
      await render(h(BusyTransition)); trigger = document.querySelector('.easm-ui-dropdown-select-trigger');
      await press(trigger, 'ArrowDown'); await settleSelect();
      check(document.querySelector('[role="listbox"]'), `${componentName}: enabled form opens its popup`);
      await act(async () => changeBusy(true)); await settleSelect();
      check(trigger.matches(':disabled') && !document.querySelector('[role="listbox"]'), `${componentName}: becoming busy closes an already portaled popup`);
      await act(async () => changeBusy(false)); await settleSelect();
      check(!trigger.matches(':disabled') && !document.querySelector('[role="listbox"]'), `${componentName}: becoming enabled does not reopen a dismissed popup`);
      await press(trigger, 'ArrowDown'); await settleSelect();
      await press(document.activeElement, 'ArrowDown'); await settleSelect(); await press(document.activeElement, 'Enter'); await settleSelect();
      equal(trigger.textContent, 'Courses', `${componentName}: reenabled fieldset supports real keyboard selection`);
      equal(busyChanges, 1, `${componentName}: only reenabled selection invokes the callback`);
      await render(h('fieldset', { disabled: true }, h('legend', null, h(UI[componentName], { label: 'Legend choice', options: opts, defaultValue: 'a' }))));
      trigger = document.querySelector('.easm-ui-dropdown-select-trigger');
      check(!trigger.matches(':disabled'), `${componentName}: native first-legend exception remains enabled`);
    }
    await render(h('div', null, h('form', { id: 'external-agent-form' }), h(UI.DropdownSelect, { label: 'External form agent', options: opts, name: 'agent', form: 'external-agent-form', defaultValue: 'a' })));
    equal(new window.FormData(document.querySelector('form')).get('agent'), 'a', 'DropdownSelect supports actual external native form association');
    nativeDropdown = document.querySelector('select');
    await act(async () => { nativeDropdown.value = 'c'; nativeDropdown.dispatchEvent(new window.Event('change', { bubbles: true })); });
    await act(async () => document.querySelector('form').reset()); await settleSelect();
    equal(new window.FormData(document.querySelector('form')).get('agent'), 'a', 'DropdownSelect external form reset restores its original committed ID');
    let setControlledValue, controlledResetChanges = 0;
    function ControlledResetDropdown() {
      const [value, setValue] = React.useState('a'); setControlledValue = setValue;
      return h('form', null, h(UI.DropdownSelect, { label: 'Controlled reset agent', options: opts, name: 'agent', value, onValueChange: () => controlledResetChanges++ }));
    }
    await render(h(ControlledResetDropdown)); await act(async () => setControlledValue('c'));
    await act(async () => document.querySelector('form').reset()); await settleSelect();
    equal(document.querySelector('.easm-ui-dropdown-select-trigger').textContent, 'Courses', 'DropdownSelect controlled reset retains parent-owned visible value');
    equal(new window.FormData(document.querySelector('form')).get('agent'), 'c', 'DropdownSelect controlled reset retains parent-owned submitted ID');
    equal(controlledResetChanges, 0, 'DropdownSelect controlled reflection and reset emit no fabricated user proposal');
    await render(h(UI.DropdownSelect, { label: 'Empty agent list', options: [], defaultOpen: true })); await settleSelect();
    check(document.querySelector('.easm-ui-dropdown-select-empty')?.textContent.includes('No options'), 'DropdownSelect empty finite set has meaningful popup content');
    await unmount();
  } finally {
    await unmount();
    for (let index = 0; index < adapters.length; index++) {
      if (oldAdapters[index]) Object.defineProperty(window.HTMLElement.prototype, adapters[index], oldAdapters[index]);
      else delete window.HTMLElement.prototype[adapters[index]];
    }
    if (oldFormElement === undefined) delete globalThis.HTMLFormElement; else globalThis.HTMLFormElement = oldFormElement;
  }
  // Inspect the real import-order CSS bundle: jsdom does not implement a reliable
  // stylesheet specificity cascade for :where/:is and cannot prove this paint fix.
  const path = require('node:path');
  const repo = path.resolve(__dirname, '../../../../..');
  const req = name => require(require.resolve(name, { paths: [path.join(repo, 'packages/ui')] }));
  const bundled = await req('esbuild').build({ entryPoints: [path.join(repo, 'packages/ui/src/styles.css')], bundle: true, write: false, logLevel: 'silent' });
  const stylesheet = req('postcss').parse(bundled.outputFiles[0].text);
  const cssTree = req('css-tree');
  const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  const specificity = node => {
    if (node.type === 'IdSelector') return [1, 0, 0];
    if (node.type === 'ClassSelector' || node.type === 'AttributeSelector') return [0, 1, 0];
    if (node.type === 'TypeSelector' || node.type === 'PseudoElementSelector') return [0, 0, node.name === '*' ? 0 : 1];
    if (node.type === 'PseudoClassSelector') {
      if (node.name === 'where') return [0, 0, 0];
      if (['is', 'not', 'has'].includes(node.name)) return specificity(node.children[0]);
      return [0, 1, 0];
    }
    if (node.type === 'SelectorList') return node.children.map(specificity).reduce((max, current) => compare(max, current) >= 0 ? max : current, [0, 0, 0]);
    return (node.children || []).map(specificity).reduce((sum, current) => sum.map((value, i) => value + current[i]), [0, 0, 0]);
  };
  const cascade = (element, forcedColors) => {
    const winners = new Map();
    stylesheet.walkRules(rule => {
      if (!rule.nodes.some(node => node.type === 'decl' && ['outline', 'outline-color', 'outline-offset', 'box-shadow'].includes(node.prop))) return;
      for (let parent = rule.parent; parent; parent = parent.parent) {
        if (parent.type === 'atrule' && parent.name.endsWith('keyframes')) return;
        if (parent.type === 'atrule' && parent.name === 'media') {
          if (!parent.params.includes('forced-colors: active') || !forcedColors) return;
        }
      }
      for (const selector of cssTree.toPlainObject(cssTree.parse(rule.selector, { context: 'selectorList' })).children) {
        const text = cssTree.generate(selector);
        // All four fixtures represent a keyboard-focused element. The pseudo
        // class is retained for specificity and removed only for DOM matching.
        // Vendor pseudo-elements (such as ::-moz-range-thumb) style parts of a control, never the
        // element itself, and the selector engine may not parse them: they cannot match here.
        let matched = false;
        try { matched = element.matches(text.replaceAll(':focus-visible', '')); } catch { matched = false; }
        if (!matched) continue;
        const weight = specificity(selector);
        rule.walkDecls(declaration => {
          if (!['outline', 'outline-color', 'outline-offset', 'box-shadow'].includes(declaration.prop)) return;
          const previous = winners.get(declaration.prop);
          if (!previous || Number(Boolean(declaration.important)) > Number(Boolean(previous.important)) || declaration.important === previous.important && compare(weight, previous.weight) >= 0) {
            winners.set(declaration.prop, { value: declaration.value, weight, important: declaration.important });
          }
        });
      }
    });
    return Object.fromEntries([...winners].map(([name, winner]) => [name, winner.value]));
  };
  const focusHost = document.createElement('div');
  focusHost.innerHTML = '<div class="easm-ui easm-ui-field"><input class="easm-ui-input"><button class="easm-ui-input easm-ui-dropdown-select-trigger"></button></div><div class="easm-ui easm-ui-dropdown-select-popup"><div class="easm-ui-dropdown-select-option" tabindex="-1" aria-selected="true" data-highlighted></div></div>';
  for (const element of focusHost.querySelectorAll('.easm-ui-input')) {
    const label = element.tagName === 'INPUT' ? 'native input' : 'DropdownSelect trigger';
    const normal = cascade(element, false), forced = cascade(element, true);
    equal(normal.outline, 'none', `Bundled focus cascade: ${label} paints no duplicate corner outline`);
    equal(normal['box-shadow'], 'var(--easm-ui-field-focus-ring)', `Bundled focus cascade: ${label} retains its rounded shadow ring`);
    equal(forced.outline, '2px solid Highlight', `Bundled forced-colors cascade: ${label} retains a system outline`);
    equal(forced['box-shadow'], 'none', `Bundled forced-colors cascade: ${label} removes the shadow ring`);
  }
  const popupOption = focusHost.querySelector('.easm-ui-dropdown-select-option');
  const normalOption = cascade(popupOption, false), forcedOption = cascade(popupOption, true);
  equal(normalOption['outline-offset'], '-2px', 'Bundled focus cascade: selected popup option retains its unclipped inset indicator');
  equal(normalOption['box-shadow'], 'none', 'Bundled focus cascade: selected popup option rejects the generic outer shadow');
  equal(forcedOption['outline-color'], 'Highlight', 'Bundled forced-colors cascade: selected popup option uses the system focus color');
  equal(forcedOption['outline-offset'], '-2px', 'Bundled forced-colors cascade: selected popup option keeps its focus inside the scroll clip');
  return checks;
};
