// Hand-written exports of @easm-ui/icons. index.ts is generated: it re-exports this file whole and adds one
// line per icon, so regenerating the icon library never drops what is declared here. Add new modules here.
export { AnimatedIcon } from './AnimatedIcon';
export type { AnimatedIconProps } from './AnimatedIcon';
export { MotionIcon } from './MotionIcon';
export type { MotionIconProps } from './MotionIcon';
export { iconMotionRecipes, motionIconNames, getIconMotion, isMotionIconName } from './motion-recipes';
export type { MotionIconName } from './motion-recipes';
export type { IconMotionRecipe, IconMotionPart } from './motion-parts';
export { motionPresets } from './motion';
export type { MotionPreset } from './motion';
export { Icon } from './Icon';
export type { NamedIconProps } from './Icon';
export { IconButton } from './IconButton';
export type { IconButtonProps } from './IconButton';
export { createIcon } from './core';
export type { IconProps, IconState, IconTone, IconDefinition, IconNode } from './core';
// Names come from the light registry module; search metadata and legacy aliases stay in ./data, so an app
// that renders or validates names does not ship them.
export { iconNames, isIconName } from './registry';
export type { IconName } from './registry';
export { preferredIconNames, getIconMetadata, resolveLegacyIcon } from './data';
export { BrandIcon, brandIcons, brandIconNames, isBrandIconName } from './BrandIcon';
export type { BrandIconName, BrandIconProps, BrandIconAppearance, BrandIconCategory, BrandIconDefinition } from './BrandIcon';
// Where the apps' own pictures went (2026-11-11): the Ask board's widget icons and the public form's question and
// welcome pictures, each id mapped to its library drawing.
export { WIDGET_ICON_NAMES, widgetIconName } from './widget-icons';
export type { WidgetIconId } from './widget-icons';
export { FORM_FIELD_ICON_NAMES, FORM_TOPIC_ICON_NAMES, formFieldIconName } from './form-icons';
export type { FormFieldKind, FormTopic } from './form-icons';
