'use client';

import { useEffect, useState, type ComponentType } from 'react';
import type { IconProps, MotionIconProps } from '@easm-ui/icons';
import { UIIcon, type UIIconName } from './shared';

// Every icon's directed motion is a large module, so a control draws its static icon first and fetches the motion
// system once, when the page is idle after the first such icon mounts. One fetch serves every control after it.
type Motion = ComponentType<MotionIconProps>;
let ready: Motion | undefined;
let pending: Promise<Motion> | undefined;
const loadMotion = () => pending ??= import('@easm-ui/icons/motion-icon').then(module => (ready = module.MotionIcon));

/** A control's icon (a button's, an icon button's). At rest it is exactly UIIcon; once the motion system has loaded
 *  it plays its directed motion as a hint when the control is hovered with a mouse or focused from the keyboard
 *  (never on touch, never when reduced motion is set or the control is disabled). The resting motion drawing is
 *  pixel-identical to the static one, so nothing shifts when it takes over. */
export function ControlIcon({ size = 20, tone = 'inherit', outline = true, ...props }: IconProps & { name: UIIconName }) {
  // Starts empty on every render path (including hydration), so the server's static icon always matches.
  const [MotionIcon, setMotionIcon] = useState<Motion | undefined>(undefined);
  useEffect(() => {
    let live = true;
    if (ready) { setMotionIcon(() => ready); return; }
    const idle: (callback: () => void) => unknown = window.requestIdleCallback ?? (callback => window.setTimeout(callback, 200));
    idle(() => { loadMotion().then(loaded => { if (live) setMotionIcon(() => loaded); }, () => undefined); });
    return () => { live = false; };
  }, []);
  return MotionIcon
    ? <MotionIcon {...props} size={size} tone={tone} outline={outline} trigger="interaction" className={['easm-ui-icon', props.className].filter(Boolean).join(' ')} />
    : <UIIcon {...props} size={size} tone={tone} outline={outline} />;
}
