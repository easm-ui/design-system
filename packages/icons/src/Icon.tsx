import { forwardRef, useId } from 'react';
import { renderIcon, type IconProps } from './core';
import { geometry, type IconName } from './registry';

export interface NamedIconProps extends IconProps { name: IconName }

declare const process: { env: { NODE_ENV?: string } };
function isProduction() {
  // Bundlers replace process.env.NODE_ENV; without one (a plain browser ESM import) this throws and the
  // development behaviour applies.
  try { return process.env.NODE_ENV === 'production'; } catch { return false; }
}
const reported = new Set<string>();

/** Renders any id by name. It reads only the geometry registry (id -> drawing): no search metadata or
 * legacy aliases. Individual exports and @easm-ui/icons/icons/<id> modules are smaller still.
 * An unknown name throws in development; in production it is logged once and renders an empty box of
 * the requested size, so a bad name from data does not take the page down. Validate data with isIconName. */
export const Icon = forwardRef<SVGSVGElement, NamedIconProps>(function Icon({ name, ...props }, ref) {
  const instance = useId();
  if (Object.hasOwn(geometry, name)) return renderIcon(name, geometry[name], props, ref, undefined, instance);
  if (!isProduction()) throw new Error(`Unknown EASM icon: ${name}`);
  const key = String(name);
  if (!reported.has(key)) {
    reported.add(key);
    console.error(`Unknown EASM icon: ${key}`);
  }
  return renderIcon(key, [], props, ref, undefined, instance);
});
