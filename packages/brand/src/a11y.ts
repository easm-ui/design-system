// One naming rule for every brand component: a name makes the svg an image with that name; an empty name ('') makes
// it decorative (hidden from assistive technology, no role), for when text beside it already says the same thing.

export interface ImageNameAttrs { role?: 'img'; 'aria-label'?: string; 'aria-hidden'?: true }

export function imageName(name: string | null | undefined): ImageNameAttrs {
  return name ? { role: 'img', 'aria-label': name } : { 'aria-hidden': true };
}
