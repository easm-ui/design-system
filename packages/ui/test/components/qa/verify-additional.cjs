const assert = require('node:assert/strict');

exports.run = async function ({ UI, React, render, rerender, unmount, act, document, click, input, ssr }) {
  const h = React.createElement, checks = [];
  const check = (name, result) => { assert.ok(result, name); checks.push(name); };
  let host = await render(h(UI.PasswordField, { label: 'Password', defaultValue: 'Example-only-42' }));
  let control = host.querySelector('input');
  check('Password starts masked with a named visibility control', control.type === 'password' && host.querySelector('button').getAttribute('aria-label') === 'Show password');
  control.focus(); control.setSelectionRange(2, 7);
  await click(host.querySelector('button'));
  check('Password visibility preserves value, selection and input focus', control.type === 'text' && control.value === 'Example-only-42' && control.selectionStart === 2 && control.selectionEnd === 7 && document.activeElement === control);
  check('Password reveal exposes pressed state and connected field', host.querySelector('button').getAttribute('aria-pressed') === 'true' && host.querySelector('button').getAttribute('aria-controls') === control.id);
  await click(host.querySelector('button'));
  check('Password can be hidden without changing the value', control.type === 'password' && control.value === 'Example-only-42');
  await rerender(h(UI.PasswordField, { label: 'Password', disabled: true }));
  check('Disabled password masks content and blocks visibility', control.type === 'password' && host.querySelector('button').disabled);
  check('Non-revealable password has no hidden alternative action', !ssr(h(UI.PasswordField, { label: 'Password', revealable: false })).includes('<button'));
  host = await render(h('form', null, h(UI.PasswordField, { label: 'Password', name: 'password', defaultValue: 'Reset-only-42' })));
  await click(host.querySelector('button'));
  await act(async () => host.querySelector('form').reset());
  check('Password form reset remasks the value', host.querySelector('input').type === 'password');
  let proposal;
  host = await render(h(UI.NumberField, { label: 'Capacity', defaultValue: 0, min: 0, max: 1, step: 0.1, onValueChange: value => { proposal = value; } }));
  control = host.querySelector('input');
  check('Number uses native spinbutton constraints with complete branded controls', control.type === 'number' && control.min === '0' && control.max === '1' && control.step === '0.1' && host.querySelectorAll('button').length === 2);
  check('Number decrease is unavailable at minimum', host.querySelector('[aria-label="Decrease Capacity"]').disabled);
  await click(host.querySelector('[aria-label="Increase Capacity"]'));
  await click(host.querySelector('[aria-label="Increase Capacity"]'));
  await click(host.querySelector('[aria-label="Increase Capacity"]'));
  check('Number native fractional stepping avoids arithmetic drift', control.value === '0.3' && proposal === 0.3);
  check('Number stepping preserves input focus', document.activeElement === control);
  await input(control, '1');
  check('Number upper bound disables further increase', host.querySelector('[aria-label="Increase Capacity"]').disabled);
  await input(control, '');
  check('Empty numeric editing reports null instead of NaN', proposal === null);
  host = await render(h(UI.NumberField, { label: 'Capacity', value: 2, step: 1, onValueChange: value => { proposal = value; } }));
  await click(host.querySelector('[aria-label="Increase Capacity"]'));
  check('Rejected controlled numeric proposal does not change committed display', proposal === 3 && host.querySelector('input').value === '2');
  check('Any-step input keeps free numeric editing and disables artificial stepping', ssr(h(UI.NumberField, { label: 'Capacity', step: 'any' })).match(/disabled=""/g)?.length === 2);
  check('Read-only numeric controls prevent mutation while preserving native value', ssr(h(UI.NumberField, { label: 'Capacity', readOnly: true, defaultValue: 4 })).includes('readOnly=""'));
  host = await render(h('form', null, h(UI.NumberField, { label: 'Capacity', name: 'capacity', defaultValue: 2 })));
  await click(host.querySelector('[aria-label="Increase Capacity"]'));
  await act(async () => host.querySelector('form').reset());
  check('Number form reset restores default native value and controls', host.querySelector('input').value === '2');
  for (const props of [{ min: 5, max: 2 }, { step: 0 }, { step: -1 }, { value: Infinity }, { min: NaN }]) {
    let rejected = false; try { ssr(h(UI.NumberField, { label: 'Quantity', ...props })); } catch { rejected = true; }
    check(`Invalid numeric contract rejected: ${Object.keys(props).join('/')}`, rejected);
  }
  for (const tone of ['error', 'success', 'info']) for (const appearance of ['plain', 'surface']) for (const live of ['off', 'polite', 'assertive']) {
    const html = ssr(h(UI.InlineValidation, { tone, appearance, live, id: 'validation' }, 'Choose an available agent.'));
    check(`InlineValidation ${tone}/${appearance}/${live}`, html.includes(`data-tone="${tone}"`) && html.includes(`data-appearance="${appearance}"`) && (live === 'off' ? !html.includes('aria-live') : html.includes(`aria-live="${live}"`) && html.includes(live === 'polite' ? 'role="status"' : 'role="alert"')) && html.includes('aria-hidden="true"'));
  }
  let emptyRejected = false; try { ssr(h(UI.InlineValidation, null, ' ')); } catch { emptyRejected = true; }
  check('Inline validation rejects empty feedback', emptyRejected);
  await unmount();
  return checks;
};
