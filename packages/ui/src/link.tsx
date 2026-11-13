'use client';

import { createContext, forwardRef, useContext, type AnchorHTMLAttributes, type ComponentType, type ReactNode, type Ref } from 'react';

/** Any router link that takes `href` and renders an `<a>`: Next.js `Link`, a wrapped React Router `Link`, or a plain anchor. */
export type EasmLinkComponent = ComponentType<AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; ref?: Ref<HTMLAnchorElement> }>;

const LinkContext = createContext<EasmLinkComponent | null>(null);

export interface EasmUIProviderProps {
  /** The app's router link. Every EASM UI component that navigates (Sidebar, Breadcrumbs, SettingsNav, search results,
   * conversation and lead links, bar-list and cell links) renders through it, so navigation stays client-side. */
  linkComponent?: EasmLinkComponent;
  children: ReactNode;
}

/** App-wide settings for EASM UI. Mount once at the root, e.g. `<EasmUIProvider linkComponent={Link}>` in a Next.js
 * client layout. Without it, links are plain `<a>` elements and every navigation is a full page load. */
export function EasmUIProvider({ linkComponent, children }: EasmUIProviderProps) {
  return <LinkContext.Provider value={linkComponent ?? null}>{children}</LinkContext.Provider>;
}

/** The router link set by `EasmUIProvider`, or null when the app has none. */
export function useEasmLink() {
  return useContext(LinkContext);
}

export interface EasmLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> { href: string }

/** The anchor every EASM UI component renders for navigation: the app's router link when one is provided, `<a>` otherwise. */
export const EasmLink = forwardRef<HTMLAnchorElement, EasmLinkProps>(function EasmLink(props, ref) {
  const Component = useContext(LinkContext);
  return Component ? <Component ref={ref} {...props} /> : <a ref={ref} {...props} />;
});
