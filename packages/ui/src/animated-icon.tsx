'use client';

import { lazy, Suspense, type ComponentProps } from 'react';
import type { AnimatedIconProps, IconName } from '@easm-ui/icons';
import { Icon } from '@easm-ui/icons/icon';

// The motion system (every icon's motion recipe) is large and only a toast's tick and the ring spinner use it here,
// so it loads on first use instead of shipping with every component.
const AnimatedIcon = lazy(() => import('@easm-ui/icons/animated').then((module) => ({ default: module.AnimatedIcon })));

/** AnimatedIcon, fetched on demand. Until it arrives the same pictogram is drawn with the preset's CSS effect, so a
 *  spinner already spins and a tick sits in place: nothing shifts when the motion version takes over. */
export function LazyAnimatedIcon({ icon, effect, ...props }: AnimatedIconProps & { icon: IconName; effect: string }) {
  const { preset: _preset, active, repeat, ...iconProps } = props;
  const fallback = <Icon {...(iconProps as Omit<ComponentProps<typeof Icon>, 'name'>)} name={icon} data-motion={effect}
    data-active={active || undefined} data-repeat={repeat || undefined} />;
  return <Suspense fallback={fallback}><AnimatedIcon {...props} /></Suspense>;
}
