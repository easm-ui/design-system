// Values placed into SVG markup strings (colours, labels) are escaped, so a colour or name that comes from
// configuration (a tenant's widget colour, a future product name) can never break out of its attribute.

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes text for an XML/HTML attribute value or text node. Ordinary values (#FF6A00, currentColor) are unchanged. */
export const escapeMarkup = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ENTITIES[c]);
