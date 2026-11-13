import { directedMotionRecipes } from './motion-directed';
import type { IconMotionRecipe } from './motion-parts';
import { geometry, type IconName, type GeometryNode } from './registry';

/** The curated, individually directed motions. Artwork and historical SVG exports remain unchanged. */
export const iconMotionRecipes = directedMotionRecipes;
export type MotionIconName = IconName;
export const motionIconNames = iconMotionRecipes.map(recipe => recipe.name) as readonly MotionIconName[];

const recipesByDrawing = new Map<readonly GeometryNode[], IconMotionRecipe>(
  iconMotionRecipes.map(recipe => [geometry[recipe.name], recipe]),
);

/** Compatibility IDs sharing the same drawing share its directed motion, without importing search data. */
export function getIconMotion(name: string): IconMotionRecipe | undefined {
  return Object.hasOwn(geometry, name) ? recipesByDrawing.get(geometry[name as IconName]) : undefined;
}

export function isMotionIconName(name: string): name is MotionIconName {
  return motionIconNames.includes(name as MotionIconName);
}
