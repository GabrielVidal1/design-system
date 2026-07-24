import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind class names, resolving conflicts (last wins).
 *
 * @summary The `clsx` + `tailwind-merge` class-name helper every component
 * uses.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
