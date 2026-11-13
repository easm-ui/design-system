// One pair of persistent, visually hidden live regions for the document. A live region is announced only
// when its text changes after it is in the page, and a status inside a button is not exposed at all (a
// button's children are presentational), so feedback is announced from here instead.
type Politeness = 'polite' | 'assertive';
let regions: Record<Politeness, HTMLElement> | undefined;

function hidden(element: HTMLElement) {
  Object.assign(element.style, {
    position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px',
    overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: '0',
  });
  return element;
}

/** Creates the regions once; call it on mount so they exist before the first message. */
export function ensureLiveRegions() {
  if (regions?.polite.isConnected || typeof document === 'undefined' || !document.body) return regions;
  const container = hidden(document.createElement('div'));
  container.setAttribute('data-easm-icon-announcer', '');
  const polite = document.createElement('div');
  polite.setAttribute('role', 'status');
  polite.setAttribute('aria-live', 'polite');
  polite.setAttribute('aria-atomic', 'true');
  const assertive = document.createElement('div');
  assertive.setAttribute('role', 'alert');
  assertive.setAttribute('aria-live', 'assertive');
  assertive.setAttribute('aria-atomic', 'true');
  container.append(polite, assertive);
  document.body.append(container);
  regions = { polite, assertive };
  return regions;
}

/** Announces a message; the same message twice in a row is announced twice. */
export function announce(message: string, politeness: Politeness = 'polite') {
  const region = ensureLiveRegions()?.[politeness];
  if (!region) return;
  region.textContent = '';
  setTimeout(() => { region.textContent = message; }, 100);
}
