const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = __dirname, repo = path.resolve(__dirname, '../../../..');
const req = createRequire(path.join(repo, 'packages/ui/package.json'));
const assert = require('node:assert/strict');
async function main() {
  const cache = path.join(root, 'qa/.cache'); fs.mkdirSync(cache, { recursive: true });
  await req('esbuild').build({ entryPoints: [path.join(repo, 'packages/ui/src/index.ts')], outfile: path.join(cache, 'runtime.cjs'), bundle: true, format: 'cjs', platform: 'node', jsx: 'automatic', external: ['react', 'react-dom', 'react-dom/*', 'react/jsx-runtime'], logLevel: 'silent' });
  const { JSDOM } = req('jsdom');
  const dom = new JSDOM('<!doctype html><html lang="en"><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
  for (const name of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','HTMLFormElement','HTMLTextAreaElement','Element','Node','Event','MouseEvent','KeyboardEvent','FocusEvent','CustomEvent','MutationObserver','File','FileList','DocumentFragment','NodeFilter','HTMLButtonElement','DOMRect']) global[name] = name === 'window' ? dom.window : dom.window[name];
  Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
  global.getComputedStyle = dom.window.getComputedStyle;
  global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  global.PointerEvent = dom.window.MouseEvent;
  const React = req('react'), { act } = React, { createRoot } = req('react-dom/client');
  const { renderToStaticMarkup } = req('react-dom/server');
  const UI = require(path.join(cache, 'runtime.cjs'));
  const h = React.createElement;
  const checks = [];
  const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
  const ssr = element => renderToStaticMarkup(element);
  let mount, host;
  async function unmount() { if (mount) { await act(async () => mount.unmount()); host.remove(); mount = undefined; } }
  async function render(element) { await unmount(); host = document.createElement('div'); document.body.append(host); mount = createRoot(host); await act(async () => mount.render(element)); return host; }
  async function rerender(element) { await act(async () => mount.render(element)); return host; }
  async function click(element) { await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))); }
  async function key(element, name) { let event; await act(async () => { event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }); element.dispatchEvent(event); }); return event; }
  async function input(element, value) { await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); }); }
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
  check('Exactly 47 documented component names', UI.componentNames.length === 47);
  check('All 47 runtime exports and smoke samples exist', UI.componentNames.every(name => UI[name] && samples[name]));
  let renders = 0;
  for (const name of UI.componentNames) { check(`${name}: SSR renders`, ssr(h(UI[name], samples[name])).length > 0); renders++; }
  for (const variant of ['primary','secondary','subtle','destructive']) for (const size of ['sm','md','lg']) for (const state of ['default','disabled','loading','selected']) {
    const html = ssr(h(UI.Button, { variant, size, disabled: state === 'disabled', loading: state === 'loading', selected: state === 'selected' ? true : undefined }, 'Save'));
    check(`Button ${variant}/${size}/${state}`, html.includes(`data-size="${size}"`) && html.includes(`data-variant="${variant}"`)); renders++;
  }
  for (const name of ['TextField','PasswordField','NumberField','TextArea','SearchField','Select','DropdownSelect','Combobox','Checkbox','Radio','Switch','DateField','TimeField','FileUpload']) for (const size of ['sm','md','lg']) for (const state of ['default','disabled','error','success']) {
    const html = ssr(h(UI[name], { ...samples[name], size, disabled: state === 'disabled', error: state === 'error' ? 'Fix this value.' : undefined, success: state === 'success' ? 'Valid value.' : undefined }));
    check(`${name} ${size}/${state}`, html.includes(`data-size="${size}"`) && (state !== 'error' || html.includes('aria-invalid="true"'))); renders++;
  }
  for (const [name,props] of [['IconButton',{icon:'edit',label:''}],['Button',{children:''}],['TextField',{label:''}],['Select',{label:'Agent',options:[{value:'a',label:'A'},{value:'a',label:'B'}]}],['Tabs',{label:'View',items:[sel[0],sel[0]]}],['Accordion',{items:[{id:'a',title:'A',content:'A'},{id:'a',title:'B',content:'B'}]}],['Avatar',{name:''}]]) {
    assert.throws(() => ssr(h(UI[name],props))); checks.push(`${name}: invalid semantic content rejected`);
  }
  let actions = 0;
  await render(h(UI.Button,{loading:true,onClick:()=>actions++},'Save'));
  let button = host.querySelector('button'); button.focus(); await click(button); const prevented = await key(button,'Enter');
  check('Loading blocks click and Enter while preserving focus', actions === 0 && prevented.defaultPrevented && document.activeElement === button && !button.disabled && button.getAttribute('aria-busy') === 'true');
  await rerender(h(UI.Button,{onClick:()=>actions++},'Save')); await click(button); check('Action runs when real loading state clears',actions===1);
  await render(h(UI.IconButton,{label:'Edit',icon:'edit',disabled:true,onClick:()=>actions++})); await click(host.querySelector('button')); check('Disabled icon action never fires',actions===1);
  for (const ariaDisabled of [true, 'true']) {
    await render(h(UI.SplitButton,{items:menu,'aria-disabled':ariaDisabled},'Send reply'));
    const menuButton=host.querySelectorAll('button')[1];
    check(`SplitButton aria-disabled=${typeof ariaDisabled} blocks its menu trigger`,menuButton.disabled && menuButton.getAttribute('aria-disabled')==='true');
    await click(menuButton);
    await act(async()=>menuButton.focus());
    check(`SplitButton aria-disabled=${typeof ariaDisabled} cannot activate or focus its menu`,!document.querySelector('[role="menu"]') && document.activeElement!==menuButton);
  }
  await render(h(UI.SplitButton,{items:menu,'aria-disabled':false},'Send reply'));
  check('SplitButton explicitly available state keeps its menu action enabled',!host.querySelectorAll('button')[1].disabled);
  let query;
  await render(h(UI.SearchField,{label:'Search',defaultValue:'EASM',onValueChange:value=>query=value})); await click(host.querySelector('button[aria-label="Clear search"]'));
  check('Search clear reports empty value and restores input focus',query==='' && host.querySelector('input').value==='' && document.activeElement===host.querySelector('input'));
  let selected;
  await render(h(UI.Combobox,{label:'Agent',options:opts,onValueChange:value=>selected=value,required:true,name:'agent'}));
  let combo=host.querySelector('[role="combobox"]'); await act(async()=>combo.focus()); await input(combo,'Omar'); await key(combo,'ArrowDown');
  check('Combobox exposes only a matching active option',document.querySelectorAll('[role="option"]').length===1 && document.getElementById(combo.getAttribute('aria-activedescendant'))?.textContent==='Omar Ali');
  await key(combo,'Enter'); check('Combobox keyboard commit stores semantic value',selected==='b' && host.querySelector('input[type="hidden"]').value==='b' && combo.value==='Omar Ali');
  await act(async()=>combo.focus()); await input(combo,'Unknown'); await key(combo,'ArrowDown'); check('Empty combobox has no dangling active descendant',!combo.hasAttribute('aria-activedescendant'));
  await key(combo,'Escape'); check('Combobox Escape restores committed label',combo.value==='Omar Ali' && combo.getAttribute('aria-expanded')==='false');
  await render(h(UI.Combobox,{label:'Agent',options:opts,value:'missing'})); check('Removed controlled selection is explicitly invalid',host.querySelector('[role="combobox"]').getAttribute('aria-invalid')==='true');
  let tabValue;
  await render(h(UI.Tabs,{label:'View',items:sel,onValueChange:value=>tabValue=value})); let tabs=host.querySelectorAll('[role="tab"]'); tabs[0].focus(); await key(tabs[0],'ArrowRight');
  check('Manual tabs move focus without changing selected content',document.activeElement===tabs[1] && tabs[0].getAttribute('aria-selected')==='true' && !tabValue);
  await click(tabs[1]); check('Tabs activate linked panels',tabValue==='b' && !host.querySelectorAll('[role="tabpanel"]')[1].hidden && host.querySelectorAll('[role="tabpanel"]')[0].hidden);
  await key(tabs[1],'ArrowRight'); check('Tab navigation skips disabled tabs and wraps',document.activeElement===tabs[0]);
  let segment;
  await render(h(UI.SegmentedControl,{label:'View',options:sel,onValueChange:value=>segment=value})); const radios=host.querySelectorAll('[role="radio"]'); radios[0].focus(); await key(radios[0],'ArrowRight'); check('Segmented arrow selection follows radio-group behavior',segment==='b' && radios[1].getAttribute('aria-checked')==='true');
  await render(h(UI.SegmentedControl,{label:'View',options:sel,value:'missing',name:'view'})); check('Unavailable segmented value is visible and never submitted as a valid selection',host.querySelector('[role="radiogroup"]').getAttribute('aria-invalid')==='true' && host.querySelector('input[type="hidden"]').value==='' && host.textContent.includes('selected value is unavailable'));
  await render(h(UI.FilterControl,{label:'Channel',options:sel,value:['a','missing','c']})); check('Filter counts only enabled options and explains unavailable values',host.querySelector('button').textContent.includes('(1)') && host.textContent.includes('Some selected filters are unavailable'));
  check('Overflow action uses the purpose-built three-dot glyph',ssr(h(UI.OverflowMenu,{items:menu})).includes('data-icon="more-horizontal"'));
  await render(h(UI.Collapsible,{title:'Advanced',children:h(UI.Button,null,'Nested action')})); button=host.querySelector('button'); let region=document.getElementById(button.getAttribute('aria-controls'));
  check('Collapsed content is inert and excluded from accessibility',region.hasAttribute('inert') && region.getAttribute('aria-hidden')==='true'); await click(button); check('Expansion exposes content and correct state',!region.hasAttribute('inert') && button.getAttribute('aria-expanded')==='true');
  await render(h(UI.Accordion,{items:[{id:'a',title:'First',content:'First'},{id:'b',title:'Second',content:'Second'}]})); const headers=host.querySelectorAll('button'); await click(headers[0]); await click(headers[1]); check('Single accordion closes previous section',headers[0].getAttribute('aria-expanded')==='false' && headers[1].getAttribute('aria-expanded')==='true');
  await render(h(UI.Accordion,{items:[{id:'a',title:'First',icon:'knowledge',content:'First'},{id:'b',title:'Second',content:'Second'}],defaultValue:['removed','b','b']}));
  check('Accordion retains an available section after a stale leading ID',host.querySelectorAll('button')[1].getAttribute('aria-expanded')==='true');
  check('Accordion contextual artwork comes from the shared icon registry',host.querySelector('[data-icon="knowledge"]')?.getAttribute('aria-hidden')==='true');
  let accordionChange;
  await render(h(UI.Accordion,{multiple:true,items:[{id:'a',title:'First',content:'First'},{id:'b',title:'Second',content:'Second'}],defaultValue:['missing','b','b'],onValueChange:value=>accordionChange=value}));
  await click(host.querySelector('button')); check('Accordion change removes stale and duplicate IDs without losing valid open items',JSON.stringify(accordionChange)==='["b","a"]');
  await render(h(UI.Collapsible,{title:'Outer',defaultOpen:true,icon:'knowledge',children:h(UI.Collapsible,{title:'Inner',icon:'settings',children:'Inner content'})}));
  check('Nested collapsible state remains independent of its expanded parent',host.querySelectorAll('button')[1].getAttribute('aria-expanded')==='false' && host.querySelectorAll('.easm-ui-collapsible-region')[1].hasAttribute('inert'));
  check('Only disclosure chevrons carry the rotation hook',host.querySelectorAll('.easm-ui-collapsible-chevron').length===2 && !host.querySelector('.easm-ui-collapsible-leading').classList.contains('easm-ui-collapsible-chevron'));
  check('Button loading uses the approved shared spinner',ssr(h(UI.Button,{loading:true},'Save')).includes('data-icon="spinner"'));
  let finish;
  Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>new Promise(resolve=>finish=resolve)},configurable:true});
  await render(h(UI.CopyControl,{text:'old'})); await click(host.querySelector('button')); await rerender(h(UI.CopyControl,{text:'new'})); await act(async()=>finish()); check('Copy completion cannot report stale text as copied',!host.querySelector('[role=status]')?.textContent.includes('Copied'));
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('Denied');}},configurable:true}); await render(h(UI.CopyControl,{text:'reference'})); await click(host.querySelector('button')); check('Clipboard rejection yields an actionable message',host.textContent.includes('Copy failed. Select the text and copy it manually.'));
  await unmount();
  const overlayTest=path.join(root,'qa/verify-overlay-feedback.cjs');
  if(!fs.existsSync(overlayTest)) throw new Error('Overlay/feedback verification is required.');
  const extra=await require(overlayTest).run({UI,React,render,unmount,act,document,click,key,ssr}); checks.push(...extra);
  const inputTest=path.join(root,'qa/verify-inputs.cjs');
  if(!fs.existsSync(inputTest))throw new Error('Input verification is required.');
  checks.push(...await require(inputTest).run({UI,React,render,unmount,act,document,click,key,ssr}));
  checks.push(...await require(path.join(root,'qa/verify-additional.cjs')).run({UI,React,render,rerender,unmount,act,document,click,key,input,ssr}));
  checks.push(...await require(path.join(root,'qa/verify-identity.cjs')).run({UI,React,render,unmount,act,document,click,key,ssr}));
  await unmount();
  const cssFiles=fs.readdirSync(path.join(repo,'packages/ui/src')).filter(name=>name.endsWith('.css'));
  const css=cssFiles.map(file=>fs.readFileSync(path.join(repo,'packages/ui/src',file),'utf8')).join('\n');
  const defined=new Set([...css.matchAll(/(--easm-ui-[\w-]+)\s*:/g)].map(match=>match[1]));
  const used=new Set([...css.matchAll(/var\((--easm-ui-[\w-]+)/g)].map(match=>match[1]));
  check('Every referenced UI token is defined', [...used].every(token=>defined.has(token)));
  check('Reduced motion rules exist across interactive families', ['actions.css','selection.css','containers.css','overlays.css','feedback.css','inputs.css'].every(file=>fs.readFileSync(path.join(repo,'packages/ui/src',file),'utf8').includes('prefers-reduced-motion')));
  const luminance=hex=>{const values=hex.slice(1).match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return values[0]*.2126+values[1]*.7152+values[2]*.0722;};
  const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  // Read from the generated tokens so this follows tokens/easm.tokens.json (the full matrix lives in tokens/contrast.mjs).
  const C=UI.tokens.color;
  const pairs=[['primary fill',C.surface,C.primaryFill],['primary fill hover',C.surface,C.primaryFillHover],['primary text',C.primary,C.surface],['danger',C.surface,C.danger],['secondary text',C.textSecondary,C.surface],['placeholder',C.placeholder,C.surface],['success',C.success,C.successSurface],['warning',C.warning,C.warningSurface],['signature text','#161616',C.signature]];
  const contrasts=pairs.map(([role,foreground,background])=>({role,foreground,background,ratio:+contrast(foreground,background).toFixed(2)}));
  check('All enabled text pairs exceed 4.5:1',contrasts.every(pair=>pair.ratio>=4.5));
  // A selected item on an ink menu: on-ink text over the tint overlays.css mixes (and its no-color-mix fallback).
  const mix=(a,b,share)=>'#'+[0,1,2].map(i=>Math.round(parseInt(a.slice(1+2*i,3+2*i),16)*share+parseInt(b.slice(1+2*i,3+2*i),16)*(1-share)).toString(16).padStart(2,'0')).join('');
  const inkSelected=[mix(C.onInkBrand,C.inkPanel,.18),mix(C.onInkBrand,C.inkPanel,.28),C.inkPanelHover];
  check('Ink menu: the selected item stays readable (text 4.5:1, check 3:1), hovered or not',inkSelected.every(fill=>contrast(C.onInkStrong,fill)>=4.5&&contrast(C.onInkBrand,fill)>=3));
  check('Ink menu: the pale primary-surface highlight would have been unreadable under on-ink text',contrast(C.onInk,C.primarySurface)<3);
  const overlaysCss=fs.readFileSync(path.join(repo,'packages/ui/src/overlays.css'),'utf8');
  check('Ink menu: a selected item has its own ink rules (text, check and both tints)',
    /\[data-surface='ink'\] \.easm-ui-menu-item\[data-selected\] \{[^}]*color: var\(--easm-ui-on-ink-strong\)/.test(overlaysCss)
    && /\[data-surface='ink'\] \.easm-ui-menu-item\[data-selected\] \.easm-ui-menu-check \{ color: var\(--easm-ui-on-ink-brand\)/.test(overlaysCss)
    && /\[data-surface='ink'\] \.easm-ui-menu-item\[data-selected\] \{ background: color-mix\(in srgb, var\(--easm-ui-on-ink-brand\) 18%/.test(overlaysCss)
    && /\[data-surface='ink'\] \.easm-ui-menu-item\[data-selected\]\[data-highlighted\] \{ background: color-mix\(in srgb, var\(--easm-ui-on-ink-brand\) 28%/.test(overlaysCss));
  check('Control border exceeds 3:1 on white and on the page',contrast(C.border,C.surface)>=3&&contrast(C.border,C.background)>=3);
  const specPath=path.join(repo,'packages/ui/docs/component-specs.json');
  if(!fs.existsSync(specPath)) throw new Error('All component specifications must exist before release.');
  const rawSpecs=JSON.parse(fs.readFileSync(specPath,'utf8')); const specs=Array.isArray(rawSpecs)?rawSpecs:rawSpecs.components;
  const headings=['Purpose','Anatomy','Variants','Sizes','States','Color behavior','Icon behavior','Typography','Spacing','Borders & surfaces','Motion & micro-interactions','Accessibility','Responsive behavior','Content rules','Usage rules'];
  // ButtonLink: a Button's markup on an anchor, through the app's router link.
  const buttonLinkHtml = ssr(h(UI.ButtonLink, { href: '/inbox', variant: 'secondary', size: 'lg', leadingIcon: 'inbox', block: true }, 'Open inbox'));
  check('ButtonLink renders a Button-styled anchor', /^<a /.test(buttonLinkHtml) && buttonLinkHtml.includes('href="/inbox"') && buttonLinkHtml.includes('easm-ui-button')
    && buttonLinkHtml.includes('data-variant="secondary"') && buttonLinkHtml.includes('data-size="lg"') && buttonLinkHtml.includes('easm-ui-button-block') && buttonLinkHtml.includes('easm-ui-button-label'));
  let routedHref = null;
  const RouterLink = React.forwardRef((props, ref) => { routedHref = props.href; return h('a', { ...props, ref, 'data-router': '' }); });
  check('ButtonLink navigates through EasmUIProvider linkComponent', ssr(h(UI.EasmUIProvider, { linkComponent: RouterLink }, h(UI.ButtonLink, { href: '/settings' }, 'Settings'))).includes('data-router') && routedHref === '/settings');
  assert.throws(() => ssr(h(UI.ButtonLink, { href: '/inbox' }, ''))); checks.push('ButtonLink: blank label rejected');
  // Overlays render at the end of <body>; they take the direction and language of the place they open from.
  document.documentElement.setAttribute('dir', 'rtl'); document.documentElement.lang = 'ur';
  await render(h('div', { dir: 'ltr', lang: 'en' }, h(UI.Drawer, { title: 'Choose a surah', side: 'start', trigger: h(UI.Button, null, 'Open') }, h('p', null, 'Surahs'))));
  await click(host.querySelector('button'));
  const openedDrawer = document.querySelector('.easm-ui-drawer');
  check('A drawer opened from an English region of an Urdu page is left-to-right and English', openedDrawer?.getAttribute('dir') === 'ltr' && openedDrawer?.getAttribute('lang') === 'en');
  function OpenedFromCode() {
    const [open, setOpen] = React.useState(false);
    return h('div', null, h('div', { dir: 'ltr', lang: 'en' }, h('button', { type: 'button', onClick: () => setOpen(true) }, 'Surahs')),
      h(UI.Drawer, { title: 'Choose a surah', open, onOpenChange: setOpen, side: 'start' }, h('p', null, 'Surahs')));
  }
  await render(h(OpenedFromCode));
  await click(host.querySelector('button'));
  const codeDrawer = document.querySelector('.easm-ui-drawer');
  check('A drawer opened from code takes the region of the button pressed, focused or not', codeDrawer?.getAttribute('dir') === 'ltr' && codeDrawer?.getAttribute('lang') === 'en');
  await render(h(UI.Drawer, { title: 'Menu', open: true, dir: 'ltr' }, h('p', null, 'Places')));
  check('A drawer dir overrides the place it opened from', document.querySelector('.easm-ui-drawer')?.getAttribute('dir') === 'ltr');
  await render(h(UI.Select, { label: 'Translation', options: opts }));
  check('A select in a right-to-left page reads right-to-left (Radix defaulted to left-to-right)', host.querySelector('[role="combobox"]')?.getAttribute('dir') === 'rtl');
  await render(h('div', { dir: 'ltr', lang: 'en' }, h(UI.DropdownMenu, { trigger, items: [{ id: 'edit', label: 'Edit' }], open: true })));
  const openedMenu = document.querySelector('[role="menu"]');
  check('A menu takes the direction and language of its trigger region', openedMenu?.getAttribute('dir') === 'ltr' && openedMenu?.getAttribute('lang') === 'en');
  await unmount(); document.documentElement.removeAttribute('dir'); document.documentElement.lang = 'en';
  check('All 47 components have the exact 15 requested specification sections',UI.componentNames.every(name=>{const spec=specs.find(item=>item.name===name);return spec && headings.every(heading=>spec.sections?.[heading] && String(spec.sections[heading]).trim());}));
  // No package version here: it changes with every release and would leave CI's tree dirty.
  const report={components:47,sourceRenders:renders,checks:checks.length,passed:checks,contrasts,issues:[],scope:'SSR, DOM unit behavior, token/motion/specification contracts; real browser checks are recorded separately.'};
  fs.writeFileSync(path.join(root,'qa/report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`PASS: ${renders} SSR renders, ${checks.length} assertions, 47 components, complete 15-part specifications.`);
  dom.window.close();
}
main().catch(error=>{console.error(error);process.exit(1)});
