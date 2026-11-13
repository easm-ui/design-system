import { forwardRef } from 'react';
import { Icon } from './Icon';
import type { IconProps } from './core';
import { motionPresets, type MotionPreset } from './motion';
import { MotionIcon } from './MotionIcon';
import { getIconMotion } from './motion-recipes';

export interface AnimatedIconProps extends IconProps {
  preset: MotionPreset;
  /** False is a static, fully recognizable pictogram. */
  active?: boolean;
  /** Only progress, listening and audio activity may repeat. */
  repeat?: boolean;
}

/** Remount or toggle active after an event to replay one-shot motion. */
export const AnimatedIcon = forwardRef<SVGSVGElement, AnimatedIconProps>(function AnimatedIcon(
  { preset, active = false, repeat = false, ...props }, ref,
) {
  // Own presets only: inherited names such as toString are not presets.
  if (!Object.hasOwn(motionPresets, preset)) throw new Error(`Unknown EASM motion preset: ${preset}`);
  const spec = motionPresets[preset];
  if (repeat && !spec.loopAllowed) throw new Error(`Motion preset ${preset} does not permit looping`);
  if (getIconMotion(spec.icon)) return <MotionIcon {...props} ref={ref} name={spec.icon}
    active={active} repeat={repeat} data-preset={preset} />;
  return <Icon {...props} ref={ref} name={spec.icon} data-motion={spec.effect}
    data-active={active || undefined} data-repeat={repeat || undefined} />;
});
