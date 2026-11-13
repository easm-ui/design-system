const assert = require('node:assert/strict');

/** SSR contracts and virtual-DOM behavior. Actual browser layout/focus evidence is separate. */
exports.run = async function run({ UI, React, render, unmount, act, document, click, key, ssr }) {
  const h = React.createElement;
  const checks = [];
  const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
  const fragment = element => {
    const host = document.createElement('div');
    host.innerHTML = ssr(element);
    return host;
  };
  const tick = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  const rejection = (name, props, message, detail = message.source) => {
    assert.throws(() => ssr(h(UI[name], props)), message);
    checks.push(`${name}: rejects ${detail}`);
  };

  for (const tone of ['neutral', 'brand', 'success', 'warning', 'danger']) {
    for (const size of ['sm', 'md']) {
      const host = fragment(h(UI.Badge, { tone, size, icon: 'check-circle' }, 'Reviewed'));
      check(`Badge ${tone}/${size}: text remains visible and its symbol is decorative`,
        host.textContent === 'Reviewed' && host.querySelector('svg')?.getAttribute('aria-hidden') === 'true' && !host.querySelector('[role="status"]'));
    }
  }
  for (const status of ['active', 'pending', 'inactive', 'success', 'warning', 'error', 'processing']) {
    for (const size of ['sm', 'md']) {
      const host = fragment(h(UI.StatusBadge, { status, size }));
      // Only work under way moves: `processing` turns its spinner (animation.css stills it under reduced motion).
      const turning = host.querySelector('svg[data-active="true"][data-motion="spin"][data-repeat="true"]');
      check(`StatusBadge ${status}/${size}: status has text and a decorative symbol that ${status === 'processing' ? 'turns' : 'stays still'}`,
        host.textContent.trim().length > 0 && !!host.querySelector('svg[aria-hidden="true"]')
          && (status === 'processing' ? !!turning : !host.querySelector('[data-active="true"]')));
    }
  }
  rejection('Badge', { children: '' }, /meaningful text/);
  rejection('StatusBadge', { status: 'unknown' }, /Unknown status/);
  const tooltipTrigger = h(UI.IconButton, { icon: 'info', label: 'About assignment' });
  const tooltipSSR = fragment(h(UI.Tooltip, { trigger: tooltipTrigger }, 'Only assigned agents receive notifications.'));
  check('Tooltip SSR preserves an independent accessible trigger name', tooltipSSR.querySelector('button')?.getAttribute('aria-label') === 'About assignment' || tooltipSSR.textContent.includes('About assignment'));
  rejection('Tooltip', { trigger: tooltipTrigger, children: h('button', null, 'Unsafe action') }, /noninteractive text/);
  rejection('Tooltip', { trigger: tooltipTrigger, children: 'Help', delayDuration: -1 }, /nonnegative duration/);
  rejection('Tooltip', { trigger: tooltipTrigger, children: '' }, /meaningful text/);

  for (const tone of ['neutral', 'brand', 'success', 'warning', 'danger']) {
    const action = h('button', { type: 'button' }, 'View record');
    let host = fragment(h(UI.Toast, { title: 'Assignment saved', description: 'The assigned agent can now reply.', tone, onDismiss() {}, action }));
    let message = host.querySelector(tone === 'danger' ? '[role="alert"]' : '[role="status"]');
    check(`Toast ${tone}: one message-only live region excludes action and dismissal`,
      !!message && host.querySelectorAll('[role="alert"],[role="status"]').length === 1 && !message.querySelector('button') && host.querySelectorAll('button').length === 2 && message.textContent.includes('Assignment saved'));
    host = fragment(h(UI.Alert, { title: 'Review assignment', description: 'Confirm the correct support group.', tone, action }));
    check(`Alert ${tone}: persistent guidance does not announce itself by default`, !host.querySelector('[role="alert"],[role="status"],[aria-live]'));
    host = fragment(h(UI.Alert, { title: 'Review assignment', tone, action, live: true }));
    message = host.querySelector(tone === 'danger' ? '[role="alert"]' : '[role="status"]');
    check(`Alert ${tone}: opt-in announcement excludes the separate action`, !!message && !message.querySelector('button'));
  }
  rejection('Toast', { title: '' }, /meaningful text/);
  rejection('Alert', { title: false }, /meaningful text/);

  for (const [state, value, max] of [['default', 0, 100], ['default', 42, 100], ['default', undefined, 100], ['success', undefined, 8], ['success', 8, 8], ['error', 3, 8]]) {
    const host = fragment(h(UI.Progress, { label: 'Indexing documents', state, value, max, description: 'Current ingestion batch.', showValue: true }));
    const progress = host.querySelector('progress');
    const expected = state === 'success' && value === undefined ? max : value;
    const valueName = value === undefined ? state === 'success' ? 'automatic completion' : 'indeterminate' : value;
    check(`Progress ${state}/${valueName}/${max}: native value and description agree`,
      !!progress && progress.getAttribute('aria-label') === 'Indexing documents' && Number(progress.getAttribute('max')) === max &&
      (expected === undefined ? !progress.hasAttribute('value') : Number(progress.getAttribute('value')) === expected) &&
      host.querySelector('label').getAttribute('for') === progress.id &&
      host.querySelector(`[id="${progress.getAttribute('aria-describedby')}"]`)?.textContent === 'Current ingestion batch.');
  }
  for (const [props, detail] of [[{ max: 0 }, 'zero maximum'], [{ max: Infinity }, 'infinite maximum'], [{ value: -1 }, 'negative value'], [{ value: 101 }, 'value above maximum'], [{ value: NaN }, 'nonfinite value']]) {
    rejection('Progress', { label: 'Indexing', ...props }, /Progress (max|value)/, detail);
  }
  rejection('Progress', { label: 'Indexing', state: 'error' }, /last recorded value/);
  rejection('Progress', { label: 'Indexing', state: 'success', value: 40 }, /must be complete/);
  rejection('Progress', { label: '' }, /meaningful text/);
  for (const size of [16, 20, 24, 32]) {
    const host = fragment(h(UI.Spinner, { label: 'Saving assignment', size }));
    check(`Spinner ${size}: one textual status and one hidden brand loader`,
      host.querySelectorAll('[role="status"]').length === 1 && host.textContent === 'Saving assignment' && host.querySelectorAll('svg').length === 1 &&
      !!host.querySelector('svg')?.closest('[aria-hidden="true"]') && host.querySelector('.easm-ui-spinner')?.getAttribute('data-variant') === 'brand');
    const ring = fragment(h(UI.Spinner, { label: 'Saving assignment', size, variant: 'ring' }));
    check(`Spinner ${size} ring: one textual status and one hidden approved glyph`,
      ring.querySelectorAll('[role="status"]').length === 1 && ring.textContent === 'Saving assignment' && ring.querySelector('svg')?.getAttribute('width') === String(size) && ring.querySelector('svg')?.getAttribute('aria-hidden') === 'true');
  }
  rejection('Spinner', { label: '' }, /meaningful text/);
  for (const shape of ['text', 'rect', 'circle']) {
    const host = fragment(h(UI.Skeleton, { shape, width: 96, children: h('button', null, 'Unavailable content') }));
    const skeleton = host.firstElementChild;
    check(`Skeleton ${shape}: hidden, inert and shimmering by default`, skeleton.getAttribute('aria-hidden') === 'true' && skeleton.hasAttribute('inert') && skeleton.getAttribute('data-animated') === 'true');
    check(`Skeleton ${shape}: still on request`, !fragment(h(UI.Skeleton, { shape, animated: false })).firstElementChild.hasAttribute('data-animated'));
  }
  check('Skeleton multiline exposes the requested number of placeholders', fragment(h(UI.Skeleton, { lines: 3 })).querySelectorAll('.easm-ui-skeleton-line').length === 3);
  rejection('Skeleton', { lines: 0 }, /one to twenty/);

  const launcher = h(UI.Button, { variant: 'secondary' }, 'Open assignment');
  rejection('DropdownMenu', { trigger: launcher, items: [{ id: 'edit', label: 'Edit' }, { id: 'edit', label: 'Duplicate' }] }, /unique/);
  rejection('DropdownMenu', { trigger: launcher, items: [{ id: 'edit', label: '' }] }, /nonempty label/);
  rejection('Popover', { trigger: launcher, children: 'Settings' }, /visible title or a nonempty label/);
  for (const name of ['Dialog', 'Drawer', 'ConfirmationDialog']) {
    rejection(name, { trigger: launcher, title: '', children: 'Details', onConfirm() {} }, /meaningful title/);
  }

  let dismissed = 0;
  let host = await render(h(UI.Toast, { title: 'Saved', onDismiss: () => dismissed++ }));
  await click(host.querySelector('button'));
  await tick();
  check('Toast dismissal is explicit and does not silently remove consumer content', dismissed === 1 && host.textContent.includes('Saved'));
  await unmount();

  host = await render(h(UI.ConfirmationDialog, { title: 'Removing source', description: 'The requested removal is in progress.',
    defaultOpen: true, loading: true, onConfirm() {} }));
  let initiallyPendingPanel = document.querySelector('[role="alertdialog"]');
  check('Initially pending confirmation focuses its panel rather than disabled Cancel',
    !!initiallyPendingPanel && document.activeElement === initiallyPendingPanel && initiallyPendingPanel.getAttribute('aria-busy') === 'true');
  await unmount();

  let confirms = 0, cancels = 0, finish;
  function ConfirmationHarness() {
    const [open, setOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    return h(UI.ConfirmationDialog, { title: 'Delete source?', description: 'The source will be removed from this workspace.',
      trigger: h(UI.Button, null, 'Delete source'), open, onOpenChange: setOpen, destructive: true, loading,
      confirmLabel: 'Delete source now', onCancel: () => cancels++, onConfirm: async () => {
        confirms++;
        setLoading(true);
        await new Promise(resolve => { finish = resolve; });
        setLoading(false);
        setOpen(false);
      } });
  }
  host = await render(h(ConfirmationHarness));
  const trigger = host.querySelector('button');
  await act(async () => trigger.focus());
  await click(trigger);
  let panel = document.querySelector('[role="alertdialog"]');
  check('Confirmation opens with safe cancel focus and a meaningful title', !!panel && document.activeElement?.textContent === 'Cancel' && document.getElementById(panel.getAttribute('aria-labelledby'))?.textContent === 'Delete source?');
  await click([...panel.querySelectorAll('button')].find(button => button.textContent === 'Delete source now'));
  panel = document.querySelector('[role="alertdialog"]');
  let confirm = [...panel.querySelectorAll('button')].find(button => button.textContent.includes('Delete source now'));
  let cancel = [...panel.querySelectorAll('button')].find(button => button.textContent === 'Cancel');
  await click(confirm); await click(cancel);
  const escape = await key(panel, 'Escape');
  check('Pending confirmation blocks repeat action, cancel and Escape dismissal', confirms === 1 && cancels === 0 && panel.getAttribute('aria-busy') === 'true' && cancel.disabled && confirm.getAttribute('aria-disabled') === 'true' && escape.defaultPrevented && !!document.querySelector('[role="alertdialog"]'));
  await act(async () => { finish(); });
  await tick();
  check('Consumer async completion closes confirmation and restores its trigger', !document.querySelector('[role="alertdialog"]') && document.activeElement === trigger && cancels === 0);
  await click(trigger);
  panel = document.querySelector('[role="alertdialog"]');
  await click([...panel.querySelectorAll('button')].find(button => button.textContent === 'Cancel'));
  await tick();
  check('Explicit cancellation reports once and restores trigger focus', cancels === 1 && !document.querySelector('[role="alertdialog"]') && document.activeElement === trigger);
  await unmount();

  let resolved, pendingOpen, calls = 0;
  function ManualClosureHarness() {
    const [open, setOpen] = React.useState(false);
    pendingOpen = setOpen;
    return h(UI.ConfirmationDialog, { title: 'Archive draft?', description: 'Move this draft to the archive.', trigger: launcher,
      open, onOpenChange: setOpen, onConfirm: async () => { calls++; await new Promise(resolve => { resolved = resolve; }); } });
  }
  host = await render(h(ManualClosureHarness));
  await click(host.querySelector('button'));
  panel = document.querySelector('[role="alertdialog"]');
  await click([...panel.querySelectorAll('button')].find(button => button.textContent === 'Confirm'));
  check('Confirmation does not close while its business promise is pending', calls === 1 && !!document.querySelector('[role="alertdialog"]'));
  await act(async () => resolved());
  check('Promise resolution alone does not discard controlled confirmation state', !!document.querySelector('[role="alertdialog"]'));
  await act(async () => pendingOpen(false)); await tick();
  check('Controlled confirmation closes only when its consumer changes open', !document.querySelector('[role="alertdialog"]'));
  await unmount();

  for (const name of ['Dialog', 'Drawer']) {
    host = await render(h(UI[name], { title: 'Assignment details', description: 'Choose the correct support agent.',
      trigger: launcher, children: h('input', { 'aria-label': 'Assigned agent' }) }));
    const openButton = host.querySelector('button');
    await act(async () => openButton.focus()); await click(openButton);
    panel = document.querySelector('[role="dialog"]');
    check(`${name}: initial focus reaches meaningful body content`, !!panel && document.activeElement === panel.querySelector('input') && !!document.getElementById(panel.getAttribute('aria-labelledby')));
    await act(async () => openButton.focus());
    check(`${name}: modal scope returns outside focus into content`, panel.contains(document.activeElement));
    await key(panel, 'Escape'); await tick();
    check(`${name}: Escape closes and restores its launcher`, !document.querySelector('[role="dialog"]') && document.activeElement === openButton);
    await unmount();
  }
  for (const name of ['Dialog', 'Drawer', 'ConfirmationDialog']) {
    host = await render(h(UI[name], { title: 'Blocked launcher', trigger: h(UI.Button, { disabled: true }, 'Unavailable'),
      children: 'Details', onConfirm() {} }));
    await click(host.querySelector('button'));
    check(`${name}: disabled trigger cannot open an overlay`, !document.querySelector('[role="dialog"],[role="alertdialog"]'));
    await unmount();
  }
  let closeExternally;
  function ExternalLauncherHarness() {
    const [open, setOpen] = React.useState(false);
    const restoreFocusRef = React.useRef(null);
    closeExternally = setOpen;
    return h(React.Fragment, null,
      h(UI.Button, { ref: restoreFocusRef, onClick: () => setOpen(true) }, 'Open external dialog'),
      h(UI.Dialog, { open, onOpenChange: setOpen, restoreFocusRef, title: 'External dialog', children: h(UI.Button, null, 'Review') }));
  }
  host = await render(h(ExternalLauncherHarness));
  const externalButton = host.querySelector('button');
  await act(async () => externalButton.focus()); await click(externalButton);
  await act(async () => closeExternally(false)); await tick();
  check('Externally controlled modal returns focus through its explicit reference', document.activeElement === externalButton && !document.querySelector('[role="dialog"]'));
  await unmount();

  let selection = 0;
  host = await render(h(UI.DropdownMenu, { trigger: launcher, items: [
    { id: 'edit', label: 'Edit assignment', onSelect: () => selection++ },
    { id: 'disabled', label: 'Unavailable command', disabled: true, onSelect: () => selection++ },
    { id: 'archive', label: 'Archive assignment', destructive: true, onSelect: () => selection++ },
  ] }));
  const menuTrigger = host.querySelector('button');
  await key(menuTrigger, 'ArrowDown'); await tick();
  const menu = document.querySelector('[role="menu"]');
  check('Dropdown keyboard opening focuses its first enabled command', !!menu && document.activeElement?.textContent === 'Edit assignment');
  const disabled = [...menu.querySelectorAll('[role="menuitem"]')].find(item => item.textContent === 'Unavailable command');
  await click(disabled);
  check('Disabled menu command is semantically disabled and cannot select', disabled.getAttribute('aria-disabled') === 'true' && selection === 0);
  await key(document.activeElement, 'ArrowDown'); await tick();
  check('Dropdown arrow navigation skips disabled commands', document.activeElement?.textContent === 'Archive assignment');
  await key(document.activeElement, 'Enter'); await tick();
  check('Dropdown selection invokes once, closes, and restores its trigger', selection === 1 && !document.querySelector('[role="menu"]') && document.activeElement === menuTrigger);
  await unmount();

  host = await render(h(UI.Popover, { trigger: launcher, label: 'Assignment options', children: h(UI.Button, null, 'Apply options') }));
  const popoverTrigger = host.querySelector('button');
  await act(async () => popoverTrigger.focus()); await click(popoverTrigger);
  panel = document.querySelector('[role="dialog"]');
  check('Untitled popover has its explicit accessible name and interactive focus', panel?.getAttribute('aria-label') === 'Assignment options' && document.activeElement?.textContent === 'Apply options');
  await key(panel, 'Escape'); await tick();
  check('Popover Escape closes and restores its trigger', !document.querySelector('[role="dialog"]') && document.activeElement === popoverTrigger);
  await unmount();

  host = await render(h(UI.Tooltip, { trigger: tooltipTrigger }, 'Only assigned agents receive notifications.'));
  const helpTrigger = host.querySelector('button');
  await act(async () => helpTrigger.focus()); await tick();
  const tooltip = document.querySelector('[role="tooltip"]');
  check('Tooltip keyboard focus opens supplemental noninteractive text', tooltip?.textContent === 'Only assigned agents receive notifications.' && !tooltip.querySelector('button,a,input') && helpTrigger.getAttribute('aria-label') === 'About assignment');
  await key(helpTrigger, 'Escape'); await tick();
  check('Tooltip Escape dismisses help while retaining its named trigger focus', !document.querySelector('[role="tooltip"]') && document.activeElement === helpTrigger);
  await unmount();

  for (const name of ['Dialog', 'Drawer', 'ConfirmationDialog']) {
    host = await render(h(UI[name], { title: 'Long explanation', defaultOpen: true,
      description: Array.from({ length: 16 }, (_, index) => h('p', { key: index }, 'Review supporting information before continuing.')),
      children: h('input', { 'aria-label': 'Review note' }), footer: h(UI.Button, null, 'Save review'), onConfirm() {} }));
    panel = document.querySelector(name === 'ConfirmationDialog' ? '[role="alertdialog"]' : '[role="dialog"]');
    const description = document.getElementById(panel.getAttribute('aria-describedby'));
    const body = panel.querySelector('.easm-ui-overlay-body');
    check(`${name}: long explanation shares the scroll region with business content`,
      body.contains(description) && body.contains(panel.querySelector('input')) && description.querySelectorAll('p').length === 16 && !panel.querySelector('header').contains(description));
    check(`${name}: fixed title and actions stay outside the content scroll region`,
      !body.contains(document.getElementById(panel.getAttribute('aria-labelledby'))) && !body.contains(panel.querySelector('footer')));
    await unmount();
  }

  // These assertions verify portal scope and ordering recipes. Browser QA proves actual paint order.
  const offset = element => Number(element.style.getPropertyValue('--easm-ui-layer-offset'));
  const rank = (element, base) => base + offset(element);
  host = await render(h(UI.Popover, { trigger: launcher, label: 'Parent preferences', defaultOpen: true },
    h(UI.Dialog, { title: 'Nested assignment', trigger: h(UI.Button, null, 'Open nested assignment') },
      h(React.Fragment, null,
        h(UI.DropdownMenu, { trigger: h(UI.Button, null, 'Assignment commands'), items: [{ id: 'review', label: 'Review assignment' }] }),
        h(UI.Tooltip, { trigger: h(UI.IconButton, { icon: 'info', label: 'Nested guidance' }) }, 'Guidance within the active assignment.'),
        h(UI.Dialog, { title: 'Deeper details', trigger: h(UI.Button, null, 'Open deeper details') }, h(UI.Button, null, 'Review details'))))));
  const parentPopover = document.querySelector('[role="dialog"][aria-label="Parent preferences"]');
  const nestedLauncher = [...parentPopover.querySelectorAll('button')].find(button => button.textContent === 'Open nested assignment');
  await click(nestedLauncher);
  const titledPanel = title => [...document.querySelectorAll('[role="dialog"]')].find(candidate => document.getElementById(candidate.getAttribute('aria-labelledby'))?.textContent === title);
  const nestedPanel = titledPanel('Nested assignment');
  const nestedBackdrop = [...document.querySelectorAll('.easm-ui-overlay-backdrop')].find(backdrop => offset(backdrop) === offset(nestedPanel));
  check('Dialog opened from Popover reserves a band above the ancestor surface',
    !!parentPopover && !!nestedPanel && rank(nestedBackdrop, 1000) > rank(parentPopover, 1100) && rank(nestedPanel, 1001) > rank(nestedBackdrop, 1000));
  const commandTrigger = [...nestedPanel.querySelectorAll('button')].find(button => button.textContent === 'Assignment commands');
  await key(commandTrigger, 'ArrowDown'); await tick();
  const nestedMenu = document.querySelector('[role="menu"]');
  check('Menu inside a nested modal inherits its portal band and receives focus',
    !!nestedMenu && rank(nestedMenu, 1100) > rank(nestedPanel, 1001) && nestedMenu.contains(document.activeElement));
  await key(nestedMenu, 'Escape'); await tick();
  check('Escape dismisses only the nested command surface and returns its focus',
    !document.querySelector('[role="menu"]') && !!titledPanel('Nested assignment') && document.activeElement === commandTrigger);
  const guidance = nestedPanel.querySelector('button[aria-label="Nested guidance"]');
  await act(async () => guidance.focus()); await tick();
  const nestedTooltip = document.querySelector('[role="tooltip"]');
  const tooltipSurface = nestedTooltip?.closest('.easm-ui-tooltip');
  check('Tooltip inside a nested modal inherits the active portal band',
    !!nestedTooltip && !!tooltipSurface && rank(tooltipSurface, 1200) > rank(nestedPanel, 1001));
  await key(guidance, 'Escape'); await tick();
  const deeperLauncher = [...nestedPanel.querySelectorAll('button')].find(button => button.textContent === 'Open deeper details');
  await click(deeperLauncher);
  const deeperPanel = titledPanel('Deeper details');
  const deeperBackdrop = [...document.querySelectorAll('.easm-ui-overlay-backdrop')].find(backdrop => offset(backdrop) === offset(deeperPanel));
  check('Deeper modal backdrop is above its parent modal and parent tooltip band',
    !!deeperPanel && rank(deeperBackdrop, 1000) > rank(nestedPanel, 1001) && rank(deeperBackdrop, 1000) > rank(tooltipSurface, 1200));
  await key(deeperPanel, 'Escape'); await tick();
  check('Nested modal Escape restores its own launcher without closing its parent',
    !titledPanel('Deeper details') && !!titledPanel('Nested assignment') && document.activeElement === deeperLauncher);
  await key(nestedPanel, 'Escape'); await tick();
  check('Closing modal launched from Popover returns to the still-open parent surface',
    !titledPanel('Nested assignment') && !!document.querySelector('[aria-label="Parent preferences"]') && document.activeElement === nestedLauncher);
  await unmount();

  let setSiblingOpen;
  function SiblingModalHarness() {
    const [secondOpen, setSecondOpen] = React.useState(false);
    setSiblingOpen = setSecondOpen;
    return h(React.Fragment, null,
      h(UI.Dialog, { title: 'First sibling modal', defaultOpen: true },
        h(UI.DropdownMenu, { defaultOpen: true, trigger: h(UI.Button, null, 'First sibling commands'), items: [{ id: 'review', label: 'Review first sibling' }] })),
      h(UI.Dialog, { title: 'Second sibling modal', open: secondOpen, onOpenChange: setSecondOpen }, h(UI.Button, null, 'Review second sibling')));
  }
  host = await render(h(SiblingModalHarness));
  const firstSibling = titledPanel('First sibling modal');
  const firstSiblingMenu = document.querySelector('[role="menu"]');
  await act(async () => setSiblingOpen(true));
  const secondSibling = titledPanel('Second sibling modal');
  const secondSiblingBackdrop = [...document.querySelectorAll('.easm-ui-overlay-backdrop')].find(backdrop => offset(backdrop) === offset(secondSibling));
  check('Later externally controlled sibling modal covers the earlier live command portal',
    !!firstSibling && !!firstSiblingMenu && !!secondSibling && rank(secondSiblingBackdrop, 1000) > rank(firstSiblingMenu, 1100) && rank(secondSibling, 1001) > rank(secondSiblingBackdrop, 1000));
  const previousSiblingBand = offset(secondSibling);
  await key(secondSibling, 'Escape'); await tick();
  check('Closing a sibling modal leaves the earlier modal and its command surface available',
    !titledPanel('Second sibling modal') && !!titledPanel('First sibling modal') && !!document.querySelector('[role="menu"]') && firstSiblingMenu.contains(document.activeElement));
  await act(async () => setSiblingOpen(true));
  check('A new modal activation gets a fresh band above any exiting previous portal', offset(titledPanel('Second sibling modal')) > previousSiblingBand);
  await unmount();

  host = await render(h(React.StrictMode, null,
    h(UI.Dialog, { title: 'Strict mode modal', defaultOpen: true },
      h(UI.Popover, { defaultOpen: true, label: 'Strict mode options', trigger: h(UI.Button, null, 'Strict mode trigger') }, h(UI.Button, null, 'Apply strict options')))));
  const strictPanel = titledPanel('Strict mode modal');
  const strictPopover = document.querySelector('[role="dialog"][aria-label="Strict mode options"]');
  const strictBand = offset(strictPanel);
  await tick();
  check('Strict Mode effect replay keeps an active modal band stable for its mounted popup',
    !!strictPanel && !!strictPopover && offset(strictPanel) === strictBand && rank(strictPopover, 1100) > rank(strictPanel, 1001) && offset(strictPopover) - strictBand < 100);
  await unmount();

  let beginRapidReopen;
  function RapidReopenHarness() {
    const [firstOpen, setFirstOpen] = React.useState(true);
    const [secondOpen, setSecondOpen] = React.useState(false);
    const [phase, setPhase] = React.useState(0);
    beginRapidReopen = () => setPhase(1);
    React.useLayoutEffect(() => {
      if (phase === 1) {
        setFirstOpen(false);
        setSecondOpen(true);
        setPhase(2);
      } else if (phase === 2) {
        setFirstOpen(true);
        setPhase(3);
      }
    }, [phase]);
    return h(React.Fragment, null,
      h(UI.Dialog, { title: 'Rapid first modal', open: firstOpen, onOpenChange: setFirstOpen }, h(UI.Button, null, 'Review rapid first')),
      h(UI.Dialog, { title: 'Rapid second modal', open: secondOpen, onOpenChange: setSecondOpen }, h(UI.Button, null, 'Review rapid second')));
  }
  host = await render(h(RapidReopenHarness));
  await act(async () => beginRapidReopen());
  const rapidFirst = titledPanel('Rapid first modal');
  const rapidSecond = titledPanel('Rapid second modal');
  const rapidFirstBackdrop = [...document.querySelectorAll('.easm-ui-overlay-backdrop')].find(backdrop => offset(backdrop) === offset(rapidFirst));
  check('Committed close/reopen before microtask cleanup receives a fresh band above the intervening sibling',
    !!rapidFirst && !!rapidSecond && rank(rapidFirstBackdrop, 1000) > rank(rapidSecond, 1001) && rapidFirst.contains(document.activeElement));
  await unmount();

  host = await render(h(UI.DropdownMenu, { trigger: launcher, defaultOpen: true, items: [
    { id: 'edit', label: 'Edit with icon', icon: 'edit' }, { id: 'review', label: 'Review without icon' },
  ] }));
  let mixedRows = document.querySelectorAll('[role="menuitem"]');
  check('Mixed-icon menu reserves a decorative slot only for its iconless row',
    !!mixedRows[0].querySelector('svg') && !mixedRows[0].querySelector('.easm-ui-menu-icon-slot') && mixedRows[1].querySelector('.easm-ui-menu-icon-slot')?.getAttribute('aria-hidden') === 'true' && mixedRows[1].textContent === 'Review without icon');
  await unmount();
  host = await render(h(UI.DropdownMenu, { trigger: launcher, defaultOpen: true, items: [{ id: 'review', label: 'Review compact menu' }] }));
  check('Fully iconless menu retains compact labels without reserved icon slots',
    !document.querySelector('[role="menuitem"] .easm-ui-menu-icon-slot') && !document.querySelector('[role="menuitem"] svg'));
  await unmount();

  for (const name of ['Card', 'Panel']) {
    host = fragment(h(UI[name], { title: 'Assignment', description: 'Choose a responsible agent.',
      actions: h(React.Fragment, null, h(UI.Button, null, 'Review'), h(UI.Button, null, 'Save')) }, h(UI.TextField, { label: 'Agent reference' })));
    check(`${name}: header actions have a separate group outside the title and body`,
      host.querySelector('.easm-ui-container-actions')?.querySelectorAll('button').length === 2 &&
      !host.querySelector('.easm-ui-container-title button') && !host.querySelector('.easm-ui-container-body button'));
  }

  let setDisclosure;
  function DisclosureHarness() {
    const [state, setState] = React.useState({ open: true, disabled: false, expandedCopy: false });
    setDisclosure = setState;
    return h(React.Fragment, null,
      h(UI.Button, null, 'Outside disclosure'),
      h(UI.Collapsible, { title: 'Assignment metadata', open: state.open, disabled: state.disabled },
        h(UI.TextField, { label: 'Retained reference', defaultValue: 'EASM-1042' }),
        h('p', null, state.expandedCopy ? 'Additional context '.repeat(80) : 'Short context')));
  }
  host = await render(h(DisclosureHarness));
  let retainedField = host.querySelector('input');
  let disclosureTrigger = host.querySelector('.easm-ui-collapsible-trigger');
  let disclosureRegion = host.querySelector('.easm-ui-collapsible-region');
  const originalRegionId = disclosureRegion.id;
  await act(async () => retainedField.focus());
  await act(async () => setDisclosure(previous => ({ ...previous, expandedCopy: true })));
  check('Disclosure content growth preserves the field node, value, focus and controlled region ID',
    host.querySelector('input') === retainedField && retainedField.value === 'EASM-1042' && document.activeElement === retainedField &&
    disclosureRegion.id === originalRegionId && disclosureTrigger.getAttribute('aria-expanded') === 'true');
  await act(async () => setDisclosure(previous => ({ ...previous, open: false })));
  check('Controlled disclosure closure returns body focus to its own surviving trigger',
    document.activeElement === disclosureTrigger && disclosureRegion.hasAttribute('inert') && disclosureRegion.getAttribute('aria-hidden') === 'true');
  await act(async () => setDisclosure(previous => ({ ...previous, open: true })));
  check('Disclosure reopening preserves the entered value and mounted field', host.querySelector('input') === retainedField && retainedField.value === 'EASM-1042');
  const outsideDisclosure = [...host.querySelectorAll('button')].find(button => button.textContent === 'Outside disclosure');
  await act(async () => outsideDisclosure.focus());
  await act(async () => setDisclosure(previous => ({ ...previous, open: false })));
  check('Controlled disclosure closure leaves unrelated outside focus undisturbed', document.activeElement === outsideDisclosure);
  await act(async () => setDisclosure(previous => ({ ...previous, open: true })));
  await act(async () => retainedField.focus());
  await act(async () => setDisclosure(previous => ({ ...previous, open: false, disabled: true })));
  const closedDisclosure = host.querySelector('.easm-ui-collapsible');
  check('Simultaneous closure and disabling returns focus to the named non-tab-stop container',
    disclosureTrigger.disabled && document.activeElement === closedDisclosure && closedDisclosure.tabIndex === -1 &&
    document.getElementById(closedDisclosure.getAttribute('aria-labelledby')) === disclosureTrigger && disclosureRegion.hasAttribute('inert'));
  await unmount();

  let closeOuter;
  function NestedDisclosureHarness() {
    const [outerOpen, setOuterOpen] = React.useState(true);
    closeOuter = () => setOuterOpen(false);
    return h(UI.Collapsible, { title: 'Outer metadata', open: outerOpen },
      h(UI.Collapsible, { title: 'Inner metadata', defaultOpen: true }, h(UI.TextField, { label: 'Nested metadata value' })));
  }
  host = await render(h(NestedDisclosureHarness));
  const outerDisclosureTrigger = host.querySelector('.easm-ui-collapsible-trigger');
  await act(async () => host.querySelector('input').focus());
  await act(async () => closeOuter());
  check('Closing an ancestor disclosure returns nested field focus to the visible outer trigger',
    document.activeElement === outerDisclosureTrigger && host.querySelector('.easm-ui-collapsible-region').hasAttribute('inert') &&
    host.querySelectorAll('.easm-ui-collapsible-trigger')[1].getAttribute('aria-expanded') === 'true');
  await unmount();
  return checks;
};
