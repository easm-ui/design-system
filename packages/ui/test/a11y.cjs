// Automated axe-core checks (WCAG 2.0–2.2 A and AA rules) for every @easm-ui/ui component.
// Renders each core component in its default and key states, then the three higher-layer module
// demos (navigation, data, patterns), and fails on any violation.
//
// jsdom has no layout engine, so axe cannot measure colour contrast here. Contrast is checked
// against the tokens by tokens/contrast.mjs. Keyboard-only and screen-reader passes stay manual.
const fs = require('node:fs');
const path = require('node:path');

const pkg = path.resolve(__dirname, '..');
const repo = path.resolve(pkg, '../..');
const cache = path.join(pkg, 'test/.cache');

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function main() {
  fs.mkdirSync(cache, { recursive: true });
  await require('esbuild').build({
    entryPoints: {
      ui: path.join(pkg, 'src/index.ts'),
      navigation: path.join(pkg, 'test/demos/navigation/demo.tsx'),
      data: path.join(pkg, 'test/demos/data/demo.tsx'),
      patterns: path.join(pkg, 'test/demos/patterns/demo.tsx'),
    },
    outdir: cache, outExtension: { '.js': '.cjs' }, bundle: true, format: 'cjs', platform: 'node', jsx: 'automatic',
    external: ['react', 'react-dom', 'react-dom/*', 'react/jsx-runtime'],
    loader: { '.css': 'empty' }, logLevel: 'silent',
  });

  const { JSDOM, VirtualConsole } = require('jsdom');
  // jsdom reports axe's optional canvas probe as "not implemented"; that is noise, not a finding.
  const virtualConsole = new VirtualConsole().on('jsdomError', error => { if (!/getContext/.test(error.message)) console.error(error); });
  const dom = new JSDOM('<!doctype html><html lang="en"><head><title>a11y</title></head><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'outside-only', virtualConsole });
  for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLFormElement', 'HTMLTextAreaElement', 'HTMLButtonElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'FocusEvent', 'CustomEvent', 'MutationObserver', 'File', 'FileList', 'DocumentFragment', 'NodeFilter', 'DOMRect']) {
    global[name] = name === 'window' ? dom.window : dom.window[name];
  }
  Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
  global.getComputedStyle = dom.window.getComputedStyle;
  global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.ResizeObserver = dom.window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  global.PointerEvent = dom.window.PointerEvent = dom.window.MouseEvent;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  dom.window.matchMedia = query => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  dom.window.eval(fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'));

  const React = require('react');
  const { act } = React;
  const { createRoot } = require('react-dom/client');
  const h = React.createElement;
  const UI = require(path.join(cache, 'ui.cjs'));

  const results = [];
  async function audit(label, element, interact) {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(element));
    if (interact) await interact(host);
    // Overlays portal into <body>, so audit the whole body rather than the host.
    const { violations } = await dom.window.axe.run(document.body, {
      runOnly: { type: 'tag', values: WCAG_TAGS },
      rules: { 'color-contrast': { enabled: false } },
    });
    results.push({ label, violations: violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map(n => n.target.join(' ')) })) });
    await act(async () => root.unmount());
    document.body.innerHTML = '';
  }

  // Sample props match brand-assets/components/library/scripts/verify-components.cjs.
  const opts = [{ value: 'a', label: 'Aisha Khan' }, { value: 'b', label: 'Omar Ali' }, { value: 'c', label: 'Sara Ahmed', disabled: true }];
  const sel = [{ id: 'a', label: 'Support', content: h('p', null, 'Support content') }, { id: 'b', label: 'Knowledge', content: h('p', null, 'Knowledge content') }, { id: 'c', label: 'Unavailable', disabled: true, content: 'Unavailable' }];
  const trigger = h(UI.Button, { variant: 'secondary' }, 'Open');
  const menu = [{ id: 'edit', label: 'Edit', icon: 'edit' }, { id: 'archive', label: 'Archive', disabled: true }];
  const samples = {
    Button: { children: 'Save changes' }, IconButton: { icon: 'edit', label: 'Edit' }, SplitButton: { children: 'Send reply', items: menu }, ButtonGroup: { label: 'Actions', children: h(UI.Button, null, 'Save') },
    TextField: { label: 'Name' }, PasswordField: { label: 'Password' }, NumberField: { label: 'Quantity' }, TextArea: { label: 'Note' }, SearchField: { label: 'Search records' }, Select: { label: 'Agent', options: opts }, DropdownSelect: { label: 'Agent', options: opts }, Combobox: { label: 'Agent', options: opts },
    Checkbox: { label: 'Notify' }, Radio: { label: 'Public', name: 'visibility', value: 'public' }, Switch: { label: 'Enabled' }, DateField: { label: 'Date' }, TimeField: { label: 'Time' }, FileUpload: { label: 'Document', onFiles() {} },
    Tabs: { label: 'Settings', items: sel }, SegmentedControl: { label: 'View', options: sel }, Chip: { children: 'Support' }, Tag: { children: 'Student' }, FilterControl: { label: 'Channel', options: sel },
    Badge: { children: 'Reviewed' }, StatusBadge: { status: 'active' }, Tooltip: { trigger, children: 'Useful context' }, Toast: { title: 'Saved' }, Alert: { title: 'Review required' }, InlineValidation: { children: 'Choose an available agent.' }, Progress: { label: 'Processing', value: 40 }, Spinner: { label: 'Loading' }, Skeleton: {},
    Card: { title: 'Source', children: 'Handbook' }, Panel: { title: 'Settings', children: 'Settings' }, Accordion: { items: [{ id: 'a', title: 'Sources', content: 'Verified documents' }] }, Collapsible: { title: 'Advanced', children: 'Optional settings' }, Divider: {},
    DropdownMenu: { trigger, items: menu }, Popover: { trigger, title: 'Preferences', children: 'Context' }, Dialog: { trigger, title: 'Assignment', children: 'Details' }, Drawer: { trigger, title: 'Details', children: 'Details' }, ConfirmationDialog: { trigger, title: 'Delete draft?', onConfirm() {} },
    Avatar: { name: 'Aisha Khan' }, UserChip: { name: 'Aisha Khan' }, ModuleIcon: { icon: 'inbox', label: 'Support' }, CopyControl: { text: 'EASM-1042' }, OverflowMenu: { items: menu },
  };
  const missing = UI.componentNames.filter(name => !samples[name]);
  if (missing.length) throw new Error(`a11y: no sample props for ${missing.join(', ')}`);

  const fields = ['TextField', 'PasswordField', 'NumberField', 'TextArea', 'SearchField', 'Select', 'DropdownSelect', 'Combobox', 'Checkbox', 'Switch', 'DateField', 'TimeField', 'FileUpload'];
  const openable = ['DropdownMenu', 'Popover', 'Dialog', 'Drawer', 'ConfirmationDialog', 'Select', 'DropdownSelect', 'Collapsible'];

  for (const name of UI.componentNames) {
    const wrap = el => name === 'Radio' ? h('fieldset', null, h('legend', null, 'Visibility'), el) : el;
    await audit(`${name}`, wrap(h(UI[name], samples[name])));
    if (fields.includes(name)) {
      await audit(`${name} (error)`, h(UI[name], { ...samples[name], error: 'Fix this value.' }));
      await audit(`${name} (disabled)`, h(UI[name], { ...samples[name], disabled: true }));
    }
    if (openable.includes(name)) await audit(`${name} (open)`, h(UI[name], { ...samples[name], defaultOpen: true }));
  }
  for (const variant of ['primary', 'secondary', 'subtle', 'destructive']) {
    await audit(`Button ${variant} (loading)`, h(UI.Button, { variant, loading: true }, 'Save'));
  }
  for (const module of ['navigation', 'data', 'patterns']) {
    await audit(`${module} module demo`, h(require(path.join(cache, `${module}.cjs`)).default));
  }

  // Pickers (DatePicker, DateRangePicker, TimePicker): closed, open, and month/year views.
  const assert = require('node:assert/strict');
  const click = el => act(async () => { el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 })); el.click(); await new Promise(r => setTimeout(r, 10)); });
  const openTrigger = async host => click(host.querySelector('.easm-ui-picker-trigger, .easm-ui-range-button'));
  let picked = '';
  for (const [name, props] of [
    ['DatePicker', { label: 'Exam date', defaultValue: '2026-11-03', onValueChange: v => { picked = v; } }],
    ['DateRangePicker', { label: 'Report period', defaultValue: { start: '2026-10-01', end: '2026-10-13' } }],
    ['DateRangePicker (button)', { label: 'Date range', hideLabel: true, appearance: 'button', defaultValue: { start: '2026-10-07', end: '2026-10-13' } }],
    ['TimePicker', { label: 'Office opens', defaultValue: '09:00' }],
    ['TimePicker (24-hour)', { label: 'Office opens', defaultValue: '17:30', hourCycle: 24 }],
  ]) {
    const Component = UI[name.split(' ')[0]];
    await audit(name, h(Component, props));
    await audit(`${name} (open)`, h(Component, props), openTrigger);
  }
  await audit('DatePicker (error, required)', h(UI.DatePicker, { label: 'Follow up on', required: true, error: 'Choose a date.' }));
  await audit('DatePicker (month view)', h(UI.DatePicker, { label: 'Exam date', defaultValue: '2026-11-03' }), async host => {
    await openTrigger(host); await click(document.querySelector('.easm-ui-cal-title-button'));
  });
  await audit('DatePicker (year view)', h(UI.DatePicker, { label: 'Exam date', defaultValue: '2026-11-03', onValueChange: v => { picked = v; } }), async host => {
    await openTrigger(host); await click(document.querySelector('.easm-ui-cal-title-button')); await click(document.querySelector('.easm-ui-cal-title-button'));
    assert.equal(document.querySelector('.easm-ui-cal').dataset.view, 'year', 'DatePicker: the title steps up to the year view');
    await click([...document.querySelectorAll('.easm-ui-cal-cell')].find(b => b.textContent === '2019'));
    assert.equal(document.querySelector('.easm-ui-cal').dataset.view, 'month', 'DatePicker: choosing a year opens its months');
    await click([...document.querySelectorAll('.easm-ui-cal-cell')].find(b => b.textContent === 'Mar'));
    await click(document.querySelector('[data-cell="2019-03-14"]'));
    assert.equal(picked, '2019-03-14', 'DatePicker: year → month → day reports the ISO date');
  });
  await audit('DatePicker (min blocks earlier dates)', h(UI.DatePicker, { label: 'Follow up on', defaultValue: '2026-10-20', min: '2026-10-13' }), async host => {
    await openTrigger(host);
    assert.equal(document.querySelector('[data-cell="2026-10-12"]').disabled, true, 'DatePicker: dates before min are disabled');
    assert.equal(document.querySelector('[data-cell="2026-10-13"]').disabled, false, 'DatePicker: min itself stays available');
  });
  let time = '';
  await audit('TimePicker (pick)', h(UI.TimePicker, { label: 'At', defaultValue: '09:00', step: 15, onValueChange: v => { time = v; } }), async host => {
    await openTrigger(host);
    await click([...document.querySelector('[aria-label="Minute"]').children].find(o => o.textContent === '45'));
    await click([...document.querySelector('[aria-label="AM or PM"]').children].find(o => o.textContent === 'PM'));
    assert.equal(time, '21:45', 'TimePicker: minute and AM/PM choices produce a 24-hour value');
  });
  let range = null;
  await audit('DateRangePicker (pick)', h(UI.DateRangePicker, { label: 'Report period', presets: false, defaultValue: { start: '2026-10-01', end: '2026-10-13' }, onValueChange: v => { range = v; } }), async host => {
    await openTrigger(host);
    await click(document.querySelector('[data-cell="2026-10-02"]')); await click(document.querySelector('[data-cell="2026-10-09"]'));
    assert.deepEqual(range, { start: '2026-10-02', end: '2026-10-09' }, 'DateRangePicker: two clicks set start and end');
  });
  // Tabs keep their overflow controls out of the way when everything fits.
  await audit('Tabs (overflow scroller)', h(UI.Tabs, { label: 'Settings', items: sel }), async host => {
    assert.ok(host.querySelector('.easm-ui-tab-scroller > [role="tablist"]'), 'Tabs: horizontal lists sit in the overflow scroller');
    assert.equal(host.querySelectorAll('.easm-ui-tab-scroll').length, 0, 'Tabs: no paging buttons when nothing overflows');
  });

  // Reporting layer: charts, meters, tiles and structure.
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((label, i) => ({ id: label, label, values: { total: 20 + i * 3, ai: i === 2 ? null : 15 + i } }));
  const twoSeries = [{ id: 'total', label: 'Total' }, { id: 'ai', label: 'AI handled', tone: 'teal' }];
  for (const kind of ['line', 'area', 'bar', 'stacked-bar']) {
    await audit(`SeriesChart (${kind})`, h(UI.SeriesChart, { title: 'Conversations per day', description: 'Total vs AI handled', info: 'Counted when a conversation starts.', series: twoSeries, data: days, kind }));
  }
  await audit('SeriesChart (keyboard reading)', h(UI.SeriesChart, { title: 'Conversations', series: twoSeries, data: days, kind: 'stacked-bar' }), async host => {
    const plot = host.querySelector('.easm-ui-series-plot');
    await act(async () => { plot.focus(); plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); });
    assert.match(plot.querySelector('[aria-live]').textContent, /^Fri: Total 32, AI handled 19, total 51$/, 'SeriesChart: End announces the last category with every series and the stack total');
    assert.equal(host.querySelectorAll('.easm-ui-chart-data tbody tr').length, 5, 'SeriesChart: data table lists every category');
  });
  await audit('SeriesChart (loading / error / empty)', h('div', null,
    h(UI.SeriesChart, { title: 'Loading chart', series: twoSeries, data: days, loading: true }),
    h(UI.SeriesChart, { title: 'Failed chart', series: twoSeries, data: days, error: 'The report could not load.' }),
    h(UI.SeriesChart, { title: 'Empty chart', series: twoSeries, data: days.map(d => ({ ...d, values: {} })) })));
  await audit('DonutChart', h(UI.DonutChart, { label: 'Priority distribution', segments: [{ id: 'm', label: 'Medium', value: 407, tone: 'amber' }, { id: 'h', label: 'High', value: 26, tone: 'coral' }, { id: 'l', label: 'Low', value: 0 }] }), async host => {
    assert.match(host.textContent, /Medium40794%/, 'DonutChart: legend states value and share');
  });
  await audit('BarList (inline, auto tones, both)', h(UI.BarList, { label: 'Topics', tone: 'auto', display: 'both', items: [{ id: 'a', label: 'Admissions', value: 820 }, { id: 'f', label: 'Fees', value: 180, href: '#fees' }, { id: 'u', label: 'Unclassified', value: null }] }), async host => {
    assert.equal(host.querySelectorAll('li').length, 3, 'BarList: one list item per row');
    assert.match(host.textContent, /820 · 82%/, 'BarList: value and share of total');
  });
  await audit('BarList (stacked)', h(UI.BarList, { label: 'Department load', layout: 'stacked', scale: 500, items: [{ id: 'a', label: 'Admissions Office', value: 465 }] }));
  await audit('ProgressRing + Meter', h('div', null,
    h(UI.ProgressRing, { label: 'Profile fields captured', value: 3, max: 26, valueText: '3 of 26' }, '3/26'),
    h(UI.Meter, { label: 'Confidence', value: 68, description: 'How sure the assistant was.' })), async host => {
    assert.equal(host.querySelector('[role="meter"]').getAttribute('aria-valuetext'), '68%', 'Meter: value text');
    assert.equal(host.querySelector('[role="progressbar"]').getAttribute('aria-valuetext'), '3 of 26', 'ProgressRing: value text');
  });
  await audit('MetricGroup + MetricTile + InlineStats', h('div', null,
    h(UI.MetricGroup, { columns: 4 },
      h(UI.MetricTile, { label: 'Attempts', value: 123, caption: 'Outbound attempts' }),
      h(UI.MetricTile, { label: 'AI responses', value: '2,470', tone: 'violet', info: 'Replies written by the assistant.' }),
      h(UI.MetricTile, { label: 'Loading', value: null, loading: true })),
    h(UI.InlineStats, { items: [{ id: 'f', label: 'In funnel', value: 1687 }, { id: 'a', label: 'Reached applied', value: '5%', tone: 'amber' }] })));
  await audit('SectionHeading + DescriptionList + CellStack', h('div', null,
    h(UI.SectionHeading, { title: 'Conversation activity', meta: 'Last 30 days', actions: h(UI.Button, { size: 'sm', variant: 'secondary' }, 'Export') }),
    h(UI.DescriptionList, { items: [{ id: 'i', label: 'Intent', value: 'Admissions' }, { id: 's', label: 'Sentiment', value: 'Neutral' }] }),
    h(UI.DescriptionList, { layout: 'columns', items: [{ id: 'c', label: 'Completed work', value: '0 requests' }] }),
    h(UI.CellStack, { primary: 'Spring admission', secondary: 'n = 0', href: '#agent' })));
  await audit('StatCard (tone, info) + Card/Panel/Collapsible with icons', h('div', null,
    h(UI.StatCard, { label: 'Conversations', value: 2277, icon: 'chat', tone: 'violet', info: 'All conversations started in range.' }),
    h(UI.Card, { title: 'Channel mix', description: 'Where conversations come from', icon: 'analytics', iconTone: 'blue' }, h('p', null, 'Body')),
    h(UI.Panel, { title: 'Calls', icon: 'phone' }, h('p', null, 'Body')),
    h(UI.Collapsible, { title: 'AI insights', icon: 'sparkle', appearance: 'card', defaultOpen: true }, h('p', null, 'Summary'))));

  await audit('Sidebar (grouped sections)', h(UI.Sidebar, { label: 'Main', activeId: 'inbox', items: [
    { id: 'overview', label: 'Overview', href: '#o', icon: 'home', group: 'Overview' },
    { id: 'inbox', label: 'Inbox', href: '#i', icon: 'inbox', badge: 12, group: 'Work' },
    { id: 'calls', label: 'Calls', href: '#c', icon: 'call', group: 'Work' }] }), async host => {
    const groups = host.querySelectorAll('[role="group"]');
    assert.equal(groups.length, 2, 'Sidebar: one named group per section');
    assert.equal(document.getElementById(groups[1].getAttribute('aria-labelledby')).textContent, 'Work', 'Sidebar: group named by its heading');
  });
  await audit('DataTable (visible title)', h(UI.DataTable, { label: 'Outcomes', title: 'Responsiveness and outcomes', description: 'Median / P90', rows: [{ id: 'a', name: 'Sana' }], rowKey: r => r.id, columns: [{ id: 'name', label: 'Agent', value: r => r.name }] }), async host => {
    const section = host.querySelector('section');
    assert.equal(document.getElementById(section.getAttribute('aria-labelledby')).textContent, 'Responsiveness and outcomes', 'DataTable: titled tables are named by their heading');
  });

  // Charts: new kinds, legend toggles and the text equivalents.
  await audit('SeriesChart (stacked-area, dashed comparison, legend toggle)', h(UI.SeriesChart, { title: 'Volume', kind: 'stacked-area', series: [...twoSeries, { id: 'last', label: 'Last week', dashed: true }], data: days }), async host => {
    const chips = host.querySelectorAll('.easm-ui-chart-legend-item');
    assert.equal(chips.length, 3, 'SeriesChart: one legend toggle per series');
    await click(chips[0]);
    assert.equal(chips[0].getAttribute('aria-pressed'), 'false', 'SeriesChart: a legend chip hides its series');
    await click(chips[1]); await click(chips[2]);
    assert.equal([...chips].filter(c => c.getAttribute('aria-pressed') === 'true').length, 1, 'SeriesChart: the last visible series cannot be hidden');
  });
  await audit('Sparkline + ProportionBar + Gauge', h('div', null,
    h(UI.Sparkline, { label: 'Open conversations', data: [3, 5, 4, 8] }),
    h(UI.ProportionBar, { label: 'Sentiment', segments: [{ id: 'p', label: 'Positive', value: 25, tone: 'green' }, { id: 'n', label: 'Neutral', value: 75 }] }),
    h(UI.Gauge, { label: 'SLA attainment', value: 92, target: 95 })), async host => {
    assert.equal(host.querySelector('[role="img"]').getAttribute('aria-label'), 'Open conversations: from 3 to 8', 'Sparkline: names its first and last value');
    assert.match(host.textContent, /Neutral7575%/, 'ProportionBar: legend states each value and share');
    assert.equal(host.querySelector('[role="meter"]').getAttribute('aria-valuetext'), '92%, target 95%', 'Gauge: value and target in words');
  });
  await audit('Heatmap', h(UI.Heatmap, { label: 'Busy hours', rows: [{ id: 'm', label: 'Mon' }, { id: 't', label: 'Tue' }], columns: [{ id: '9', label: '09:00' }, { id: '10', label: '10:00' }], values: [[4, 9], [null, 0]], valueLabel: 'Conversations' }), async host => {
    assert.equal(host.querySelectorAll('tbody td').length, 4, 'Heatmap: a real table cell per value');
    assert.match(host.querySelector('tbody').textContent, /Not measured/, 'Heatmap: missing values are stated');
  });
  await audit('Funnel', h(UI.Funnel, { label: 'Admissions', stages: [{ id: 'i', label: 'Inquiry', value: 200 }, { id: 'a', label: 'Applied', value: 50 }] }), async host => {
    assert.match(host.textContent, /25% of Inquiry/, 'Funnel: conversion from the previous stage');
  });

  // Product layer: inbox and top bar.
  await audit('StatusPill + Kbd + NotificationButton + ScorePill', h('div', null,
    h(UI.StatusPill, { label: 'Online', meta: '16 min today', tone: 'success', live: true }), h(UI.Kbd, null, '⌘K'),
    h(UI.NotificationButton, { count: 3 }), h(UI.ScorePill, { value: 68 }), h(UI.ScorePill, { value: 70, kind: 'lead' })), async host => {
    assert.equal(host.querySelector('.easm-ui-notification-button').getAttribute('aria-label'), 'Notifications, 3 unread', 'NotificationButton: count in its name');
    assert.equal(host.querySelectorAll('[role="img"]')[1].getAttribute('aria-label'), 'Lead score 70, hot', 'ScorePill: level in words');
  });
  let quick = 'all';
  await audit('QuickFilters', h(UI.QuickFilters, { label: 'View', value: 'all', onValueChange: v => { quick = v; }, options: [{ id: 'all', label: 'All' }, { id: 'mine', label: 'Mine', count: 2 }] }), async host => {
    await click(host.querySelectorAll('.easm-ui-quick-filter')[1]);
    assert.equal(quick, 'mine', 'QuickFilters: choosing a filter reports it');
  });
  await audit('ConversationList (arrow keys)', h(UI.ConversationList, { label: 'Conversations' },
    h(UI.ConversationListItem, { name: 'Ali Mustafa', time: '3 min', preview: 'When are results?', previewAuthor: 'AI', selected: true, meta: h(UI.ScorePill, { value: 68 }) }),
    h(UI.ConversationListItem, { name: 'Fazeela Yousif', time: '1 h', preview: 'Fee question', unread: true })), async host => {
    const items = host.querySelectorAll('.easm-ui-conversation-item-control');
    assert.equal(items[0].getAttribute('aria-current'), 'true', 'ConversationListItem: the open conversation is current');
    await act(async () => { items[0].focus(); items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
    assert.equal(document.activeElement, items[1], 'ConversationList: ArrowDown moves to the next conversation');
  });
  let sent = null;
  await audit('Thread, messages and composer', h('div', null,
    h(UI.ThreadHeader, { name: 'Ali Mustafa', status: h(UI.Badge, { size: 'sm' }, 'AI handling'), subtitle: 'ali@example.com · Web chat', actions: h(UI.IconButton, { icon: 'panel-right', label: 'Show contact panel' }) }),
    h(UI.MessageThread, { label: 'Messages' },
      h(UI.MessageDivider, null, 'Today'),
      h(UI.Message, { author: 'contact', name: 'Ali Mustafa', time: '18:59' }, h('p', null, 'Hello')),
      h(UI.Message, { author: 'assistant', name: 'Assistant', time: '18:59' }, h('p', null, 'Hi')),
      h(UI.Message, { author: 'note', name: 'Fatima Khan' }, h('p', null, 'Internal')),
      h(UI.Message, { author: 'agent', name: 'Sana Ahmed', delivery: 'read', actions: h(UI.IconButton, { icon: 'copy', label: 'Copy message', size: 'sm' }) }, h('p', null, 'Reply')),
      h(UI.Message, { author: 'system', name: 'System' }, 'Assigned')),
    h(UI.Composer, { value: 'Results publish on 20 October', onValueChange: () => {}, onSubmit: (v, m) => { sent = [v, m]; }, mode: 'note', onModeChange: () => {}, recipient: 'Ali', onDraft: () => {}, onFormat: () => {}, onAttach: () => {}, onTemplate: () => {} }),
    h(UI.ContactHeader, { name: 'Ali Mustafa', detail: 'ali@example.com', tags: h(UI.Badge, { size: 'sm' }, 'Applicant') })), async host => {
    assert.match(host.querySelector('[role="log"]').textContent, /Internal note by Fatima Khan: /, 'Message: notes say so to screen readers');
    const field = host.querySelector('.easm-ui-composer-field');
    await act(async () => { field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })); });
    assert.deepEqual(sent, ['Results publish on 20 October', 'note'], 'Composer: Ctrl+Enter submits with the current mode');
  });
  await audit('Inline Select + hidden-label SearchField + search CommandBar + inline Meter', h('div', null,
    h(UI.Select, { label: 'Dept', appearance: 'inline', icon: 'building', defaultValue: 'all', options: [{ value: 'all', label: 'All' }, { value: 'adm', label: 'Admissions' }] }),
    h(UI.SearchField, { label: 'Search conversations', hideLabel: true }),
    h(UI.CommandBar, { appearance: 'search', shortcut: true, triggerLabel: 'Search', commands: [{ id: 'a', label: 'Open inbox', onSelect: () => {} }] }),
    h(UI.Meter, { label: 'Resolution rate', value: 84, inline: true })), async host => {
    assert.equal(host.querySelector('.easm-ui-dropdown-select-trigger').getAttribute('aria-labelledby').split(' ').map(id => document.getElementById(id).textContent).join(' '), 'Dept', 'Inline Select: still named by its label');
    assert.equal(host.querySelector('.easm-ui-command-trigger').getAttribute('aria-keyshortcuts'), 'Meta+K Control+K', 'CommandBar: shortcut is announced');
  });

  // Settings layer: layout, menu, section rows, slider, prompt editor and the advanced disclosure.
  let navValue = 'model', temperature = 0.7, prompt = '';
  await audit('Settings (layout, nav, section, rows, slider, prompt editor, advanced)', h(UI.SettingsLayout, {
    nav: h(UI.SettingsNav, { label: 'AI settings', value: navValue, onValueChange: v => { navValue = v; }, items: [
      { id: 'model', label: 'Model & behaviour', description: 'Which model answers and how freely', icon: 'brain-circuit' },
      { id: 'knowledge', label: 'Knowledge', description: 'Sources the assistant may cite', icon: 'knowledge' },
      { id: 'handoff', label: 'Handoff', icon: 'handoff', disabled: true }] }) },
    h(UI.SettingsSection, { title: 'Model', description: 'Applies to new conversations.', icon: 'brain-circuit', footer: h(UI.Button, null, 'Save changes') },
      h(UI.SettingRow, { label: 'Auto-reply', description: 'Let the assistant answer first.' }, h(UI.Switch, { label: h('span', { className: 'easm-ui-sr-only' }, 'Auto-reply'), defaultChecked: true })),
      h(UI.Slider, { label: 'Temperature', description: 'Lower is more precise.', min: 0, max: 1, step: 0.1, defaultValue: 0.7, formatValue: v => v.toFixed(1), onValueChange: v => { temperature = v; },
        marks: [{ value: 0, label: 'Precise' }, { value: 1, label: 'Creative' }] }),
      h(UI.PromptEditor, { label: 'System prompt', description: 'Sent before every conversation.', variables: ['student_name', 'programme'], defaultValue: 'Hello ', onValueChange: v => { prompt = v; }, maxLength: 4000 }),
      h(UI.AdvancedSettings, null, h(UI.Slider, { label: 'Top P', defaultValue: 90 })))), async host => {
    const range = host.querySelector('input[type="range"]');
    assert.equal(range.getAttribute('aria-valuetext'), '0.7', 'Slider: reads the formatted value');
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(range, '0.2'); range.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(temperature, 0.2, 'Slider: reports a new value');
    assert.equal(range.closest('.easm-ui-slider').style.getPropertyValue('--easm-slider-fill'), '20%', 'Slider: the track fill follows the value');
    await click(host.querySelector('.easm-ui-prompt-editor-var'));
    assert.equal(prompt, 'Hello {{student_name}}', 'PromptEditor: a variable chip inserts its placeholder');
    const toggle = host.querySelector('.easm-ui-advanced-settings-toggle');
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    await click(toggle);
    assert.equal(toggle.getAttribute('aria-expanded'), 'true', 'AdvancedSettings: expands');
    assert.match(toggle.textContent, /Hide advanced settings/, 'AdvancedSettings: says what the button will do');
    assert.equal(host.querySelector('[aria-current="page"]').textContent.startsWith('Model'), true, 'SettingsNav: marks the current section');
    await click(host.querySelectorAll('.easm-ui-settings-nav-item')[1]);
    assert.equal(navValue, 'knowledge', 'SettingsNav: reports the chosen section');
    assert.equal(host.querySelector('.easm-ui-setting-row').getAttribute('role'), 'group', 'SettingRow: a labelled group around its control');
  });

  // Pipeline: a board of two stages; the card menu is the keyboard, touch and screen reader way to move.
  let moved = null;
  await audit('Pipeline (board, columns, lead cards, move menu)', h(UI.KanbanBoard, { label: 'Admissions pipeline', onMove: (...args) => { moved = args; } },
    h(UI.KanbanColumn, { id: 'new', title: 'New', tone: 'sky', count: 24 },
      h(UI.LeadCard, { id: 'c1', name: 'Ali Mustafa', href: '#c1', subtitle: 'BS Computer Science', score: 72, details: [{ icon: 'mail', label: 'ali@example.com' }],
        progress: { value: 10, max: 26 }, tags: h(UI.Tag, { size: 'sm', icon: 'chat' }, 'Web chat'), time: '2 h', owner: 'Sana Ahmed' }),
      h(UI.LeadCard, { id: 'c2', name: 'Hira Baig', score: 41 })),
    h(UI.KanbanColumn, { id: 'applied', title: 'Applied', tone: 'green', badge: h(UI.Tag, { size: 'sm', icon: 'lock-closed' }, 'Manual') }),
    h(UI.KanbanColumn, { id: 'closed', title: 'Closed', tone: 'honey', acceptsDrop: false })), async host => {
    assert.equal(host.querySelector('.easm-ui-kanban-column h3').textContent, 'New, 24 cards', 'KanbanColumn: heading carries the count');
    assert.match(host.querySelector('.easm-ui-kanban-empty').textContent, /Drop leads here/, 'KanbanColumn: an empty stage says what to do');
    const menu = host.querySelector('button[aria-label="Actions for Ali Mustafa"]');
    await click(menu);
    const items = [...document.querySelectorAll('[role="menuitem"]')].map(item => item.textContent);
    assert.deepEqual(items, ['Move down', 'Move to Applied'], 'LeadCard: menu offers only possible moves');
    await click([...document.querySelectorAll('[role="menuitem"]')].find(item => item.textContent === 'Move to Applied'));
    assert.deepEqual(moved, ['c1', 'applied', 0], 'KanbanBoard: menu move reports card, stage and position');
    assert.equal(host.querySelector('[role="status"]').textContent, 'Ali Mustafa moved to Applied, position 1.', 'KanbanBoard: the move is announced');
  });

  // Workflow parts (demand list wave 1): one audit for all of them, with the behaviour each promises.
  const t0 = Date.parse('2026-10-28T10:00:00Z'), min = 60000;
  let fixed = 0;
  await audit('Workflow (status, stage, presence, identity, SLA, timeline, stepper, readiness, unmeasured)', h('div', null,
    h(UI.StatusChip, { status: 'processing' }), h(UI.StatusChip, { status: 'failed', variant: 'dot' }), h(UI.StatusChip, { status: 'blocked', variant: 'row', detail: 'Refused at 10:42' }),
    h(UI.StageChip, { step: 3 }, 'Applied'), h(UI.StageChip, { step: 'stopped' }, 'Do not contact'),
    h(UI.Presence, { state: 'idle', since: '6 min', onCall: true }), h(UI.Presence, { state: 'away', variant: 'dot' }), h(UI.Avatar, { name: 'Hira Baig', status: 'idle' }),
    h(UI.IdentityLevel, { level: 'verified' }),
    h(UI.SlaClock, { dueAt: t0 - 8 * min, now: t0 }), h(UI.SlaClock, { dueAt: t0 + 40 * min, startedAt: t0 - 20 * min, now: t0, variant: 'ring' }), h(UI.SlaClock, { dueAt: t0, paused: true, now: t0, variant: 'dot' }),
    h(UI.Timeline, { label: 'History', onLoadEarlier: () => {}, items: [{ id: '1', day: 'Today', glyph: 'chat', actor: 'Ali Khan', title: 'asked about fees', time: '10:00', dateTime: '2026-10-28T10:00' }, { id: '2', day: 'Today', glyph: 'call', title: 'Called back', body: 'Wants the deadline' }] }),
    h(UI.Stepper, { label: 'Setup', onStepSelect: () => {}, steps: [{ id: 'a', label: 'Connect', state: 'done' }, { id: 'b', label: 'Sign in', state: 'blocked', reason: 'Key refused' }, { id: 'c', label: 'Publish', state: 'todo' }] }),
    h(UI.Stepper, { label: 'Setup', variant: 'dots', steps: [{ id: 'a', label: 'A', state: 'done' }, { id: 'b', label: 'B', state: 'current' }] }),
    h(UI.ReadinessChecklist, { title: 'Before calling', items: [{ id: 'a', label: 'Extension', state: 'done' }, { id: 'b', label: 'Places calls', state: 'blocked', why: 'Not switched on', fix: { label: 'Fix it', onClick: () => { fixed++; } } }, { id: 'c', label: 'Bridge', state: 'needs-someone', owner: 'an administrator' }] }),
    h(UI.UnmeasuredValue, { reason: 'No ad account connected' }),
    h(UI.StatCard, { label: 'Cost per lead', value: null, unmeasured: 'No ad account connected' })), async host => {
    assert.match(host.querySelector('[data-status="processing"] .easm-ui-status-glyph').getAttribute('data-motion') || '', /spin/, 'StatusChip: only work under way moves');
    assert.equal(host.querySelector('.easm-ui-status-chip[data-variant="dot"]').getAttribute('aria-label'), 'Failed', 'StatusChip: the dot is named by its label');
    assert.equal(host.querySelector('.easm-ui-sla').textContent, 'Overdue 8 min', 'SlaClock: says how far overdue');
    assert.match(host.querySelectorAll('.easm-ui-sla')[1].getAttribute('aria-label'), /40 min left/, 'SlaClock: the ring is named by the time left');
    assert.match(host.querySelectorAll('.easm-ui-sla')[2].getAttribute('aria-label'), /Paused, outside office hours/, 'SlaClock: paused says why');
    assert.equal(host.querySelectorAll('.easm-ui-timeline-day').length, 1, 'Timeline: one separator per day');
    assert.equal(host.querySelector('.easm-ui-stepper [aria-current="step"]'), null, 'Stepper: no current step when none is current');
    assert.match(host.querySelector('.easm-ui-stepper li[data-state="blocked"]').textContent, /Key refused/, 'Stepper: a blocked step gives its reason');
    assert.equal(host.querySelector('.easm-ui-stepper-dots').getAttribute('aria-label'), 'Setup: 1 of 2 done', 'Stepper dots: named by progress');
    assert.equal(host.querySelector('.easm-ui-readiness-count').textContent, '1 of 3 done', 'ReadinessChecklist: counts what is done');
    assert.equal(host.querySelectorAll('.easm-ui-readiness-list > li').length, 2, 'ReadinessChecklist: done steps fold into the count');
    await click(host.querySelector('.easm-ui-readiness-fix'));
    assert.equal(fixed, 1, 'ReadinessChecklist: Fix it acts');
    await click(host.querySelector('.easm-ui-readiness-toggle'));
    assert.equal(host.querySelectorAll('.easm-ui-readiness-list > li').length, 3, 'ReadinessChecklist: Show done brings them back');
    assert.match(host.querySelector('.easm-ui-avatar').getAttribute('aria-label'), /idle/, 'Avatar: idle is named');
    assert.match(host.querySelector('.easm-ui-stat-card .easm-ui-unmeasured').getAttribute('aria-label'), /Not measured: No ad account connected/, 'StatCard: unmeasured says why, never zero');
  });

  // Provenance (CLR-07), channel colours (CLR-11) and dashboard accents (CLR-01): said in words, never by colour alone.
  await audit('Provenance, channel colours and dashboard accents', h('div', null,
    h(UI.SeriesChart, { title: 'Applications', kind: 'line', series: [{ id: 'v', label: 'Verified' }, { id: 's', label: 'Said in chat', provenance: 'self-reported' }],
      data: [{ id: 'a', label: '26 Oct', values: { v: 4, s: 2 } }, { id: 'b', label: '27 Oct', values: { v: 5, s: 3 }, provisional: true }] }),
    h(UI.BarList, { label: 'Leads', items: [{ id: 'm', label: 'Meta', value: 9 }, { id: 'c', label: 'Chat', value: 4, provenance: 'self-reported' }, { id: 't', label: 'TikTok', value: null, unmeasured: 'Reports spend only' }] }),
    h(UI.Funnel, { label: 'Funnel', stages: [{ id: 'i', label: 'Inquiry', value: 10 }, { id: 'a', label: 'Applied', value: 4, provenance: 'provisional' }] }),
    h(UI.StatCard, { label: 'Admitted', value: 31, provenance: 'self-reported' }),
    h(UI.ModuleIcon, { icon: 'dashboard-marketing', product: 'marketing', label: 'Marketing' }),
    h(UI.Tag, { tone: UI.channelTone('Paid social') }, 'Paid social')), async host => {
    assert.match(host.querySelector('.easm-ui-chart-provenance').textContent, /Dashed from 27 Oct: provisional/, 'SeriesChart: provisional is said in words');
    assert.match(host.querySelector('.easm-ui-chart-provenance').textContent, /self-reported/, 'SeriesChart: self-reported is said in words');
    assert.match(host.querySelector('.easm-ui-chart-legend').textContent, /self-reported/, 'SeriesChart: the legend names the source');
    assert.equal(host.querySelectorAll('.easm-ui-series-line[data-provisional]').length, 2, 'SeriesChart: each line turns dashed at the provisional day');
    assert.match(host.querySelector('.easm-ui-bar-list li[data-provenance="self-reported"]').textContent, /self-reported/, 'BarList: self-reported is said beside the value');
    assert.match(host.querySelector('.easm-ui-bar-list li[data-provenance="unmeasured"] .easm-ui-unmeasured').getAttribute('aria-label'), /Not measured: Reports spend only/, 'BarList: unmeasured says why');
    assert.match(host.querySelector('.easm-ui-stat-source').textContent, /Self-reported/, 'StatCard: provenance is said under the figure');
    assert.equal(host.querySelector('.easm-ui-module-icon').getAttribute('data-easm-product'), 'marketing', 'ModuleIcon: takes the dashboard accent');
    assert.equal(UI.channelTone('paid-social'), 'indigo', 'channelTone: spellings agree');
    assert.equal(UI.channelTone('cpc'), 'blue', 'channelTone: common aliases');
    assert.equal(UI.channelTone('carrier pigeon'), 'honey', 'channelTone: unknown channels are grey');
  });

  // Calling parts and the person journey (demand list wave 2).
  const keysPressed = []; let seekTo = null, hung = 0, muteTo = null, chips = [];
  const pressKey = (el, name) => act(async () => { el.dispatchEvent(new window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true })); });
  const typeInto = (el, value) => act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new window.Event('input', { bubbles: true })); });
  await audit('Calling (buttons, keypad, call bar, row meta, transcript, result, events) + FilterChip + PersonJourney', h('div', null,
    h(UI.CallBar, { name: 'Ali Khan', detail: '0342 1234567', status: 'live', startedAt: Date.now() - 65000, muted: false, onMuteChange: v => { muteTo = v; }, onHangUp: () => { hung++; }, onKeypadChange: () => {}, onOpen: () => {} },
      h(UI.Keypad, { onKey: k => keysPressed.push(k), value: '03' })),
    h(UI.CallBar, { name: 'Sara Ahmed', status: 'ringing', onAnswer: () => {}, onDecline: () => {} }),
    h(UI.CallControls, null, h(UI.CallButton, { action: 'hold', pressed: true }), h(UI.CallButton, { action: 'transfer', loading: true })),
    h(UI.CallDeviceLine, { microphone: 'Jabra', speaker: 'Headset', onChange: () => {} }),
    h(UI.CallRowMeta, { direction: 'outbound', handledBy: 'ai', purpose: 'Follow-up', outcome: h(UI.StatusChip, { status: 'done', size: 'sm' }) }),
    h(UI.TranscriptViewer, { label: 'Call transcript', onSeek: t => { seekTo = t; }, currentTime: 7, turns: [
      { id: '1', speaker: 'assistant', name: 'Ayesha', at: 0, text: 'Hello, this is admissions.' },
      { id: '2', speaker: 'caller', name: 'Ali', at: 6, text: 'What is the fee?', marker: { kind: 'lookup-failed', text: 'Fee lookup failed' } }] }),
    h(UI.CallResultCard, { outcome: { label: 'Interested', glyph: 'state-done', tone: 'success' }, followUps: [{ id: 'a', label: 'Apply link emailed', state: 'done' }], handedTo: 'Sana' }),
    h(UI.ThreadEvent, { glyph: 'event-assigned', tone: 'brand', time: '10:42' }, 'Assigned to Ayesha'),
    h(UI.FilterChipGroup, { label: 'Inbox filters' }, h(UI.FilterChip, { label: 'Needs you', icon: 'state-waiting-on-person', count: 4, attention: true, selected: false, onSelectedChange: v => chips.push(v) })),
    h(UI.PersonJourney, { label: 'Journey', events: [{ id: 'a', kind: 'chat', glyph: 'chat', title: 'Asked about fees' }, { id: 'b', kind: 'call', glyph: 'call', title: 'Called back' }] })), async host => {
    const mute = host.querySelector('.easm-ui-call-button[data-kind="toggle"]');
    assert.equal(mute.getAttribute('aria-pressed'), 'false', 'CallButton: a toggle says whether it is on');
    await click(mute); assert.equal(muteTo, true, 'CallBar: mute reports the new state');
    await click([...host.querySelectorAll('.easm-ui-call-button')].find(b => b.textContent === 'Hang up')); assert.equal(hung, 1, 'CallBar: hang up acts');
    assert.ok(host.querySelector('[aria-label="Call with Sara Ahmed"] .easm-ui-call-button[data-kind="go"]'), 'CallBar: ringing offers Answer');
    const busy = host.querySelector('.easm-ui-call-button[aria-busy="true"]');
    assert.equal(busy.getAttribute('aria-disabled'), 'true', 'CallButton: busy blocks presses but stays focusable');
    await click(host.querySelector('.easm-ui-keypad-key[aria-label="2 ABC"]')); assert.deepEqual(keysPressed, ['2'], 'Keypad: a key sends its digit');
    await pressKey(host.querySelector('.easm-ui-keypad'), '#'); assert.deepEqual(keysPressed, ['2', '#'], 'Keypad: typing sends keys');
    await click(host.querySelector('.easm-ui-transcript-time')); assert.equal(seekTo, 0, 'TranscriptViewer: a time seeks the recording');
    assert.ok(host.querySelector('.easm-ui-transcript-list > li[data-turn="2"][data-playing]'), 'TranscriptViewer: the turn being heard is marked');
    await typeInto(host.querySelector('.easm-ui-transcript-search input'), 'fee');
    assert.equal(host.querySelectorAll('.easm-ui-transcript-list > li').length, 1, 'TranscriptViewer: search narrows the turns');
    assert.equal(host.querySelector('.easm-ui-thread-event').getAttribute('role'), 'note', 'ThreadEvent: a note between messages');
    const needs = host.querySelector('.easm-ui-filter-chip');
    assert.equal(needs.getAttribute('aria-pressed'), 'false', 'FilterChip: a toggle');
    assert.match(needs.textContent, /4 items/, 'FilterChip: the count is read with its word');
    await click(needs); assert.deepEqual(chips, [true], 'FilterChip: reports the new state');
    const journey = host.querySelector('.easm-ui-journey');
    assert.equal(journey.querySelectorAll('.easm-ui-timeline-item').length, 2, 'PersonJourney: nothing picked shows everything');
    await click([...journey.querySelectorAll('.easm-ui-filter-chip')].find(b => b.textContent.startsWith('Calls')));
    assert.equal(journey.querySelectorAll('.easm-ui-timeline-item').length, 1, 'PersonJourney: picking a kind narrows the story');
  });

  // Forms builder and Knowledge parts (demand list wave 2b).
  let added = 0, selectedCard = 0, revealed = 0;
  await audit('Forms builder (tiles, field cards, rules, response cells) + Knowledge (pipeline, item row, retrieval trace, chunk)', h('div', null,
    h(UI.QuestionTypeGroup, { label: 'Basic' },
      h(UI.QuestionTypeTile, { icon: 'question-phone', name: 'Mobile number', example: 'Pakistani formats', onAdd: () => { added++; }, dragData: 'phone' }),
      h(UI.QuestionTypeTile, { icon: 'question-cnic', name: 'CNIC', disabledReason: 'Not inside a repeated section', onAdd: () => { added += 10; } })),
    h(UI.FieldCard, { title: 'Which programme?', type: { icon: 'question-programme', label: 'Programme' }, required: true, onSelect: () => { selectedCard++; },
      rules: [{ id: 'r', effect: 'show', sentence: 'If Programme is one of 3 → show this' }], sensitivity: 'restricted' }),
    h(UI.FieldCard, { kind: 'section', title: 'Your details', type: { icon: 'question-section', label: 'Section' } }, h(UI.FieldCard, { title: 'Email', type: { icon: 'question-email', label: 'Email' } })),
    h(UI.RuleRow, { effect: 'hide' }, 'If Staff referral → hide this'),
    h(UI.ResponseStatusCell, { status: 'unfinished' }), h(UI.ResponseSourceCell, { source: 'assistant-call' }), h(UI.ResponseScoreCell, { score: 8, max: 10 }),
    h(UI.SealedCell, { mask: '42101-•••••••-3', onReveal: () => { revealed++; } }), h(UI.FilesCell, { files: [{ name: 'a.pdf', icon: 'type-pdf' }], onOpen: () => {} }),
    h(UI.PipelineProgress, { label: 'Fees', stages: [{ id: 'fetch', state: 'done', ms: 800 }, { id: 'clean', state: 'done', ms: 2400 }, { id: 'refine', state: 'done', ms: 5000 }, { id: 'chunk', state: 'failed', error: 'No text after cleaning' }, { id: 'index', state: 'todo' }] }),
    h(UI.PipelineProgress, { label: 'Fees', variant: 'pips', stages: [{ id: 'fetch', state: 'done' }, { id: 'clean', state: 'current' }, { id: 'refine', state: 'todo' }, { id: 'chunk', state: 'todo' }, { id: 'index', state: 'todo' }] }),
    h(UI.KnowledgeItemRow, { title: 'Fee structure', href: '#fees', type: { icon: 'type-pdf', label: 'PDF' }, status: { label: 'Live', glyph: 'state-live', tone: 'success' }, audiences: ['public'], confidence: 0.9, freshness: { state: 'due', text: 'Review due in 12 days' } }),
    h(UI.RetrievalTrace, { label: 'Trace', stages: UI.retrievalStages.map((st, i) => ({ ...st, ms: 100, state: i === 4 ? 'handoff' : undefined })), outcome: 'Handed over' }),
    h(UI.ChunkResult, { rank: 1, excerpt: 'The fee for Computer Science is PKR 145,000.', highlight: ['fee'], scores: { dense: .8, keyword: .6, rerank: .9 }, source: { title: 'Fees' }, context: 'Lab charges are separate.', used: true })), async host => {
    const tiles = host.querySelectorAll('.easm-ui-question-tile');
    await click(tiles[0]); await click(tiles[1]);
    assert.equal(added, 1, 'QuestionTypeTile: adds, and a tile that cannot be used does not');
    assert.equal(tiles[1].getAttribute('aria-disabled'), 'true', 'QuestionTypeTile: a blocked tile stays focusable');
    assert.match(tiles[1].textContent, /Not inside a repeated section/, 'QuestionTypeTile: says why it cannot be used');
    assert.equal(tiles[0].getAttribute('draggable'), 'true', 'QuestionTypeTile: draggable onto the canvas');
    await click(host.querySelector('button.easm-ui-field-card-title')); assert.equal(selectedCard, 1, 'FieldCard: the question selects the card');
    assert.match(host.querySelector('.easm-ui-field-card-required').getAttribute('aria-label'), /required/, 'FieldCard: required is read');
    assert.match(host.querySelector('.easm-ui-rule-chip').getAttribute('aria-label'), /1 rule for Which programme/, 'RuleChip: says how many rules and for which question');
    assert.ok(host.querySelector('.easm-ui-field-card[data-kind="section"] .easm-ui-field-card-children .easm-ui-field-card'), 'FieldCard: a section holds cards');
    await click(host.querySelector('.easm-ui-sealed-reveal')); assert.equal(revealed, 1, 'SealedCell: Reveal asks');
    assert.match(host.querySelector('.easm-ui-pipeline-error').textContent, /Stopped at Chunk/, 'PipelineProgress: says where it stopped');
    assert.match(host.querySelector('.easm-ui-pipeline[data-variant="pips"]').getAttribute('aria-label'), /Clean \(2 of 5\)/, 'PipelineProgress pips: named by the stage reached');
    assert.match(host.querySelector('.easm-ui-retrieval').textContent, /handed over here/, 'RetrievalTrace: the hand-over stage is said');
    const ctx = host.querySelector('.easm-ui-chunk-context > button');
    await click(ctx); assert.equal(ctx.getAttribute('aria-expanded'), 'true', 'ChunkResult: the wider context opens');
    assert.equal(host.querySelectorAll('.easm-ui-chunk-text mark').length, 1, 'ChunkResult: the query words are marked');
  });

  // Marketing and Automation parts (demand list wave 3).
  await audit('Marketing (provenance, credit by model, journey strip, two-band funnel, connection card)', h('div', null,
    h(UI.ProvenanceFigure, { label: 'Applications', value: 412, provenance: 'verified', size: 'lg' }),
    h(UI.ProvenanceFigure, { label: 'Leads from Meta', value: 1268, provenance: 'external', note: 'External: reported by Meta.' }),
    h(UI.ProvenanceFigure, { label: 'Cost per enrolment', value: null, provenance: 'verified', reason: 'No verified enrolments yet' }),
    h(UI.ProvenanceKey, {}),
    h(UI.CreditComparison, { label: 'Credit', unattributed: 1, touches: [
      { id: 'a', channel: 'paid_social', label: 'Fall intake', credit: { 'first-touch': 1, 'last-touch': 0, linear: .5, 'time-decay': .3, 'position-based': .5 } },
      { id: 'b', channel: 'email', label: 'Open day', credit: { 'first-touch': 0, 'last-touch': 1, linear: .5, 'time-decay': .7, 'position-based': .5 } }] }),
    h(UI.JourneyStrip, { label: 'Journey', lookbackDays: 30, outcome: { at: '2026-10-06', label: 'Applied' }, touches: [
      { id: 'o', at: '2026-08-01', channel: 'organic_search', label: 'Search' }, { id: 'f', at: '2026-09-20', channel: 'paid_social', label: 'Fall intake' },
      { id: 'l', at: '2026-10-03', channel: 'paid_search', label: 'BS CS' }] }),
    h(UI.TwoBandFunnel, { label: 'Funnel', boundary: { rate: .124 },
      observation: { label: 'Website', unit: 'browsers', steps: [{ id: 'v', label: 'Visited', value: 1000 }, { id: 'f', label: 'Form', value: 500 }] },
      lifecycle: { label: 'Admissions', unit: 'people', steps: [{ id: 'i', label: 'Inquiry', value: 60 }, { id: 'a', label: 'Applied', value: 30, provenance: 'verified' }, { id: 'e', label: 'Enrolled', value: null, reason: 'After fee payment' }] } }),
    h(UI.ConnectionCard, { provider: 'google-ads', name: 'Google Ads', state: 'expiring', now: '2026-10-28T10:00:00', expiresAt: '2026-11-06',
      capabilities: { reporting: { status: 'on', lastRunAt: '2026-10-28T09:00:00', dataThrough: '2026-10-21' }, conversions: { status: 'error' }, audiences: { status: 'unsupported' } } })), async host => {
    assert.match(host.querySelector('.easm-ui-provenance-figure[data-provenance="verified"] .easm-ui-provenance-mark').getAttribute('aria-label'), /^Applications: Verified/, 'ProvenanceFigure: the mark says what and how sure');
    assert.match(host.querySelector('.easm-ui-provenance-figure[data-provenance="unmeasured"] [role="img"]').getAttribute('aria-label'), /No verified enrolments yet/, 'ProvenanceFigure: no value says why, never 0');
    const bars = host.querySelectorAll('.easm-ui-credit-bar');
    assert.equal(bars.length, 5, 'CreditComparison: one bar per model');
    assert.match(bars[0].getAttribute('aria-label'), /First touch: Paid social, Fall intake: 1; unattributed: 1/, 'CreditComparison: a bar reads its shares');
    assert.match(host.querySelector('.easm-ui-credit-table tfoot').textContent, /Unattributed.*Total/, 'CreditComparison: unattributed and the total at the foot');
    const roles = [...host.querySelectorAll('.easm-ui-journey-list > li')].map(li => li.dataset.role);
    assert.deepEqual(roles, ['outside', 'first', 'last', 'outcome'], 'JourneyStrip: roles follow the lookback window');
    assert.match(host.querySelector('.easm-ui-journey-nodes li[data-role="first"] [role="img"]').getAttribute('aria-label'), /Fall intake.*First touch/, 'JourneyStrip: a touch is named with its role');
    const lifecycle = host.querySelector('.easm-ui-band[data-band="lifecycle"]');
    assert.equal(lifecycle.querySelector('li').querySelector('.easm-ui-band-loss'), null, 'TwoBandFunnel: no rate crosses the line');
    assert.match(host.querySelector('.easm-ui-band-boundary').textContent, /Identified.*12/, 'TwoBandFunnel: the line carries the identification rate');
    assert.match(host.querySelector('.easm-ui-band[data-band="observation"] .easm-ui-band-loss').textContent, /50%.*500 fewer/, 'TwoBandFunnel: what a step kept and lost');
    assert.match(lifecycle.textContent, /No rate: a step is not measured/, 'TwoBandFunnel: no rate to or from an unmeasured step');
    const reporting = host.querySelector('.easm-ui-connection-capabilities > li[data-stale]');
    assert.ok(reporting && /7 days behind/.test(reporting.textContent) && /Data behind/.test(reporting.textContent), 'ConnectionCard: a successful run over stale data shows as behind');
    assert.match(host.querySelector('.easm-ui-connection').textContent, /Google Ads does not offer this/, 'ConnectionCard: not offered is said, not shown as off');
  });

  let inputSeen = null, request = null, kept = null, rule = null;
  const sample = { student: { name: 'Ayesha' }, vouchers: [{ amount: 145000, isPaid: false }, { amount: 139000, isPaid: true }] };
  const baseRule = { trigger: 'keyword', words: [], tools: [], surfaces: [], audiences: [], instruction: '' };
  await audit('Automation (input sources, request builder, JSON view, response picker, rule sentence)', h('div', null,
    h(UI.InputSourceRow, { value: { name: 'term', kind: 'text', source: 'assistant', meaning: 'The term', required: true }, onChange: v => { inputSeen = v; } }),
    h(UI.InputSourceRow, { value: { name: 'emplid', kind: 'text', source: 'signin', from: 'subject.id' }, onChange: () => {}, locked: { reason: 'Built in: the gateway takes this name.', fields: ['source', 'name', 'kind', 'from'] } }),
    h(UI.RequestBuilder, { label: 'Request', method: 'GET', base: 'Gateway', path: '/students/{emplid}/fees', query: [{ key: 'term', value: '{term}' }, { key: 'x', value: '{stray}' }],
      slots: { emplid: { source: 'signin', sample: '•••4521' }, term: { source: 'assistant', sample: '2610' } }, onPathChange: p => { request = p; } }),
    h(UI.RequestBuilder, { label: 'Write', method: 'POST', path: '/vouchers', readOnly: true }),
    h(UI.JsonView, { label: 'Masked', value: sample, masked: true, truncated: true }),
    h(UI.ResponsePicker, { label: 'Keep', sample, value: ['vouchers[].amount'], onChange: v => { kept = v; } }),
    h(UI.RuleSentence, { label: 'Rule', value: baseRule, onChange: v => { rule = v; }, surfaces: [{ id: 'portal', label: 'Student portal' }], audiences: [{ id: 'student', label: 'Students' }] }),
    h(UI.RuleSentence, { label: 'Done', value: { ...baseRule, words: ['fee'], surfaces: ['portal'], audiences: ['student'], instruction: 'Say it is per semester.' }, surfaces: [{ id: 'portal', label: 'Student portal' }], audiences: [{ id: 'student', label: 'Students' }] })), async host => {
    const [free, fixedRow] = host.querySelectorAll('.easm-ui-input-source');
    assert.match(free.querySelector('.easm-ui-input-source-button').getAttribute('aria-label'), /Filled by The assistant/, 'InputSourceRow: the source button says what it changes');
    await typeInto(free.querySelector('.easm-ui-input-source-name input'), 'term_code');
    assert.equal(inputSeen?.name, 'term_code', 'InputSourceRow: edits report the whole input');
    assert.equal(fixedRow.querySelector('.easm-ui-input-source-what input'), null, 'InputSourceRow: a locked name is a value, not a field');
    assert.match(fixedRow.querySelector('.easm-ui-input-source-lock').textContent, /Built in/, 'InputSourceRow: a locked input says why');
    const [get, post] = host.querySelectorAll('.easm-ui-request');
    assert.equal(get.querySelectorAll('.easm-ui-request-address .easm-ui-slot-mirror mark').length, 1, 'RequestBuilder: the path’s slot is drawn by its source');
    assert.match(get.querySelector('.easm-ui-request-preview').textContent, /•••4521.*term=2610/, 'RequestBuilder: the preview puts the samples in');
    assert.match(get.querySelector('.easm-ui-request-slots').textContent, /stray.*not an input of this tool/, 'RequestBuilder: a slot that is no input is flagged');
    assert.equal(get.querySelector('.easm-ui-request-writes'), null, 'RequestBuilder: a read says nothing about changing data');
    assert.match(post.querySelector('.easm-ui-request-writes').textContent, /changes data/, 'RequestBuilder: a write says so');
    await typeInto(get.querySelector('.easm-ui-request-address input'), '/students/{emplid}');
    assert.equal(request, '/students/{emplid}', 'RequestBuilder: the address edits');
    const masked = host.querySelector('.easm-ui-json');
    assert.ok(masked.textContent.includes('•••') && !masked.textContent.includes('Ayesha'), 'JsonView: a masked sample keeps its shape only');
    assert.match(masked.querySelector('.easm-ui-json-truncated').textContent, /Cut off/, 'JsonView: a cut-off output says so');
    const picker = host.querySelector('.easm-ui-response-picker');
    const paid = [...picker.querySelectorAll('.easm-ui-json-leaf')].find(li => li.textContent.includes('isPaid'));
    assert.ok(paid, 'ResponsePicker: a group holding a kept field starts open');
    await click(paid.querySelector('input[type="checkbox"]'));
    assert.deepEqual(kept, ['vouchers[].amount', 'vouchers[].isPaid'], 'ResponsePicker: a picked field joins the end of the list');
    await click(picker.querySelector('button[aria-label="Stop keeping vouchers[].amount"]'));
    assert.deepEqual(kept, [], 'ResponsePicker: a kept field can be dropped');
    const [draft, done] = host.querySelectorAll('.easm-ui-rule-sentence');
    assert.match(draft.querySelector('.easm-ui-rule-problems').textContent, /Add a word.*Say what the assistant must do/, 'RuleSentence: says what is missing');
    assert.match(done.querySelector('.easm-ui-rule-outcome').textContent, /Applies to students on Student portal, when they ask about “fee”/, 'RuleSentence: says what will happen');
    assert.equal(done.querySelector('button.easm-ui-rule-slot'), null, 'RuleSentence: without onChange the sentence is read-only');
    await click(draft.querySelector('button.easm-ui-rule-slot[data-slot="trigger"]'));
    await click([...document.querySelectorAll('.easm-ui-rule-trigger')].find(b => b.textContent.includes('Every question')));
    assert.equal(rule?.trigger, 'always', 'RuleSentence: a chip opens its picker and changes that part');
  });

  // Breadcrumbs under a page title: one line, the middle folded, a back link for narrow boxes.
  await audit('Breadcrumbs (line size: folded middle, back link)', h('div', null,
    h(UI.Breadcrumbs, { size: 'line', items: [{ label: 'Knowledge', href: '#k' }, { label: 'Knowledge library', href: '#l' }, { label: 'Collections', href: '#c' }, { label: 'Admissions', href: '#a' }, { label: 'Spring 2027' }] })), async host => {
    const nav = host.querySelector('.easm-ui-breadcrumbs[data-size="line"]');
    assert.equal(nav.querySelectorAll('ol > li').length, 4, 'Breadcrumbs line: five pages fold to four places');
    const fold = nav.querySelector('.easm-ui-breadcrumbs-fold');
    assert.match(fold.getAttribute('aria-label'), /Show 2 more pages/, 'Breadcrumbs line: the fold says how many it hides');
    await click(fold);
    assert.equal(nav.querySelectorAll('ol > li').length, 5, 'Breadcrumbs line: pressing the fold shows the whole trail');
    assert.equal(nav.querySelector('[aria-current="page"]').textContent, 'Spring 2027', 'Breadcrumbs line: the current page is marked');
    assert.equal(nav.querySelector('.easm-ui-breadcrumbs-back').getAttribute('href'), '#a', 'Breadcrumbs line: the back link goes to the parent');
  });

  // The side panel and its parts, and the setup parts (demand list wave 4a).
  let audience = null, previous = 0;
  await audit('DetailPanel (header, attention, sections, audience picker, content, Q&A, attachment)', h(UI.DetailPanel, { defaultOpen: true, title: 'B.E. Technology (Biomedical)',
      kind: { icon: 'type-html', label: 'Web page' }, status: h(UI.StatusChip, { status: 'failed', size: 'sm' }), meta: 'uni.example.edu',
      position: { index: 1, count: 25, onPrevious: () => { previous++; }, onNext: () => {} }, more: [{ id: 'del', label: 'Delete', icon: 'delete', destructive: true }],
      attention: h(UI.Alert, { tone: 'danger', title: 'Not indexed' }), actions: h(UI.Button, null, 'Re-ingest') },
    h(UI.AudiencePicker, { label: 'Who can find it', value: 'PUBLIC', onValueChange: v => { audience = v; } }),
    h(UI.DetailSection, { title: 'Details', icon: 'document-text', collapsible: true, defaultOpen: false }, h(UI.DescriptionList, { size: 'sm', items: [{ id: 'kb', label: 'Knowledge base', value: 'None', action: h(UI.Button, { size: 'sm', variant: 'secondary' }, 'Add to one'), hint: 'Not in a collection' }] })),
    h(UI.DetailSection, { title: 'Pipeline' }, h(UI.PipelineProgress, { label: 'Pipeline', stages: [{ id: 'fetch', state: 'done', at: '22 Oct' }, { id: 'clean', state: 'failed' }] })),
    h(UI.ContentPreview, { text: '# Fees\n\n**Apply for Admission**\n\n---\n- one\n- two' }),
    h(UI.QAPairs, { pairs: [{ question: 'Q1?', answer: 'A1' }, { question: 'Q2?', answer: 'A2' }, { question: 'Q3?', answer: 'A3' }] }),
    h(UI.AttachmentPreview, { href: '#f', name: 'fees.pdf', kind: 'document', type: { label: 'PDF', icon: 'type-pdf' } })), async () => {
    const dialog = document.querySelector('[role="dialog"]');
    assert.match(dialog.getAttribute('aria-labelledby') ? document.getElementById(dialog.getAttribute('aria-labelledby')).textContent : '', /B\.E\. Technology/, 'DetailPanel: named by the record, not "Item details"');
    assert.match(dialog.querySelector('.easm-ui-overlay-header-detail').textContent, /Web page.*uni\.example\.edu/, 'DetailPanel: kind and source in the header');
    assert.equal(dialog.querySelector('button[aria-label="Previous item"]').disabled, true, 'DetailPanel: no Previous on the first item');
    assert.ok(dialog.querySelector('.easm-ui-detail-attention .easm-ui-alert'), 'DetailPanel: what needs someone comes first');
    const stops = dialog.querySelectorAll('[role="radio"]');
    assert.equal(stops.length, 4, 'AudiencePicker: four stops');
    await pressKey(stops[0], 'ArrowRight');
    assert.equal(audience, 'STUDENT', 'AudiencePicker: an arrow key moves the choice');
    const details = [...dialog.querySelectorAll('.easm-ui-detail-section')].find(x => x.textContent.startsWith('Details'));
    assert.equal(details.querySelector('.easm-ui-description-list'), null, 'DetailSection: a closed section hides its content');
    await click(details.querySelector('button[aria-expanded]'));
    assert.ok(details.querySelector('.easm-ui-description-action'), 'DescriptionList: a row ends with its action');
    assert.match(dialog.querySelector('.easm-ui-pipeline-track').textContent, /22 Oct/, 'PipelineProgress: a stage can show when it happened');
    const preview = dialog.querySelector('.easm-ui-content-preview-text');
    assert.ok(preview.querySelector('strong') && !preview.textContent.includes('**') && !preview.textContent.includes('---'), 'ContentPreview: markdown is drawn, its signs gone');
    assert.equal(preview.querySelectorAll('li').length, 2, 'ContentPreview: a list stays a list');
    assert.equal(dialog.querySelectorAll('.easm-ui-qa-pair').length, 2, 'QAPairs: two show at first');
    await click(dialog.querySelector('.easm-ui-qa-more'));
    assert.equal(dialog.querySelectorAll('.easm-ui-qa-pair').length, 3, 'QAPairs: Show all shows every question');
  });
  const setupSteps = [{ id: 'a', label: 'Website tracker', checks: [{ id: '1', label: 'Snippet', state: 'done' }] },
    { id: 'b', label: 'Admissions intake', checks: [{ id: '2', label: 'Stage reported', state: 'blocked', why: 'Nothing reported yet', fix: { label: 'Connect' } }] },
    { id: 'c', label: 'Privacy', checks: [{ id: '3', label: 'Banner', state: 'needs-someone', owner: 'An administrator' }] }];
  const t = (hh, mm) => `2026-10-28T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
  await audit('Setup parts (connector, source, setup checklist, credits, shift strip)', h('div', null,
    h(UI.ConnectorCard, { name: 'Moodle', brand: 'moodle', state: 'failing', now: '2026-10-29T10:00:00', lastSync: '2026-10-29T08:00:00', nextSync: '2026-10-29T12:00:00', health: 'Token refused', action: h(UI.Button, { size: 'sm' }, 'Reconnect') }),
    h(UI.SourceCard, { name: 'WordPress', brand: 'wordpress', state: 'connected', indexed: 2985, failed: 3, direction: 'two-way', trend: [1, .9, .99] }),
    h(UI.SetupChecklist, { label: 'Marketing setup', steps: setupSteps }),
    h(UI.CreditsMeter, { balance: 0, of: 60000 }), h(UI.CreditsMeter, { balance: 3900, of: 60000, variant: 'inline' }),
    h(UI.ShiftStrip, { label: 'Tuesday', days: [{ id: 'd', periods: [{ from: t(9, 2), to: t(12, 0), state: 'online' }, { from: t(12, 0), to: t(12, 40), state: 'away' }, { from: t(12, 40), to: t(17, 42), state: 'online' }], ended: 'logout' }] }),
    h(UI.ShiftStrip, { label: 'Week', days: [{ id: 'm', label: 'Mon', periods: [{ from: t(9, 0), to: t(17, 0), state: 'online' }] }, { id: 'n', label: 'Tue', periods: [{ from: t(9, 0), to: t(13, 0), state: 'online' }] }] })), async host => {
    assert.match(host.querySelector('.easm-ui-connector-times').textContent, /Synced 2 h ago.*Next in 2 h/, 'ConnectorCard: when it last synced and syncs next');
    assert.match(host.querySelector('.easm-ui-source-stats').textContent, /2,985 indexed.*3 could not be read.*Two-way/, 'SourceCard: indexed, failed and the sync direction');
    const steps = host.querySelectorAll('.easm-ui-setup-step');
    assert.equal(steps[1].getAttribute('aria-expanded'), 'true', 'SetupChecklist: the first step not ready opens by itself');
    assert.match(steps[1].textContent, /1 thing to fix/, 'SetupChecklist: a blocked step says how many things to fix');
    await click(steps[2]);
    assert.equal(steps[2].getAttribute('aria-expanded'), 'true', 'SetupChecklist: another step opens on a press');
    assert.match(host.querySelector('.easm-ui-credits[data-state="exhausted"]').textContent, /assistants are paused.*What people are told/, 'CreditsMeter: used up says the assistants are paused and what people hear');
    assert.match(host.querySelector('.easm-ui-credits[data-variant="inline"]').getAttribute('aria-label'), /AI credits: 3,900/, 'CreditsMeter inline: named by the balance');
    assert.match(host.querySelector('.easm-ui-shift[data-view="day"] [role="img"]').getAttribute('aria-label'), /Started 9:02.*signed out.*Online 8 h · Away 40 min/, 'ShiftStrip: the day is told in words');
    assert.equal(host.querySelectorAll('.easm-ui-shift-week > li').length, 2, 'ShiftStrip week: a row per day');
  });

  // Wave 4b: colour roles, TagInput, ChoiceCards, page rhythm, Callout, SelectionBar, WeeklyScheduleGrid, Tree.
  const press = (el, key, extra = {}) => act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra })); await new Promise(r => setTimeout(r, 20)); });
  const setValue = (el, value) => act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new window.Event('input', { bubbles: true })); });
  function TagHarness() { const [v, setV] = React.useState(['admission']); return h(UI.TagInput, { label: 'Keywords', value: v, onValueChange: setV, max: 4, reorderable: true }); }
  await audit('Colour roles + TagInput + ChoiceCards', h('div', null,
    h(UI.StatusChip, { status: 'hot', statuses: UI.temperatureStatuses }), h(UI.StatusChip, { status: 'needs-you', statuses: UI.attentionStatuses, variant: 'dot' }),
    h(TagHarness), h(UI.ChoiceCards, { label: 'Privacy mode', defaultValue: 'a', options: [{ id: 'a', title: 'Only after consent', description: 'Nothing stored first', icon: 'shield-lock', recommended: true }, { id: 'b', title: 'Anonymous counts', icon: 'eye-off' }, { id: 'c', title: 'Everything', disabled: true, disabledReason: 'Not allowed here' }] })), async host => {
    assert.equal(host.querySelector('.easm-ui-status-chip').getAttribute('data-tone'), 'temperature-hot', 'Colour roles: a vocabulary chip carries its role');
    assert.equal(UI.roleTone('consent-withdrawn'), 'plum', 'Colour roles: roleTone gives the hue behind a role');
    assert.equal(UI.chartTones.length, 12, 'CLR-12: twelve series tones');
    const box = host.querySelector('.easm-ui-tag-input-entry');
    await setValue(box, 'fee, scholarship,');
    assert.deepEqual([...host.querySelectorAll('.easm-ui-tag-input-text')].map(b => b.textContent), ['admission', 'fee', 'scholarship'], 'TagInput: a comma adds what was typed');
    await setValue(box, 'Fee,');
    assert.match(host.querySelector('.easm-ui-tag-input .easm-ui-field-message').textContent, /already in the list/, 'TagInput: a repeat is said in words');
    assert.match(host.querySelector('.easm-ui-tag-input-count').textContent, /3 of 4/, 'TagInput: the count beside the label');
    const chips = host.querySelectorAll('.easm-ui-tag-input-text');
    await press(chips[2], 'ArrowLeft', { altKey: true });
    assert.deepEqual([...host.querySelectorAll('.easm-ui-tag-input-text')].map(b => b.textContent), ['admission', 'scholarship', 'fee'], 'TagInput: Alt and an arrow move an item');
    await press(host.querySelectorAll('.easm-ui-tag-input-text')[0], 'Delete');
    assert.equal(host.querySelectorAll('.easm-ui-tag-input-text').length, 2, 'TagInput: Delete removes an item');
    assert.match(host.querySelector('.easm-ui-tag-input [role="status"]').textContent, /Removed admission/, 'TagInput: a removal is announced');
    const radios = host.querySelectorAll('.easm-ui-choice-card-input');
    assert.equal(radios.length, 3, 'ChoiceCards: one native radio per card');
    assert.equal(new Set([...radios].map(r => r.name)).size, 1, 'ChoiceCards: one group');
    assert.match(document.getElementById(radios[2].getAttribute('aria-describedby')).textContent, /Not allowed here/, 'ChoiceCards: a disabled card says why');
    await click(radios[1]);
    assert.equal(host.querySelectorAll('.easm-ui-choice-card')[1].hasAttribute('data-checked'), true, 'ChoiceCards: choosing marks the card');
  });
  function BarHarness() { const [n, setN] = React.useState(3); return h(UI.SelectionBar, { count: n, noun: ['response', 'responses'], total: 40, onSelectAll: () => setN(40), onClear: () => setN(0) }, h(UI.Button, { size: 'sm', variant: 'secondary' }, 'Download')); }
  await audit('PageScaffold + PageSection + StatGrid + Callout + SelectionBar', h(UI.PageScaffold, { width: 'sections', back: { href: '#', label: 'All tools' }, phoneIntro: { text: 'Tools the assistant uses.' } },
    h(UI.StatGrid, null, h(UI.StatCard, { label: 'Calls', value: 12 })), h(UI.PageSection, { title: 'Tools', meta: '6 live', span: true }, h(UI.Callout, { tone: 'provisional', title: 'Provisional' }, 'The last 72 hours can still change.')),
    h(BarHarness)), async host => {
    assert.equal(host.querySelector('.easm-ui-page-scaffold').getAttribute('data-width'), 'sections', 'PageScaffold: its width');
    assert.ok(host.querySelector('a.easm-ui-page-back[href="#"]'), 'PageScaffold: the back link');
    assert.equal(host.querySelector('.easm-ui-page-section h2').textContent, 'Tools · 6 live', 'PageSection: a heading with its scope');
    assert.equal(host.querySelector('.easm-ui-callout').getAttribute('role'), null, 'Callout: part of the page, not announced');
    const bar = host.querySelector('[role="toolbar"]');
    assert.match(bar.textContent, /3 responses selected · Select all 40/, 'SelectionBar: how many, and the rest on offer');
    await click(bar.querySelector('.easm-ui-selection-bar-all'));
    assert.match(host.querySelector('[role="toolbar"]').textContent, /40 responses selected/, 'SelectionBar: Select all picks every matching row');
    await click([...host.querySelectorAll('[role="toolbar"] button')].find(b => b.textContent === 'Clear'));
    assert.equal(host.querySelector('[role="toolbar"]'), null, 'SelectionBar: nothing picked, no bar');
  });
  function WeekHarness() { const [w, setW] = React.useState({ mon: [{ from: '09:00', to: '13:00' }, { from: '12:30', to: '17:00' }], tue: [{ from: '08:00', to: '17:00' }] });
    return h(UI.WeeklyScheduleGrid, { label: 'Calling hours', value: w, onValueChange: setW, bounds: { mon: [{ from: '09:00', to: '18:00' }], tue: [{ from: '09:00', to: '18:00' }], wed: [{ from: '09:00', to: '18:00' }] }, boundsLabel: 'the desk’s hours', holidays: [{ id: 'q', date: '2026-12-25', label: 'Quaid-e-Azam Day' }], onHolidaysChange: () => {} }); }
  await audit('WeeklyScheduleGrid (bounds, problems, holidays)', h(WeekHarness), async host => {
    assert.equal(host.querySelector('.easm-ui-schedule').getAttribute('role'), 'group', 'WeeklyScheduleGrid: one named group');
    const days = host.querySelectorAll('.easm-ui-schedule-day');
    assert.equal(days.length, 7, 'WeeklyScheduleGrid: seven days');
    assert.match(days[0].textContent, /overlaps 09:00–13:00/, 'WeeklyScheduleGrid: an overlap is said in words');
    assert.match(days[1].textContent, /outside the desk’s hours/, 'WeeklyScheduleGrid: hours outside the bounds are refused in words');
    assert.equal(days[3].querySelector('input[role="switch"], input[type="checkbox"]').disabled, true, 'WeeklyScheduleGrid: a day the bounds close cannot open');
    assert.match(host.querySelector('.easm-ui-schedule-holidays').textContent, /Quaid-e-Azam Day/, 'WeeklyScheduleGrid: holidays listed');
    const tueSwitch = days[1].querySelector('input');
    await click(tueSwitch);
    assert.match(host.querySelectorAll('.easm-ui-schedule-day')[1].textContent, /Closed/, 'WeeklyScheduleGrid: a day closes');
    await click(host.querySelectorAll('.easm-ui-schedule-day')[1].querySelector('input'));
    assert.equal(host.querySelectorAll('.easm-ui-schedule-day')[1].querySelector('input[type="time"]').value, '08:00', 'WeeklyScheduleGrid: reopening brings its hours back');
    assert.deepEqual(UI.scheduleProblems([{ from: '10:00', to: '09:00' }]), ['10:00–09:00 ends before it starts.'], 'scheduleProblems: a range that ends before it starts');
  });
  const topics = [{ id: 'adm', label: 'Admissions', count: 142, children: [{ id: 'fees', label: 'Fees', count: 61, children: [{ id: 'sch', label: 'Scholarships', count: 24 }, { id: 'inst', label: 'Instalments', count: 9 }] }, { id: 'dates', label: 'Dates', count: 43 }] }, { id: 'life', label: 'Campus life', count: 31 }];
  function TreeHarness() { const [picked, setPicked] = React.useState([]); const [names, setNames] = React.useState({}); const label = n => ({ ...n, label: names[n.id] ?? n.label, children: n.children?.map(label) });
    return h(UI.Tree, { label: 'Taxonomy', nodes: topics.map(label), defaultExpanded: ['adm'], selectable: true, selected: picked, onSelectedChange: setPicked, onRename: (id, l) => l === 'Fees' ? 'Taken' : void setNames({ ...names, [id]: l }), rowActions: () => [{ id: 'del', label: 'Delete', destructive: true }], countLabel: c => `${c} documents` }); }
  await audit('Tree (levels, keys, picking, rename)', h(TreeHarness), async host => {
    const tree = host.querySelector('[role="tree"]');
    assert.equal(tree.getAttribute('aria-multiselectable'), 'true', 'Tree: picking is announced as multi-select');
    let rows = host.querySelectorAll('[role="treeitem"]');
    assert.equal(rows.length, 4, 'Tree: closed branches hide their rows');
    assert.deepEqual([rows[1].getAttribute('aria-level'), rows[1].getAttribute('aria-posinset'), rows[1].getAttribute('aria-setsize')], ['2', '1', '2'], 'Tree: level and position');
    assert.equal([...rows].filter(r => r.tabIndex === 0).length, 1, 'Tree: one tab stop');
    rows[1].focus(); await press(rows[1], 'ArrowRight');
    assert.equal(host.querySelector('[data-node-id="fees"]').getAttribute('aria-expanded'), 'true', 'Tree: Right opens a branch');
    await press(host.querySelector('[data-node-id="sch"]'), ' ');
    assert.equal(host.querySelector('[data-node-id="sch"]').getAttribute('aria-checked'), 'true', 'Tree: Space picks a row');
    assert.equal(host.querySelector('[data-node-id="fees"]').getAttribute('aria-checked'), 'mixed', 'Tree: a branch with some picked is mixed');
    await press(host.querySelector('[data-node-id="inst"]'), ' ');
    assert.equal(host.querySelector('[data-node-id="fees"]').getAttribute('aria-checked'), 'true', 'Tree: a branch with everything picked is picked');
    await press(host.querySelector('[data-node-id="dates"]'), 'F2');
    const rename = host.querySelector('.easm-ui-tree-rename input');
    assert.ok(rename, 'Tree: F2 renames in place');
    await setValue(rename, 'Fees');
    await press(rename, 'Enter');
    assert.match(host.querySelector('.easm-ui-tree-refusal').textContent, /Taken/, 'Tree: a refused name says why');
    await setValue(host.querySelector('.easm-ui-tree-rename input'), 'Key dates');
    await press(host.querySelector('.easm-ui-tree-rename input'), 'Enter');
    assert.match(host.querySelector('[data-node-id="dates"]').textContent, /Key dates/, 'Tree: the new name is kept');
    assert.match(host.querySelector('[data-node-id="adm"] .easm-ui-tree-count').textContent, /142, 142 documents/, 'Tree: counts read with their words');
  });

  // Wave 4c: the dashboards' P2 parts.
  await audit('Support parts (capture, conversion, extensions, bridge, applicant, lead card)', h('div', null,
    h(UI.CaptureGrid, { fields: [{ id: 'n', label: 'Full name', value: 'Hira', source: 'chat', at: '12 Oct' }, { id: 'c', label: 'CNIC' }] }),
    h(UI.ConversionStrip, { label: 'Fall calls', onSelect: () => {}, steps: [{ id: 'l', label: 'Listed', value: 100 }, { id: 'c', label: 'Called', value: 80 }, { id: 'a', label: 'Applied', value: null }] }),
    h(UI.ExtensionPool, { label: 'Extensions', selectable: true, defaultSelected: [], extensions: [{ id: 'e1', number: '2101', person: { name: 'Sana Ahmed' }, state: 'registered', kind: 'browser' }, { id: 'e2', number: '2102', state: 'signed-out' }] }),
    h(UI.BridgeHealth, { name: 'Main campus', heartbeatSeconds: 700, revision: '2026-10-22', update: { revision: '2026-10-24', state: 'available' }, campus: { address: '203.0.113.24', matches: false }, callsInProgress: 2 }),
    h(UI.ApplicantStepper, { stage: 'applied', since: 'since 14 Oct', payment: { status: 'due', detail: 'by 30 Oct' } }),
    h(UI.LeadCard, { id: 'l', name: 'Hira Siddiqui', temperature: 'hot', stageAge: '6 days in stage', nextAction: { label: 'Counsellor call', due: 'today', overdue: true }, source: { label: 'Lead Ads form' } })), async host => {
    assert.match(host.querySelector('.easm-ui-capture').textContent, /1 of 2 captured.*From chat · 12 Oct.*Not captured yet/, 'CaptureGrid: what is captured, from where, and what is missing');
    assert.match(host.querySelector('.easm-ui-conversion').textContent, /80% of listed/, 'ConversionStrip: the rate from the step before');
    assert.ok(host.querySelector('.easm-ui-conversion .easm-ui-unmeasured'), 'ConversionStrip: an unmeasured step is not a zero');
    const ext = host.querySelectorAll('.easm-ui-extension-check');
    assert.match(ext[1].getAttribute('aria-label'), /2102, unassigned, not signed in/, 'ExtensionPool: each cell named by number, person and state');
    await click(ext[0]);
    assert.ok(host.querySelector('.easm-ui-extensions li[data-picked]'), 'ExtensionPool: picking marks the cell');
    assert.match(host.querySelector('.easm-ui-bridge').textContent, /Offline.*12 min ago.*Update available: 2026-10-24.*Not a campus address/, 'BridgeHealth: offline after ten minutes, the update and the campus lock in words');
    assert.match(host.querySelector('.easm-ui-applicant-steps').getAttribute('aria-label'), /Applied, step 3 of 5/, 'ApplicantStepper: the stage and its position');
    assert.match(host.querySelector('.easm-ui-lead-card').textContent, /Overdue: Counsellor call · today.*6 days in stage|Lead Ads form.*6 days in stage.*Overdue/, 'LeadCard: source, stage age and the overdue next action');
  });
  await audit('Knowledge parts (diff, change preview, programme tree)', h('div', null,
    h(UI.DiffCompare, { before: 'a\nb\nc', after: 'a\nB\nc', beforeLabel: 'Raw', afterLabel: 'Cleaned' }),
    h(UI.ChangePreview, { title: 'Import', noun: ['programme', 'programmes'], onApply: () => {}, groups: [{ id: 'new', label: 'New', count: 2, items: [{ id: 'x', label: 'BS Cyber Security' }] }, { id: 'changed', label: 'Changed', count: 0 }, { id: 'removed', label: 'Removed', count: 1 }, { id: 'problems', label: 'With problems', count: 1 }] }),
    h(UI.ProgrammeTree, { programme: 'BS CS', schemes: [{ id: 's', label: '2024 scheme', forNewStudents: true, semesters: [{ id: 's1', label: 'Semester 1', courses: [{ id: 'c', code: 'CS-101', title: 'Programming', credits: 3, kind: 'core', prerequisites: [] }, { id: 'd', code: 'CS-102', title: 'OOP', credits: 3, prerequisites: ['CS-101'] }] }] }] })), async host => {
    const lines = UI.diffLines('a\nb\nc', 'a\nB\nc').map(l => l.kind);
    assert.deepEqual(lines, ['same', 'removed', 'added', 'same'], 'diffLines: a changed line is the old one removed, then the new one added');
    assert.match(host.querySelector('.easm-ui-diff-summary').textContent, /1 line removed · 1 added/, 'DiffCompare: counts in words');
    assert.ok([...host.querySelectorAll('.easm-ui-diff-text')].some(t => /Removed: b/.test(t.textContent)), 'DiffCompare: a removed line is said as removed');
    const tabs = host.querySelectorAll('.easm-ui-change-preview [role="tab"]');
    assert.equal(tabs.length, 4, 'ChangePreview: four tiles as tabs');
    assert.match(host.querySelector('.easm-ui-change-apply').textContent, /Adds 2 programmes, removes 1; 1 with problems is left out/, 'ChangePreview: Apply says what it will do');
    await click(tabs[2]);
    assert.equal(tabs[2].getAttribute('aria-selected'), 'true', 'ChangePreview: a tile opens its sample');
    assert.equal(host.querySelector('.easm-ui-programme-toggle').getAttribute('aria-expanded'), 'true', 'ProgrammeTree: the scheme for new students opens first');
    assert.match(host.querySelector('.easm-ui-programme').textContent, /For new students.*1 semester · 6 credit hours/, 'ProgrammeTree: the chosen scheme marked, with its totals');
    assert.ok(host.querySelector('.easm-ui-programme-courses caption'), 'ProgrammeTree: each semester is a captioned table');
  });
  function CohortHarness() { const [rules, setRules] = React.useState([{ id: 'x', mode: 'exclude', kind: 'outcome', ref: 'applied' }]);
    return h(UI.CohortBuilder, { rules, onRulesChange: setRules, events: [{ value: 'fee', label: 'Viewed fees' }], outcomes: [{ value: 'applied', label: 'Applied' }], count: 0 }); }
  await audit('Marketing parts (gates, routing, outbox, cohort, target, recommendation)', h('div', null,
    h(UI.GatePipeline, { label: 'Collection', received: 100, gates: [{ id: 'contract', label: 'Contract', refused: 10, topReason: { label: 'Unknown event', count: 8 } }, { id: 'consent', label: 'Consent', refused: 5 }] }),
    h(UI.RoutingMatrix, { label: 'Routing', onCellSelect: () => {}, destinations: [{ id: 'meta', label: 'Meta', brand: 'meta' }], signals: [{ id: 'lead', label: 'Lead created', cells: { meta: { event: 'Lead', state: 'mapped' } } }, { id: 'app', label: 'Applied', cells: {} }] }),
    h(UI.OutboxBoard, { label: 'Outbox', onRetry: () => {}, columns: [{ state: 'queued', count: 1, items: [{ id: 'a', title: 'Lead' }] }, { state: 'dead-letter', count: 1, items: [{ id: 'b', title: 'Purchase', reason: 'Token expired' }] }] }),
    h(CohortHarness),
    h(UI.TargetBar, { label: 'MBA', actual: 31, target: null }), h(UI.TargetBar, { label: 'BS CS', actual: 214, target: 300 }),
    h(UI.RecommendationCard, { severity: 'act', kind: 'anomaly', title: 'Paid social fell 38%', evidence: ['1,940 → 1,203'], standingDays: 9, onDismiss: () => {} })), async host => {
    assert.match(host.querySelector('.easm-ui-gates').textContent, /Received100.*90.*10 refused.*Mostly: Unknown event \(8\).*Accepted85.*85% of what arrived/, 'GatePipeline: what each gate let through and refused, and why');
    assert.match(host.querySelectorAll('.easm-ui-routing-cell')[1].getAttribute('aria-label'), /Applied to Meta: Not mapped/, 'RoutingMatrix: an empty cell is said as not mapped');
    assert.ok([...host.querySelectorAll('.easm-ui-outbox button')].some(b => b.textContent === 'Send again'), 'OutboxBoard: a dead-lettered item can be sent again');
    assert.match(host.querySelector('.easm-ui-cohort').textContent, /Matches nobody/, 'CohortBuilder: only leave-out rules say they match nobody');
    assert.match(host.querySelector('.easm-ui-cohort-count').textContent, /add an include rule/, 'CohortBuilder: the count waits for an include rule');
    assert.match(host.querySelectorAll('.easm-ui-target-track')[0].getAttribute('aria-label'), /31 · no target set/, 'TargetBar: no target draws no percentage');
    assert.match(host.querySelectorAll('.easm-ui-target-track')[1].getAttribute('aria-label'), /214 of 300 · 71%/, 'TargetBar: attainment against the target');
    assert.match(host.querySelector('.easm-ui-recommendation').textContent, /Act on it.*Standing for 9 days/, 'RecommendationCard: severity and how long it has stood');
  });
  await audit('Automation parts (resolver, go live, tool call)', h('div', null,
    h(UI.ResolverResult, { mustUse: [{ id: 'f', label: 'Fee vouchers', reason: 'Asked for', builtin: true }], mayUse: [], leftOut: [{ id: 'r', label: 'Results', reason: 'Portal only' }], rules: [{ id: 'x', label: 'Due date first', wording: 'Say the due date first.' }] }),
    h(UI.GoLiveGate, { tool: 'Library loans', onGoLive: () => {}, onGoLiveAnyway: () => {}, checks: [{ id: 't', label: 'Tested', state: 'done' }, { id: 'p', label: 'Pilot call', state: 'blocked', why: 'No pilot call yet' }] }),
    h(UI.ToolCallRow, { tool: 'Library loans', who: { name: 'Bilal', level: 'erp' }, outcome: 'not-found', durationMs: 180, status: 404, at: '10:39', why: 'The path does not exist.' })), async host => {
    assert.match(host.querySelector('.easm-ui-resolver').textContent, /Must use1.*May use0.*Nothing else is offered.*Left out1/, 'ResolverResult: three columns with counts');
    assert.ok(host.querySelector('.easm-ui-resolver-wording summary'), 'ResolverResult: the exact wording opens on request');
    const golive = [...host.querySelectorAll('.easm-ui-golive button')];
    assert.equal(golive.find(b => b.textContent === 'Go live').disabled, true, 'GoLiveGate: Go live waits for the checks');
    await click(golive.find(b => /anyway/.test(b.textContent)));
    const anyway = [...host.querySelectorAll('.easm-ui-golive button')].find(b => b.textContent === 'Go live anyway');
    assert.equal(anyway.disabled, true, 'GoLiveGate: going live anyway needs a reason');
    const why = host.querySelector('.easm-ui-tool-call-why');
    await click(why);
    assert.equal(why.getAttribute('aria-expanded'), 'true', 'ToolCallRow: Why this happened opens');
    assert.match(host.querySelector('.easm-ui-tool-call-detail').textContent, /Not found\. The path does not exist/, 'ToolCallRow: the outcome and why in words');
  });
  await audit('Forms parts (preview tiles, drop-off, publish, collection)', h('div', null,
    h(UI.PreviewTiles, { label: 'Form type', defaultValue: 'a', options: [{ id: 'a', label: 'One page', preview: h('span', null, 'A') }, { id: 'b', label: 'Sections', description: 'A page per section', preview: h('span', null, 'B') }] }),
    h(UI.DropOffStrip, { label: 'Where people stop', started: 100, finished: 40, questions: [{ id: 'a', label: 'Name', reached: 95 }, { id: 'b', label: 'CNIC', reached: 50 }, { id: 'c', label: 'City', reached: 45 }] }),
    h(UI.PublishChannels, { url: 'https://x.test/f/a', embed: '<div></div>', assistant: { on: false, channels: [] } }),
    h(UI.CollectionStatus, { link: true, assistant: { chat: true }, cannotTake: 'No required uploads.' })), async host => {
    assert.equal(host.querySelectorAll('.easm-ui-preview-tile-input').length, 2, 'PreviewTiles: native radios');
    assert.match(host.querySelector('.easm-ui-dropoff-worst').textContent, /question 2, CNIC.*45 people/, 'DropOffStrip: where most stop, in words');
    assert.ok(host.querySelector('.easm-ui-dropoff li[data-worst]'), 'DropOffStrip: that question is marked');
    const source = [...host.querySelectorAll('.easm-ui-publish input')][0];
    await setValue(source, 'Face Book');
    assert.match(host.querySelector('.easm-ui-publish').textContent, /utm_source=face_book/, 'PublishChannels: the campaign link lowercases and joins words');
    assert.match(host.querySelector('.easm-ui-collection').getAttribute('aria-label'), /Collecting: Link, Website chat/, 'CollectionStatus: where it collects, in words');
  });
  await audit('Admin parts (level ladder, notification matrix, registry)', h('div', null,
    h(UI.LevelLadder, { label: 'Forms access', current: 'creator', levels: [{ id: 'viewer', name: 'Viewer', does: 'Reads' }, { id: 'creator', name: 'Creator', does: 'Builds forms' }, { id: 'reviewer', name: 'Reviewer', does: 'Reads every form' }] }),
    h(UI.NotificationMatrix, { label: 'Notifications', onToggle: () => {}, quietHours: { from: '22:00', to: '07:00' }, events: [{ id: 'h', group: 'Conversations', label: 'Handed to you', value: { bell: true }, locked: { bell: 'Always' } }] }),
    h(UI.RegistryTree, { label: 'Systems', onDisconnect: () => {}, systems: [{ id: 'm', kind: 'system', label: 'Meta', state: 'ok', children: [{ id: 'c', kind: 'connection', label: 'Hira', children: [{ id: 'r', kind: 'resource', label: 'Pixel', children: [{ id: 'u', kind: 'use', label: 'Conversions' }] }] }] }] })), async host => {
    assert.equal(host.querySelector('.easm-ui-ladder [aria-current="step"]').textContent.includes('Creator'), true, 'LevelLadder: the current step is marked');
    assert.match(host.querySelector('.easm-ui-ladder-next').textContent, /next step, Reviewer: Reads every form/, 'LevelLadder: what the next step adds');
    assert.match(host.querySelector('.easm-ui-notify-lock').getAttribute('aria-label'), /locked by your workspace\. Always/, 'NotificationMatrix: a lock says it is locked and why');
    assert.ok(host.querySelector('.easm-ui-notify-matrix input[aria-label="Email for Handed to you"], .easm-ui-notify-matrix [aria-label="Email for Handed to you"]') || [...host.querySelectorAll('.easm-ui-notify-matrix label')].some(l => /Email for Handed to you/.test(l.textContent)), 'NotificationMatrix: each switch named by channel and event');
    await click([...host.querySelectorAll('.easm-ui-registry button')].find(b => /Disconnect/.test(b.textContent)));
    assert.match(host.querySelector('.easm-ui-registry-confirm').textContent, /These stop working.*Conversions.*Disconnect and stop 1/, 'RegistryTree: a disconnect says what stops first');
  });

  // Wave 4d: empty-state illustrations.
  await audit('EmptyIllustration + EmptyState illustration', h('div', null,
    ...UI.emptyIllustrationNames.map(n => h(UI.EmptyIllustration, { key: n, name: n })),
    h(UI.EmptyState, { illustration: 'no-results', title: 'No matches', description: 'Try fewer words.' }),
    h(UI.EmptyState, { illustration: 'no-results', title: 'No matches', compact: true })), async host => {
    assert.equal(host.querySelectorAll('svg.easm-ui-illustration[aria-hidden="true"]').length, UI.emptyIllustrationNames.length + 1, 'EmptyIllustration: every scene is decorative');
    assert.equal(UI.emptyIllustrationNames.length, 16, 'EmptyIllustration: sixteen scenes');
    const states = host.querySelectorAll('.easm-ui-empty-state');
    assert.ok(states[0].querySelector('.easm-ui-illustration') && !states[0].querySelector('.easm-ui-empty-symbol'), 'EmptyState: the scene replaces the symbol');
    assert.ok(states[1].querySelector('.easm-ui-empty-symbol') && !states[1].querySelector('.easm-ui-illustration'), 'EmptyState: compact keeps the symbol');
  });

  // Responsive parts: DataTable card rows keep table roles; ThreadHeader back; InfoHint opens on click/tap.
  await audit('DataTable (card rows) + ThreadHeader (back) + InfoHint (click)', h('div', null,
    h(UI.DataTable, { label: 'Sources', narrowLayout: 'cards', rows: [{ id: 'a', name: 'Handbook', pages: 48 }], rowKey: r => r.id,
      columns: [{ id: 'name', label: 'Source', value: r => r.name }, { id: 'pages', label: 'Pages', value: r => r.pages, align: 'end' }] }),
    h(UI.ThreadHeader, { name: 'Ali Mustafa', onBack: () => {} }),
    h(UI.InfoHint, { label: 'About first response' }, 'Median time to the first reply.')), async host => {
    assert.equal(host.querySelector('table').getAttribute('role'), 'table', 'DataTable cards: explicit table role');
    assert.equal(host.querySelectorAll('[role="cell"]').length, 2, 'DataTable cards: cells keep the cell role');
    assert.equal(host.querySelector('td[data-label="Pages"]')?.textContent, '48', 'DataTable cards: each value carries its column label');
    assert.ok(host.querySelector('button[aria-label="Back to conversations"]'), 'ThreadHeader: back button is named');
    await click(host.querySelector('.easm-ui-info-hint'));
    assert.match(document.querySelector('[role="tooltip"]')?.textContent ?? '', /Median time/, 'InfoHint: a click or tap opens the hint');
  });

  // Review fixes: presets respect min/max, variable chips respect maxLength, ⌘K returns focus to its opener.
  let rangePicked = null;
  await audit('DateRangePicker (presets outside min/max are disabled)', h(UI.DateRangePicker, { label: 'Report period', min: '2026-10-10', max: '2026-10-20',
    presets: [{ label: 'Too early', start: '2026-09-01', end: '2026-09-30' }, { label: 'Inside', start: '2026-10-11', end: '2026-10-12' }], onValueChange: v => { rangePicked = v; } }), async host => {
    await openTrigger(host);
    const [early, inside] = [...document.querySelectorAll('.easm-ui-range-preset')];
    assert.equal(early.disabled, true, 'DateRangePicker: a preset before min cannot be chosen');
    assert.equal(inside.disabled, false, 'DateRangePicker: a preset within bounds stays available');
    await click(early);
    assert.equal(rangePicked, null, 'DateRangePicker: an out-of-bounds preset does not commit');
  });
  await audit('PromptEditor (variable chips respect maxLength)', h(UI.PromptEditor, { label: 'Greeting', defaultValue: 'Hello', maxLength: 12, variables: ['student_name', 'x'] }), async host => {
    const [longVar, shortVar] = host.querySelectorAll('.easm-ui-prompt-editor-var');
    assert.equal(longVar.disabled, true, 'PromptEditor: a chip that would pass maxLength is disabled');
    assert.equal(shortVar.disabled, false, 'PromptEditor: a chip that fits stays available');
    await click(shortVar);
    assert.ok(host.querySelector('textarea').value.length <= 12, 'PromptEditor: inserting never passes maxLength');
  });
  await audit('CommandBar (shortcut returns focus to its opener)', h('div', null, h('textarea', { 'aria-label': 'Reply', id: 'cb-editor' }),
    h(UI.CommandBar, { appearance: 'search', shortcut: true, triggerLabel: 'Search', commands: [{ id: 'a', label: 'Open inbox', onSelect: () => {} }] })), async host => {
    const editor = host.querySelector('#cb-editor');
    await act(async () => { editor.focus(); });
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })); await new Promise(r => setTimeout(r, 10)); });
    assert.ok(document.querySelector('[role="dialog"]'), 'CommandBar: the shortcut opens the dialog');
    await click(document.querySelector('[role="dialog"] button[aria-label="Close dialog"]'));
    await act(async () => { await new Promise(r => setTimeout(r, 20)); });
    assert.equal(document.activeElement, editor, 'CommandBar: closing returns focus to where ⌘K was pressed');
  });

  // Second review: hidden legends keep the numbers, disabled pickers leave the form, disabled linked
  // conversations are inert, and an empty range opens on a usable month.
  await audit('DonutChart + ProportionBar (legend off keeps the numbers)', h('div', null,
    h(UI.DonutChart, { label: 'Priority', legend: 'none', segments: [{ id: 'm', label: 'Medium', value: 407 }, { id: 'h', label: 'High', value: 26 }] }),
    h(UI.ProportionBar, { label: 'Sentiment', legend: false, segments: [{ id: 'p', label: 'Positive', value: 58 }, { id: 'n', label: 'Negative', value: 42 }] })), async host => {
    assert.match(host.textContent, /Medium: 407, 94%/, 'DonutChart: legend="none" still lists each segment for screen readers');
    assert.match(host.textContent, /Positive: 58, 58%/, 'ProportionBar: legend={false} still lists each segment for screen readers');
  });
  await audit('Pickers (disabled ones are left out of the form)', h('form', { id: 'pk-form' },
    h(UI.DatePicker, { label: 'Follow up on', name: 'follow', defaultValue: '2026-10-20', disabled: true }),
    h(UI.DateRangePicker, { label: 'Period', name: 'period', defaultValue: { start: '2026-10-01', end: '2026-10-13' }, disabled: true }),
    h(UI.TimePicker, { label: 'Opens', name: 'opens', defaultValue: '09:00', disabled: true })), async host => {
    const data = new dom.window.FormData(host.querySelector('#pk-form'));
    assert.deepEqual([...data.keys()], [], 'Pickers: a disabled picker submits nothing, like a disabled native field');
  });
  // Third review: required pickers block submission, form reset restores defaults, calendar keys stay in
  // bounds, and a board without onMove offers no moves.
  await audit('Pickers (required ones block an empty submission)', h('form', { id: 'pk-required' },
    h(UI.DatePicker, { label: 'Follow up on', name: 'follow', required: true }),
    h(UI.DateRangePicker, { label: 'Period', name: 'period', required: true }),
    h(UI.TimePicker, { label: 'Opens', name: 'opens', required: true })), async host => {
    const form = host.querySelector('#pk-required');
    let valid;
    await act(async () => { valid = form.checkValidity(); });
    assert.equal(valid, false, 'Pickers: an empty required picker makes the form invalid');
    assert.match(host.textContent, /Choose a date\./, 'DatePicker: a missing required value shows a message');
    assert.match(host.textContent, /Choose a start and end date\./, 'DateRangePicker: a missing required range shows a message');
    assert.match(host.textContent, /Choose a time\./, 'TimePicker: a missing required value shows a message');
    assert.equal(host.querySelector('.easm-ui-picker-trigger').getAttribute('aria-invalid'), 'true', 'Pickers: the trigger reports the missing value');
  });
  let resetChanges = 0;
  await audit('DatePicker (form reset restores the default)', h('form', { id: 'pk-reset' },
    h(UI.DatePicker, { label: 'Follow up on', name: 'follow', defaultValue: '2026-10-20', onValueChange: () => { resetChanges++; } })), async host => {
    const form = host.querySelector('#pk-reset');
    await openTrigger(host);
    await click(document.querySelector('[data-cell="2026-10-22"]'));
    assert.equal(new dom.window.FormData(form).get('follow'), '2026-10-22', 'DatePicker: a pick changes the submitted value');
    const changes = resetChanges;
    await act(async () => { form.reset(); await new Promise(r => setTimeout(r, 10)); });
    assert.equal(new dom.window.FormData(form).get('follow'), '2026-10-20', 'DatePicker: reset restores the default value');
    assert.equal(resetChanges, changes, 'DatePicker: reset does not call onValueChange');
  });
  await audit('DatePicker (arrow keys stop at min)', h(UI.DatePicker, { label: 'Follow up on', defaultValue: '2026-10-20', min: '2026-10-20' }), async host => {
    await openTrigger(host);
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    const cell = document.querySelector('[data-cell="2026-10-20"]');
    await act(async () => { cell.focus(); cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); await new Promise(r => setTimeout(r, 10)); });
    assert.equal(document.activeElement.getAttribute('data-cell'), '2026-10-20', 'Calendar: ArrowLeft on the first allowed day keeps focus on it');
    await act(async () => { document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })); await new Promise(r => setTimeout(r, 10)); });
    assert.equal(document.activeElement.getAttribute('data-cell'), '2026-10-20', 'Calendar: a week back past min stops on min');
  });
  await audit('KanbanBoard (no onMove, no moves)', h(UI.KanbanBoard, { label: 'Pipeline' },
    h(UI.KanbanColumn, { id: 'new', title: 'New' }, h(UI.LeadCard, { id: 'c1', name: 'Ali Mustafa' }), h(UI.LeadCard, { id: 'c2', name: 'Hira Baig' })),
    h(UI.KanbanColumn, { id: 'applied', title: 'Applied' })), async host => {
    assert.equal(host.querySelector('[draggable="true"]'), null, 'KanbanBoard: cards are not draggable without onMove');
    assert.equal(host.querySelector('button[aria-label="Actions for Ali Mustafa"]'), null, 'LeadCard: no move menu without onMove');
  });
  // Brand marks: decorative unless labelled, every mark renders, and a conversation names its channel.
  await audit('BrandIcon + ChannelMark', h('div', null,
    ...UI.brandIconNames.map(name => h(UI.BrandIcon, { key: name, name, label: UI.brandIcons[name].title })),
    h(UI.BrandIcon, { name: 'whatsapp', appearance: 'solid' }),
    h(UI.Tag, { size: 'sm', brand: 'moodle' }, 'Moodle'),
    h(UI.ConversationList, { label: 'Conversations' }, h(UI.ConversationListItem, { name: 'Fazeela Yousif', channel: 'whatsapp', time: '1 h', preview: 'Hello' }))), async host => {
    assert.equal(host.querySelectorAll('[role="img"].easm-brand-icon').length, UI.brandIconNames.length, 'BrandIcon: a labelled mark is an image');
    assert.ok([...host.querySelectorAll('.easm-brand-icon svg path')].every(p => (p.getAttribute('d') || '').length > 10), 'BrandIcon: every mark has artwork');
    assert.equal(host.querySelector('[data-appearance="solid"]').getAttribute('aria-hidden'), 'true', 'BrandIcon: unlabelled marks are decorative');
    assert.match(host.querySelector('.easm-ui-conversation-item-name').textContent, /Fazeela Yousif, WhatsApp/, 'ConversationListItem: the channel is read after the name');
  });
  // Brand kit: logo lockups and marks are named images; the motion kit renders with names too.
  await audit('Brand kit (EasmLogo, EasmMark, EasmIcon, EasmWaveform, EasmDots)', h('div', null,
    h(UI.EasmLogo, { product: 'One' }), h(UI.EasmLogo, { product: 'Forms', theme: 'dark' }), h(UI.EasmLogo, { variant: 'descriptor' }),
    h(UI.EasmMark, { size: 32 }), h(UI.EasmMark, { tile: true, product: 'Calling' }),
    h(UI.EasmIcon, { state: 'thinking' }), h(UI.EasmWaveform, { mode: 'loading' }), h(UI.EasmDots, { label: 'EASM is typing' })), async host => {
    const names = [...host.querySelectorAll('svg[role="img"]')].map(s => s.getAttribute('aria-label'));
    for (const n of ['EASM One', 'EASM Forms', 'EASM Calling']) assert.ok(names.includes(n), `EasmLogo/EasmMark: named "${n}"`);
    assert.ok(names.some(n => /Enterprise Applications and Systems Management/.test(n || '')), 'EasmLogo descriptor: the full name is its label');
    assert.equal(host.querySelectorAll('svg[viewBox="0 0 64 64"] rect[fill="#FF6A00"]').length >= 2, true, 'EasmMark: the orange core is drawn');
  });
  let linkSelected = 0;
  await audit('ConversationListItem (disabled link is inert)', h(UI.ConversationList, { label: 'Conversations' },
    h(UI.ConversationListItem, { name: 'Ali Mustafa', preview: 'Hello', time: '3 min', href: '#c1', disabled: true, onSelect: () => { linkSelected++; } })), async host => {
    assert.equal(host.querySelector('a'), null, 'ConversationListItem: a disabled item is not a link');
    assert.equal(host.querySelector('button').disabled, true, 'ConversationListItem: a disabled item is a disabled control');
  });
  await audit('DateRangePicker (empty range opens on this month)', h(UI.DateRangePicker, { label: 'Period', max: '2027-06-30', presets: false }), async host => {
    await openTrigger(host);
    const month = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date());
    assert.equal(document.querySelector('[role="grid"]').getAttribute('aria-label'), month, 'DateRangePicker: opens on today, not on max');
  });

  // Canary: an unnamed button must be reported, or the harness is not actually checking anything.
  await audit('canary', h('button', { type: 'button' }));
  const canary = results.pop();
  if (!canary.violations.some(v => v.id === 'button-name')) throw new Error('a11y: axe did not flag the canary unnamed button; the harness is broken.');

  dom.window.close();
  const failing = results.filter(r => r.violations.length);
  for (const { label, violations } of failing) {
    console.error(`\n✗ ${label}`);
    for (const v of violations) console.error(`  [${v.impact}] ${v.id}: ${v.help}\n    ${v.nodes.slice(0, 3).join('\n    ')}`);
  }
  console.log(`\naxe: ${results.length - failing.length}/${results.length} renders pass (${WCAG_TAGS.join(', ')}; contrast checked separately).`);
  if (failing.length) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exit(1); });
